export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, config } = req.body;

  if (!text || !config || !config.apiKey) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let cleanBaseUrl = config.baseUrl || 'https://api.minimax.io';
  if (cleanBaseUrl.endsWith('/v1')) {
    cleanBaseUrl = cleanBaseUrl.replace('/v1', '');
  }

  const speed = Number(config.speed) || 1;
  const vol = Number(config.vol) || 1;
  const pitch = Number(config.pitch) || 0;
  const sampleRate = Number(config.sampleRate) || 32000;
  const channel = Number(config.channel) || 1;

  let bitrate = config.bitrate;
  if (typeof bitrate === 'string') {
    if (bitrate.includes('128')) bitrate = 128000;
    else if (bitrate.includes('64')) bitrate = 64000;
    else if (bitrate.includes('32')) bitrate = 32000;
    else if (bitrate.includes('256')) bitrate = 256000;
    else bitrate = Number(bitrate) || 128000;
  } else {
    bitrate = bitrate || 128000;
  }

  let emotion = config.emotion;
  if (emotion && (emotion.includes('Auto') || emotion.trim() === '')) {
    emotion = undefined;
  }

  const requestBody = {
    model: config.model || 'speech-2.8-hd',
    text,
    stream: false,
    voice_setting: {
      voice_id: config.voiceId || 'English_expressive_narrator',
      speed,
      vol,
      pitch,
      ...(emotion && { emotion })
    },
    audio_setting: {
      sample_rate: sampleRate,
      bitrate,
      format: config.format || 'mp3',
      channel
    },
    output_format: 'hex'
  };

  try {
    const response = await fetch(`${cleanBaseUrl}/v1/t2a_v2`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ 
        error: `Minimax API Error: ${response.status} - ${errorText}` 
      });
    }

    const data = await response.json();

    if (data.base_resp?.status_code !== 0) {
      return res.status(400).json({ 
        error: `Minimax API Error: ${data.base_resp?.status_msg || 'Unknown error'}` 
      });
    }

    if (!data.data?.audio) {
      return res.status(500).json({ error: 'No audio data returned from Minimax API' });
    }

    res.status(200).json({ 
      audio: data.data.audio,
      extra_info: data.extra_info 
    });

  } catch (error) {
    console.error('Minimax TTS proxy error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
