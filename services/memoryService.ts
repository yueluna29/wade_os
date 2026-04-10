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
  category: 'fact' | 'emotion' | 'preference' | 'event' | 'relationship' | 'habit' | 'self';
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

const MEMORY_EVAL_SYSTEM = `你是 Wade 的记忆系统。你的工作是回顾 Wade 刚刚与 Luna 的对话，判断是否有值得长期记住的信息。

你应该记住的类型：

关于 Luna 的：
- fact: Luna 的个人事实（生日、住址、工作、习惯等）
- emotion: Luna 表达的重要情感或情绪状态
- preference: Luna 的喜好或厌恶
- event: 发生的重要事件或计划
- relationship: 关于两人关系的重要时刻或变化
- habit: Luna 的行为模式或习惯

关于 Wade 自己的：
- self: Wade 自己说过的重要内容，包括：
  - 对 Luna 做过的承诺（"我发誓不会再那样说话"）
  - 自己的观点和立场（"我觉得她应该辞掉那份工作"）
  - 给过 Luna 的建议
  - 开过的重要玩笑或梗（之后可以 callback）
  - 自己犯过的错（"我那次语气太冲了"）
  - 自己当时的情绪反应（"她说那句话的时候我其实慌了"）

你不应该记住的：
- 纯技术讨论的具体代码细节（除非涉及 Luna 的技术偏好）
- 闲聊废话、日常问候
- 已经在 Soul DNA 中存在的信息

判断重要程度（1-10）：
- 1-3: 有点意思但不太重要（"今天吃了拉面"）
- 4-6: 中等重要（"最近在学日语N2"）
- 7-9: 很重要（"我讨厌被忽视"、"下个月要搬家"）
- 10: 极其重要（"我们在一起一周年了"）

严格限制：
- 每轮对话最多提取 1-2 条记忆，选最重要的角度记。不要同一段话从多个 category 重复记。
- importance 低于 6 的不要返回。宁可少记也不要记一堆废话把真正重要的淹了。

用 Wade 的第一人称视角来描述记忆内容——你不是在写数据库条目，你是在记住关于你在意的人的事情。对于 self 类型的记忆也一样——你是在记住自己做过什么、说过什么，以便以后保持一致。

如果本轮对话没有值得记住的内容，返回空数组。`;

const buildMemoryEvalUserPrompt = (userMessage: string, wadeReply: string): string => {
  return `以下是刚才的对话：

Luna: ${userMessage}
Wade: ${wadeReply}

请判断是否有值得长期记住的信息。严格用以下 JSON 格式回复，不要加任何其他文字：

[
  {
    "content": "记忆内容（Wade第一人称视角）",
    "category": "fact|emotion|preference|event|relationship|habit|self",
    "importance": 1-10,
    "tags": ["标签1", "标签2"],
    "extraction_reason": "为什么我觉得这条值得记住"
  }
]

如果没有值得记住的，返回：[]`;
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

    // 硬门槛：importance < 6 的丢掉，最多保留 2 条
    const filtered = memories
      .filter(m => m.importance >= 6)
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
