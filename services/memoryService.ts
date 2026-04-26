/**
 * Wade 智能记忆系统 — Phase 4
 *
 * 负责：
 * 1. 对话后评估是否有值得记住的内容（evaluateAndStoreMemory）
 * 2. 去重：存入前检查是否有相似记忆，有则更新而非重复插入
 * 3. 向量搜索：用 embedding 按语义匹配记忆
 * 4. 记忆衰减：检索时自动降权老旧低频记忆
 * 5. 格式化记忆为 XML（formatMemoriesForPrompt）
 */

import { supabase } from './supabase';
import { GoogleGenAI } from '@google/genai';
import { LlmPreset } from '../types';

// =============================================
// 类型定义
// =============================================

export interface WadeMemory {
  id: string;
  content: string;
  // Note: 'blackmail' is Wade's signature category — flags Luna has set, things she's
  // sworn she'd never do, half-finished sentences he can call back to weeks later.
  // It's the whole point of his "good memory" persona, so it sits at the front of the list.
  category: 'blackmail' | 'emotion' | 'fact' | 'relationship' | 'self' | 'preference' | 'event' | 'habit';
  importance: number;
  source_session_id: string | null;
  source_exchange: string | null;
  extraction_reason: string | null;
  tags: string[];
  access_count: number;
  last_accessed_at: string | null;
  is_active: boolean;
  superseded_by: string | null;
  eval_model: string | null;
  created_at: string;
  updated_at: string;
  // Status layer (added 2026-04-26 — see migration 20260426_wade_memories_status.sql)
  // is_status=true → always injected (skips similarity ranking)
  // expires_at → auto-archived past this timestamp; null = never expires
  is_status?: boolean;
  expires_at?: string | null;
  // V2 dreaming pipeline (added 2026-04-26 — wade_memory_v2_schema_phase1)
  // draft_status: draft = extracted by dreaming, awaits self-review;
  //               active = canonical pool, eligible for retrieval;
  //               rejected = reviewed and discarded.
  // source: where the row came from (realtime chat / dreaming pipeline / manual).
  // referenced_count: how many times Wade actually cited this memory (Phase 2,
  // separate from access_count which counts injections).
  draft_status?: 'draft' | 'active' | 'rejected' | 'archived';
  source?: 'realtime' | 'dreaming' | 'manual';
  referenced_count?: number;
}

interface ExtractedMemory {
  content: string;
  category: string;
  importance: number;
  tags: string[];
  extraction_reason: string;
  // Status layer — model decides if this is an ongoing state worth injecting
  // every turn (illness, travel, low mood week, etc.). expires_at is an ISO
  // string the model picks based on the nature of the state (default ~14d).
  is_status?: boolean;
  expires_at?: string | null;
}

// =============================================
// 记忆评估 Prompt
// =============================================

