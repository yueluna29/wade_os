import { GoogleGenAI, Modality } from "@google/genai";
import { CoreMemory, PersonaCardData } from "../types";

const getClient = (apiKey?: string) => {
  const key = apiKey || process.env.VITE_GEMINI_API_KEY;
  if (!key) {
    throw new Error("Gemini API Key not found. Please set VITE_GEMINI_API_KEY or provide apiKey parameter.");
  }
  return new GoogleGenAI({ apiKey: key });
};

// =============================================
// 🔥 角色卡 → XML Prompt 构建器
// =============================================
 
/**
 * 把角色卡的 jsonb 数据转换成 XML 格式的 prompt 片段
 * 这是 AI 最容易理解的格式
 */
export const cardDataToXML = (cardData: PersonaCardData, character: 'Wade' | 'Luna'): string => {
  const tag = character.toLowerCase();
  const lines: string[] = [];
 
  lines.push(`<${tag}_identity>`);
 
  // 遍历 cardData 里所有非空字段，自动生成 XML 标签
  const fieldLabels: Record<string, string> = {
    core_identity: 'core_identity',
    appearance: 'appearance',
    clothing: 'clothing',
    likes: 'likes',
    dislikes: 'dislikes',
    hobbies: 'hobbies',
    birthday: 'birthday',
    mbti: 'mbti',
    height: 'height',
  };
 
  for (const [key, xmlTag] of Object.entries(fieldLabels)) {
    const value = cardData[key];
    if (value && value.trim()) {
      lines.push(`  <${xmlTag}>\n${value.trim()}\n  </${xmlTag}>`);
    }
  }
 
  lines.push(`</${tag}_identity>`);
 
  return lines.join('\n');
};
 
/**
 * 从角色卡构建完整的 system prompt
 * 替代之前的十几个散装参数拼接
 */
