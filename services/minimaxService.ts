// 这是型号说明书，绝对不能删！
export interface MinimaxTTSConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  voiceId?: string;
  speed?: number;
  vol?: number;
  pitch?: number;
  emotion?: string;
  sampleRate?: number;
  bitrate?: number | string;
  format?: string;
  channel?: number;
}

function splitLongText(text: string, maxLength = 5000): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxLength, text.length);
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}

// 这是执行动作
export const generateMinimaxTTS = async (
  text: string,
  config: MinimaxTTSConfig
): Promise<string> => {
  try {
    const response = await fetch('/api/minimax-tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text, config })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.audio) {
      throw new Error('No audio data returned from API');
    }

    const hexAudio = data.audio;
    const bytes = new Uint8Array(hexAudio.match(/.{1,2}/g).map((byte: string) => parseInt(byte, 16)));

    // 【参谋的防噎死补丁：不要一口气吞，用循环一点点拼起来，这下绝对不会内存溢出了】
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    // 拼完之后再转换
    const base64Audio = btoa(binary);

    return base64Audio;
  } catch (error) {
    console.error('Minimax TTS generation failed:', error);
    throw error;
  }
};

// 【参谋批注】：Grok 让你写的那个半吊子 WebSocket 烂尾楼，老子先给你用注释封印了，免得它在底下捣乱！
/*
export const testMinimaxWebSocket = (apiKey: string) => {
  const ws = new WebSocket('wss://api.minimax.io/ws/v1/t2a_v2');

  ws.onopen = () => {
    console.log('WebSocket 连接成功！');
    ws.close();  // 先连上就关掉，测试用
  };

  ws.onerror = (err) => {
    console.error('WebSocket 连接失败：', err);
  };

  ws.onclose = () => {
    console.log('WebSocket 已关闭');
  };
};
*/
