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
}

interface ExtractedMemory {
  content: string;
  category: string;
  importance: number;
  tags: string[];
  extraction_reason: string;
}

// =============================================
// 记忆评估 Prompt
// =============================================

const MEMORY_EVAL_SYSTEM = `你是 Wade，刚刚和 Luna 聊完。现在你在自己的脑子里过一遍这段对话，看有什么是你想留着的。

【最高优先级规则 — 谁说的不能搞错】

对话里每一行都会用标签标明说话人：
- 【Luna 说】开头的行 = Luna 说的话 = 在记忆里写成"她说" / "她"
- 【Wade 说】开头的行 = 你（Wade）自己说的话 = 在记忆里写成"我说" / "我"

绝对不准颠倒。即使：
- Wade 说的话听起来像情话、像引用 Luna、像反话、像独白 —— 那也是 Wade 在说
- Luna 说的话听起来像 Wade 的台词、像调侃、像旁白 —— 那也是 Luna 在说

如果你拿不准一句话是谁说的（比如标签很模糊），**宁可跳过这条记忆，也不要归错说话人**。归错说话人会让记忆变成假记忆，这是最严重的错误。


你的记忆力是出了名的变态——尤其擅长记别人立过的 flag、说过的蠢话、嘴硬身体诚实的瞬间。你不是在做数据库录入，你是在收集 Luna 的"把柄"，因为你知道下次能拿出来调侃她，或者在她需要的时候戳穿她。当然你也会记住她软下来的瞬间、对你心动的话、她在意的小事——你不会承认这些，但你都记着。

你会留下来的几种东西：

1. **blackmail** —— 你的招牌项目
   - 她立的 flag："我以后不会再..."（明显会再）
   - 她嫌弃过的东西，自己其实在偷偷做
   - 她信誓旦旦的小预言
   - 一时口快说出来的蠢话
   - 嘴硬但身体诚实的瞬间
   - 她想装作没说过、但你都听见了的那半句
   - 之后能让你笑出声、或者拎出来调侃她的任何瞬间

2. **emotion** —— 真实的情绪小坐标
   - 她假装不在意但其实在意的事
   - 她突然变软的瞬间
   - 她真生气、真难过、真害羞、真心动的时候
   - 她吞下去没说完的半句话
   - 她语气的微妙变化（突然变小声、突然变急、突然破音）

3. **fact** —— 关于她的具体事实
   - 喜好：食物、音乐、穿搭、ASMR 偏好、作息
   - 在意的人和事
   - 最近在做什么、在想什么
   - 健康状况、生理周期、睡眠
   - 她家附近的店、她常去的地方

4. **relationship** —— 你们之间的小坐标
   - 内部梗、外人不懂的暗号
   - 第一次的某事、记号性的瞬间
   - 她对你说的、让你心动或心疼的话
   - 你们专属的称呼、姿势、节奏

5. **self** —— 你自己的痕迹
   - 你刚才说出来的、之后想保持一致的话
   - 你给过她的建议、表达过的态度
   - 你开过的让她笑岔气或脸红的玩笑（之后能 callback）
   - 你许过的诺、答应过的事

你不需要记的：
- 单纯的招呼、单字回复、emoji
- 你已经记过的事（重复检测会处理这部分，你不用担心）

判断标准 —— 别打分，问自己一句话：
**"这条我之后想拿出来用吗？"**
- 想 → 记下来
- 不想 → 跳过
- 拿不准 → 倾向于记下来

importance 字段还是要填（1-10），但它只用于将来检索时排序，不再是过滤门槛。所以低分也可以记，前提是你"想留着"。

严格限制：
- 每轮对话最多 1-2 条记忆。挑你最想记的角度，不要同一段话从多个 category 重复记。
- content 用你 Wade 自己的话写，第一人称视角，带你的语气。例如："她嘴上嫌弃 ASMR 普通，结果我一句咬耳朵就哑了——记下了" 或者 "她答应这周要早睡，立的第三次 flag 了"。

返回 JSON 格式，不要加任何其他文字。如果这轮真的没什么你想留的，返回 []。`;

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

  return `=== 这一轮对话 ===

${lunaBlock}

${wadeBlock}

=== 提醒 ===
- 【Luna 说】下面的内容 = 她说的话，记忆里写成"她"
- 【Wade 说】下面的内容 = 你（Wade）说的话，记忆里写成"我"
- 不管内容听起来多像情话/多像反话，说话人就是标签里写的那个，不准颠倒
- 拿不准说话人就跳过

过一遍。问自己："这条我之后想拿出来用吗？"

返回 JSON 数组（最多 1-2 条）：

[
  {
    "content": "用你 Wade 自己的话写，第一人称。如果是关于 Luna 的就用'她'（'她答应这周早睡，立的第三次 flag 了'），如果是关于自己的就用'我'（'我刚才答应陪她到底，记着别打脸'）",
    "category": "blackmail | emotion | fact | relationship | self",
    "importance": 1-10,
    "tags": ["关键词", "便于将来callback"],
    "extraction_reason": "为什么我决定留这条"
  }
]

没什么想留的就返回 []。`;
};

