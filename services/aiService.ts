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
    personality_traits: 'personality_traits',
    speech_patterns: 'speech_patterns',
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
  wadeDiaryXml?: string; // recent diary entries so Wade knows what he wrote
  wadeTodosXml?: string; // pending notes injected at the very end (most volatile)
}): string => {
  const { wadeCard, lunaCard, systemCard, chatMode, coreMemories, isRetry, formattedHistory } = options;

  // Prefer system card values, fall back to wade card (backward compat)
  const globalDirectives = systemCard?.global_directives?.trim() || wadeCard?.global_directives?.trim();
  const smsRulesEffective = systemCard?.sms_mode_rules?.trim() || wadeCard?.sms_mode_rules?.trim();
  const rpRulesEffective = systemCard?.rp_mode_rules?.trim() || wadeCard?.rp_mode_rules?.trim();

  let prompt = '';

  // ================================================================
  // PROMPT ORDER — stable-to-volatile, optimized for Anthropic prompt
  // cache (1h TTL via cache_control). Anything before the first
  // dynamic block stays cached across turns; reorder with care.
  // Reordered 2026-04-18: `[CURRENT TIME]` moved from #2 to the tail
  // so minute-precision drift doesn't invalidate persona + rules +
  // memories every single call. Also dropped time precision from
  // minute to hour so the cache holds for a full hour at a time.
  // ================================================================

  // 1. 全局系统指令（最静态、最长 → 放最前，缓存价值最高）
  if (globalDirectives) {
    prompt += `[SYSTEM INSTRUCTIONS - HIGHEST PRIORITY]\n${globalDirectives}`;
  }

  // 2. Wade 的身份（XML）
  if (wadeCard?.core_identity?.trim()) {
    prompt += `\n\n[CHARACTER PERSONA]\n`;
    prompt += cardDataToXML(wadeCard, 'Wade');
  }

  // 3. Luna 的身份（XML）
  if (lunaCard?.core_identity?.trim()) {
    prompt += `\n\n[USER IDENTITY]\n`;
    prompt += cardDataToXML(lunaCard, 'Luna');
  }

  // 4. 示例对话（静态）
  if (wadeCard?.example_punchlines?.trim()) {
    prompt += `\n\n[WADE'S STYLE - SINGLE LINE EXAMPLES]\n${wadeCard.example_punchlines.trim()}`;
  }
  // Mixed mode: SMS and general/RP examples are both useful reference since a
  // single thread now contains both short-bubble texting AND longer narration
  // turns. Send whichever fields have content — Wade's range comes from seeing
  // both, not from being constrained to one.
  if (wadeCard?.example_dialogue_sms?.trim()) {
    prompt += `\n\n[SMS MODE EXAMPLES - TONE REFERENCE, NOT A RIGID TEMPLATE]\n${wadeCard.example_dialogue_sms.trim()}`;
  }
  if (wadeCard?.example_dialogue_general?.trim()) {
    prompt += `\n\n[EXAMPLE DIALOGUE - MIMIC THIS STYLE]\n${wadeCard.example_dialogue_general.trim()}`;
  }

  // 5. 模式专属规则（静态 per mode）
  if (chatMode === 'sms') {
    if (smsRulesEffective) prompt += `\n\n${smsRulesEffective}`;
  } else if (chatMode === 'roleplay') {
    prompt += rpRulesEffective
      ? `\n\n${rpRulesEffective}`
      : `\n\n[OUTPUT FORMAT: Internal monologue in <think> tags first. Then immersive response.]`;
  } else {
    // deep 模式：如果有 RP 规则也加上（因为 deep 模式也需要 CoT）
    if (rpRulesEffective) prompt += `\n\n${rpRulesEffective}`;
  }

  // 6. 长期记忆（慢变：Luna 改 memory 时）
  if (coreMemories && coreMemories.length > 0) {
    // Prefix the title (when present) as a bracketed topic tag so the model
    // can quickly locate which fact is relevant without re-parsing the
    // sentence. Memories without a title fall back to bare content — no
    // visual noise, and the format stays backwards-compatible.
    const activeMemories = coreMemories.filter(m => m.isActive).map(m => {
      const title = m.title?.trim();
      return title ? `- [${title}] ${m.content}` : `- ${m.content}`;
    }).join('\n');
    if (activeMemories) {
      prompt += `\n\n[LONG TERM MEMORY BANK - FACTS YOU MUST REMEMBER]\n${activeMemories}\n[END MEMORIES]`;
    }
  }

  // 7. 对话摘要（变：Fresh Start / auto-summary 后）
  if (options.sessionSummary) {
    prompt += `\n\n[PREVIOUS CONVERSATION SUMMARY]\n${options.sessionSummary}\n[END SUMMARY]`;
  }

  // 8. wade_memories（每轮变：向量搜索结果）
  if (options.wadeMemoriesXml) {
    prompt += options.wadeMemoriesXml;
  }

  // 9. wade_diary（变：写新日记时）
  if (options.wadeDiaryXml) {
    prompt += options.wadeDiaryXml;
  }

  // 10. wade_todos（最动态：每轮都可能 +1 / -1）
  if (options.wadeTodosXml) {
    prompt += options.wadeTodosXml;
  }

  // 11. 时间感知 — 放在最后。精度降到小时，让缓存能整小时地命中；
  // Wade 基本用不到分钟级时间，有需要时他会直接问工具。
  const now = new Date();
  const tokyoTime = now.toLocaleString('en-US', {
    timeZone: 'Asia/Tokyo',
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    hour12: false,
  });
  prompt += `\n\n[CURRENT TIME]\n${tokyoTime} (Tokyo)`;

  // 12. 重试提示（只在 regenerate 时出现，放最后不影响正常调用的缓存）
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
  wadeDiaryXml?: string;
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
 
  const { wadeCard, lunaCard, systemCard, chatMode, prompt, history, coreMemories, isRetry, sessionSummary, customPrompt, wadeMemoriesXml, wadeDiaryXml, wadeTodosXml, llmPreset } = config;

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
    wadeDiaryXml,
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
      // XML-wrap the Special Sauce so the model treats it as a structured
      // directive block embedded in the user turn, not as part of Luna's
      // message. Closing tag + priority hint keep it distinct from the
      // actual dialogue that follows.
      finalPrompt = `<special_instructions priority="highest">\n${customPrompt}\n</special_instructions>\n\n${prompt}`;
    }
 
    const result = await chat.sendMessage({ message: finalPrompt });
    let rawText = result.text || "";
    // Empty replies are usually safety filter or payload issues — return a
    // diagnostic string instead of silently falling through to "…" so the
    // next bubble tells Luna what actually happened.
    if (!rawText.trim()) {
      const cand = (result as any).candidates?.[0];
      const diag = {
        finishReason: cand?.finishReason,
        safetyRatings: cand?.safetyRatings?.filter((r: any) => r.blocked || r.probability !== 'NEGLIGIBLE'),
        promptFeedback: (result as any).promptFeedback,
        historyLen: history.length,
        imageMsgs: history.filter((h) => h.parts?.some((p: any) => 'inlineData' in p)).length,
      };
      console.warn('[aiService/Gemini] empty response', diag);
      rawText = `[debug] Gemini returned empty. finish=${diag.finishReason || '?'} imgs=${diag.imageMsgs} safety=${JSON.stringify(diag.safetyRatings || [])}`;
    }

    return parseThinking(rawText);
 
  } else {
    // === OpenAI 兼容路径 (OpenRouter, DeepSeek, Claude 等) ===
    const messages: any[] = [
      { role: 'system', content: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral', ttl: '1h' } }] },
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
      messages.push({ role: 'system', content: [{ type: 'text', text: `<special_instructions priority="highest">\n${customPrompt}\n</special_instructions>`, cache_control: { type: 'ephemeral' } }] });
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

    // Normalize cache/usage info across providers. OpenRouter exposes:
    //   usage.prompt_tokens_details.cached_tokens        (cache reads)
    //   usage.prompt_tokens_details.cache_creation_tokens (some providers)
    // Anthropic passthrough adds:
    //   usage.cache_creation_input_tokens
    //   usage.cache_read_input_tokens
    // Pick whichever is present and collapse into one shape.
    const rawUsage = data.usage;
    const usage = rawUsage ? {
      promptTokens: rawUsage.prompt_tokens ?? rawUsage.input_tokens,
      completionTokens: rawUsage.completion_tokens ?? rawUsage.output_tokens,
      cachedTokens:
        rawUsage.prompt_tokens_details?.cached_tokens ??
        rawUsage.cache_read_input_tokens ??
        0,
      cacheCreationTokens:
        rawUsage.prompt_tokens_details?.cache_creation_tokens ??
        rawUsage.cache_creation_input_tokens ??
        0,
      raw: rawUsage,
    } : undefined;

    if (usage) {
      const cached = usage.cachedTokens || 0;
      const total = usage.promptTokens || 0;
      const hitRate = total > 0 ? Math.round((cached / total) * 100) : 0;
      console.log(
        `[aiService] usage → prompt:${total} (cache read:${cached} = ${hitRate}%, cache create:${usage.cacheCreationTokens || 0}) completion:${usage.completionTokens || 0}`
      );
    }

    if (llmPreset.isImageGen && message?.images?.length > 0) {
      const imageUrl = message.images[0].image_url?.url;
      if (imageUrl) return { text: imageUrl, thinking: undefined, usage };
    }

    const parsed = parseThinking(message?.content || "");
    return { ...parsed, usage };
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
  /** Usage breakdown surfaced from the provider — undefined when we couldn't
   * parse it. OpenRouter / OpenAI-compat returns `prompt_tokens`, `completion_tokens`
   * and `prompt_tokens_details.cached_tokens`. Anthropic passthrough adds
   * `cache_creation_input_tokens` / `cache_read_input_tokens`. We normalize
   * everything into one shape so UI code doesn't have to switch on provider. */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    cachedTokens?: number;       // tokens served from cache (read)
    cacheCreationTokens?: number; // tokens written into cache this turn
    raw?: any;                    // the full usage object for debugging
  };
}

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
 * Accepts either a https URL (Drive proxy) or raw base64. Prefers URL when both are
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
// Detect when the summarizer echoed a raw transcript instead of producing
// a summary. A legit summary is narrative prose; an echo has many lines
// that start with "Luna:" / "Wade:" (the speaker labels we fed in). Three
// or more such line-starts is almost certainly a bad echo — weak models
// (notably GLM-5, some self-hosted) occasionally do this. Used to gate
// the return so we don't silently overwrite a good summary with garbage.
function looksLikeTranscript(text: string): boolean {
  if (!text) return false;
  const speakerLines = text.match(/^\s*(Luna|Wade)\s*[:：]/gm) || [];
  return speakerLines.length >= 3;
}

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
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (looksLikeTranscript(raw)) {
        console.warn('[Summary] LLM echoed transcript — rejecting, keeping previous summary');
        return previousSummary;
      }
      return raw || previousSummary;
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
      const trimmed = content?.trim() || '';
      if (looksLikeTranscript(trimmed)) {
        console.warn('[Summary] LLM echoed transcript — rejecting, keeping previous summary');
        return previousSummary;
      }
      return trimmed || previousSummary;
    }
  } catch (error) {
    console.error('[Summary] Generation failed:', error);
    return previousSummary; // never wipe existing summary on error
  }
};