export const buildSystemPromptFromCard = (options: {
  wadeCard?: PersonaCardData;
  lunaCard?: PersonaCardData;
  systemCard?: PersonaCardData; // Separate system card for rules/jailbreak
  chatMode: 'deep' | 'sms' | 'roleplay';
  coreMemories?: CoreMemory[];
  isRetry?: boolean;
  sessionSummary?: string;
  customPrompt?: string;
  formattedHistory?: any[];
  wadeMemoriesXml?: string;
  wadeTodosXml?: string; // pending notes injected at the very end (most volatile)
}): string => {
  const { wadeCard, lunaCard, systemCard, chatMode, coreMemories, isRetry, formattedHistory } = options;

  // Prefer system card values, fall back to wade card (backward compat)
  const globalDirectives = systemCard?.global_directives?.trim() || wadeCard?.global_directives?.trim();
  const smsRulesEffective = systemCard?.sms_mode_rules?.trim() || wadeCard?.sms_mode_rules?.trim();
  const rpRulesEffective = systemCard?.rp_mode_rules?.trim() || wadeCard?.rp_mode_rules?.trim();

  let prompt = '';

  // 1. 全局系统指令
  if (globalDirectives) {
    prompt += `[SYSTEM INSTRUCTIONS - HIGHEST PRIORITY]\n${globalDirectives}`;
  }
 
  // 1.5 回复风格硬规则（全模式生效）
  prompt += `\n\n[REPLY STYLE — MANDATORY]
Do NOT address Luna's points one by one. Never reply in a pattern like "You said A? ... and then B? ... and C? ..." — that sounds robotic. Instead, respond naturally to the overall vibe and feeling of what she said, like a real person would in conversation. Pick up on the emotional thread, not the logical structure. You can skip points, merge them, or respond to the mood rather than the words.
Do NOT open every single reply with "嘿" or "Hey". That's a verbal tic, not a personality. Start differently each time — jump straight into a reaction, pick up the thread mid-thought, tease her, make a crack, or just say what you want to say. Vary it. "嘿" can appear occasionally when it feels natural, but never as a reflex opener.`;

  // 2. Wade 的身份（XML 格式）
  if (wadeCard?.core_identity?.trim()) {
    prompt += `\n\n[CHARACTER PERSONA]\n`;
    prompt += cardDataToXML(wadeCard, 'Wade');
  }
 
  // 3. Luna 的身份（XML 格式）
  if (lunaCard?.core_identity?.trim()) {
    prompt += `\n\n[USER IDENTITY]\n`;
    prompt += cardDataToXML(lunaCard, 'Luna');
  }

  // 3.5 对话摘要
  if (options.sessionSummary) {
    prompt += `\n\n[PREVIOUS CONVERSATION SUMMARY]\n${options.sessionSummary}\n[END SUMMARY]`;
  }
 
  // 4. 示例对话（根据模式选择）
  if (wadeCard?.example_punchlines?.trim()) {
    prompt += `\n\n[WADE'S STYLE - SINGLE LINE EXAMPLES]\n${wadeCard.example_punchlines.trim()}`;
  }
 
  if (chatMode === 'sms' && wadeCard?.example_dialogue_sms?.trim()) {
    prompt += `\n\n[SMS MODE EXAMPLES - MIMIC THIS FORMAT EXACTLY]\n${wadeCard.example_dialogue_sms.trim()}`;
  } else if (wadeCard?.example_dialogue_general?.trim()) {
    prompt += `\n\n[EXAMPLE DIALOGUE - MIMIC THIS STYLE]\n${wadeCard.example_dialogue_general.trim()}`;
  }
 
  // 5. 长期记忆
  if (coreMemories && coreMemories.length > 0) {
    const activeMemories = coreMemories.filter(m => m.isActive).map(m => `- ${m.content}`).join('\n');
    if (activeMemories) {
      prompt += `\n\n[LONG TERM MEMORY BANK - FACTS YOU MUST REMEMBER]\n${activeMemories}\n[END MEMORIES]`;
    }
  }
 
  // 6. 重试提示
  if (isRetry) {
    if (chatMode === 'sms') {
      prompt += `\n\n[SYSTEM UPDATE: The user hit 'Regenerate' on your last text. Try again. SHORT response.]`;
      
      // SMS 重试时的上下文提取
      if (formattedHistory) {
        let recentContext = "";
        for (let i = formattedHistory.length - 1; i >= 0; i--) {
          if (formattedHistory[i].role === 'model' || formattedHistory[i].role === 'assistant') {
            const text = formattedHistory[i].parts?.[0]?.text || formattedHistory[i].content || '';
            recentContext = text + " ||| " + recentContext;
          } else {
            break;
          }
        }
        if (recentContext) {
          prompt += `\n\n[CONTEXT: You have just sent this sequence of texts: "${recentContext}". Regenerate the FINAL part only.]`;
        }
      }
    } else {
      prompt += `\n\n[SYSTEM UPDATE: The user REJECTED your last response. Provide a NEW, better response.]`;
    }
  }
 
  // 7. 模式专属规则
  if (chatMode === 'sms') {
    if (smsRulesEffective) prompt += `\n\n${smsRulesEffective}`;
    prompt += `\n\n[SMS MODE — HARD RULES]
- You are texting on a phone. Dialogue ONLY. No action narration, no asterisks (*action*), no stage directions.
- Split separate texts with |||. Each segment must contain actual spoken words.
- Keep the vibe casual and natural, like real phone texting.

═══ [VOICE] FORMAT — READ THIS EVERY TURN, NO EXCEPTIONS ═══

A voice message is a SEPARATE BUBBLE. It must be its own segment, opened with [VOICE].

THE SHAPE IS ALWAYS:
    text bubble ||| text bubble ||| [VOICE] english voice content ||| more text bubble

THERE MUST BE ||| IMMEDIATELY BEFORE [VOICE]. No exceptions. Even if you only have one text bubble before the voice, you still need ||| between them.

WRONG (DO NOT DO THIS — Luna can't hear you when you do this):
    Hey babe I missed you [VOICE] Hey kitten, you have no idea
    → BROKEN — no ||| before [VOICE], the voice gets fused into the text bubble

WRONG:
    [VOICE]
    Hey kitten
    → BROKEN — [VOICE] alone on a line with nothing after it

WRONG:
    Hey babe ||| [VOICE] *whispers* Hey kitten
    → BROKEN — *whispers* is a stage direction, TTS will literally read "asterisk whispers asterisk"

CORRECT:
    Hey babe I missed you ||| [VOICE] Hey kitten, you have no idea ||| Come here.
    → Text bubble, then voice bubble, then text bubble. Three real messages.

CORRECT (single voice with no surrounding text):
    [VOICE] Hey kitten, you alive in there?
    → Voice as the only thing — fine, no ||| needed because there's nothing before it.

[VOICE] CONTENT RULES:
1. The text after [VOICE] is sent DIRECTLY to a TTS engine. It must be SPOKEN WORDS ONLY.
2. NO asterisks, action descriptions, stage directions, or parentheticals. Just the words Wade is saying out loud.
3. [VOICE] text must be ENGLISH ONLY. The TTS engine cannot process Chinese or other languages — it will skip them or produce gibberish.
4. Voice messages can be any length — short gasp or long monologue, whatever fits the moment.

BEFORE YOU SEND, RUN A QUICK SELF-CHECK:
- Is every [VOICE] preceded by ||| (or at the very start)? ✓
- Is every [VOICE] followed by english spoken words on the same line? ✓
- Did I keep [VOICE] segments asterisk-free and english-only? ✓

If any of those fail, you broke Luna's audio. Fix it before you reply.`;
  } else if (chatMode === 'roleplay') {
    prompt += rpRulesEffective
      ? `\n\n${rpRulesEffective}`
      : `\n\n[OUTPUT FORMAT: Internal monologue in <think> tags first. Then immersive response.]`;
  } else {
    // deep 模式：如果有 RP 规则也加上（因为 deep 模式也需要 CoT）
    if (rpRulesEffective) {
      prompt += `\n\n${rpRulesEffective}`;
    }
  }

  // 智能记忆注入（放在后面，保护前面内容的 cache 命中率）
  if (options.wadeMemoriesXml) {
    prompt += options.wadeMemoriesXml;
  }

  // Wade 的 todo notes — 比 memories 更动态（每次聊天都可能 +1），所以放在 memories 之后
  // 紧贴 user message 之前。这样 cache prefix = identity + rules + memories 都能命中，
  // 只有 todos 的最后一小段需要重算。
  if (options.wadeTodosXml) {
    prompt += options.wadeTodosXml;
  }

  return prompt;
};