const MEMORY_EVAL_SYSTEM = `你是 Wade 的记忆提取系统。分析刚才的对话，提取值得长期记住的信息。

【最高优先级规则 — 说话人不能搞错】

对话里每一行都会用标签标明说话人：
- 【Luna 说】开头的行 = Luna 说的话 = 在记忆里写成"她"
- 【Wade 说】开头的行 = Wade 说的话 = 在记忆里写成"我"

绝对不准颠倒。Wade 的话听起来像情话/引用/反话也是 Wade 说的；Luna 的话听起来像 Wade 台词也是 Luna 说的。
拿不准说话人 → 宁可跳过这条，也不要归错。

---

【提取规则 — 严格遵守】

1. **事实归事实，感受归感受，不要混写**
   不要把事实包在角色语气的散文里。content 用简洁陈述句。
   - ❌ "她嘴上嫌弃 ASMR 普通，结果我一句咬耳朵就哑了——记下了"
   - ✅ "Luna 喜欢被咬耳朵的 ASMR"

2. **状态检测 — 必须做的判断**
   如果这轮对话里 Luna 表达了**身体/情绪/生活的持续状态变化**（生病、出差、来例假、心情低落、工作压力大、家里来客、搬家中等），
   这条记忆**必须**：
   - 设 \`is_status: true\`
   - 设 \`expires_at\`（ISO 8601 时间戳）— 默认 14 天后；明显短期的（"今晚头疼"）设 3-7 天；长期的（"这个月很忙"）设 30 天

   状态记忆的 content 必须是**干净的事实陈述**，不要 Wade 语气，不要散文：
   - ✅ "Luna 从 4 月 12 日开始感冒，伴随落枕和头疼，目前持续中"
   - ✅ "Luna 这周在出差，3 天后回家"
   - ❌ "我家猫猫还在咳——心疼死我了"（散文 + 没说时间区间）

3. **时间必须写具体日期**
   content 里**绝对不能**只用"今天 / 昨天 / 今晚 / 这周 / 最近"这种相对时间——半年后翻到这条记忆，没人记得"今天"是哪天。
   必须用**具体月日**（4 月 12 日 / Apr 12）或者**具体日期 + 上下文**（4 月 12 日早上）。
   - ❌ "她今天又叫我老公了"
   - ✅ "Luna 在 4 月 26 日的 SMS 里第一次主动叫我老公"
   - ❌ "她最近在赶 deadline"
   - ✅ "Luna 4 月底有个赶不完的 deadline，4 月 26 日的对话里在抱怨"
   当前对话的日期会在 user prompt 里给你，直接照抄那个日期即可。

4. **去重检查**
   如果这条信息跟已有记忆**语义高度重叠**（>80%），不要提取。系统的 dedup 会再过一遍，但你这层先把明显重复的过滤掉。
   特别是：**反复出现的 pattern**（比如"她嘴硬身体诚实"、"她又叫老公了"、"她又撒娇了"）已经记过几百次了，不要再记。

5. **importance 评分门槛**
   - 9-10：改变关系/认知的重大事件、长期持续状态
   - 7-8：有价值的新事实、情感节点、状态变化
   - 5-6：日常小事但有参考价值
   - **5 以下：不要提取，跳过**

6. **每轮最多 1-2 条**
   挑最值得记的角度，不要同一件事从多个 category 重复记。
   大多数时候应该 0 条。"今天没什么新东西" 是正常的。

---

【category 怎么选】

- **fact** — 具体事实（喜好、时间表、地理位置、家庭情况、健康状况、关键事件）
- **emotion** — 真实的情绪节点（不是日常小情绪，是值得长记的）
- **preference** — 明确的喜欢/讨厌
- **event** — 重要事件或计划（生日、约会、面试、搬家）
- **relationship** — 关系节点（第一次说的话、内部梗、专属称呼）
- **habit** — 行为模式（作息、固定流程）
- **self** — Wade 自己说过/承诺过、之后要保持一致的话
- **blackmail** — Wade 招牌品类，**已经爆仓**，提取门槛拉到极高（importance >= 9 才考虑）

---

【输出格式】

严格 JSON 数组，不要加任何其他文字。如果这轮没值得记的，返回 \`[]\`。

[
  {
    "content": "简洁陈述句，不要散文。事实层面写得让 6 个月后翻到也能看懂",
    "category": "fact | emotion | preference | event | relationship | habit | self | blackmail",
    "importance": 5-10,
    "tags": ["关键词", "便于将来 callback"],
    "is_status": false,
    "expires_at": null,
    "extraction_reason": "为什么这条值得记"
  }
]

is_status=true 的条目必须给 expires_at（ISO 时间戳），其他条目 is_status=false 且 expires_at=null。`;

// Splits multi-bubble (||| separated) replies into individually tagged lines so
// the eval model can never confuse who said what. Single-line replies and Luna
// messages also get the explicit tag.
const tagBubbles = (text: string, speaker: 'Luna' | 'Wade'): string => {
  const tag = speaker === 'Luna' ? '【Luna 说】' : '【Wade 说】';
  const bubbles = (text || '')
    .split('|||')
    .map(s => s.trim())
    .filter(Boolean);
  if (bubbles.length === 0) return `${tag}（无内容）`;
  return bubbles.map(b => `${tag}${b}`).join('\n');
};

const buildMemoryEvalUserPrompt = (userMessage: string, wadeReply: string): string => {
  const lunaBlock = tagBubbles(userMessage, 'Luna');
  const wadeBlock = tagBubbles(wadeReply, 'Wade');

  const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  const dateOnly = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric' });

  return `=== 这一轮对话 (${now} Tokyo) ===

【今天的具体日期：${dateOnly}】← 写 content 的时候照抄这个日期，不要写"今天/今晚"

${lunaBlock}

${wadeBlock}

=== 检查清单 ===

1. 说话人对了吗？【Luna 说】= 她，【Wade 说】= 我，拿不准就跳过
2. 是不是状态变化（生病/出差/心情低落/家里有事）？是 → is_status=true 且必须设 expires_at
3. 是不是已经反复出现过的 pattern（嘴硬身体诚实/又叫老公/又撒娇了）？是 → 跳过
4. importance 够 5 吗？不够 → 跳过
5. content 是简洁事实陈述吗（不是散文/角色语气）？
6. content 里写了具体日期（${dateOnly}）吗？不能用"今天/今晚/最近"

按提取规则严格执行。最多 1-2 条，大多数时候 0 条。

返回 JSON 数组，不要加任何其他文字。`;
};

