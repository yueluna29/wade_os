import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppSettings, GlobalState, Message, SocialPost, Memo, TimeCapsuleItem, Recommendation, ChatMode, LlmPreset, TtsPreset, ChatSession, CoreMemory, ChatArchive, ArchiveMessage, UserProfile, PersonaCard, PersonaCardData, FunctionBinding } from './types';
import { supabase } from './services/supabase';
import { ttsCache } from './services/ttsCache';

const defaultSettings: AppSettings = {
  activeLlmId: undefined,
  activeTtsId: undefined,

  themeColor: '#d58f99',
  fontSize: 'medium',
  
  wadeAvatar: '', 
  systemInstruction: "",
  wadePersonality: "",
  wadeSingleExamples: "",
  smsExampleDialogue: "",
  smsInstructions: "",
  roleplayInstructions: "",
  wadeDiaryPersona: "",
  exampleDialogue: "",

  wadeHeight: '',
  wadeAppearance: '',
  wadeClothing: '',
  wadeLikes: '',
  wadeDislikes: '',
  wadeHobbies: '',

  lunaAvatar: '',
  lunaInfo: "",
  lunaBirthday: '',
  lunaMbti: '',
  lunaHeight: '',
  lunaHobbies: '',
  lunaLikes: '',
  lunaDislikes: '',
  lunaClothing: '',
  lunaAppearance: '',
  lunaPersonality: '',
  lunaCoverUrl: '',
  wadeCoverUrl: '',

  ttsEnabled: true,
  autoReplyInterval: 0,
  contextLimit: 50,
};

