import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { generateMinimaxTTS } from '../services/minimaxService';

interface UseTTSReturn {
  /** 播放或暂停。传入文字和可选的缓存音频，返回新生成的base64音频（用于缓存） */
  play: (text: string, cachedAudio?: string) => Promise<string | undefined>;
  /** 强制重新生成并播放（忽略缓存） */
  regenerate: (text: string) => Promise<string | undefined>;
  /** 暂停 */
  pause: () => void;
  /** 继续播放 */
  resume: () => void;
  /** 停止并清理 */
  stop: () => void;
  /** 是否正在播放（包括暂停状态） */
  isPlaying: boolean;
  /** 是否暂停中 */
  isPaused: boolean;
  /** 是否正在加载（生成音频中） */
  isLoading: boolean;
}

/**
 * 统一的TTS播放控制Hook
 * 所有需要Wade说话的地方都用这个
 * 
 * 用法：
 * const tts = useTTS();
 * 
 * // 播放（有缓存就用缓存，没有就生成）
 * const newAudio = await tts.play(text, cachedAudio);
 * if (newAudio) saveToCache(newAudio); // 新生成的音频，存起来
 * 
 * // 强制重新生成
 * const newAudio = await tts.regenerate(text);
 * 
 * // 暂停/继续
 * tts.pause();
 * tts.resume();
 * 
 * // 停止
 * tts.stop();
 */
export const useTTS = (): UseTTSReturn => {
  const { settings, ttsPresets } = useStore();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // 清理音频资源
  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // 把base64音频转成Audio对象并播放
  const playBase64Audio = useCallback(async (base64Audio: string) => {
    // 先彻底清理之前的音频
    cleanup();
    
    // 重置状态
    setIsPlaying(false);
    setIsPaused(false);

    // base64 → Uint8Array → Blob → Object URL
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const blob = new Blob([bytes], { type: 'audio/mp3' });
    const url = URL.createObjectURL(blob);
    audioUrlRef.current = url;

    const audio = new Audio(url);
    audioRef.current = audio;

    // 播放结束
    audio.onended = () => {
      setIsPlaying(false);
      setIsPaused(false);
      cleanup();
    };

    // 播放出错
    audio.onerror = () => {
      console.error("Audio playback error");
      setIsPlaying(false);
      setIsPaused(false);
      setIsLoading(false);
      cleanup();
    };

    // 等Audio对象准备好再播放
    await new Promise<void>((resolve, reject) => {
      audio.oncanplaythrough = () => resolve();
      audio.onerror = () => reject(new Error("Audio failed to load"));
    });

    setIsPlaying(true);
    setIsPaused(false);
    try {
      await audio.play();
    } catch (playError: any) {
      // Browser autoplay restriction — retry once (user has now interacted)
      if (playError?.name === 'NotAllowedError') {
        console.warn('[TTS] Autoplay blocked, will play on next user interaction');
        setIsPlaying(false);
        // Store audio for immediate replay on next click
        throw new Error('Tap the play button again to start audio');
      }
      throw playError;
    }
  }, [cleanup]);

  // 生成音频（调MiniMax API）
  const generateAudio = useCallback(async (text: string): Promise<string> => {
    const activeTtsId = settings.activeTtsId;
    if (!activeTtsId) {
      throw new Error("请先在设置里配置TTS");
    }

    const ttsPreset = ttsPresets.find(p => p.id === activeTtsId);
    if (!ttsPreset) {
      throw new Error("找不到TTS配置");
    }

    // 清理markdown符号
    const cleanText = text.replace(/[*_~`#]/g, '');

    const base64Audio = await generateMinimaxTTS(cleanText, {
      apiKey: ttsPreset.apiKey,
      baseUrl: ttsPreset.baseUrl || 'https://api.minimax.io',
      model: ttsPreset.model || 'speech-2.8-hd',
      voiceId: ttsPreset.voiceId || 'English_expressive_narrator',
      speed: ttsPreset.speed || 1,
      vol: ttsPreset.vol || 1,
      pitch: ttsPreset.pitch || 0,
      emotion: ttsPreset.emotion,
      sampleRate: ttsPreset.sampleRate || 32000,
      bitrate: ttsPreset.bitrate || 128000,
      format: ttsPreset.format || 'mp3',
      channel: ttsPreset.channel || 1
    });

    return base64Audio;
  }, [settings.activeTtsId, ttsPresets]);

  // 播放（有缓存用缓存，没缓存就生成）
  const play = useCallback(async (text: string, cachedAudio?: string): Promise<string | undefined> => {
    // 如果正在播放，切换暂停/继续
    if (isPlaying && audioRef.current) {
      if (isPaused) {
        audioRef.current.play();
        setIsPaused(false);
      } else {
        audioRef.current.pause();
        setIsPaused(true);
      }
      return undefined;
    }

    setIsLoading(true);
    try {
      let base64Audio: string;
      let isNewlyGenerated = false;

      if (cachedAudio) {
        base64Audio = cachedAudio;
      } else {
        base64Audio = await generateAudio(text);
        isNewlyGenerated = true;
      }

      await playBase64Audio(base64Audio);
      setIsLoading(false);

      // 返回新生成的音频，调用方可以用来缓存
      return isNewlyGenerated ? base64Audio : undefined;
    } catch (error) {
      setIsLoading(false);
      setIsPlaying(false);
      console.error("TTS Error:", error);
      throw error;
    }
  }, [isPlaying, isPaused, generateAudio, playBase64Audio]);

  // 强制重新生成
  const regenerate = useCallback(async (text: string): Promise<string | undefined> => {
    setIsLoading(true);
    try {
      const base64Audio = await generateAudio(text);
      await playBase64Audio(base64Audio);
      setIsLoading(false);
      return base64Audio;
    } catch (error) {
      setIsLoading(false);
      setIsPlaying(false);
      console.error("TTS Regenerate Error:", error);
      throw error;
    }
  }, [generateAudio, playBase64Audio]);

  const pause = useCallback(() => {
    if (audioRef.current && isPlaying && !isPaused) {
      audioRef.current.pause();
      setIsPaused(true);
    }
  }, [isPlaying, isPaused]);

  const resume = useCallback(() => {
    if (audioRef.current && isPlaying && isPaused) {
      audioRef.current.play();
      setIsPaused(false);
    }
  }, [isPlaying, isPaused]);

  const stop = useCallback(() => {
    cleanup();
    setIsPlaying(false);
    setIsPaused(false);
    setIsLoading(false);
  }, [cleanup]);

  return { play, regenerate, pause, resume, stop, isPlaying, isPaused, isLoading };
};