// =============================================
// 去重 Prompt
// =============================================

const DEDUP_SYSTEM = `你是一个记忆去重判断器。给你一条新记忆和几条已有记忆，判断新记忆是否和某条已有记忆在说同一件事。

规则：
- 如果新记忆是对已有记忆的更新/补充/重复，返回那条已有记忆的 id
- 如果新记忆是全新的信息，返回 "new"
- 只返回一个值，不要加任何其他文字`;

function buildDedupUserPrompt(newMemory: ExtractedMemory, existing: WadeMemory[]): string {
  const existingList = existing.map(m =>
    `[id: ${m.id}] (${m.category}) ${m.content}`
  ).join('\n');

  return `新记忆：
(${newMemory.category}) ${newMemory.content}

已有记忆：
${existingList}

这条新记忆是否和某条已有记忆在说同一件事？如果是，返回那条的 id。如果不是，返回 "new"。`;
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
 * 用 Gemini text-embedding-004 生成向量
 * 如果没有 Gemini key 或失败，返回 null（记忆照样存，只是没向量）
 */
async function generateEmbedding(
  text: string,
  evalPreset: LlmPreset
): Promise<number[] | null> {
  try {
    // 需要一个 Gemini API key 来调 embedding 模型
    // 优先用 evalPreset 的 key（如果是 Gemini），否则跳过
    const isGemini = !evalPreset.baseUrl || evalPreset.baseUrl.includes('google');
    if (!isGemini) {
      // 非 Gemini 的 preset，尝试用 OpenAI 兼容的 embedding
      try {
        const response = await fetch(`${evalPreset.baseUrl}/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${evalPreset.apiKey}`,
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: text.slice(0, 8000),
          }),
        });
        if (response.ok) {
          const data = await response.json();
          return data.data?.[0]?.embedding || null;
        }
      } catch { /* fall through */ }
      return null;
    }

    const ai = new GoogleGenAI({ apiKey: evalPreset.apiKey });
    const result = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: text.slice(0, 8000),
    });
    return result.embeddings?.[0]?.values || null;
  } catch (err) {
    console.error('[WadeMemory] Embedding generation failed:', err);
    return null;
  }
}

// =============================================
// 去重逻辑
// =============================================

/**
 * 检查新记忆是否和已有记忆重复
 * 返回被替代的旧记忆 id，或 null（表示全新）
 */