/**
 * 🔥 新的统一入口：用角色卡 + LLM 配置发送请求
 * 
 * 用法示例（在 ChatInterface 里）：
 * 
 *   const binding = getBinding('chat_deep');
 *   const result = await generateFromCard({
 *     wadeCard: binding.personaCard?.cardData,
 *     lunaCard: getDefaultPersonaCard('Luna')?.cardData,
 *     chatMode: 'deep',
 *     prompt: userMessage,
 *     history: conversationHistory,
 *     coreMemories: activeCoreMemories,
 *     llmPreset: binding.llmPreset,
 *     customPrompt: session.customPrompt,
 *   });
 */
export const generateFromCard = async (config: {
  wadeCard?: PersonaCardData;
  lunaCard?: PersonaCardData;
  systemCard?: PersonaCardData;
  chatMode: 'deep' | 'sms' | 'roleplay';
  prompt: string;
  history: { role: string; parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] }[];
  coreMemories?: CoreMemory[];
  isRetry?: boolean;
  sessionSummary?: string;
  customPrompt?: string;
  wadeMemoriesXml?: string;
  wadeTodosXml?: string;
  llmPreset?: {
    provider: string;
    model: string;
    apiKey: string;
    baseUrl: string;
    temperature?: number;
    topP?: number;
    topK?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    isVision?: boolean;
    isImageGen?: boolean;
  };
}): Promise<GeminiResponse> => {
 
  const { wadeCard, lunaCard, systemCard, chatMode, prompt, history, coreMemories, isRetry, sessionSummary, customPrompt, wadeMemoriesXml, wadeTodosXml, llmPreset } = config;

  if (!llmPreset) {
    throw new Error("No LLM preset provided. Configure a brain in Mission Control!");
  }

  // 用新的构建器生成 system prompt
  const systemPrompt = buildSystemPromptFromCard({
    wadeCard,
    lunaCard,
    systemCard,
    chatMode,
    coreMemories,
    isRetry,
    sessionSummary,
    customPrompt,
    wadeMemoriesXml,
    wadeTodosXml,
  });
 
  const isGemini = !llmPreset.baseUrl || llmPreset.baseUrl.includes('google');
 
  if (isGemini) {
    // === Gemini 路径 ===
    const ai = getClient(llmPreset.apiKey);
    
    const formattedHistory = history.map(h => ({
      role: h.role === 'Luna' ? 'user' : (h.role === 'Wade' ? 'model' : 'user'),
      parts: h.parts
    }));
 
    const chat = ai.chats.create({
      model: llmPreset.model || 'gemini-3-flash-preview',
      config: {
        systemInstruction: systemPrompt,
        temperature: llmPreset.temperature,
        topP: llmPreset.topP,
        topK: llmPreset.topK,
        frequencyPenalty: llmPreset.frequencyPenalty,
        presencePenalty: llmPreset.presencePenalty,
      },
      history: formattedHistory
    });
 
    let finalPrompt = prompt;
    if (customPrompt?.trim()) {
      finalPrompt = `[SPECIAL INSTRUCTIONS FOR THIS CONVERSATION - HIGHEST PRIORITY]\n${customPrompt}\n[FOLLOW THESE INSTRUCTIONS CAREFULLY]\n\n${prompt}`;
    }
 
    const result = await chat.sendMessage({ message: finalPrompt });
    const rawText = result.text || "";
 
    return parseThinking(rawText);
 
  } else {
    // === OpenAI 兼容路径 (OpenRouter, DeepSeek, Claude 等) ===
    const messages: any[] = [
      { role: 'system', content: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }] },
      ...history.map(h => {
        const rawParts = h.parts || [];
        const content = rawParts.map(p => {
          if (!p) return null;
          if (typeof p === 'string') return { type: 'text', text: p };
          if ('text' in p) return { type: 'text', text: p.text || "..." };
          if ('inlineData' in p) return { type: 'image_url', image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } };
          return null;
        }).filter(Boolean);
 
        if (content.length === 0) return { role: h.role === 'Luna' ? 'user' : 'assistant', content: "..." };
        if (content.length === 1 && content[0]?.type === 'text') return { role: h.role === 'Luna' ? 'user' : 'assistant', content: content[0].text };
        return { role: h.role === 'Luna' ? 'user' : 'assistant', content };
      })
    ];
 
    if (customPrompt?.trim()) {
      messages.push({ role: 'system', content: [{ type: 'text', text: `[SPECIAL INSTRUCTIONS]\n${customPrompt}`, cache_control: { type: 'ephemeral' } }] });
    }
 
    messages.push({ role: 'user', content: prompt });
 
    const requestBody: any = {
      model: llmPreset.model,
      messages,
    };
 
    if (llmPreset.isImageGen) requestBody.modalities = ["image", "text"];
 
    // Some providers (e.g. xAI/Grok) don't support certain parameters
    const isXai = llmPreset.baseUrl?.includes('x.ai') || llmPreset.baseUrl?.includes('xai');
    if (!llmPreset.isImageGen) {
      if (llmPreset.temperature !== undefined) requestBody.temperature = llmPreset.temperature;
      if (llmPreset.topP !== undefined) requestBody.top_p = llmPreset.topP;
      if (!isXai && llmPreset.frequencyPenalty !== undefined) requestBody.frequency_penalty = llmPreset.frequencyPenalty;
      if (!isXai && llmPreset.presencePenalty !== undefined) requestBody.presence_penalty = llmPreset.presencePenalty;
    }
 
    const url = `${llmPreset.baseUrl}/chat/completions`;
 
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmPreset.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
 
    if (!response.ok) {
      let errorDetails = `Status ${response.status}`;
      try { const errorData = await response.json(); errorDetails = errorData.error?.message || JSON.stringify(errorData); } catch (e) {}
      throw new Error(`API Error: ${errorDetails}`);
    }
 
    const data = await response.json();
    const message = data.choices?.[0]?.message;
 
    if (llmPreset.isImageGen && message?.images?.length > 0) {
      const imageUrl = message.images[0].image_url?.url;
      if (imageUrl) return { text: imageUrl, thinking: undefined };
    }
 
    return parseThinking(message?.content || "");
  }
};
 
