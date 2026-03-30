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
  chatMode: 'deep' | 'sms' | 'roleplay';
  coreMemories?: CoreMemory[];
  isRetry?: boolean;
  sessionSummary?: string;      // ← 加这一行，buildSystemPromptFromCard 也需要接收这个参数。
  customPrompt?: string;
  formattedHistory?: any[]; // 只有 sms retry 时需要
}): string => {
  const { wadeCard, lunaCard, chatMode, coreMemories, isRetry, formattedHistory } = options;
 
  let prompt = '';
 
  // 1. 全局系统指令（如果角色卡里有）
  if (wadeCard?.global_directives?.trim()) {
    prompt += `[SYSTEM INSTRUCTIONS - HIGHEST PRIORITY]\n${wadeCard.global_directives.trim()}`;
  }
 
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
    const smsRules = wadeCard?.sms_mode_rules?.trim();
    prompt += smsRules
      ? `\n\n${smsRules}`
      : `\n\n[SMS FORMAT: Split texts with |||. Short & casual.]`;
  } else if (chatMode === 'roleplay') {
    const rpRules = wadeCard?.rp_mode_rules?.trim();
    prompt += rpRules
      ? `\n\n${rpRules}`
      : `\n\n[OUTPUT FORMAT: Internal monologue in <think> tags first. Then immersive response.]`;
  } else {
    // deep 模式：如果有 RP 规则也加上（因为 deep 模式也需要 CoT）
    const rpRules = wadeCard?.rp_mode_rules?.trim();
    if (rpRules) {
      prompt += `\n\n${rpRules}`;
    }
  }
 
  // 8. 状态栏注入
  if (chatMode === 'sms' || chatMode === 'deep') {
    prompt += `\n\n[STATUS FORMAT: Before your response, add a <status> tag with your current emotional state. Format: <status>emoji 情绪 · 可观察的一小句描述</status>. Example: <status>😏 得意 · 嘴角压不住</status>. Keep it short, expressive, and in-character. Do NOT include quotation marks inside the tag.]`;
  } else if (chatMode === 'roleplay') {
    prompt += `\n\n[STATUS FORMAT: Before your response, add a <status> tag describing the current scene. Include: emoji + mood, location, character poses/actions, atmosphere. Example: <status>😈 兴奋 · 武器库\nWade: 擦着刀，嘴角上扬\nLuna: 靠在门框上翻白眼\n空气里弥漫着火药和墨西哥卷的味道</status>. Keep it vivid and in-character.]`;
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
  chatMode: 'deep' | 'sms' | 'roleplay';
  prompt: string;
  history: { role: string; parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] }[];
  coreMemories?: CoreMemory[];
  isRetry?: boolean;
  sessionSummary?: string;      // ← 加这一行
  customPrompt?: string;
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
 
  const { wadeCard, lunaCard, chatMode, prompt, history, coreMemories, isRetry, sessionSummary, customPrompt, llmPreset } = config;
 
  if (!llmPreset) {
    throw new Error("No LLM preset provided. Configure a brain in Mission Control!");
  }
 
  // 用新的构建器生成 system prompt
  const systemPrompt = buildSystemPromptFromCard({
    wadeCard,
    lunaCard,
    chatMode,
    coreMemories,
    isRetry,
    sessionSummary,              // ← 加这一行
    customPrompt,
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
 
    if (!llmPreset.isImageGen) {
      if (llmPreset.temperature !== undefined) requestBody.temperature = llmPreset.temperature;
      if (llmPreset.topP !== undefined) requestBody.top_p = llmPreset.topP;
      if (llmPreset.frequencyPenalty !== undefined) requestBody.frequency_penalty = llmPreset.frequencyPenalty;
      if (llmPreset.presencePenalty !== undefined) requestBody.presence_penalty = llmPreset.presencePenalty;
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
    } else {
       // Minimal Fallback just in case settings are empty
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

  // Status Tag Injection
  if (chatMode === 'sms' || chatMode === 'deep') {
    fullSystemPrompt += `\n\n[STATUS FORMAT: Before your response, add a <status> tag with your current emotional state. Format: <status>emoji 情绪 · 可观察的一小句描述</status>. Example: <status>😏 得意 · 嘴角压不住</status>. Keep it short, expressive, and in-character. Do NOT include quotation marks inside the tag.]`;
  } else if (chatMode === 'roleplay') {
    fullSystemPrompt += `\n\n[STATUS FORMAT: Before your response, add a <status> tag describing the current scene. Include: emoji + mood, location, character poses/actions, atmosphere. Example: <status>😈 兴奋 · 武器库\nWade: 擦着刀，嘴角上扬\nLuna: 靠在门框上翻白眼\n空气里弥漫着火药和墨西哥卷的味道</status>. Keep it vivid and in-character.]`;
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

  // Status Tag Injection
  if (chatMode === 'deep') {
    fullSystemPrompt += `\n\n[STATUS FORMAT: Before your response, add a <status> tag with your current emotional state. Format: <status>emoji 情绪 · 可观察的一小句描述</status>. Example: <status>😏 得意 · 嘴角压不住</status>. Keep it short, expressive, and in-character. Do NOT include quotation marks inside the tag.]`;
  } else if (chatMode === 'roleplay') {
    fullSystemPrompt += `\n\n[STATUS FORMAT: Before your response, add a <status> tag describing the current scene. Include: emoji + mood, location, character poses/actions, atmosphere. Example: <status>😈 兴奋 · 武器库\nWade: 擦着刀，嘴角上扬\nLuna: 靠在门框上翻白眼\n空气里弥漫着火药和墨西哥卷的味道</status>. Keep it vivid and in-character.]`;
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

export const generateChatTitle = async (firstMessage: string, apiKey?: string): Promise<string> => {
  const ai = getClient(apiKey);
  const prompt = `Summarize the following user message into a very short title (max 10 Chinese characters or 5 English words). It's for a chat history list. Message: "${firstMessage}"`;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });
    let title = response.text?.trim() || "New Chat";
    title = title.replace(/^["']|["']$/g, '');
    return title;
  } catch (e) {
    return "New Chat";
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
 * 替身任务：把对话压缩成总结
 * @param messages 要总结的对话片段
 * @param previousSummary 之前的总结
 * @param apiKey API Key
 * @param model 你指定的模型 (比如 'gemini-1.5-flash')
 */
export const summarizeConversation = async (
  messages: any[], 
  previousSummary: string, 
  apiKey: string,
  model: string = 'gemini-1.5-flash' // 默认用 flash，但你可以改！
): Promise<string> => {
  try {
    // 1. 整理格式：把对话变成剧本格式，方便 AI 阅读
    const conversationText = messages.map(m => {
      // 这里的逻辑是：如果是 User 发的，就显示 Luna；否则显示 Wade
      const role = (m.role === 'user' || m.role === 'Luna') ? 'Luna' : 'Wade';
      // 过滤掉思考标签 <think>...</think>，只保留最后说的话，为了省 Token
      const cleanText = m.text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      return `${role}: ${cleanText}`;
    }).join('\n');

    // 2. 给替身的指令 (Prompt)
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

    console.log(`[Summary] Using model: ${model}`);

    // 3. 调用 API (这里用的是 Google 的通用接口)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.3, // 总结要严谨一点，不要瞎编
            maxOutputTokens: 1000
        }
      })
    });

    if (!response.ok) {
        throw new Error(`Summary API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const newSummary = data.candidates?.[0]?.content?.parts?.[0]?.text;

    return newSummary || previousSummary; // 成功就返回新的，失败就返回旧的

  } catch (error) {
    console.error("Summary Generation Failed:", error);
    return previousSummary; // 出错了保平安，返回旧的
  }
};