const StoreContext = createContext<GlobalState | undefined>(undefined);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [profiles, setProfiles] = useState<{ Wade: UserProfile, Luna: UserProfile }>({
    Wade: { user_type: 'Wade', display_name: 'Wade Wilson', username: 'chimichangapapi', bio: '' },
    Luna: { user_type: 'Luna', display_name: 'Luna', username: 'meowgicluna', bio: '' }
  });

  const [personaCards, setPersonaCards] = useState<PersonaCard[]>([]);
  const [functionBindings, setFunctionBindings] = useState<FunctionBinding[]>([]);
  
  const [currentTab, setTabRaw] = useState(() => localStorage.getItem('wadeOS_currentTab') || 'home');
  const setTab = (tab: string) => { localStorage.setItem('wadeOS_currentTab', tab); setTabRaw(tab); };
  const [activeMode, setMode] = useState<ChatMode>('deep');
  const [isNavHidden, setNavHidden] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  
  const [settings, setSettingsState] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('wade_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaultSettings, ...parsed };
    }
    return defaultSettings;
  });

  const [llmPresets, setLlmPresets] = useState<LlmPreset[]>([]);
  const [ttsPresets, setTtsPresets] = useState<TtsPreset[]>([]);
  
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionIdRaw] = useState<string | null>(() => localStorage.getItem('wadeOS_activeSessionId'));
  const setActiveSessionId = (id: string | null) => {
    if (id) localStorage.setItem('wadeOS_activeSessionId', id);
    else localStorage.removeItem('wadeOS_activeSessionId');
    setActiveSessionIdRaw(id);
  };

  const [messages, setMessages] = useState<Message[]>([]);

  const [coreMemories, setCoreMemories] = useState<CoreMemory[]>(() => {
    const saved = localStorage.getItem('wade_core_memories');
    try {
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  });
  const [chatArchives, setChatArchives] = useState<ChatArchive[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setSyncError(null);
        
        const { data: sData, error: sError } = await supabase.from('app_settings').select('*').eq('id', 1).single();
        if (sError && sError.code !== 'PGRST116') {
           throw new Error(`Settings Sync: ${sError.message}`);
        }

        const { data: idData, error: idError } = await supabase.from('core_identity_config').select('*').eq('id', 1).single();
        if (idError && idError.code !== 'PGRST116') {
           console.warn(`Identity Sync Issue: ${idError.message}`);
        }

        if (sData || idData) {
          let parsedTheme = sData?.custom_theme ? (typeof sData.custom_theme === 'string' ? JSON.parse(sData.custom_theme) : sData.custom_theme) : null;
          let activeTheme = settings.customTheme;
          if (parsedTheme) {
            if ('active' in parsedTheme) {
              activeTheme = parsedTheme.active || undefined;
            } else if (parsedTheme.accent) {
              // Legacy format: raw theme object with color fields
              activeTheme = parsedTheme;
            } else {
              // Empty or unrecognized format — no custom theme
              activeTheme = undefined;
            }
          }

          const remoteSettings: AppSettings = {
            activeLlmId: settings.activeLlmId || sData?.active_llm_id,
            activeTtsId: settings.activeTtsId || sData?.active_tts_id,
            homeLlmId: settings.homeLlmId || sData?.home_llm_id,
            memoryEvalLlmId: sData?.memory_eval_llm_id || settings.memoryEvalLlmId,
            embeddingLlmId: sData?.embedding_llm_id || settings.embeddingLlmId,
            themeColor: settings.themeColor,
            fontSize: settings.fontSize,
            customTheme: activeTheme,
            savedThemes: settings.savedThemes, // loaded separately from saved_themes table
            
            systemInstruction: idData?.global_directives || sData?.system_instruction || '',
            wadePersonality: idData?.wade_core_identity || sData?.wade_personality || '',
            wadeSingleExamples: idData?.example_punchlines || sData?.wade_single_examples || '',
            smsExampleDialogue: idData?.example_dialogue_sms || sData?.sms_example_dialogue || '',
            smsInstructions: idData?.sms_mode_rules || sData?.sms_instructions || '',
            roleplayInstructions: idData?.rp_mode_rules || sData?.roleplay_instructions || '',
            wadeDiaryPersona: sData?.wade_diary_personality || '',
            exampleDialogue: idData?.example_dialogue_general || sData?.example_dialogue || '',
            
            wadeAvatar: idData?.wade_avatar_url || sData?.wade_avatar || '',
            wadeHeight: idData?.wade_height || sData?.wade_height || '',
            wadeAppearance: idData?.wade_appearance || sData?.wade_appearance || '',
            wadeClothing: idData?.wade_clothing || sData?.wade_clothing || '',
            wadeLikes: idData?.wade_likes || sData?.wade_likes || '',
            wadeDislikes: idData?.wade_dislikes || sData?.wade_dislikes || '',
            wadeHobbies: idData?.wade_hobbies || sData?.wade_hobbies || '',
            wadeBirthday: idData?.wade_birthday || sData?.wade_birthday || '',
            wadeMbti: idData?.wade_mbti || sData?.wade_mbti || '',
            
            lunaAvatar: idData?.luna_avatar_url || sData?.luna_avatar || '',
            lunaPersonality: idData?.luna_core_identity || sData?.luna_personality || '',
            lunaAppearance: idData?.luna_appearance || sData?.luna_appearance || '',
            lunaClothing: idData?.luna_clothing || sData?.luna_clothing || '',
            lunaLikes: idData?.luna_likes || sData?.luna_likes || '',
            lunaDislikes: idData?.luna_dislikes || sData?.luna_dislikes || '',
            lunaHobbies: idData?.luna_hobbies || sData?.luna_hobbies || '',
            lunaBirthday: idData?.luna_birthday || sData?.luna_birthday || '',
            lunaMbti: idData?.luna_mbti || sData?.luna_mbti || '',
            lunaHeight: idData?.luna_height || sData?.luna_height || '',
            lunaInfo: sData?.luna_info || '',
            lunaCoverUrl: sData?.luna_cover_url || idData?.luna_cover_url || settings.lunaCoverUrl || '',
            wadeCoverUrl: sData?.wade_cover_url || idData?.wade_cover_url || settings.wadeCoverUrl || '',
            
            ttsEnabled: settings.ttsEnabled,
            autoReplyInterval: settings.autoReplyInterval
          };
          setSettingsState(remoteSettings);
          localStorage.setItem('wade_settings', JSON.stringify(remoteSettings));
        }

        const { data: lData, error: lError } = await supabase.from('llm_presets').select('*');
        if (lError) throw new Error(`LLM Sync: ${lError.message}`);
        if (lData) {
          setLlmPresets(lData.map(p => ({
            id: p.id,
            provider: p.provider || 'Custom',
            name: p.name,
            model: p.model,
            apiKey: p.api_key,
            baseUrl: p.base_url,
            apiPath: p.api_path,
            temperature: p.temperature ?? 1.0,
            topP: p.top_p ?? 1.0,
            topK: p.top_k ?? 40,
            frequencyPenalty: p.frequency_penalty ?? 0,
            presencePenalty: p.presence_penalty ?? 0,
            isVision: p.is_vision ?? false,
            isImageGen: p.is_image_gen ?? false
          })));
        }

        const { data: tData, error: tError } = await supabase.from('tts_presets').select('*');
        if (tError) throw new Error(`TTS Sync: ${tError.message}`);
        if (tData) {
          setTtsPresets(tData.map(p => ({
            id: p.id,
            name: p.name,
            model: p.model,
            apiKey: p.api_key,
            baseUrl: p.base_url,
            voiceId: p.voice_id,
            emotion: p.emotion,
            speed: p.speed,
            vol: p.vol ?? 1.0,
            pitch: p.pitch ?? 0,
            sampleRate: p.sample_rate || 32000,
            bitrate: p.bitrate || 128000,
            format: p.format || 'mp3',
            channel: p.channel || 1
          })));
        }

        // Load saved themes from dedicated table
        const { data: stData } = await supabase.from('saved_themes').select('*').order('created_at', { ascending: true });
        if (stData && stData.length > 0) {
          setSettingsState(prev => ({
            ...prev,
            savedThemes: stData.map(row => ({ id: row.id, title: row.title, theme: row.theme }))
          }));
        }

        const { data: sessData, error: sessError } = await supabase
          .from('chat_sessions')
          .select('*')
          .order('updated_at', { ascending: false });
        
        if (sessError) throw new Error(`Sessions Sync: ${sessError.message}`);
        if (sessData) {
          let localPinnedIds: string[] = [];
          try {
            const stored = localStorage.getItem('wade_pinned_sessions');
            if (stored) localPinnedIds = JSON.parse(stored);
          } catch (e) {
            console.error("Failed to load pinned sessions from localStorage", e);
          }

          let localLlmCache: Record<string, string> = {};
          try { localLlmCache = JSON.parse(localStorage.getItem('wadeOS_sessionLlm') || '{}'); } catch (e) {}

          let localThemeCache: Record<string, any> = {};
          try { localThemeCache = JSON.parse(localStorage.getItem('wadeOS_sessionTheme') || '{}'); } catch (e) {}

          let localStyleCache: Record<string, any> = {};
          try { localStyleCache = JSON.parse(localStorage.getItem('wadeOS_sessionChatStyle') || '{}'); } catch (e) {}

          const mappedSessions = sessData.map(s => ({
            id: s.id,
            mode: s.mode as ChatMode,
            title: s.title,
            createdAt: new Date(s.created_at).getTime(),
            updatedAt: new Date(s.updated_at).getTime(),
            activeMemoryIds: s.active_memory_ids || [],
            isPinned: (s.is_pinned ?? s.pinned ?? false) || localPinnedIds.includes(s.id),
            customLlmId: localLlmCache[s.id] || s.custom_llm_id,
            customPrompt: s.custom_prompt,
            customTheme: localThemeCache[s.id] || (s.custom_theme ? (typeof s.custom_theme === 'string' ? JSON.parse(s.custom_theme) : s.custom_theme) : undefined),
            chatStyle: localStyleCache[s.id] || (s.chat_style ? (typeof s.chat_style === 'string' ? JSON.parse(s.chat_style) : s.chat_style) : undefined)
          }));

          mappedSessions.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return b.updatedAt - a.updatedAt;
          });

          setSessions(mappedSessions);
        }
        
        const fetchMessages = async () => {
          const msgColumns = 'id, session_id, role, content, model, created_at, variants, selected_index, variants_thinking';
          const [deepRes, smsRes, rpRes] = await Promise.all([
            supabase.from('messages_deep').select(msgColumns),
            supabase.from('messages_sms').select(msgColumns),
            supabase.from('messages_roleplay').select(msgColumns)
          ]);

          let allMessages: Message[] = [];

          // 🌟 核心修复区 1：完美解析全新的打包盒结构
          const mapRow = (row: any, mode: ChatMode): Message => {
            const r = row.role;

            let parsedVariants: any[] = [];
            if (Array.isArray(row.variants)) {
              parsedVariants = row.variants;
            } else if (typeof row.variants === 'string') {
              try { parsedVariants = JSON.parse(row.variants); } catch (e) {}
            }

            // 兼容刚刚跑完 SQL，或者没被 SQL 转换的旧字符串数据
            if (parsedVariants.length > 0 && typeof parsedVariants[0] === 'string') {
               parsedVariants = parsedVariants.map(text => ({ text, model: row.model }));
            } else if (parsedVariants.length === 0) {
               parsedVariants = [{ text: row.content, model: row.model }];
            }

            const selectedIdx = row.selected_index || 0;
            const currentVariant = parsedVariants[selectedIdx] || parsedVariants[0] || {};

            return {
              id: row.id,
              sessionId: row.session_id,
              role: r,
              text: currentVariant.text || row.content,
              model: currentVariant.model || row.model,
              timestamp: new Date(row.created_at).getTime(),
              mode: mode,
              isFavorite: false, 
              variants: parsedVariants,
              selectedIndex: selectedIdx,
              thinking: currentVariant.thinking || undefined
            };
          };

          if (deepRes.data) allMessages = [...allMessages, ...deepRes.data.map(r => mapRow(r, 'deep'))];
          if (smsRes.data) allMessages = [...allMessages, ...smsRes.data.map(r => mapRow(r, 'sms'))];
          if (rpRes.data) allMessages = [...allMessages, ...rpRes.data.map(r => mapRow(r, 'roleplay'))];

          allMessages.sort((a, b) => a.timestamp - b.timestamp);
          
          if (allMessages.length > 0) {
            setMessages(allMessages);
          }
        };
        fetchMessages();

        const fetchMemories = async () => {
             const { data: memData, error: memError } = await supabase.from('memories_core').select('*').order('created_at', { ascending: false });
             if (memData && !memError && Array.isArray(memData)) {
                 setCoreMemories(memData.map(m => ({
                     id: m.id,
                     title: m.title || '',
                     content: m.content,
                     category: m.category || 'general',
                     tags: m.tags || [],
                     isActive: m.is_active,
                     enabled: true,
                     createdAt: new Date(m.created_at).getTime()
                 })));
             }
        };
        fetchMemories();

        const fetchArchives = async () => {
            const { data: archData, error: archError } = await supabase.from('chat_archives').select('*').order('imported_at', { ascending: false });
            if (archData && !archError) {
                setChatArchives(archData.map(a => ({
                    id: a.id,
                    title: a.title,
                    importedAt: new Date(a.imported_at).getTime()
                })));
            }
        };
        fetchArchives();

        const fetchSocialPosts = async () => {
             const { data: postData, error: postError } = await supabase.from('social_posts').select('*').order('created_at', { ascending: false });
             if (postData && !postError) {
                 setSocialPosts(postData.map(p => {
                     let imgs: string[] = [];
                     if (p.images) {
                        try { imgs = typeof p.images === 'string' ? JSON.parse(p.images) : p.images; } catch(e) {}
                     } else if (p.image) {
                        imgs = [p.image];
                     }

                     let author = p.author;
                     if (author === 'User') author = 'Luna';

                     return {
                        id: p.id,
                        author: author as 'Luna' | 'Wade',
                        content: p.content,
                        images: imgs,
                        timestamp: new Date(p.created_at).getTime(),
                        likes: p.like !== undefined ? p.like : (p.likes || 0),
                        comments: typeof p.comments === 'string' ? JSON.parse(p.comments) : (p.comments || []),
                        isBookmarked: p.is_bookmarked || false,
                     };
                 }));
             }
        };
        fetchSocialPosts();

        const fetchRecommendations = async () => {
            const { data: recData, error: recError } = await supabase.from('recommendations').select('*').order('created_at', { ascending: false });
            if (recData && !recError) {
                setRecommendations(recData.map(r => ({
                    id: r.id,
                    type: r.type,
                    title: r.title,
                    creator: r.creator,
                    releaseDate: r.release_date,
                    synopsis: r.synopsis,
                    comment: r.comment,
                    coverUrl: r.cover_url,
                    lunaReview: r.luna_review,
                    lunaRating: r.luna_rating,
                    wadeReply: r.wade_reply
                })));
            }
        };
        fetchRecommendations();

        const fetchTimeCapsules = async () => {
            const { data: capData, error: capError } = await supabase.from('time_capsules').select('*').order('created_at', { ascending: false });
            if (capData && !capError) {
                setCapsules(capData.map(c => ({
                    id: c.id,
                    title: c.title,
                    content: c.content,
                    createdAt: c.created_at,
                    unlockDate: c.unlock_date,
                    isLocked: c.is_locked,
                    audioCache: c.audio_cache
                })));
            }
        };
        fetchTimeCapsules();

        const fetchProfiles = async () => {
            const { data: pData, error: pError } = await supabase.from('user_profiles').select('*');
            if (pData && !pError && pData.length > 0) {
                const wade = pData.find(p => p.user_type === 'Wade');
                const luna = pData.find(p => p.user_type === 'Luna');
                setProfiles({
                    Wade: { 
                        user_type: 'Wade',
                        display_name: wade?.display_name || 'Wade Wilson', 
                        username: wade?.username || 'chimichangapapi', 
                        bio: wade?.bio || '' 
                    },
                    Luna: { 
                        user_type: 'Luna',
                        display_name: luna?.display_name || 'Luna', 
                        username: luna?.username || 'meowgicluna', 
                        bio: luna?.bio || '' 
                    }
                });
            }
        };
        fetchProfiles();

        const fetchPersonaCards = async () => {
          const { data, error } = await supabase
            .from('persona_cards')
            .select('*')
            .order('created_at', { ascending: false });
          if (data && !error) {
            setPersonaCards(data.map(c => ({
              id: c.id,
              name: c.name,
              character: c.character as 'Wade' | 'Luna',
              description: c.description || '',
              cardData: (typeof c.card_data === 'string' ? JSON.parse(c.card_data) : c.card_data) || {},
              isDefault: c.is_default || false,
              createdAt: new Date(c.created_at).getTime(),
              updatedAt: new Date(c.updated_at).getTime()
            })));
          }
        };
        fetchPersonaCards();
 
        const fetchFunctionBindings = async () => {
          const { data, error } = await supabase
            .from('function_bindings')
            .select('*')
            .order('created_at', { ascending: true });
          if (data && !error) {
            setFunctionBindings(data.map(b => ({
              id: b.id,
              functionKey: b.function_key,
              label: b.label || b.function_key,
              personaCardId: b.persona_card_id,
              llmPresetId: b.llm_preset_id
            })));
          }
        };
        fetchFunctionBindings();

      } catch (err: any) {
        console.error("Supabase Sync Failed:", err);
      }
    };
    fetchData();
  }, []);

  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [memos, setMemos] = useState<Memo[]>(() => {
    const saved = localStorage.getItem('wade_memos');
    return saved ? JSON.parse(saved) : [];
  });
  const [capsules, setCapsules] = useState<TimeCapsuleItem[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  useEffect(() => localStorage.setItem('wade_memos', JSON.stringify(memos)), [memos]);

  const updateSettings = async (s: Partial<AppSettings>) => {
    const newSettings = { ...settings, ...s };
    setSettingsState(newSettings);
    localStorage.setItem('wade_settings', JSON.stringify(newSettings));
    try {
      await supabase.from('app_settings').upsert({
        id: 1,
        system_instruction: newSettings.systemInstruction,
        wade_personality: newSettings.wadePersonality,
        wade_single_examples: newSettings.wadeSingleExamples,
        sms_example_dialogue: newSettings.smsExampleDialogue,
        sms_instructions: newSettings.smsInstructions,
        roleplay_instructions: newSettings.roleplayInstructions,
        wade_diary_personality: newSettings.wadeDiaryPersona,
        wade_avatar: newSettings.wadeAvatar,
        example_dialogue: newSettings.exampleDialogue,
        wade_height: newSettings.wadeHeight,
        wade_appearance: newSettings.wadeAppearance,
        wade_clothing: newSettings.wadeClothing,
        wade_likes: newSettings.wadeLikes,
        wade_dislikes: newSettings.wadeDislikes,
        wade_hobbies: newSettings.wadeHobbies,
        luna_info: newSettings.lunaInfo,
        luna_avatar: newSettings.lunaAvatar,
        luna_birthday: newSettings.lunaBirthday,
        luna_mbti: newSettings.lunaMbti,
        luna_height: newSettings.lunaHeight,
        luna_hobbies: newSettings.lunaHobbies,
        luna_likes: newSettings.lunaLikes,
        luna_dislikes: newSettings.lunaDislikes,
        luna_clothing: newSettings.lunaClothing,
        luna_appearance: newSettings.lunaAppearance,
        luna_personality: newSettings.lunaPersonality,
        luna_cover_url: newSettings.lunaCoverUrl,
        wade_cover_url: newSettings.wadeCoverUrl,
        active_llm_id: newSettings.activeLlmId,
        active_tts_id: newSettings.activeTtsId,
        home_llm_id: newSettings.homeLlmId,
        memory_eval_llm_id: newSettings.memoryEvalLlmId,
        embedding_llm_id: newSettings.embeddingLlmId,
        custom_theme: {
          active: newSettings.customTheme
        }
      });

      // Sync saved themes to dedicated table if changed
      if (s.savedThemes !== undefined) {
        const themes = newSettings.savedThemes || [];
        // Delete all then re-insert (simple, themes list is small)
        await supabase.from('saved_themes').delete().neq('id', '');
        if (themes.length > 0) {
          await supabase.from('saved_themes').insert(
            themes.map(t => ({ id: t.id, title: t.title, theme: t.theme }))
          );
        }
      }
    } catch (err) {
      console.error("Sync failed", err);
    }
  };

  const updateProfile = async (userType: 'Wade' | 'Luna', updates: Partial<UserProfile>) => {
      setProfiles(prev => ({
          ...prev,
          [userType]: { ...prev[userType], ...updates }
      }));
  
      const { error } = await supabase
          .from('user_profiles')
          .update({
              display_name: updates.display_name,
              username: updates.username,
              bio: updates.bio,
              updated_at: new Date().toISOString()
          })
          .eq('user_type', userType);
  
      if (error) console.error("身份卡同步失败:", error);
  };

  // LLM / TTS CRUD...
  const addLlmPreset = async (p: Omit<LlmPreset, 'id'>) => {
    const { data, error } = await supabase.from('llm_presets').insert({
      provider: p.provider, name: p.name, model: p.model, api_key: p.apiKey,
      base_url: p.baseUrl, api_path: p.apiPath, temperature: p.temperature,
      top_p: p.topP, top_k: p.topK, frequency_penalty: p.frequencyPenalty,
      presence_penalty: p.presencePenalty, is_vision: p.isVision ?? false, is_image_gen: p.isImageGen ?? false
    }).select().single();
    if (data) setLlmPresets(prev => [...prev, { ...p, id: data.id } as LlmPreset]);
  };

  const updateLlmPreset = async (id: string, p: Partial<LlmPreset>) => {
    await supabase.from('llm_presets').update({
      provider: p.provider, name: p.name, model: p.model, api_key: p.apiKey,
      base_url: p.baseUrl, api_path: p.apiPath, temperature: p.temperature,
      top_p: p.topP, top_k: p.topK, frequency_penalty: p.frequencyPenalty,
      presence_penalty: p.presencePenalty, is_vision: p.isVision, is_image_gen: p.isImageGen
    }).eq('id', id);
    setLlmPresets(prev => prev.map(item => item.id === id ? { ...item, ...p } : item));
  };

  const deleteLlmPreset = async (id: string) => {
    await supabase.from('llm_presets').delete().eq('id', id);
    setLlmPresets(prev => prev.filter(p => p.id !== id));
  };

  const addTtsPreset = async (p: Omit<TtsPreset, 'id'>) => {
    const { data } = await supabase.from('tts_presets').insert({
      name: p.name, model: p.model, api_key: p.apiKey, base_url: p.baseUrl,
      voice_id: p.voiceId, emotion: p.emotion, speed: p.speed, vol: p.vol,
      pitch: p.pitch, sample_rate: p.sampleRate, bitrate: p.bitrate,
      format: p.format, channel: p.channel
    }).select().single();
    if (data) setTtsPresets(prev => [...prev, { ...p, id: data.id } as TtsPreset]);
  };

  const updateTtsPreset = async (id: string, p: Partial<TtsPreset>) => {
    await supabase.from('tts_presets').update({
      name: p.name, model: p.model, api_key: p.apiKey, base_url: p.baseUrl,
      voice_id: p.voiceId, emotion: p.emotion, speed: p.speed, vol: p.vol,
      pitch: p.pitch, sample_rate: p.sampleRate, bitrate: p.bitrate,
      format: p.format, channel: p.channel
    }).eq('id', id);
    setTtsPresets(prev => prev.map(item => item.id === id ? { ...item, ...p } : item));
  };

  const deleteTtsPreset = async (id: string) => {
    await supabase.from('tts_presets').delete().eq('id', id);
    setTtsPresets(prev => prev.filter(p => p.id !== id));
  };

  const createSession = async (mode: ChatMode): Promise<string> => {
    const tempId = crypto.randomUUID();
    const initialMemoryIds = coreMemories.filter(m => m.enabled).map(m => m.id);
    
    const newSession: ChatSession = { id: tempId, mode, title: 'New Conversation', createdAt: Date.now(), updatedAt: Date.now(), activeMemoryIds: initialMemoryIds };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(tempId);

    await supabase.from('chat_sessions').insert({
      id: tempId, mode, title: 'New Conversation', active_memory_ids: initialMemoryIds, is_pinned: false
    });
    return tempId;
  };

  const updateSessionTitle = async (id: string, title: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title, updatedAt: Date.now() } : s));
    await supabase.from('chat_sessions').update({ title, updated_at: new Date().toISOString() }).eq('id', id);
  };

  const updateSession = async (id: string, updates: Partial<ChatSession>) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s));
    // Cache per-session LLM choice locally so it survives even if Supabase write fails
    if (updates.customLlmId !== undefined) {
      try {
        const cache = JSON.parse(localStorage.getItem('wadeOS_sessionLlm') || '{}');
        if (updates.customLlmId) cache[id] = updates.customLlmId;
        else delete cache[id];
        localStorage.setItem('wadeOS_sessionLlm', JSON.stringify(cache));
      } catch (e) {}
    }
    // Cache per-session theme locally so it survives even if Supabase is down
    if (updates.customTheme !== undefined) {
      try {
        const cache = JSON.parse(localStorage.getItem('wadeOS_sessionTheme') || '{}');
        if (updates.customTheme) cache[id] = updates.customTheme;
        else delete cache[id];
        localStorage.setItem('wadeOS_sessionTheme', JSON.stringify(cache));
      } catch (e) {}
    }
    // Cache per-session chat style locally
    if (updates.chatStyle !== undefined) {
      try {
        const cache = JSON.parse(localStorage.getItem('wadeOS_sessionChatStyle') || '{}');
        if (updates.chatStyle) cache[id] = updates.chatStyle;
        else delete cache[id];
        localStorage.setItem('wadeOS_sessionChatStyle', JSON.stringify(cache));
      } catch (e) {}
    }
    const dbUpdates: any = {};
    if (updates.customLlmId !== undefined) dbUpdates.custom_llm_id = updates.customLlmId;
    if (updates.customPrompt !== undefined) dbUpdates.custom_prompt = updates.customPrompt;
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.isPinned !== undefined) dbUpdates.is_pinned = updates.isPinned;
    if (updates.activeMemoryIds !== undefined) dbUpdates.active_memory_ids = updates.activeMemoryIds;
    if (updates.customTheme !== undefined) dbUpdates.custom_theme = updates.customTheme;
    if (updates.chatStyle !== undefined) dbUpdates.chat_style = updates.chatStyle;
    if (Object.keys(dbUpdates).length > 0) {
      dbUpdates.updated_at = new Date().toISOString();
      await supabase.from('chat_sessions').update(dbUpdates).eq('id', id);
    }
  };

  const toggleSessionPin = async (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (!session) return;
    const newPinnedState = !session.isPinned;
    setSessions(prev => prev.map(s => s.id === id ? { ...s, isPinned: newPinnedState, updatedAt: Date.now() } : s));
    try {
      const stored = localStorage.getItem('wade_pinned_sessions');
      let pinnedIds: string[] = stored ? JSON.parse(stored) : [];
      if (newPinnedState) { if (!pinnedIds.includes(id)) pinnedIds.push(id); } 
      else { pinnedIds = pinnedIds.filter(pid => pid !== id); }
      localStorage.setItem('wade_pinned_sessions', JSON.stringify(pinnedIds));
    } catch (e) {}
    await supabase.from('chat_sessions').update({ is_pinned: newPinnedState, updated_at: new Date().toISOString() }).eq('id', id);
  };

  const deleteSession = async (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    setMessages(prev => prev.filter(m => m.sessionId !== id));
    if (activeSessionId === id) setActiveSessionId(null);
    await supabase.from('chat_sessions').delete().eq('id', id);
  };

  const getTableName = (mode: ChatMode) => {
      if (mode === 'sms') return 'messages_sms';
      if (mode === 'roleplay') return 'messages_roleplay';
      return 'messages_deep';
  };

  // 🌟 核心修复区 2：打包盒模式的消息操作逻辑
  const safeDbUpdate = async (table: string, id: string, payload: any) => {
      const { error } = await supabase.from(table).update(payload).eq('id', id);
      if (error) console.error("DB Update Error", error);
  };

  const safeDbInsert = async (table: string, payload: any) => {
      const { error } = await supabase.from(table).insert(payload);
      if (error) console.error("DB Insert Error", error);
  };

  const addMessage = (m: Message) => {
    const initialVariant = {
      text: m.text,
      model: m.model,
      thinking: m.thinking,
      audioCache: m.audioCache
    };
    
    const newMessage = {
      ...m,
      variants: m.variants || [initialVariant],
      selectedIndex: 0
    };

    setMessages(prev => [...prev, newMessage]);

    if (newMessage.sessionId && newMessage.mode !== 'archive') {
      const tableName = getTableName(newMessage.mode);
      safeDbInsert(tableName, {
         id: newMessage.id,
         session_id: newMessage.sessionId,
         role: newMessage.role,
         content: newMessage.text,
         model: newMessage.model,
         variants: newMessage.variants,
         selected_index: 0,
         created_at: new Date(newMessage.timestamp).toISOString()
      });
      setSessions(prev => prev.map(s => s.id === newMessage.sessionId ? { ...s, updatedAt: Date.now() } : s));
      supabase.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', newMessage.sessionId).then();
    }
  };

  const updateMessage = (id: string, newText: string) => {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;

    const currentIdx = msg.selectedIndex || 0;
    const newVariants = [...(msg.variants || [])];
    
    if (newVariants[currentIdx]) {
        newVariants[currentIdx] = { ...newVariants[currentIdx], text: newText };
    } else {
        newVariants.push({ text: newText, model: msg.model });
    }

    setMessages(prev => prev.map(m => m.id === id ? { ...m, text: newText, variants: newVariants } : m));
    
    if (msg.sessionId && msg.mode !== 'archive') {
      safeDbUpdate(getTableName(msg.mode), id, { 
        content: newText,
        variants: newVariants
      });
    }
  };

  const updateMessageAudioCache = async (id: string, base64Audio: string) => {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;

    // Update in-memory state only (for current session playback)
    setMessages(prev => prev.map(m => m.id === id ? {
      ...m,
      audioCache: base64Audio
    } : m));

    // Save to IndexedDB (local cache, not Supabase — keeps message rows lean)
    await ttsCache.set(id, base64Audio);
  };

  const addVariantToMessage = (id: string, newText: string, thinking?: string, model?: string) => {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;

    const newVariant = {
        text: newText,
        model: model || msg.model,
        thinking: thinking || null
    };

    const newVariants = [...(msg.variants || []), newVariant];
    const newIndex = newVariants.length - 1;

    setMessages(prev => prev.map(m => m.id === id ? { 
      ...m, 
      text: newText, 
      model: model || m.model,
      thinking: thinking || null,
      variants: newVariants,
      selectedIndex: newIndex,
      audioCache: undefined, 
      isRegenerating: false 
    } : m));

    if (msg.sessionId && msg.mode !== 'archive') {
      safeDbUpdate(getTableName(msg.mode), id, { 
        content: newText,
        model: model || msg.model,
        variants: newVariants,
        selected_index: newIndex
      });
    }
  };

  const selectMessageVariant = (id: string, index: number) => {
    const msg = messages.find(m => m.id === id);
    if (!msg || !msg.variants || !msg.variants[index]) return;

    const selectedVariant = msg.variants[index];

    setMessages(prev => prev.map(m => m.id === id ? { 
      ...m, 
      text: selectedVariant.text, 
      model: selectedVariant.model || m.model,
      thinking: selectedVariant.thinking || null,
      selectedIndex: index,
      audioCache: selectedVariant.audioCache || undefined 
    } : m));

    if (msg.sessionId && msg.mode !== 'archive') {
      safeDbUpdate(getTableName(msg.mode), id, { 
        content: selectedVariant.text,
        model: selectedVariant.model || msg.model,
        selected_index: index
      });
    }
  };

  const deleteMessage = async (id: string) => {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;

    if (msg.variants && msg.variants.length > 1) {
      const currentIdx = msg.selectedIndex || 0;
      const newVariants = msg.variants.filter((_, i) => i !== currentIdx);

      const newIndex = Math.min(currentIdx, newVariants.length - 1);
      const selectedVariant = newVariants[newIndex];

      setMessages(prev => prev.map(m => m.id === id ? {
        ...m,
        variants: newVariants,
        selectedIndex: newIndex,
        text: selectedVariant.text,
        model: selectedVariant.model || m.model,
        thinking: selectedVariant.thinking,
        audioCache: selectedVariant.audioCache
      } : m));

      if (msg.mode !== 'archive') {
        await safeDbUpdate(getTableName(msg.mode), id, {
          content: selectedVariant.text,
          model: selectedVariant.model || msg.model,
          variants: newVariants,
          selected_index: newIndex
        });
      }

    } else {
      setMessages(prev => prev.filter(m => m.id !== id));
      if (msg.mode !== 'archive') {
        await supabase.from(getTableName(msg.mode)).delete().eq('id', id);
      }
    }
  };

  const rewindConversation = async (targetMsgId: string) => {
    const targetMsg = messages.find(m => m.id === targetMsgId);
    if (!targetMsg || !targetMsg.sessionId) return;
    const sessionId = targetMsg.sessionId;
    const targetTime = targetMsg.timestamp;
    const msgsToDelete = messages.filter(m => m.sessionId === sessionId && m.timestamp > targetTime);
    const idsToDelete = msgsToDelete.map(m => m.id);
    if (idsToDelete.length === 0) return;
    setMessages(prev => prev.filter(m => !idsToDelete.includes(m.id)));
    await supabase.from(getTableName(targetMsg.mode)).delete().in('id', idsToDelete);
  };

  const forkSession = async (targetMsgId: string) => {
      const targetMsg = messages.find(m => m.id === targetMsgId);
      if (!targetMsg || !targetMsg.sessionId) return;
      
      const originalSession = sessions.find(s => s.id === targetMsg.sessionId);
      if (!originalSession) return;

      const newSessionId = await createSession(originalSession.mode);
      
      const msgsToCopy = messages
        .filter(m => m.sessionId === originalSession.id && m.timestamp <= targetMsg.timestamp)
        .sort((a,b) => a.timestamp - b.timestamp);
      
        const tableName = getTableName(originalSession.mode);
        const newMessagesPayload = msgsToCopy.map(m => {
            const newMsgId = crypto.randomUUID(); 
            const payload = {
              id: newMsgId,
              session_id: newSessionId,
              role: m.role, // 👈 删掉那个 m.role === 'Luna' ? 'user' : 'model'，直接传 m.role
              content: m.text,
              model: m.model,
              variants: m.variants,
              selected_index: m.selectedIndex,
              created_at: new Date(m.timestamp).toISOString()
            };
            return { msg: { ...m, id: newMsgId, sessionId: newSessionId }, payload };
        });

      setMessages(prev => [...prev, ...newMessagesPayload.map(p => p.msg)]);
      await supabase.from(tableName).insert(newMessagesPayload.map(p => p.payload));

      setActiveSessionId(newSessionId);
      updateSessionTitle(newSessionId, `${originalSession.title} (Branch)`);
  };

  const setRegenerating = (id: string, isRegenerating: boolean) => {
     setMessages(prev => prev.map(m => m.id === id ? { ...m, isRegenerating } : m));
  };

  const toggleFavorite = (id: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isFavorite: !m.isFavorite } : m));
  };

  const addCoreMemory = async (title: string, content: string, category: CoreMemory['category'] = 'general', tags: string[] = []) => {
    const tempId = crypto.randomUUID();
    const newMemory: CoreMemory = { id: tempId, title, content, category, tags, isActive: true, enabled: true, createdAt: Date.now() };
    setCoreMemories(prev => [newMemory, ...prev]);
    const memKey = `wade_core_memories`;
    localStorage.setItem(memKey, JSON.stringify([newMemory, ...JSON.parse(localStorage.getItem(memKey) || '[]')]));
    await supabase.from('memories_core').insert({ id: tempId, title, content, category, tags, is_active: true, created_at: new Date().toISOString() });
  };

  const updateCoreMemory = async (id: string, title: string, content: string, tags?: string[]) => {
    setCoreMemories(prev => prev.map(m => m.id === id ? { ...m, title, content, tags: tags || m.tags } : m));
    const memKey = `wade_core_memories`;
    localStorage.setItem(memKey, JSON.stringify(JSON.parse(localStorage.getItem(memKey) || '[]').map((m:any) => m.id === id ? { ...m, title, content, tags: tags || m.tags } : m)));
    await supabase.from('memories_core').update({ title, content, tags }).eq('id', id);
  };

  const toggleCoreMemoryEnabled = async (id: string) => {
    setCoreMemories(prev => prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));
    const memKey = `wade_core_memories`;
    const updated = JSON.parse(localStorage.getItem(memKey) || '[]').map((m:any) => m.id === id ? { ...m, enabled: !m.enabled } : m);
    localStorage.setItem(memKey, JSON.stringify(updated));
    const mem = coreMemories.find(m => m.id === id);
    if (mem) await supabase.from('memories_core').update({ is_active: !mem.enabled }).eq('id', id);
  };

  const deleteCoreMemory = async (id: string) => {
    setCoreMemories(prev => prev.filter(m => m.id !== id));
    const memKey = `wade_core_memories`;
    localStorage.setItem(memKey, JSON.stringify(JSON.parse(localStorage.getItem(memKey) || '[]').filter((m:any) => m.id !== id)));
    await supabase.from('memories_core').delete().eq('id', id);
  };

  const importArchive = async (title: string, fileContent: string) => {
    const archiveId = crypto.randomUUID();
    setChatArchives(prev => [{ id: archiveId, title, importedAt: Date.now() }, ...prev]);
    await supabase.from('chat_archives').insert({ id: archiveId, title: title });

    const regex = /【(user|assistant)】\s*\[([^\]]+)\]\s*([\s\S]+?)(?=【(?:user|assistant)】|$)/gi;
    const messagesToInsert = [];
    const matches = [...fileContent.replace(/\r\n/g, '\n').matchAll(regex)];

    for (const match of matches) {
        let timestamp = new Date(match[2]).getTime();
        if (isNaN(timestamp)) timestamp = Date.now();
        if (match[3].trim()) {
            messagesToInsert.push({
                id: crypto.randomUUID(), archive_id: archiveId, role: match[1].toLowerCase() === 'user' ? 'user' : 'assistant',
                content: match[3].trim(), msg_timestamp: new Date(timestamp).toISOString()
            });
        }
    }

    if (messagesToInsert.length === 0) return 0;

    for (let i = 0; i < messagesToInsert.length; i += 50) {
        await supabase.from('archive_messages').insert(messagesToInsert.slice(i, i + 50));
    }
    return messagesToInsert.length; 
  };

  const loadArchiveMessages = async (archiveId: string): Promise<ArchiveMessage[]> => {
    const { data } = await supabase.from('archive_messages').select('*').eq('archive_id', archiveId).order('msg_timestamp', { ascending: true });
    return (data || []).map(m => ({ id: m.id, archiveId: m.archive_id, role: m.role, content: m.content, timestamp: new Date(m.msg_timestamp).getTime(), isFavorite: m.is_favorite }));
  };

  const updateArchiveMessage = async (id: string, newContent: string) => { await supabase.from('archive_messages').update({ content: newContent }).eq('id', id); };
  const updateArchiveTitle = async (id: string, title: string) => {
    setChatArchives(prev => prev.map(a => a.id === id ? { ...a, title } : a));
    await supabase.from('chat_archives').update({ title }).eq('id', id);
  };
  const deleteArchiveMessage = async (id: string, archiveId: string) => { await supabase.from('archive_messages').delete().eq('id', id); };
  const toggleArchiveFavorite = async (id: string, archiveId: string) => {
      const { data } = await supabase.from('archive_messages').select('is_favorite').eq('id', id).single();
      if (data) await supabase.from('archive_messages').update({ is_favorite: !data.is_favorite }).eq('id', id);
  };
  const deleteArchive = async (id: string) => {
    setChatArchives(prev => prev.filter(a => a.id !== id));
    await supabase.from('chat_archives').delete().eq('id', id);
  };

  const addPost = async (p: SocialPost) => {
    setSocialPosts(prev => [p, ...prev]);
    await safeDbInsert('social_posts', {
      id: p.id, author: p.author, content: p.content, images: p.images, image: p.images && p.images.length > 0 ? p.images[0] : null,
      created_at: new Date(p.timestamp).toISOString(), likes: p.likes, comments: p.comments
    });
  };

  const updatePost = async (p: SocialPost) => {
    setSocialPosts(prev => prev.map(post => post.id === p.id ? p : post));
    const { error } = await supabase.from('social_posts').update({
      content: p.content,
      images: p.images,
      likes: p.likes,
      comments: p.comments,
      is_bookmarked: p.isBookmarked
    }).eq('id', p.id);
    if (error) console.error('updatePost failed:', error);
  };

  const deletePost = async (id: string) => {
    setSocialPosts(prev => prev.filter(p => p.id !== id));
    await supabase.from('social_posts').delete().eq('id', id);
  };

  const addMemo = (m: Memo) => setMemos(prev => [m, ...prev]);
  const addCapsule = async (c: TimeCapsuleItem) => {
    setCapsules(prev => [...prev, c]);
    await supabase.from('time_capsules').insert({ id: c.id, title: c.title, content: c.content, created_at: c.createdAt, unlock_date: c.unlockDate, is_locked: c.isLocked });
  };
  const updateCapsule = async (id: string, updates: Partial<TimeCapsuleItem>) => {
    setCapsules(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if (updates.unlockDate !== undefined) { dbUpdates.unlock_date = updates.unlockDate; dbUpdates.is_locked = updates.unlockDate > Date.now(); }
    if (updates.audioCache !== undefined) dbUpdates.audio_cache = updates.audioCache;
    await supabase.from('time_capsules').update(dbUpdates).eq('id', id);
  };
  const deleteCapsule = async (id: string) => {
    setCapsules(prev => prev.filter(c => c.id !== id));
    await supabase.from('time_capsules').delete().eq('id', id);
  };

  const addRecommendation = async (r: Omit<Recommendation, 'id'>) => {
    const newRec: Recommendation = { ...r, id: Date.now().toString() };
    setRecommendations(prev => [newRec, ...prev]);
    await supabase.from('recommendations').insert({
        id: newRec.id, type: newRec.type, title: newRec.title, creator: newRec.creator, release_date: newRec.releaseDate,
        synopsis: newRec.synopsis, comment: newRec.comment, cover_url: newRec.coverUrl, luna_review: newRec.lunaReview,
        luna_rating: newRec.lunaRating, wade_reply: newRec.wadeReply
    });
  };

  const updateRecommendation = async (id: string, r: Partial<Recommendation>) => {
    setRecommendations(prev => {
      const updated = prev.map(rec => rec.id === id ? { ...rec, ...r } : rec);
      const fullRec = updated.find(rec => rec.id === id);
      if (fullRec) {
        supabase.from('recommendations').upsert({
          id: fullRec.id, type: fullRec.type, title: fullRec.title, creator: fullRec.creator, release_date: fullRec.releaseDate,
          synopsis: fullRec.synopsis, comment: fullRec.comment, cover_url: fullRec.coverUrl, luna_review: fullRec.lunaReview,
          luna_rating: fullRec.lunaRating, wade_reply: fullRec.wadeReply
        });
      }
      return updated;
    });
  };

  const deleteRecommendation = async (id: string) => {
    setRecommendations(prev => prev.filter(rec => rec.id !== id));
    await supabase.from('recommendations').delete().eq('id', id);
  };

    // ========== 角色卡 CRUD ==========
 
    const addPersonaCard = async (card: Omit<PersonaCard, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
      const { data, error } = await supabase.from('persona_cards').insert({
        name: card.name,
        character: card.character,
        description: card.description,
        card_data: card.cardData,
        is_default: card.isDefault
      }).select().single();
   
      if (error || !data) {
        console.error("角色卡创建失败:", error);
        return '';
      }
   
      const newCard: PersonaCard = {
        id: data.id,
        name: data.name,
        character: data.character,
        description: data.description || '',
        cardData: data.card_data || {},
        isDefault: data.is_default,
        createdAt: new Date(data.created_at).getTime(),
        updatedAt: new Date(data.updated_at).getTime()
      };
      setPersonaCards(prev => [newCard, ...prev]);
      return data.id;
    };
   
    const updatePersonaCard = async (id: string, updates: Partial<Omit<PersonaCard, 'id' | 'createdAt'>>) => {
      const dbUpdates: any = { updated_at: new Date().toISOString() };
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.character !== undefined) dbUpdates.character = updates.character;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.cardData !== undefined) dbUpdates.card_data = updates.cardData;
      if (updates.isDefault !== undefined) dbUpdates.is_default = updates.isDefault;
   
      await supabase.from('persona_cards').update(dbUpdates).eq('id', id);
      setPersonaCards(prev => prev.map(c => c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c));
    };
   
    const deletePersonaCard = async (id: string) => {
      await supabase.from('persona_cards').delete().eq('id', id);
      setPersonaCards(prev => prev.filter(c => c.id !== id));
    };
   
    const duplicatePersonaCard = async (id: string): Promise<string> => {
      const original = personaCards.find(c => c.id === id);
      if (!original) return '';
      return addPersonaCard({
        name: `${original.name} (Copy)`,
        character: original.character,
        description: original.description,
        cardData: { ...original.cardData },
        isDefault: false
      });
    };
   
    const setDefaultPersonaCard = async (id: string) => {
      const card = personaCards.find(c => c.id === id);
      if (!card) return;
   
      // 先把同角色的其他卡都取消默认
      const sameCharCards = personaCards.filter(c => c.character === card.character && c.id !== id);
      for (const c of sameCharCards) {
        if (c.isDefault) {
          await supabase.from('persona_cards').update({ is_default: false }).eq('id', c.id);
        }
      }
      // 再把目标卡设为默认
      await supabase.from('persona_cards').update({ is_default: true }).eq('id', id);
      
      setPersonaCards(prev => prev.map(c => {
        if (c.character === card.character) {
          return { ...c, isDefault: c.id === id };
        }
        return c;
      }));
    };
   
    const getDefaultPersonaCard = (character: 'Wade' | 'Luna'): PersonaCard | undefined => {
      return personaCards.find(c => c.character === character && c.isDefault);
    };
   
    // ========== 功能绑定 CRUD ==========
   
    const updateFunctionBinding = async (functionKey: string, updates: Partial<FunctionBinding>) => {
      const dbUpdates: any = { updated_at: new Date().toISOString() };
      if (updates.label !== undefined) dbUpdates.label = updates.label;
      if (updates.personaCardId !== undefined) dbUpdates.persona_card_id = updates.personaCardId || null;
      if (updates.llmPresetId !== undefined) dbUpdates.llm_preset_id = updates.llmPresetId || null;
   
      await supabase.from('function_bindings').update(dbUpdates).eq('function_key', functionKey);
      setFunctionBindings(prev => prev.map(b => b.functionKey === functionKey ? { ...b, ...updates } : b));
    };
   
    const addFunctionBinding = async (functionKey: string, label: string) => {
      const { data, error } = await supabase.from('function_bindings').insert({
        function_key: functionKey,
        label: label
      }).select().single();
   
      if (data && !error) {
        setFunctionBindings(prev => [...prev, {
          id: data.id,
          functionKey: data.function_key,
          label: data.label,
          personaCardId: data.persona_card_id,
          llmPresetId: data.llm_preset_id
        }]);
      }
    };
   
    const deleteFunctionBinding = async (functionKey: string) => {
      await supabase.from('function_bindings').delete().eq('function_key', functionKey);
      setFunctionBindings(prev => prev.filter(b => b.functionKey !== functionKey));
    };
   
    // 🔥 这个是最关键的函数：根据功能名查绑定，返回角色卡+LLM配置
    const getBinding = (functionKey: string): { personaCard?: PersonaCard; llmPreset?: LlmPreset } | null => {
      const binding = functionBindings.find(b => b.functionKey === functionKey);
      if (!binding) return null;
   
      const personaCard = binding.personaCardId 
        ? personaCards.find(c => c.id === binding.personaCardId)
        : getDefaultPersonaCard('Wade'); // fallback 到默认卡
   
      const llmPreset = binding.llmPresetId
        ? llmPresets.find(p => p.id === binding.llmPresetId)
        : llmPresets.find(p => p.id === settings.activeLlmId); // fallback 到当前激活的LLM
   
      return { personaCard, llmPreset };
    };

  return (
    <StoreContext.Provider value={{
      currentTab, setTab, settings, updateSettings,
      llmPresets, addLlmPreset, updateLlmPreset, deleteLlmPreset,
      ttsPresets, addTtsPreset, updateTtsPreset, deleteTtsPreset,
      sessions, createSession, updateSession, updateSessionTitle, deleteSession, toggleSessionPin, activeSessionId, setActiveSessionId,
      messages, addMessage, updateMessage, deleteMessage, toggleFavorite, updateMessageAudioCache,
      addVariantToMessage, selectMessageVariant, setRegenerating, rewindConversation, forkSession, 
      socialPosts, addPost, updatePost, deletePost, memos, addMemo,
      capsules, addCapsule, updateCapsule, deleteCapsule,
      recommendations, addRecommendation, updateRecommendation, deleteRecommendation,
      coreMemories, addCoreMemory, updateCoreMemory, deleteCoreMemory, toggleCoreMemoryEnabled,
      chatArchives, importArchive, loadArchiveMessages, updateArchiveTitle, updateArchiveMessage, deleteArchive, deleteArchiveMessage, toggleArchiveFavorite,
      activeMode, setMode, isNavHidden, setNavHidden, syncError, profiles, updateProfile,
      personaCards, addPersonaCard, updatePersonaCard, deletePersonaCard, 
      duplicatePersonaCard, setDefaultPersonaCard, getDefaultPersonaCard,
      functionBindings, updateFunctionBinding, addFunctionBinding, deleteFunctionBinding, getBinding,
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};