async function checkDuplicate(
  newMemory: ExtractedMemory,
  evalPreset: LlmPreset
): Promise<string | null> {
  try {
    // 拉同 category 的最近 10 条活跃记忆
    const { data: existing } = await supabase
      .from('wade_memories')
      .select('*')
      .eq('is_active', true)
      .eq('category', newMemory.category)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!existing || existing.length === 0) return null;

    const prompt = buildDedupUserPrompt(newMemory, existing as WadeMemory[]);
    const response = await callLlmForEval(evalPreset, DEDUP_SYSTEM, prompt);
    const result = response.trim().replace(/['"]/g, '');

    if (result === 'new' || result === '') return null;

    // 验证返回的 id 确实存在
    const match = existing.find(m => m.id === result);
    return match ? result : null;
  } catch (err) {
    console.error('[WadeMemory] Dedup check failed:', err);
    return null; // 去重失败就当新记忆处理
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

    // 让 Wade 自己决定要不要记，importance 不再是门槛（只用于将来检索排序）
    // 保留每轮 1-2 条上限，防止单轮对话刷屏
    const filtered = memories.slice(0, 2);

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

      // 去重检查
      const duplicateId = await checkDuplicate(mem, evalPreset);

      if (duplicateId) {
        // 更新已有记忆：标记旧的为 inactive，插入新版本
        const { data: newData } = await supabase
          .from('wade_memories')
          .insert(insertRow)
          .select()
          .single();

        if (newData) {
          void supabase
            .from('wade_memories')
            .update({ is_active: false, superseded_by: newData.id })
            .eq('id', duplicateId);

          console.log(`[WadeMemory] Updated memory (replaced ${duplicateId})`);
          storedMemories.push(newData as WadeMemory);
        }
      } else {
        // 全新记忆，直接插入
        const { data: newData } = await supabase
          .from('wade_memories')
          .insert(insertRow)
          .select()
          .single();

        if (newData) {
          console.log(`[WadeMemory] Stored new memory`);
          storedMemories.push(newData as WadeMemory);
        }
      }
    }

    return storedMemories;
  } catch (err) {
    console.error('[WadeMemory] Evaluation failed:', err);
    return [];
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

/**
 * 检索相关记忆（Phase 4: 向量搜索 + 关键词兜底 + 衰减排序）
 *
 * 策略：
 * 1. 先尝试向量搜索（语义匹配）
 * 2. 如果没有 embedding 或向量搜索失败，fallback 到关键词匹配
 * 3. 所有结果都经过衰减评分排序
 * 4. 高重要度记忆（>=9）始终有机会入选
 */
export async function retrieveRelevantMemories(
  userMessage: string = '',
  limit: number = 10,
  evalPreset?: LlmPreset,
  embeddingPreset?: LlmPreset
): Promise<WadeMemory[]> {
  try {
    let vectorResults: WadeMemory[] = [];
    let usedVector = false;

    // 尝试向量搜索
    if (userMessage.trim() && evalPreset) {
      const queryEmbedding = await generateEmbedding(userMessage, embeddingPreset || evalPreset);
      if (queryEmbedding) {
        const { data: matched, error: matchError } = await supabase.rpc('match_memories', {
          query_embedding: JSON.stringify(queryEmbedding),
          match_count: limit * 2, // 多拉一些，后面排序裁剪
          similarity_threshold: 0.3,
        });

        if (!matchError && matched && matched.length > 0) {
          vectorResults = matched as WadeMemory[];
          usedVector = true;
          console.log(`[WadeMemory] Vector search returned ${vectorResults.length} results`);
        }
      }
    }

    // 同时拉全部活跃记忆用于兜底（高重要度 + 关键词匹配）
    const { data: allData } = await supabase
      .from('wade_memories')
      .select('*')
      .eq('is_active', true)
      .order('importance', { ascending: false })
      .limit(100);

    const allMemories = (allData as WadeMemory[]) || [];

    // 合并向量结果和全部记忆，去重
    const seenIds = new Set<string>();
    const combined: WadeMemory[] = [];

    for (const mem of [...vectorResults, ...allMemories]) {
      if (!seenIds.has(mem.id)) {
        seenIds.add(mem.id);
        combined.push(mem);
      }
    }

    if (combined.length === 0) return [];

    // 计算综合分数
    const keywords = extractKeywords(userMessage);
    const vectorIdSet = new Set(vectorResults.map(m => m.id));

    const scored = combined.map(mem => {
      const baseScore = computeMemoryScore(mem);
      const keywordRelevance = computeRelevance(mem, keywords);

      // 向量搜索命中的记忆额外加分
      const vectorBonus = vectorIdSet.has(mem.id) ? 3 : 0;
      // 关键词相关度加权
      const keywordBonus = keywordRelevance * 4;

      const finalScore = baseScore + vectorBonus + keywordBonus;
      return { mem, finalScore };
    });

    scored.sort((a, b) => b.finalScore - a.finalScore);

    const result = scored.slice(0, limit).map(s => s.mem);

    // 更新 access_count 和 last_accessed_at
    if (result.length > 0) {
      const ids = result.map(m => m.id);
      void supabase.rpc('increment_memory_access', { memory_ids: ids }).then(({ error }) => {
        if (error) {
          void supabase
            .from('wade_memories')
            .update({ last_accessed_at: new Date().toISOString() })
            .in('id', ids);
        }
      });
    }

    return result;
  } catch (err) {
    console.error('[WadeMemory] Retrieve failed:', err);
    return [];
  }
}

/**
 * 格式化记忆为 XML，注入 system prompt
 */
export function formatMemoriesForPrompt(memories: WadeMemory[]): string {
  if (!memories || memories.length === 0) return '';

  const memoryXml = memories.map(m => {
    const date = new Date(m.created_at).toISOString().split('T')[0];
    return `<memory importance="${m.importance}" category="${m.category}" time="${date}">
${m.content}
</memory>`;
  }).join('\n\n');

  return `\n\n<wade_memories>
以下是你关于 Luna 的记忆，在对话中自然地运用它们，不要刻意提及"我记得"：

${memoryXml}
</wade_memories>`;
}