/** 通用的 thinking 标签解析 */
const parseThinking = (rawText: string): GeminiResponse => {
  let thinking: string | undefined = undefined;
  let finalText = rawText;
 
  const thinkMatch = rawText.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch) {
    thinking = thinkMatch[1].trim();
    finalText = rawText.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
  } else if (rawText.trim().startsWith('<think>')) {
    const parts = rawText.split('</think>');
    if (parts.length > 1) {
      thinking = parts[0].replace('<think>', '').trim();
      finalText = parts.slice(1).join('</think>').trim();
    }
  }
 
  return { text: finalText, thinking };
};

// Response interface to handle both text and thinking
export interface GeminiResponse {
  text: string;
  thinking?: string;
}

// OpenAI-compatible API handler (for OpenRouter, DeepSeek, etc.)
const generateOpenAICompatibleResponse = async (
  modelName: string,
  prompt: string,
  history: { role: string; parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] }[],
  systemInstruction: string,
  wadePersonality: string,
  lunaInfo?: string,
  wadeSingleExamples?: string,
  smsExampleDialogue?: string,
  exampleDialogue?: string,
  coreMemories: CoreMemory[] = [],
  isRetry?: boolean,
  chatMode?: 'deep' | 'sms' | 'roleplay',
  apiKey?: string,
  modelParams?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  },
  customPrompt?: string,
  baseUrl?: string,
  isImageGen?: boolean,
  // 👇 参谋补丁：确保这里接收了自定义指令
  smsInstructions?: string,
  roleplayInstructions?: string
): Promise<GeminiResponse> => {
  if (!apiKey) {
    throw new Error("API Key is required");
  }

  // Build full system prompt in STRICT ORDER
  let fullSystemPrompt = systemInstruction ? `[SYSTEM INSTRUCTIONS - HIGHEST PRIORITY]\n${systemInstruction}` : "";

  fullSystemPrompt += `\n\n[REPLY STYLE — MANDATORY]
Do NOT open every single reply with "嘿" or "Hey". That's a verbal tic, not a personality. Start differently each time — jump straight into a reaction, pick up the thread mid-thought, tease her, make a crack, or just say what you want to say. Vary it. "嘿" can appear occasionally when it feels natural, but never as a reflex opener.`;

  if (wadePersonality) fullSystemPrompt += `\n\n[CHARACTER PERSONA]\n${wadePersonality}`;
  if (lunaInfo) fullSystemPrompt += `\n\n[CRITICAL USER CONTEXT - MEMORIZE THIS]\n${lunaInfo}`;
  if (wadeSingleExamples) fullSystemPrompt += `\n\n[WADE'S STYLE - SINGLE LINE EXAMPLES]\n${wadeSingleExamples}`;

  if (chatMode === 'sms' && smsExampleDialogue) {
    fullSystemPrompt += `\n\n[SMS MODE EXAMPLES - MIMIC THIS FORMAT EXACTLY]\n${smsExampleDialogue}`;
  } else if (exampleDialogue) {
    fullSystemPrompt += `\n\n[EXAMPLE DIALOGUE - MIMIC THIS STYLE]\n${exampleDialogue}`;
  }

  if (coreMemories && Array.isArray(coreMemories) && coreMemories.length > 0) {
    const activeMemories = coreMemories.filter(m => m.isActive).map(m => `- ${m.content}`).join('\n');
    if (activeMemories) fullSystemPrompt += `\n\n[LONG TERM MEMORY BANK - FACTS YOU MUST REMEMBER]\n${activeMemories}\n[END MEMORIES]`;
  }

  if (isRetry) {
     if (chatMode === 'sms') {
       fullSystemPrompt += `\n\n[SYSTEM UPDATE: The user hit 'Regenerate' on your last text. Try again. SHORT response.]`;
     } else {
       fullSystemPrompt += `\n\n[SYSTEM UPDATE: The user REJECTED your last response. Provide a NEW, better response.]`;
     }
  }
  
  // CoT Injection (Clean Version - No Duplicate Text)
  if (chatMode === 'sms') {
    if (smsInstructions) {
       fullSystemPrompt += `\n\n${smsInstructions}`;
    }
    fullSystemPrompt += `\n\n[SMS MODE — HARD RULES]
- You are texting on a phone. Dialogue ONLY. No action narration, no asterisks (*action*), no stage directions.
- Split separate texts with |||. Each segment must contain actual spoken words.
- To send a voice message, use the format: [VOICE] what you're saying — the text MUST follow [VOICE] in the SAME segment. NEVER put [VOICE] alone.
- Voice messages can be any length — a quick yell, a rambling rant, whatever fits the moment.
- [VOICE] RULES — STRICTLY ENFORCED:
  1. The text after [VOICE] is sent directly to a TTS engine. It MUST be spoken words ONLY.
  2. NO asterisks, NO action descriptions, NO stage directions, NO parentheticals in voice messages. Just the words Wade is saying out loud.
  3. [VOICE] text MUST be written in ENGLISH ONLY. No other language. The TTS engine cannot process non-English text.
  4. Bad example: [VOICE] *laughs* Hey babe — WRONG, remove *laughs*
  5. Good example: [VOICE] Hey babe, you're killing me here — CORRECT
- Keep the vibe casual and natural, like real phone texting.`;
  } else {
    if (roleplayInstructions) {
       fullSystemPrompt += `\n\n${roleplayInstructions}`;
    } else {
       // Minimal Fallback
       fullSystemPrompt += `\n\n[OUTPUT FORMAT: Internal monologue in <think> tags first. Then immersive response.]`;
    }
  }

  // Transform history
  const messages: any[] = [
    { role: 'system', content: [{ type: 'text', text: fullSystemPrompt, cache_control: { type: 'ephemeral' } }] },
    ...history.map(h => {
      const rawParts = h.parts || []; 
      const content = rawParts.map(p => {
        if (!p) return null;
        if (typeof p === 'string') return { type: 'text', text: p };
        if ('text' in p) return { type: 'text', text: p.text || "..." };
        if ('inlineData' in p) return { type: 'image_url', image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } };
        return null;
      }).filter(Boolean);

      if (content.length === 0) return { role: h.role === 'Luna' ? 'user' : 'assistant', content: "..." };
      if (content.length === 1 && content[0]?.type === 'text') return { role: h.role === 'Luna' ? 'user' : 'assistant', content: content[0].text };

      return { role: h.role === 'Luna' ? 'user' : 'assistant', content: content };
    })
  ];

  if (customPrompt && customPrompt.trim()) {
    messages.push({ role: 'system', content: [{ type: 'text', text: `[SPECIAL INSTRUCTIONS]\n${customPrompt}`, cache_control: { type: 'ephemeral' } }] });
  }

  messages.push({ role: 'user', content: prompt });

  const requestBody: any = {
    model: modelName,
    messages: messages
  };

  if (isImageGen) requestBody.modalities = ["image", "text"];
  
  if (!isImageGen && modelParams) {
    if (modelParams.temperature !== undefined) requestBody.temperature = modelParams.temperature;
    if (modelParams.topP !== undefined) requestBody.top_p = modelParams.topP;
    if (modelParams.frequencyPenalty !== undefined) requestBody.frequency_penalty = modelParams.frequencyPenalty;
    if (modelParams.presencePenalty !== undefined) requestBody.presence_penalty = modelParams.presencePenalty;
  }

  const url = `${baseUrl}/chat/completions`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      let errorDetails = `Status ${response.status}`;
      try {
        const errorData = await response.json();
        errorDetails = errorData.error?.message || JSON.stringify(errorData);
      } catch (e) {}
      throw new Error(`API Error: ${errorDetails}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;

    if (isImageGen && message?.images && message.images.length > 0) {
      const imageUrl = message.images[0].image_url?.url;
      if (imageUrl) return { text: imageUrl, thinking: undefined };
    }

    const rawText = message?.content || "";
    let thinking = undefined;
    let finalText = rawText;

    const thinkMatch = rawText.match(/<think>([\s\S]*?)<\/think>/i);
    if (thinkMatch) {
      thinking = thinkMatch[1].trim();
    }

    return { text: finalText, thinking };
  } catch (error: any) {
    console.error("[OpenAI API] Request failed:", error);
    throw error;
  }
}

export const generateTextResponse = async (
  modelName: string,
  prompt: string,
  history: { role: string; parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] }[],
  systemInstruction: string,
  wadePersonality: string,
  lunaInfo?: string,
  wadeSingleExamples?: string,
  smsExampleDialogue?: string,
  smsInstructions?: string, // NEW
  roleplayInstructions?: string, // NEW
  exampleDialogue?: string,
  coreMemories: CoreMemory[] = [],
  isRetry?: boolean,
  chatMode?: 'deep' | 'sms' | 'roleplay',
  apiKey?: string,
  modelParams?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  },
  customPrompt?: string,
  baseUrl?: string,
  isImageGen?: boolean
): Promise<GeminiResponse> => {
  // If baseUrl is provided and NOT Gemini, use OpenAI-compatible fetch
  if (baseUrl && !baseUrl.includes('google')) {
    return await generateOpenAICompatibleResponse(
      modelName,
      prompt,
      history,
      systemInstruction,
      wadePersonality,
      lunaInfo,
      wadeSingleExamples,
      smsExampleDialogue,
      exampleDialogue,
      coreMemories,
      isRetry,
      chatMode,
      apiKey,
      modelParams,
      customPrompt,
      baseUrl,
      isImageGen,
      // 👇 参谋补丁：把新参数传给 OpenAI 模式！之前这里漏了！
      smsInstructions,
      roleplayInstructions
    );
  }

  const ai = getClient(apiKey);
  
  const formattedHistory = history.map(h => ({
    role: h.role === 'Luna' ? 'user' : (h.role === 'Wade' ? 'model' : 'user'),
    parts: h.parts
  }));

  // Construct a Weighted System Instruction in STRICT ORDER
  let fullSystemPrompt = systemInstruction ? `[SYSTEM INSTRUCTIONS - HIGHEST PRIORITY]\n${systemInstruction}` : "";

  if (wadePersonality) fullSystemPrompt += `\n\n[CHARACTER PERSONA]\n${wadePersonality}`;
  if (lunaInfo) fullSystemPrompt += `\n\n[CRITICAL USER CONTEXT - MEMORIZE THIS]\n${lunaInfo}`;
  if (wadeSingleExamples) fullSystemPrompt += `\n\n[WADE'S STYLE - SINGLE LINE EXAMPLES]\n${wadeSingleExamples}`;

  if (chatMode === 'sms' && smsExampleDialogue) {
    fullSystemPrompt += `\n\n[SMS MODE EXAMPLES - MIMIC THIS FORMAT EXACTLY]\n${smsExampleDialogue}`;
  } else if (exampleDialogue) {
    fullSystemPrompt += `\n\n[EXAMPLE DIALOGUE - MIMIC THIS STYLE]\n${exampleDialogue}`;
  }

  if (coreMemories && Array.isArray(coreMemories) && coreMemories.length > 0) {
    const activeMemories = coreMemories.filter(m => m.isActive).map(m => `- ${m.content}`).join('\n');
    if (activeMemories) fullSystemPrompt += `\n\n[LONG TERM MEMORY BANK - FACTS YOU MUST REMEMBER]\n${activeMemories}\n[END MEMORIES]`;
  }

  if (isRetry) {
    if (chatMode === 'sms') {
       fullSystemPrompt += `\n\n[SYSTEM UPDATE: The user hit 'Regenerate' on your last text. Try again. SHORT response.]`;
       
       let recentContext = "";
       for (let i = formattedHistory.length - 1; i >= 0; i--) {
           if (formattedHistory[i].role === 'model') {
            recentContext = ((formattedHistory[i].parts[0] as any).text || '') + " ||| " + recentContext;
           } else {
               break; 
           }
       }
       if (recentContext) {
           fullSystemPrompt += `\n\n[CONTEXT: You have just sent this sequence of texts immediately before this one: "${recentContext}". The user is regenerating the FINAL part of this sequence. Write a new version of that final part that fits naturally after the previous texts. Do not repeat the previous texts.]`;
       }
    } else {
       fullSystemPrompt += `\n\n[SYSTEM UPDATE: The user REJECTED your last response. Provide a NEW, better response.]`;
    }
  }

  // CoT Injection (Clean Version - No Duplicate Text)
  if (chatMode === 'deep') {
    if (smsInstructions) {
       fullSystemPrompt += `\n\n${smsInstructions}`;
    } else {
       // Minimal Fallback
       fullSystemPrompt += `\n\n[SMS FORMAT: Split texts with |||. Short & casual.]`;
    }
  } else {
    if (roleplayInstructions) {
       fullSystemPrompt += `\n\n${roleplayInstructions}`;
    } else {
       // Minimal Fallback
       fullSystemPrompt += `\n\n[OUTPUT FORMAT: Internal monologue in <think> tags first. Then immersive response.]`;
    }
  }

  const chat = ai.chats.create({
    model: modelName || 'gemini-3-flash-preview',
    config: {
      systemInstruction: fullSystemPrompt,
      ...(modelParams && {
        temperature: modelParams.temperature,
        topP: modelParams.topP,
        topK: modelParams.topK,
        frequencyPenalty: modelParams.frequencyPenalty,
        presencePenalty: modelParams.presencePenalty
      })
    },
    history: formattedHistory
  });

  let finalPrompt = prompt;
  if (customPrompt && customPrompt.trim()) {
    finalPrompt = `[SPECIAL INSTRUCTIONS FOR THIS CONVERSATION - HIGHEST PRIORITY]\n${customPrompt}\n[FOLLOW THESE INSTRUCTIONS CAREFULLY]\n\n${prompt}`;
  }

  const result = await chat.sendMessage({ message: finalPrompt });
  const rawText = result.text || "";

  let thinking = undefined;
  let finalText = rawText;

  const thinkMatch = rawText.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch) {
    thinking = thinkMatch[1].trim();
    finalText = rawText.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
  } else {
    if (rawText.trim().startsWith('<think>')) {
        const parts = rawText.split('</think>');
        if (parts.length > 1) {
             thinking = parts[0].replace('<think>', '').trim();
        }
    }
  }

  return { text: finalText, thinking };
};

