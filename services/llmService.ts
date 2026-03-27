import { GoogleGenAI } from "@google/genai";

/**
 * 统一的轻量文本生成入口
 * 根据 preset 的 provider 字段判断走 Google SDK 还是 OpenAI 兼容接口
 * 用于首页语录、标题生成等简单场景
 */
export const generateSimpleText = async (
  preset: { apiKey: string; provider: string; baseUrl: string; model?: string },
  prompt: string
): Promise<string> => {
  if (!preset.apiKey) {
    throw new Error("API Key is required");
  }

  // Google（Gemini）走专有 SDK，其他所有服务走 OpenAI 兼容接口
  if (preset.provider === 'Gemini') {
    const ai = new GoogleGenAI({ apiKey: preset.apiKey });
    const response = await ai.models.generateContent({
      model: preset.model || 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "";
  }

  // Claude, OpenAI, DeepSeek, OpenRouter, 硅基流动, Custom... 全走这条路
  const url = `${preset.baseUrl}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${preset.apiKey}`
    },
    body: JSON.stringify({
      model: preset.model || 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200
    })
  });

  if (!res.ok) {
    let errorDetails = `Status ${res.status}`;
    try {
      const errorData = await res.json();
      errorDetails = errorData.error?.message || JSON.stringify(errorData);
    } catch (e) {}
    throw new Error(`API Error: ${errorDetails}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
};