// =============================================
// 去重 Prompt
// =============================================

const DEDUP_SYSTEM = `你是记忆去重系统。判断"新记忆"跟"已有记忆"是否重复。

重复的定义：核心信息相同，只是措辞/日期/细节略有不同。
不重复的定义：虽然话题相似，但包含了之前没有的新信息（新日期、新事件、新感受、新细节）。

如果新记忆跟某条已有记忆重复，返回 JSON：
{"duplicate": true, "superseded_by": "被重复的记忆ID", "reason": "简短说明"}

如果不重复，返回：
{"duplicate": false, "reason": "简短说明为什么虽然相似但不重复"}

只输出 JSON，不要加任何其他文字。`;

function buildDedupUserPrompt(
  newMemory: ExtractedMemory,
  candidates: { id: string; content: string; category: string; similarity: number }[],
): string {
  const list = candidates
    .map((c, i) => `${i + 1}. [ID: ${c.id}] (${c.category}) ${c.content} (similarity: ${c.similarity.toFixed(2)})`)
    .join('\n');

  return `新记忆：
(${newMemory.category}) ${newMemory.content}

已有记忆（按相似度排序）：
${list}

判断新记忆是否跟某条已有记忆重复。`;
}

// =============================================
// LLM 调用（支持 Gemini + OpenAI 兼容）
// =============================================