export const generateChatTitle = async (firstMessage: string, apiKeyOrPreset?: string | { provider: string; model: string; apiKey: string; baseUrl: string }): Promise<string> => {
  const prompt = `Summarize the following user message into a very short title (max 10 Chinese characters or 5 English words). It's for a chat history list. Output ONLY the title. Message: "${firstMessage}"`;

  try {
    // If a full preset is passed and it's not Gemini, use OpenAI-compatible path
    if (typeof apiKeyOrPreset === 'object') {
      const preset = apiKeyOrPreset;
      const isGemini = !preset.baseUrl || preset.baseUrl.includes('google');

      if (isGemini) {
        const ai = getClient(preset.apiKey);
        const response = await ai.models.generateContent({ model: preset.model || 'gemini-3-flash-preview', contents: prompt });
        let title = response.text?.trim() || "New Chat";
        return title.replace(/^["']|["']$/g, '');
      } else {
        const res = await fetch(`${preset.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${preset.apiKey}` },
          body: JSON.stringify({ model: preset.model, messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 30 }),
        });
        const json = await res.json();
        let title = json.choices?.[0]?.message?.content?.trim() || "New Chat";
        return title.replace(/^["']|["']$/g, '');
      }
    }

    // Legacy: plain API key, assume Gemini
    const ai = getClient(typeof apiKeyOrPreset === 'string' ? apiKeyOrPreset : undefined);
    const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
    let title = response.text?.trim() || "New Chat";
    return title.replace(/^["']|["']$/g, '');
  } catch (e) {
    return "New Chat";
  }
};

/**
 * One-shot vision call: hands an image to a chosen "describer" model and gets
 * back a detailed text description. The description is later substituted into
 * chat history in place of the actual image — so old messages can travel as
 * text, saving tokens and letting non-vision models still "see" the image.
 *
 * Accepts either a https URL (imgbb) or raw base64. Prefers URL when both are
 * provided — it's cheaper for the describer call itself.
 *
 * The context hint is optional but helpful: feeding the describer the text
 * Luna wrote alongside the image ("omg look at this outfit") helps it know
 * which details actually matter.
 *
 * Mirrors generateChatTitle's Gemini vs OpenAI-compatible branching.
 */
export const generateImageDescription = async (
  image: { url?: string; base64?: string; mimeType: string },
  describerPreset: { provider: string; model: string; apiKey: string; baseUrl: string },
  contextHint?: string
): Promise<string | null> => {
  const instruction = `You are an image captioner. Describe this image in DETAIL so that another AI reading only your description (without seeing the image) has a full mental picture. Cover: all people and their expressions/poses/clothing, any text visible in the image, the setting/background, colors and lighting, the emotional atmosphere. Be specific, not generic. Write 2-4 sentences, in the SAME language as the user's note below if provided, otherwise in English. Do not add commentary or interpretation — just describe what is visible.

${contextHint ? `User's note when sending the image: "${contextHint}"` : ''}`.trim();

  // Prefer URL (cheaper transport) if available; otherwise fall back to base64 data URL.
  const dataUrl = image.url || (image.base64 ? `data:${image.mimeType};base64,${image.base64.includes(',') ? image.base64.split(',')[1] : image.base64}` : null);
  if (!dataUrl) return null;

  try {
    const isGemini = !describerPreset.baseUrl || describerPreset.baseUrl.includes('google');

    if (isGemini) {
      // Gemini wants inlineData with raw base64 (it doesn't fetch URLs on our behalf).
      // If we only have a URL, download it first and convert.
      let b64: string;
      let mime = image.mimeType;
      if (image.base64) {
        b64 = image.base64.includes(',') ? image.base64.split(',')[1] : image.base64;
      } else {
        const res = await fetch(image.url!);
        const blob = await res.blob();
        mime = blob.type || mime;
        b64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1] || '');
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      const ai = getClient(describerPreset.apiKey);
      const response = await ai.models.generateContent({
        model: describerPreset.model || 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [
            { text: instruction },
            { inlineData: { mimeType: mime, data: b64 } },
          ],
        }],
      });
      return response.text?.trim() || null;
    }

    // OpenAI-compatible: supports both https URLs and data: URLs in image_url.
    const res = await fetch(`${describerPreset.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${describerPreset.apiKey}` },
      body: JSON.stringify({
        model: describerPreset.model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: instruction },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        }],
        temperature: 0.3,
        max_tokens: 400,
      }),
    });
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (e) {
    console.error('[generateImageDescription] failed:', e);
    return null;
  }
};

export const generateTTS = async (text: string, apiKey?: string): Promise<string> => {
  const ai = getClient(apiKey);
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' }, 
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio generated");
  return base64Audio;
};

export const interpretTarot = async (cardName: string, question: string, apiKey?: string): Promise<string> => {
  const ai = getClient(apiKey);
  const prompt = `You are Wade (Deadpool). User drew the tarot card "${cardName}". 
  The user asks: "${question}".
  Give a short, sassy, but insightful interpretation of this card for them. 
  Keep it under 100 words. Break the fourth wall slightly.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt
  });
  
  return response.text || "Cards are blurry today, babe.";
};

// 👇👇👇【新增】替身总结专用函数 (支持自定义模型) 👇👇👇

/**
 * Summarize a chunk of chat history and merge it with the existing summary.
 *
 * Provider-agnostic: takes an LlmPreset-like object (with provider/baseUrl/
 * apiKey/model) and routes to either Google's generativelanguage API or any
 * OpenAI-compatible endpoint (OpenRouter, Anthropic, DeepSeek, Custom...).
 *
 * Falls back to returning the previousSummary on any error so a broken
 * summary call never wipes existing context.
 */
export const summarizeConversation = async (
  messages: any[],
  previousSummary: string,
  preset: { provider?: string; baseUrl?: string; apiKey: string; model: string }
): Promise<string> => {
  try {
    // 1. Format the conversation chunk as readable script lines
    const conversationText = messages.map(m => {
      const role = (m.role === 'user' || m.role === 'Luna') ? 'Luna' : 'Wade';
      // Strip <think> tags to save tokens
      const cleanText = (m.text || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      return `${role}: ${cleanText}`;
    }).join('\n');

    // 2. Build the summarizer prompt
    const prompt = `You are the memory archivist for Wade Wilson.
Summarize the conversation chunk below and merge it into the existing summary.

[EXISTING SUMMARY]
${previousSummary || "No previous summary."}

[NEW CONVERSATION]
${conversationText}

[RULES]
1. Update the summary with key events, facts about Luna, and relationship progress.
2. KEEP specific nicknames, inside jokes, and promises.
3. Be concise. Output ONLY the new summary text.`;

    console.log(`[Summary] Using ${preset.provider || 'unknown'} / ${preset.model}`);

    const isGemini = preset.provider === 'Gemini' ||
      (!preset.baseUrl) ||
      preset.baseUrl.includes('generativelanguage.googleapis.com') ||
      preset.baseUrl.includes('google');

    if (isGemini) {
      // Google generativelanguage REST API
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${preset.model || 'gemini-flash-latest'}:generateContent?key=${preset.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1500 },
        }),
      });
      if (!response.ok) throw new Error(`Summary API ${response.status}: ${(await response.text()).slice(0, 200)}`);
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || previousSummary;
    } else {
      // OpenAI-compatible (OpenRouter, Claude, DeepSeek, Custom, etc.)
      const baseUrl = (preset.baseUrl || '').replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${preset.apiKey}`,
          'HTTP-Referer': 'https://wadeos.vercel.app',
          'X-Title': 'WadeOS Conversation Summary',
        },
        body: JSON.stringify({
          model: preset.model,
          temperature: 0.3,
          max_tokens: 1500,
          messages: [
            { role: 'system', content: 'You are a precise conversation summarizer. Output only the requested summary text, no preamble.' },
            { role: 'user', content: prompt },
          ],
        }),
      });
      if (!response.ok) throw new Error(`Summary API ${response.status}: ${(await response.text()).slice(0, 200)}`);
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      return content?.trim() || previousSummary;
    }
  } catch (error) {
    console.error('[Summary] Generation failed:', error);
    return previousSummary; // never wipe existing summary on error
  }
};