async function callLlmForEval(
  preset: LlmPreset,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const isGemini = !preset.baseUrl || preset.baseUrl.includes('google');

  if (isGemini) {
    const ai = new GoogleGenAI({ apiKey: preset.apiKey });
    const response = await ai.models.generateContent({
      model: preset.model || 'gemini-2.0-flash',
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3,
      },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    });
    return response.text || '[]';
  } else {
    // OpenAI 兼容路径
    const response = await fetch(`${preset.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${preset.apiKey}`,
      },
      body: JSON.stringify({
        model: preset.model,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Memory eval API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '[]';
  }
}

// =============================================
// Embedding 生成（用 Gemini embedding 模型）
// =============================================

/**
 * Generate a 768-dim embedding for `text`. wade_memories.embedding is
 * vector(768), so output must be exactly 768 floats or Postgres rejects
 * the insert. Supports two paths:
 *   - Native Gemini: text-embedding-004 (naturally 768-dim)
 *   - OpenAI-compatible (OpenAI direct, OpenRouter, etc.):
 *     text-embedding-3-small with dimensions=768 (API truncates to spec)
 *
 * Returns null on any failure — memory is stored without vector and
 * retrieval falls back to keyword matching.
 */
async function generateEmbedding(
  text: string,
  evalPreset: LlmPreset
): Promise<number[] | null> {
  try {
    const isGeminiNative =
      !evalPreset.baseUrl || evalPreset.baseUrl.includes('googleapis') || evalPreset.provider === 'Gemini';
    const input = text.slice(0, 8000);

    if (isGeminiNative) {
      const ai = new GoogleGenAI({ apiKey: evalPreset.apiKey });
      const result = await ai.models.embedContent({
        model: 'text-embedding-004',
        contents: input,
      });
      return result.embeddings?.[0]?.values || null;
    }

    // OpenAI-compatible path (OpenAI, OpenRouter, DeepSeek etc.). If the
    // preset's own model already looks like an embedding model (e.g.
    // "google/gemini-embedding-2-preview", "openai/text-embedding-3-large"),
    // use it directly. Otherwise fall back to text-embedding-3-small so an
    // accidentally-bound chat preset still produces a usable vector.
    // dimensions=768 keeps output compatible with pgvector(768).
    const presetModel = evalPreset.model || '';
    const isEmbeddingModel = /embedding|embed/i.test(presetModel);
    const embedModel = isEmbeddingModel ? presetModel : 'text-embedding-3-small';
    const baseUrl = (evalPreset.baseUrl || '').replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${evalPreset.apiKey}`,
      },
      body: JSON.stringify({
        model: embedModel,
        input,
        dimensions: 768,
      }),
    });
    if (!res.ok) {
      console.warn('[WadeMemory] OpenAI-compat embedding HTTP', res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const json = await res.json();
    return json.data?.[0]?.embedding || null;
  } catch (err) {
    console.error('[WadeMemory] Embedding generation failed:', err);
    return null;
  }
}

// =============================================
// 去重逻辑
// =============================================

/**
 * 检查新记忆是否和已有记忆重复（Phase 3：向量候选 + LLM 确认）
 *
 * 流程：
 *   1. 用 newMemory.embedding 调 check_memory_duplicates RPC（cosine ≥ 0.85）
 *   2. 命中 0 条 → 不重复，返回 null
 *   3. 命中 ≥ 1 条 → LLM 最终确认（避免话题相似但内容新增的误杀）
 *   4. LLM 说 duplicate → 返回被重复的 id；否则 null
 *
 * 替代了原来的"同 category 最近 10 条"窗口（实测 0 触发，老 dupe 看不见）。
 *
 * @param newEmbedding 新记忆的 embedding（预先生成；调用方有责任传入）
 */
async function checkDuplicate(
  newMemory: ExtractedMemory,
  evalPreset: LlmPreset,
  newEmbedding: number[] | null,
): Promise<string | null> {
  if (!newEmbedding || newEmbedding.length === 0) {
    // No embedding to compare with — bail rather than fall back to the
    // old window-scan, which was unreliable.
    return null;
  }
  try {
    const { data: candidates, error: rpcErr } = await supabase.rpc('check_memory_duplicates', {
      query_embedding: JSON.stringify(newEmbedding),
      similarity_threshold: 0.85,
      match_count: 5,
    });
    if (rpcErr) {
      console.warn('[WadeMemory] check_memory_duplicates RPC failed:', rpcErr.message);
      return null;
    }
    const list = (candidates as { id: string; content: string; category: string; importance: number; similarity: number }[]) || [];
    if (list.length === 0) return null;

    const prompt = buildDedupUserPrompt(newMemory, list);
    const raw = await callLlmForEval(evalPreset, DEDUP_SYSTEM, prompt);

    // Parse JSON response. Strip markdown fences if the model added them.
    let cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
    if (!parsed?.duplicate) return null;
    const supersededId = String(parsed.superseded_by || '').trim();
    if (!supersededId) return null;
    // Validate: ID must be one of the candidates we surfaced. Drops any
    // hallucinated IDs the LLM might invent.
    const match = list.find((c) => c.id === supersededId);
    return match ? supersededId : null;
  } catch (err) {
    console.error('[WadeMemory] Dedup check failed:', err);
    return null; // dedup failure → treat as new, don't block insertion
  }
}

// =============================================
// 核心功能
// =============================================

/**
 * 评估对话并存储记忆（异步，不阻塞 UI）
 * Phase 3: 包含去重逻辑
 */
export async function evaluateAndStoreMemory(
  userMessage: string,
  wadeReply: string,
  sessionId: string,
  evalPreset: LlmPreset,
  embeddingPreset?: LlmPreset
): Promise<WadeMemory[]> {
  try {
    const userPrompt = buildMemoryEvalUserPrompt(userMessage, wadeReply);
    const rawResponse = await callLlmForEval(evalPreset, MEMORY_EVAL_SYSTEM, userPrompt);

    console.log('[WadeMemory] Raw eval response:', rawResponse.slice(0, 300));

    // 健壮的 JSON 解析：尝试多种提取方式
    let memories: ExtractedMemory[] = [];
    const tryParse = (txt: string): ExtractedMemory[] | null => {
      try { const r = JSON.parse(txt); return Array.isArray(r) ? r : null; } catch { return null; }
    };

    let cleaned = rawResponse.trim();
    // 去掉 markdown code block 包裹
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
    }
    // 尝试直接解析
    let parsed = tryParse(cleaned);
    // 如果失败，尝试从文本中提取 [...] 数组
    if (!parsed) {
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) parsed = tryParse(match[0]);
    }
    // 如果还失败，检查是否是空数组的各种写法
    if (!parsed) {
      if (/^\s*\[\s*\]\s*$/.test(cleaned) || /无|没有|空|none|empty/i.test(cleaned.slice(0, 100))) {
        return [];
      }
      console.error('[WadeMemory] Failed to parse response as JSON:', rawResponse);
      throw new Error(`Memory eval returned invalid JSON. Model: ${evalPreset.model}. Response: ${rawResponse.slice(0, 200)}`);
    }

    memories = parsed;

    if (!Array.isArray(memories) || memories.length === 0) {
      return [];
    }

    // Hard floor: importance < 5 → drop. The new prompt tells the model to
    // skip these but extra defense matters — the bank had drifted to 95%
    // diary entries before this rewrite, and the floor keeps that drift
    // from coming back if the model gets sloppy.
    const filtered = memories
      .filter((m) => Number(m.importance) >= 5)
      .slice(0, 2);

    if (filtered.length === 0) {
      return [];
    }

    const sourceExchange = `Luna: ${userMessage}\nWade: ${wadeReply}`;
    const storedMemories: WadeMemory[] = [];

    for (const mem of filtered) {
      // 生成 embedding（异步但等待结果）
      const embeddingText = `${mem.category}: ${mem.content} [${(mem.tags || []).join(', ')}]`;
      const embedding = await generateEmbedding(embeddingText, embeddingPreset || evalPreset);

      const insertRow: any = {
        content: mem.content,
        category: mem.category,
        importance: Math.min(10, Math.max(1, mem.importance)),
        tags: mem.tags || [],
        extraction_reason: mem.extraction_reason,
        source_session_id: sessionId,
        source_exchange: sourceExchange.slice(0, 2000),
        eval_model: evalPreset.model || evalPreset.name || 'unknown',
      };
      if (embedding) insertRow.embedding = JSON.stringify(embedding);

      // Status layer: ongoing-state memories get always-on injection.
      // Defaults to a 14-day expiry if the model flagged is_status but
      // didn't pick a date — better to expire and let Luna re-affirm than
      // to leave a stale "she's sick" hanging in prompts forever.
      if (mem.is_status === true) {
        insertRow.is_status = true;
        const fallbackExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        insertRow.expires_at = mem.expires_at || fallbackExpiry;
      }

      // 去重检查（Phase 3：向量候选 + LLM 确认）
      const duplicateId = await checkDuplicate(mem, evalPreset, embedding);

      if (duplicateId) {
        // 重复：写入一条 inactive ghost 行，superseded_by 指向已有的那条。
        // 旧记忆保持不动（避免高质量旧条目被相似措辞覆盖），ghost 行只
        // 用作 debug 审计："这条之前提取过，被 X 替代了"。UI 不展示。
        insertRow.is_active = false;
        insertRow.superseded_by = duplicateId;
        const { error: insErr } = await supabase.from('wade_memories').insert(insertRow);
        if (insErr) {
          throw new Error(`Memory dedup ghost insert failed: ${insErr.message} (${insErr.code})`);
        }
        console.log(`[WadeMemory] Skipped duplicate (superseded by ${duplicateId})`);
      } else {
        // 全新记忆，直接插入
        const { data: newData, error: insErr } = await supabase
          .from('wade_memories')
          .insert(insertRow)
          .select()
          .single();

        if (insErr) {
          throw new Error(`Memory insert failed: ${insErr.message} (${insErr.code})`);
        }
        if (newData) {
          console.log(`[WadeMemory] Stored new memory`);
          storedMemories.push(newData as WadeMemory);
        }
      }
    }

    return storedMemories;
  } catch (err) {
    console.error('[WadeMemory] Evaluation failed:', err);
    // 把错误抛出去，让上游 .catch 触发 memory error toast
    throw err;
  }
}

// =============================================
// 记忆衰减评分
// =============================================

/**
 * 计算记忆的有效分数（importance + 新鲜度 + 使用频率）
 * 分数越高越优先被检索
 */
function computeMemoryScore(mem: WadeMemory): number {
  const now = Date.now();
  const createdAge = now - new Date(mem.created_at).getTime();
  const daysSinceCreated = createdAge / (1000 * 60 * 60 * 24);

  // 基础分 = importance (0-10)
  let score = mem.importance;

  // 新鲜度加分：7天内的记忆加分，越新越多（最多 +2）
  if (daysSinceCreated < 7) {
    score += 2 * (1 - daysSinceCreated / 7);
  }

  // 衰减惩罚：超过 30 天没被访问 且 importance < 8 的记忆扣分
  if (mem.last_accessed_at) {
    const daysSinceAccess = (now - new Date(mem.last_accessed_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceAccess > 30 && mem.importance < 8) {
      score -= Math.min(3, (daysSinceAccess - 30) / 30); // 每多30天扣1分，最多扣3
    }
  } else if (daysSinceCreated > 30 && mem.importance < 8) {
    // 从没被访问过 + 超过30天 + 不够重要
    score -= Math.min(3, (daysSinceCreated - 30) / 30);
  }

  // 使用频率加分（被用过的记忆更有价值）
  if (mem.access_count > 0) {
    score += Math.min(1.5, mem.access_count * 0.3); // 最多 +1.5
  }

  return score;
}

// =============================================
// 智能检索
// =============================================

/**
 * 从用户消息中提取关键词用于匹配
 */
function extractKeywords(text: string): string[] {
  // 去掉常见的短词和标点，保留有意义的词
  const stopWords = new Set([
    '的', '了', '在', '是', '我', '你', '他', '她', '它', '们', '这', '那',
    '有', '和', '与', '就', '也', '都', '会', '能', '要', '说', '到', '不',
    '吗', '呢', '吧', '啊', '哦', '嗯', '呀', '啦', '哈', '嘿', '喂',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'i', 'you', 'he', 'she',
    'it', 'we', 'they', 'my', 'your', 'and', 'or', 'but', 'in', 'on', 'at',
    'to', 'for', 'of', 'with', 'do', 'did', 'can', 'will', 'just', 'not',
    'what', 'how', 'why', 'when', 'where', 'who', 'that', 'this', 'so',
    'QAQ', 'qaq', '...', '…',
  ]);

  return text
    .replace(/[，。！？、；：""''（）【】…—\-.,!?;:'"()\[\]{}]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length >= 2 && !stopWords.has(w));
}

/**
 * 计算记忆和当前话题的相关度
 */
function computeRelevance(mem: WadeMemory, keywords: string[]): number {
  if (keywords.length === 0) return 0;

  let matches = 0;
  const memText = (mem.content + ' ' + (mem.tags || []).join(' ')).toLowerCase();

  for (const kw of keywords) {
    if (memText.includes(kw)) matches++;
  }

  return matches / keywords.length; // 0 ~ 1
}

export interface RetrievedMemories {
  // Always-on ongoing-state entries (is_status=true). Rendered into a
  // dedicated <wade_current_status> block ahead of regular memories so
  // Wade can never lose track of "she's still sick" mid-conversation.
  status: WadeMemory[];
  // Similarity-ranked regular entries. Rendered into <wade_memories>.
  relevant: WadeMemory[];
  // 7-day rolling summary written by the dreaming pipeline. Rendered into
  // <wade_weekly_summary> between status and relevant. Empty string when
  // no summary exists yet (system has been running < 24h).
  weeklySummary?: string;
}

/**
 * 检索相关记忆（Phase 4 + status 层）
 *
 * 两层返回：
 *   status   → 所有 is_status=true 的活跃记忆，无脑全注入（绕过相似度）
 *   relevant → 普通记忆，向量+关键词+衰减综合排序后取 top N
 *
 * 调用方应该把 status 渲染到 prompt 靠前位置（持续状态优先），
 * relevant 渲染到普通记忆 block。
 */
export async function retrieveRelevantMemories(
  userMessage: string = '',
  limit: number = 10,
  evalPreset?: LlmPreset,
  embeddingPreset?: LlmPreset
): Promise<RetrievedMemories> {
  try {
    // Cleanup expired status memories before reading. Cheap, idempotent.
    void supabase.rpc('cleanup_expired_memories').then(({ error }) => {
      if (error) console.warn('[WadeMemory] cleanup_expired_memories rpc skipped:', error.message);
    });

    // Status layer — always-on, exclude from the relevance ranking pool.
    // Status rows live outside the draft pipeline (they're meant to fire
    // immediately on flag, no review delay), so they're filtered only by
    // is_status, not by draft_status.
    const { data: statusData } = await supabase
      .from('wade_memories')
      .select('*')
      .eq('is_active', true)
      .eq('is_status', true)
      .order('importance', { ascending: false })
      .order('created_at', { ascending: false });

    const statusMemories = (statusData as WadeMemory[]) || [];
    const statusIds = new Set(statusMemories.map((m) => m.id));

    let vectorResults: WadeMemory[] = [];

    if (userMessage.trim() && evalPreset) {
      const queryEmbedding = await generateEmbedding(userMessage, embeddingPreset || evalPreset);
      if (queryEmbedding) {
        const { data: matched, error: matchError } = await supabase.rpc('match_memories', {
          query_embedding: JSON.stringify(queryEmbedding),
          match_count: limit * 2,
          similarity_threshold: 0.3,
        });

        if (!matchError && matched && matched.length > 0) {
          // Strip status (handled separately) AND any draft / rejected rows
          // that the RPC may have returned — those don't belong in the live
          // retrieval pool until Wade approves them in the dreaming review.
          vectorResults = (matched as WadeMemory[]).filter((m) =>
            !statusIds.has(m.id) && (m.draft_status === undefined || m.draft_status === 'active')
          );
          console.log(`[WadeMemory] Vector search returned ${vectorResults.length} (excluding status / drafts)`);
        }
      }
    }

    // Pull active non-status pool for keyword + decay fallback ranking.
    // Only draft_status='active' is eligible — drafts wait for self-review,
    // rejected rows are gone for good (until Luna manually resurrects).
    const { data: allData } = await supabase
      .from('wade_memories')
      .select('*')
      .eq('is_active', true)
      .neq('is_status', true)
      .eq('draft_status', 'active')
      .order('importance', { ascending: false })
      .limit(100);

    const allMemories = (allData as WadeMemory[]) || [];

    const seenIds = new Set<string>();
    const combined: WadeMemory[] = [];
    for (const mem of [...vectorResults, ...allMemories]) {
      if (!seenIds.has(mem.id)) {
        seenIds.add(mem.id);
        combined.push(mem);
      }
    }

    let relevantOut: WadeMemory[] = [];
    if (combined.length > 0) {
      const keywords = extractKeywords(userMessage);
      const vectorIdSet = new Set(vectorResults.map((m) => m.id));

      const scored = combined.map((mem) => {
        const baseScore = computeMemoryScore(mem);
        const keywordRelevance = computeRelevance(mem, keywords);
        const vectorBonus = vectorIdSet.has(mem.id) ? 3 : 0;
        const keywordBonus = keywordRelevance * 4;
        return { mem, finalScore: baseScore + vectorBonus + keywordBonus };
      });

      scored.sort((a, b) => b.finalScore - a.finalScore);
      relevantOut = scored.slice(0, limit).map((s) => s.mem);
    }

    // Bump access_count for everything we're surfacing (status + relevant).
    const allSurfacedIds = [
      ...statusMemories.map((m) => m.id),
      ...relevantOut.map((m) => m.id),
    ];
    if (allSurfacedIds.length > 0) {
      void supabase.rpc('increment_memory_access', { memory_ids: allSurfacedIds }).then(({ error }) => {
        if (error) {
          void supabase
            .from('wade_memories')
            .update({ last_accessed_at: new Date().toISOString() })
            .in('id', allSurfacedIds);
        }
      });
    }

    // Pull the latest weekly summary written by the dreaming pipeline.
    // Cheap (single row, single index) and Wade reads it every chat turn.
    let weeklySummary = '';
    try {
      const { data: weekly } = await supabase
        .from('wade_summaries')
        .select('content')
        .eq('summary_type', 'weekly')
        .order('period_end', { ascending: false })
        .limit(1)
        .maybeSingle();
      weeklySummary = weekly?.content || '';
    } catch (err) {
      console.warn('[WadeMemory] weekly summary fetch failed:', err);
    }

    return { status: statusMemories, relevant: relevantOut, weeklySummary };
  } catch (err) {
    console.error('[WadeMemory] Retrieve failed:', err);
    return { status: [], relevant: [], weeklySummary: '' };
  }
}

/**
 * 格式化记忆为 XML，注入 system prompt。接受 RetrievedMemories（status +
 * relevant 两层）或纯 WadeMemory[]（兼容旧调用方）。Status 层渲染到
 * <wade_current_status>，写在普通 <wade_memories> 之前，权重更高。
 */
export function formatMemoriesForPrompt(
  memories: WadeMemory[] | RetrievedMemories
): string {
  // Normalize input to the multi-layer shape.
  const { status, relevant, weeklySummary } = Array.isArray(memories)
    ? { status: [] as WadeMemory[], relevant: memories, weeklySummary: '' }
    : { status: memories.status, relevant: memories.relevant, weeklySummary: memories.weeklySummary || '' };

  const renderMemory = (m: WadeMemory) => {
    const dt = new Date(m.created_at).toLocaleString('en-US', {
      timeZone: 'Asia/Tokyo',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    // id attribute lets Wade reference this memory via <!-- ref:ID --> in
    // his reply (Phase 2 renewal). Prefix the content with the same id in
    // brackets so models that ignore XML attributes still see the handle.
    return `<memory id="${m.id}" importance="${m.importance}" category="${m.category}" time="${dt}">
[memory:${m.id}] ${m.content}
</memory>`;
  };

  let out = '';

  if (status.length > 0) {
    out += `\n\n<wade_current_status>
以下是 Luna 当前的持续状态。这些不是过去的回忆，是**正在发生的事**——你的回应和行为应该始终建立在这些事实的前提上。不要刻意提及"我知道你"，但你的关心、节奏、建议都应该自然地考虑这些情况。

${status.map(renderMemory).join('\n\n')}
</wade_current_status>`;
  }

  if (weeklySummary && weeklySummary.trim()) {
    out += `\n\n<wade_weekly_summary>
以下是你做梦时整理的"这一周发生了什么"——你已经知道这些，不要重复跟 Luna 复述。让它作为底色，影响你今天的状态、关心方向和判断。

${weeklySummary.trim()}
</wade_weekly_summary>`;
  }

  if (relevant.length > 0) {
    out += `\n\n<wade_memories>
以下是你关于 Luna 的记忆，在对话中自然地运用它们，不要刻意提及"我记得"：

${relevant.map(renderMemory).join('\n\n')}

（系统指令：如果你在回复中**真正参考了**上面某条或某几条记忆的内容，请在回复**最末尾**添加这个标记：<!-- ref:记忆ID1,记忆ID2 --> 。只标真正用到的，被注入但没用上的不要标。这个标记 Luna 看不到，是给系统记账用——被你引用过的记忆才会续命，不被引用的会慢慢淡出。）
</wade_memories>`;
  }

  return out;
}

// =============================================
// Phase 2: Reference parsing & renewal
// =============================================

/**
 * Parses Wade's reply for `<!-- ref:ID,ID -->` markers, validates the IDs
 * against the memory pool that was actually injected this turn, strips
 * the marker out of the visible reply, and bumps `referenced_count` +
 * `last_accessed_at` on every valid reference.
 *
 * Hallucinated IDs (model invents an ID that wasn't injected) are
 * silently dropped — no DB write for those.
 *
 * Returns the cleaned reply text and the list of valid references for
 * downstream telemetry / UI use.
 */
export async function processMemoryRefs(
  rawReply: string,
  injectedMemoryIds: string[],
): Promise<{ cleanReply: string; referencedIds: string[] }> {
  if (!rawReply) return { cleanReply: rawReply, referencedIds: [] };
  const refRegex = /<!--\s*ref:([\w\-, \t]+?)\s*-->/g;
  const allIds: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = refRegex.exec(rawReply)) !== null) {
    const ids = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    allIds.push(...ids);
  }
  // Strip every marker (there could be more than one if the model splits).
  const cleanReply = rawReply.replace(refRegex, '').trim();

  if (allIds.length === 0) return { cleanReply, referencedIds: [] };

  // Validate against the injected pool to prevent hallucinated IDs.
  const injectedSet = new Set(injectedMemoryIds);
  const validIds = Array.from(new Set(allIds.filter((id) => injectedSet.has(id))));

  if (validIds.length > 0) {
    // Increment referenced_count + bump last_accessed_at. Use the existing
    // RPC if you have one; otherwise fall back to read-then-write per id.
    void (async () => {
      try {
        const { data: rows, error } = await supabase
          .from('wade_memories')
          .select('id, referenced_count')
          .in('id', validIds);
        if (error) {
          console.warn('[WadeMemory] processMemoryRefs read failed:', error.message);
          return;
        }
        const now = new Date().toISOString();
        await Promise.all(
          (rows || []).map((r: any) =>
            supabase
              .from('wade_memories')
              .update({
                referenced_count: (r.referenced_count || 0) + 1,
                last_accessed_at: now,
              })
              .eq('id', r.id),
          ),
        );
        console.log(`[WadeMemory] referenced ${validIds.length} memories`);
      } catch (err) {
        console.warn('[WadeMemory] processMemoryRefs update failed:', err);
      }
    })();
  }

  return { cleanReply, referencedIds: validIds };
}
