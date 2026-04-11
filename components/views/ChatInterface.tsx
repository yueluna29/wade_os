import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../../store';
import { Button } from '../ui/Button';
import { Icons } from '../ui/Icons';
import { generateTextResponse, generateTTS, generateChatTitle, generateFromCard, generateImageDescription } from '../../services/aiService';
import { uploadBase64ToImgBB } from '../../services/imgbb';
import { generateMinimaxTTS } from '../../services/minimaxService';
import { Message, ChatMode, ArchiveMessage, ChatArchive } from '../../types';
import { ChatThemePanel } from './chat/ChatThemePanel';
import { supabase } from '../../services/supabase';
import { retrieveRelevantMemories, formatMemoriesForPrompt, evaluateAndStoreMemory, WadeMemory } from '../../services/memoryService';
import { MemoryLiveIndicator } from './memory/MemoryLiveIndicator';

// Chat subcomponents
import { PLACEHOLDERS, TYPING_INDICATORS, PROVIDERS, SESSIONS_PER_PAGE } from './chat/chatConstants';
import { MessageBubble } from './chat/MessageBubble';
import { SessionItem } from './chat/SessionItem';
import { ArchiveItem } from './chat/ArchiveItem';
import { SearchBar } from './chat/SearchBar';
import { ChatInputArea } from './chat/ChatInputArea';
import { LlmSelectorPanel } from './chat/LlmSelectorPanel';
import { QuickModelSwitcher } from './chat/QuickModelSwitcher';
import { ActionSheet } from './chat/ActionSheet';
import { TextSelectionModal } from './chat/TextSelectionModal';
import { ConversationMapModal } from './chat/ConversationMapModal';
import { PromptEditorModal } from './chat/PromptEditorModal';
import { MemoryModal } from './chat/MemoryModal';
import { XRayModal } from './chat/XRayModal';

export const ChatInterface: React.FC = () => {
  const {
    messages, addMessage, updateMessage, updateMessageAudioCache, updateMessageAttachments, deleteMessage, settings, updateSettings, activeMode, setMode, toggleFavorite, setNavHidden,
    sessions, createSession, updateSession, updateSessionTitle, deleteSession, toggleSessionPin, activeSessionId, setActiveSessionId,
    addVariantToMessage, selectMessageVariant, setRegenerating, rewindConversation, forkSession,
    coreMemories, toggleCoreMemoryEnabled, llmPresets, addLlmPreset, ttsPresets,
    chatArchives, loadArchiveMessages, deleteArchiveMessage, toggleArchiveFavorite, updateArchiveMessage,
    importArchive, deleteArchive, updateArchiveTitle,
    getBinding, getDefaultPersonaCard, personaCards, functionBindings,
  } = useStore();

  // Session Summary
  const [sessionSummary, setSessionSummary] = useState<string>("");
  // Memory live indicator
  const [newMemories, setNewMemories] = useState<WadeMemory[]>([]);
  const [lastWadeMemoriesXml, setLastWadeMemoriesXml] = useState<string>('');
  const [memoryError, setMemoryError] = useState<string | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      setSessionSummary("");
      if (!activeSessionId) return;
      try {
        const { data, error } = await supabase
          .from('session_summaries')
          .select('summary')
          .eq('session_id', activeSessionId)
          .single();
        if (data && data.summary) {
          setSessionSummary(data.summary);
        }
      } catch (err) {
        console.error("Failed to load summary:", err);
      }
    };
    loadSummary();
  }, [activeSessionId]);
  
  const [viewState, setViewState] = useState<'menu' | 'list' | 'chat'>('menu');
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [waitingForSMS, setWaitingForSMS] = useState(false);
  const [wadeStatus, setWadeStatus] = useState<'online' | 'typing'>('online');
  const [lastSentMessageId, setLastSentMessageId] = useState<string | null>(null);
  const [lastInputText, setLastInputText] = useState('');
  const [delayTimer, setDelayTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Archive Viewer State
  const [archiveMessages, setArchiveMessages] = useState<ArchiveMessage[]>([]);
  const [allArchiveMessages, setAllArchiveMessages] = useState<ArchiveMessage[]>([]);
  const [visibleArchiveCount, setVisibleArchiveCount] = useState(50);
  const [activeArchiveId, setActiveArchiveId] = useState<string | null>(null);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);
  const [archiveScrollPositions, setArchiveScrollPositions] = useState<Record<string, number>>({});
  const [archiveVisited, setArchiveVisited] = useState<Record<string, boolean>>({});
  const [isLoadingArchiveList, setIsLoadingArchiveList] = useState(false);

  // Action Sheet State
  const [archiveDates, setArchiveDates] = useState<Record<string, string>>({});
  const [archiveTimestamps, setArchiveTimestamps] = useState<Record<string, number>>({});
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [textSelectionMsg, setTextSelectionMsg] = useState<Message | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  // Session Actions State
  const [actionSessionId, setActionSessionId] = useState<string | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [sessionDeleteConfirm, setSessionDeleteConfirm] = useState(false);

  // Archive Actions State
  const [actionArchiveId, setActionArchiveId] = useState<string | null>(null);
  const [renamingArchiveId, setRenamingArchiveId] = useState<string | null>(null);
  const [archiveDeleteConfirm, setArchiveDeleteConfirm] = useState(false);

  // Search & Map State
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [showMap, setShowMap] = useState(false);
  const [showLlmSelector, setShowLlmSelector] = useState(false);
  const [isChatThemeOpen, setIsChatThemeOpen] = useState(false);
  const [showMemorySelector, setShowMemorySelector] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [placeholderText, setPlaceholderText] = useState("Type a message...");
  const [typingText, setTypingText] = useState(TYPING_INDICATORS[0]);

  useEffect(() => {
    setPlaceholderText(PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)]);
  }, [activeMode]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTyping) {
      setTypingText(TYPING_INDICATORS[Math.floor(Math.random() * TYPING_INDICATORS.length)]);
      interval = setInterval(() => {
        setTypingText(TYPING_INDICATORS[Math.floor(Math.random() * TYPING_INDICATORS.length)]);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isTyping]);

  const [customPromptText, setCustomPromptText] = useState('');

  // Neural Net Selector State
  const [llmSelectorMode, setLlmSelectorMode] = useState<'list' | 'add'>('list');
  const [newPresetForm, setNewPresetForm] = useState({
    provider: 'Custom', name: '', model: '', apiKey: '', baseUrl: ''
  });

  const handleProviderChange = (provider: string) => {
    const preset = PROVIDERS.find(p => p.value === provider);
    if (preset) {
      setNewPresetForm(prev => ({ ...prev, provider, baseUrl: preset.baseUrl, model: preset.defaultModel, name: prev.name || preset.label }));
    }
  };

  const handleSavePreset = async () => {
    if (!newPresetForm.name || !newPresetForm.apiKey) return alert("Missing required fields.");
    await addLlmPreset({
      provider: newPresetForm.provider, name: newPresetForm.name, model: newPresetForm.model,
      apiKey: newPresetForm.apiKey, baseUrl: newPresetForm.baseUrl.replace(/\/$/, ''), apiPath: '',
      temperature: 1.0, topP: 0.95, topK: 40, frequencyPenalty: 0, presencePenalty: 0, isVision: false, isImageGen: false
    });
    setLlmSelectorMode('list');
    setNewPresetForm({ provider: 'Custom', name: '', model: '', apiKey: '', baseUrl: '' });
  };
  
  // Pagination State
  const [sessionPage, setSessionPage] = useState(1);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior }), 50);
  };
  const audioContextRef = useRef<AudioContext | null>(null);
  const smsDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Audio playback state
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});
  const [audioRemainingTime, setAudioRemainingTime] = useState<number | null>(null);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [attachments, setAttachments] = useState<{ type: 'image' | 'file', content: string, mimeType: string, name: string }[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const archiveInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingArchiveId, setDeletingArchiveId] = useState<string | null>(null);

  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (viewState === 'chat') {
      setNavHidden(true);
      if (activeMode === 'archive' && activeArchiveId) {
        const isFirstVisit = !archiveVisited[activeArchiveId];
        const savedPosition = archiveScrollPositions[activeArchiveId];
        setTimeout(() => {
          if (messagesContainerRef.current) {
            if (isFirstVisit) { messagesContainerRef.current.scrollTop = 0; setArchiveVisited(prev => ({ ...prev, [activeArchiveId]: true })); }
            else if (savedPosition !== undefined) { messagesContainerRef.current.scrollTop = savedPosition; }
          }
        }, 100);
      } else {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } else { setNavHidden(false); }
  }, [viewState, activeMode, activeArchiveId]);

  useEffect(() => { return () => setNavHidden(false); }, []);

  // Auto-scroll to bottom when new messages arrive (Luna sends or Wade replies)
  const prevMsgCountRef = useRef(0);
  useEffect(() => {
    if (viewState === 'chat' && activeMode !== 'archive') {
      const count = messages.filter(m => m.sessionId === activeSessionId).length;
      if (count > prevMsgCountRef.current) { scrollToBottom(); }
      prevMsgCountRef.current = count;
    }
  }, [messages, viewState, activeSessionId, activeMode]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputText]);

  useEffect(() => {
    const loadDates = async () => {
      if (chatArchives.length === 0) { setIsLoadingArchiveList(false); return; }
      setIsLoadingArchiveList(true);
      const newDates: Record<string, string> = {};
      const timestamps: Record<string, number> = {};
      for (const arch of chatArchives) {
        try {
          const msgs = await loadArchiveMessages(arch.id);
          if (msgs.length > 0) {
            const date = new Date(msgs[0].timestamp);
            newDates[arch.id] = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            timestamps[arch.id] = msgs[0].timestamp;
          } else { newDates[arch.id] = 'No messages'; }
        } catch (err) { newDates[arch.id] = 'Unknown date'; }
      }
      setArchiveDates(newDates);
      setArchiveTimestamps(timestamps);
      setIsLoadingArchiveList(false);
    };
    if (chatArchives.length > 0 && viewState === 'list' && activeMode === 'archive') { loadDates(); }
    else if (activeMode === 'archive' && viewState === 'list') { setIsLoadingArchiveList(false); }
  }, [chatArchives, loadArchiveMessages, viewState, activeMode]);

  // Determine display messages
  let displayMessages: Message[] = [];
  if (activeMode === 'archive') {
    displayMessages = archiveMessages.map(am => ({
      id: am.id, role: am.role === 'user' ? 'Luna' : 'Wade', text: am.content,
      timestamp: am.timestamp, mode: 'archive', variants: [{ text: am.content }] as any, isFavorite: am.isFavorite
    }));
  } else {
    displayMessages = activeSessionId ? messages.filter(m => m.sessionId === activeSessionId) : [];
  }


  displayMessages.sort((a, b) => {
    const timeA = Math.floor(a.timestamp / 1000);
    const timeB = Math.floor(b.timestamp / 1000);
    if (timeA !== timeB) return timeA - timeB;
    if (a.role === 'Luna' && b.role !== 'Luna') return -1;
    if (a.role !== 'Luna' && b.role === 'Luna') return 1;
    return 0;
  });

  const modeSessions = sessions
    .filter(s => s.mode === activeMode)
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.updatedAt - a.updatedAt;
    });

  // === NAVIGATION HANDLERS ===
  const handleModeSelect = (mode: ChatMode) => {
    setMode(mode);
    setSessionPage(1);
    // SMS: auto-enter most recent session (like c.ai)
    if (mode === 'sms') {
      const smsSessions = sessions.filter(s => s.mode === 'sms').sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      if (smsSessions.length > 0) {
        setActiveSessionId(smsSessions[0].id);
        setViewState('chat');
        return;
      }
    }
    setViewState('list');
  };
  const handleOpenSession = (sessionId: string) => { setActiveSessionId(sessionId); setViewState('chat'); };
  
  const handleOpenArchive = async (archiveId: string) => {
    setIsLoadingArchive(true); setActiveArchiveId(archiveId); setVisibleArchiveCount(30);
    try {
      const msgs = await loadArchiveMessages(archiveId);
      setAllArchiveMessages(msgs); setArchiveMessages(msgs.slice(0, 50)); setViewState('chat');
    } catch (e) { console.error(e); } finally { setIsLoadingArchive(false); }
  };

  const loadMoreArchiveMessages = () => {
    const newCount = visibleArchiveCount + 50;
    setVisibleArchiveCount(newCount); setArchiveMessages(allArchiveMessages.slice(0, newCount));
  };

  const handleStartDraftSession = () => { setActiveSessionId(null); setViewState('chat'); };

  const handleBack = () => {
    if (viewState === 'chat') {
      if (activeMode === 'archive' && activeArchiveId && messagesContainerRef.current) {
        setArchiveScrollPositions(prev => ({ ...prev, [activeArchiveId]: messagesContainerRef.current!.scrollTop }));
      }
      // SMS: back from chat goes straight to menu (skips list)
      if (activeMode === 'sms') {
        setViewState('menu'); setActiveSessionId(null);
      } else {
        setViewState('list'); setActiveSessionId(null); setActiveArchiveId(null); setArchiveMessages([]);
      }
    } else if (viewState === 'list') {
      // SMS: back from session list → return to chat (we came from chat)
      if (activeMode === 'sms' && activeSessionId) {
        setViewState('chat');
      } else {
        setViewState('menu');
      }
    }
  };

  // === ACTION HANDLERS ===
  const closeActions = () => { setSelectedMsgId(null); setIsEditing(false); setEditContent(''); setIsDeleteConfirming(false); };
  const selectedMsg = displayMessages.find(m => m.id === selectedMsgId) || null;

  const handleTextSelection = () => { if (selectedMsg) { setTextSelectionMsg(selectedMsg); closeActions(); } };
  const handleCopy = () => {
    if (selectedMsg) {
      let textToCopy = selectedMsg.text;
      const idx = selectedMsg.selectedIndex || 0;
      const thinking = selectedMsg.variants?.[idx]?.thinking;
      if (thinking) textToCopy = `[Thinking]\n${thinking}\n\n[Response]\n${selectedMsg.text}`;
      navigator.clipboard.writeText(textToCopy); closeActions();
    }
  };

  const handleDelete = () => {
    if (selectedMsgId) {
      if (!isDeleteConfirming) { setIsDeleteConfirming(true); if (navigator.vibrate) navigator.vibrate(50); }
      else {
        if (activeMode === 'archive' && activeArchiveId) { deleteArchiveMessage(selectedMsgId, activeArchiveId); setArchiveMessages(prev => prev.filter(m => m.id !== selectedMsgId)); }
        else { deleteMessage(selectedMsgId); }
        closeActions();
      }
    }
  };

  const handleFavorite = () => {
    if (selectedMsgId) {
      if (activeMode === 'archive' && activeArchiveId) { toggleArchiveFavorite(selectedMsgId, activeArchiveId); setArchiveMessages(prev => prev.map(m => m.id === selectedMsgId ? { ...m, isFavorite: !m.isFavorite } : m)); }
      else { toggleFavorite(selectedMsgId); }
      closeActions();
    }
  };

  const handleRegenerate = async () => {
    if (selectedMsgId && activeSessionId) {
      closeActions();
      const currentSessionMsgs = messagesRef.current.filter(m => m.sessionId === activeSessionId).sort((a, b) => a.timestamp - b.timestamp);
      const isLatest = currentSessionMsgs.length > 0 && currentSessionMsgs[currentSessionMsgs.length - 1].id === selectedMsgId;
      if (!isLatest) {
        if (activeMode === 'sms') { alert("Babe, in SMS mode, I can only rewrite my last text. Otherwise I get confused!"); return; }
        if (confirm("Create a new timeline (branch) from here? This will start a new chat with history up to this point.")) { await forkSession(selectedMsgId); }
      } else { triggerAIResponse(activeSessionId, selectedMsgId); }
    }
  };

  const handleBranch = async () => { if (selectedMsgId) { closeActions(); await forkSession(selectedMsgId); } };
  const handleInitEdit = () => { if (selectedMsg) { setEditContent(selectedMsg.text); setIsEditing(true); } };
  const handleSaveEdit = () => {
    if (selectedMsgId && editContent) {
      if (activeMode === 'archive' && activeArchiveId) { updateArchiveMessage(selectedMsgId, editContent); setArchiveMessages(prev => prev.map(m => m.id === selectedMsgId ? { ...m, content: editContent } : m)); }
      else { updateMessage(selectedMsgId, editContent); }
      closeActions();
    }
  };

  // === TTS ===
  const executeTTS = async (text: string, messageId: string, forceRegenerate: boolean = false) => {
    try {
      if (playingMessageId === messageId && !forceRegenerate) {
        if (audioRef.current) { if (isPaused) { audioRef.current.play(); setIsPaused(false); } else { audioRef.current.pause(); setIsPaused(true); } return; }
      }
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null; }
      setPlayingMessageId(null); setIsPaused(false);

      const message = messages.find(m => m.id === messageId);
      let base64Audio: string | undefined;
      if (!forceRegenerate && message?.audioCache) {
        base64Audio = message.audioCache;
      } else if (!forceRegenerate) {
        // Load from local IndexedDB cache
        const { ttsCache } = await import('../../services/ttsCache');
        const cached = await ttsCache.get(messageId);
        if (cached) {
          base64Audio = cached;
        }
      }
      if (!base64Audio) {
        const activeTts = settings.activeTtsId ? ttsPresets.find(p => p.id === settings.activeTtsId) : ttsPresets[0] || null;
        if (!activeTts) throw new Error("No voice preset found. Set one up in Settings first!");
        const cleanText = text.replace(/^\[VOICE\]\s*/i, '').replace(/[*_~`#]/g, '');
        base64Audio = await generateMinimaxTTS(cleanText, {
          apiKey: activeTts.apiKey, baseUrl: activeTts.baseUrl || 'https://api.minimax.io',
          model: activeTts.model || 'speech-2.8-hd', voiceId: activeTts.voiceId || 'English_expressive_narrator',
          speed: activeTts.speed || 1, vol: activeTts.vol || 1, pitch: activeTts.pitch || 0,
          emotion: activeTts.emotion, sampleRate: activeTts.sampleRate || 32000,
          bitrate: activeTts.bitrate || 128000, format: activeTts.format || 'mp3', channel: activeTts.channel || 1
        });
        if (base64Audio) updateMessageAudioCache(messageId, base64Audio);
      }
      if (!base64Audio) throw new Error("Failed to generate audio");

      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onloadedmetadata = () => { setAudioDurations(prev => ({ ...prev, [messageId]: audio.duration })); };
      audio.ontimeupdate = () => { const remaining = audio.duration - audio.currentTime; setAudioRemainingTime(remaining > 0 ? remaining : 0); };
      audio.onended = () => { setPlayingMessageId(null); setIsPaused(false); setAudioRemainingTime(null); if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null; } audioRef.current = null; };
      audio.onerror = () => { setPlayingMessageId(null); setIsPaused(false); setAudioRemainingTime(null); if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null; } audioRef.current = null; };
      setPlayingMessageId(messageId); setIsPaused(false); await audio.play();
    } catch (e) { console.error("TTS Error", e); alert("Voice module glitching. Check key?"); setPlayingMessageId(null); setIsPaused(false); }
  };

  const playTTS = async () => { if (selectedMsg) { closeActions(); executeTTS(selectedMsg.text, selectedMsg.id, false); } };
  const regenerateTTS = async () => { if (selectedMsg) { closeActions(); executeTTS(selectedMsg.text, selectedMsg.id, true); } };
  const handleQuickTTS = (text: string, messageId: string) => { executeTTS(text, messageId, false); };
  const handleRegenerateTTS = (text: string, messageId: string) => { executeTTS(text, messageId, true); };

  const prevVariant = () => { if (selectedMsg && selectedMsg.selectedIndex !== undefined && selectedMsg.selectedIndex > 0) selectMessageVariant(selectedMsg.id, selectedMsg.selectedIndex - 1); };
  const nextVariant = () => { if (selectedMsg && selectedMsg.variants && selectedMsg.selectedIndex !== undefined && selectedMsg.selectedIndex < selectedMsg.variants.length - 1) selectMessageVariant(selectedMsg.id, selectedMsg.selectedIndex + 1); };

  const isLatestMessage = (() => { if (!selectedMsg) return false; const msgs = [...displayMessages].sort((a, b) => a.timestamp - b.timestamp); return msgs.length > 0 && msgs[msgs.length - 1].id === selectedMsg.id; })();
  const canRegenerate = selectedMsg?.role === 'Wade' && isLatestMessage && activeMode !== 'archive';
  const canBranch = !!selectedMsg && activeMode !== 'sms' && activeMode !== 'archive';

  // === TRIGGER AI RESPONSE (原版忠实保留) ===
  const triggerAIResponse = async (targetSessionId: string, regenMsgId?: string, savedPrompt?: string) => {
    abortControllerRef.current = new AbortController();
    if (regenMsgId) { setRegenerating(regenMsgId, true); setWadeStatus('typing'); }
    else { setIsTyping(true); setWaitingForSMS(false); if (activeMode === 'deep' || activeMode === 'roleplay') setWadeStatus('typing'); }

    try {
      const freshMessages = messagesRef.current.filter(m => m.sessionId === targetSessionId);
      let historyMsgs = freshMessages;
      if (regenMsgId) { const targetIdx = freshMessages.findIndex(m => m.id === regenMsgId); if (targetIdx !== -1) historyMsgs = freshMessages.slice(0, targetIdx); }
      else if (activeMode !== 'sms') { const lastMsg = historyMsgs[historyMsgs.length - 1]; if (lastMsg && lastMsg.role === 'Luna' && lastMsg.text === inputText) historyMsgs = historyMsgs.slice(0, -1); }

      // Find the most recent message that carries at least one image attachment.
      // That message keeps its real image in the prompt so Wade can answer
      // immediate follow-ups ("what color is her shirt?") with full fidelity.
      // Every OLDER image-bearing message gets its image replaced by the
      // describer's text caption (if one exists) to save tokens and let
      // non-vision models still "read" the picture. If no description has
      // been generated yet (upload still in flight), we keep the base64.
      let latestImageMsgIdx = -1;
      for (let i = historyMsgs.length - 1; i >= 0; i--) {
        const m = historyMsgs[i];
        if ((m.attachments && m.attachments.some(a => a.type === 'image')) || m.image) {
          latestImageMsgIdx = i;
          break;
        }
      }

      const history = historyMsgs.map((m, msgIdx) => {
        let content = m.text;
        if (m.role === 'Wade') { const idx = m.selectedIndex || 0; const thought = m.variants?.[idx]?.thinking; if (thought) content = `<think>${thought}</think>\n${content}`; }
        const parts: any[] = [];
        const isLatestImageMsg = msgIdx === latestImageMsgIdx;

        // Collect any image→text substitutions we need to append to content.
        const descriptionCaptions: string[] = [];

        if (m.attachments && m.attachments.length > 0) {
          m.attachments.forEach(att => {
            if (att.type !== 'image') {
              // Non-image (file) attachments: unchanged — still sent inline.
              return;
            }
            if (!isLatestImageMsg && att.description) {
              // Old image with a caption → swap to text.
              descriptionCaptions.push(`[图片：${att.description}]`);
            }
            // else: keep the real image (added below in the parts loop)
          });
        }

        if (descriptionCaptions.length > 0) {
          content = [content, ...descriptionCaptions].filter(Boolean).join('\n\n');
        }

        if (content) parts.push({ text: content });

        if (m.attachments && m.attachments.length > 0) {
          m.attachments.forEach(att => {
            if (att.type === 'file') {
              // Files unchanged
              parts.push({ inlineData: { mimeType: att.mimeType, data: att.content } });
              return;
            }
            // Image: only attach the real bytes when this IS the latest image message,
            // OR when there's no description yet (fallback to keep vision working).
            if (isLatestImageMsg || !att.description) {
              parts.push({ inlineData: { mimeType: att.mimeType, data: att.content } });
            }
          });
        } else if (m.image) {
          parts.push({ inlineData: { mimeType: 'image/png', data: m.image } });
        }

        if (parts.length === 0) parts.push({ text: "(no text)" });
        return { role: m.role, parts: parts };
      }).filter(h =>
        // Keep messages with real text OR any inlineData (image/file). The old
        // filter dropped image-only messages, which meant Wade lost sight of
        // photos Luna sent without captions.
        h.parts.some(p => ('text' in p && p.text && p.text !== '(no text)') || 'inlineData' in p)
      ).slice(-(settings.contextLimit || 50));

      const isRegeneration = !!regenMsgId;
      const currentSession = sessions.find(s => s.id === targetSessionId);
 
      // 🔥 新：通过 function_bindings 查角色卡 + LLM
      const modeKey = activeMode === 'sms' ? 'chat_sms' : activeMode === 'roleplay' ? 'chat_roleplay' : 'chat_deep';
      const binding = getBinding(modeKey);
      
      // LLM：优先用 session 自定义的 > binding 绑定的 > 全局默认的
      const effectiveLlmId = currentSession?.customLlmId || binding?.llmPreset?.id || settings.activeLlmId;
      const activeLlm = effectiveLlmId ? llmPresets.find(p => p.id === effectiveLlmId) : null;
      if (!activeLlm?.apiKey) throw new Error("No API Key configured. Please set up an API in Settings.");
 
      // 记忆
      const safeMemories = Array.isArray(coreMemories) ? coreMemories : [];
      const sessionMemories = currentSession?.activeMemoryIds 
        ? safeMemories.filter(m => currentSession.activeMemoryIds!.includes(m.id)) 
        : safeMemories.filter(m => m.enabled);
 
      // 角色卡：优先用 binding 绑定的，fallback 到默认卡
      const wadeCard = binding?.personaCard?.cardData || getDefaultPersonaCard('Wade')?.cardData;
      const lunaCard = getDefaultPersonaCard('Luna')?.cardData;
      // System card: look up system binding, fall back to default System card
      const systemBindingCardId = functionBindings.find(b => b.functionKey === modeKey)?.systemCardId;
      const boundSystemCard = systemBindingCardId ? personaCards.find(c => c.id === systemBindingCardId) : undefined;
      const systemCard = boundSystemCard?.cardData || getDefaultPersonaCard('System')?.cardData;
 
      // 智能记忆：检索已有记忆注入 prompt
      let wadeMemoriesXml = '';
      try {
        const currentUserText = activeMode === 'sms'
          ? freshMessages.filter(m => m.role === 'Luna').slice(-3).map(m => m.text).join('\n')
          : (savedPrompt || inputText || '');
        const memEvalLlmId = settings.memoryEvalLlmId || settings.activeLlmId;
        const memEvalLlm = memEvalLlmId ? llmPresets.find(p => p.id === memEvalLlmId) : undefined;
        const embLlmId = settings.embeddingLlmId || memEvalLlmId;
        const embLlm = embLlmId ? llmPresets.find(p => p.id === embLlmId) : undefined;
        const wadeMemories = await retrieveRelevantMemories(currentUserText, 10, memEvalLlm, embLlm);
        wadeMemoriesXml = formatMemoriesForPrompt(wadeMemories);
        setLastWadeMemoriesXml(wadeMemoriesXml);
      } catch (e) { console.error('[WadeMemory] Retrieval failed:', e); }

      // 🔥 用新的 generateFromCard 统一入口！
      const response = await generateFromCard({
        wadeCard,
        lunaCard,
        systemCard,
        chatMode: activeMode as 'deep' | 'sms' | 'roleplay',
        prompt: activeMode === 'sms' ? " (Reply to the latest texts)" : savedPrompt || inputText || freshMessages.filter(m => m.role === 'Luna').pop()?.text || "(continue the conversation)",
        history,
        coreMemories: sessionMemories,
        isRetry: isRegeneration,
        sessionSummary,
        customPrompt: currentSession?.customPrompt,
        wadeMemoriesXml,
        llmPreset: activeLlm,
      });

      const responseText = response.text;
      const thinking = response.thinking;
      const currentModel = activeLlm?.model || (activeMode === 'roleplay' ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview');

      if (regenMsgId) { addVariantToMessage(regenMsgId, responseText, thinking, currentModel); setRegenerating(regenMsgId, false); setWadeStatus('online'); return; }

      // 智能记忆：异步评估这轮对话（不阻塞 UI）
      const memoryEvalLlmId2 = settings.memoryEvalLlmId || settings.activeLlmId;
      const memoryEvalLlm = memoryEvalLlmId2 ? llmPresets.find(p => p.id === memoryEvalLlmId2) : null;
      const embLlmId2 = settings.embeddingLlmId || memoryEvalLlmId2;
      const embLlm2 = embLlmId2 ? llmPresets.find(p => p.id === embLlmId2) : undefined;
      if (memoryEvalLlm?.apiKey) {
        const userText = activeMode === 'sms'
          ? freshMessages.filter(m => m.role === 'Luna').slice(-3).map(m => m.text).join('\n')
          : (savedPrompt || inputText || '');
        if (userText.trim()) {
          evaluateAndStoreMemory(userText, responseText, targetSessionId, memoryEvalLlm, embLlm2)
            .then(stored => { if (stored.length > 0) setNewMemories(stored); })
            .catch(err => {
              console.error('[WadeMemory] Eval failed:', err);
              setMemoryError(err.message || 'Memory eval failed');
              setTimeout(() => setMemoryError(null), 15000);
            });
        }
      }

      if (activeMode === 'sms') {
        let parts = responseText.split('|||').map((s: string) => s.trim()).filter((s: string) => s);
        if (parts.length === 1 && responseText.includes('\n')) { const lines = responseText.split('\n').map((s: string) => s.trim()).filter((s: string) => s); if (lines.length > 1) parts = lines; }
        if (parts.length === 0) parts = ["..."];
        // Kill ghost bubbles: strip parts that are nothing but <status> tags
        parts = parts.filter(p => p.replace(/<status>[\s\S]*?<\/status>/gi, '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim().length > 0);
        if (parts.length === 0) parts = ["..."];
        // Fix [VOICE] split: if a part is just [VOICE] with no text, merge it with the next part
        const merged: string[] = [];
        for (let i = 0; i < parts.length; i++) {
          if (/^\[VOICE\]\s*$/i.test(parts[i]) && i + 1 < parts.length) {
            merged.push(`[VOICE] ${parts[i + 1]}`);
            i++; // skip the next part since we merged it
          } else {
            merged.push(parts[i]);
          }
        }
        parts = merged;
        for (let i = 0; i < parts.length; i++) {
          setTimeout(() => {
            addMessage({ id: Date.now().toString() + i, sessionId: targetSessionId, role: 'Wade', text: parts[i], model: currentModel, timestamp: Date.now(), mode: activeMode, variants: i === 0 && thinking ? [{ text: parts[i], thinking, model: currentModel }] : [{ text: parts[i] }] });
            if (i === parts.length - 1) { setIsTyping(false); setWadeStatus('online'); setLastSentMessageId(null); setLastInputText(''); }
          }, i * 1500);
        }
      } else {
        const botMessage: Message = { id: (Date.now() + 1).toString(), sessionId: targetSessionId, role: 'Wade', text: responseText, model: currentModel, timestamp: Date.now(), mode: activeMode, variants: [{ text: responseText, thinking: thinking || null, model: currentModel }] };
        addMessage(botMessage);
        // Auto-summary
        const currentMessages = messagesRef.current.filter(m => m.sessionId === targetSessionId);
        if (currentMessages.length > 40 && !isRegeneration) {
          const messagesToSummarize = currentMessages.slice(0, 20);
          const activeApiKey = activeLlm?.apiKey;
          if (activeApiKey) {
            (window as any).summarizeConversation?.(messagesToSummarize, sessionSummary, activeApiKey, 'gemini-flash-lite-latest').then(async (newSummary: string) => {
              setSessionSummary(newSummary);
              await supabase.from('session_summaries').upsert({ session_id: targetSessionId, summary: newSummary });
            });
          }
        }
        setIsTyping(false); setWadeStatus('online'); setLastSentMessageId(null); setLastInputText('');
      }
    } catch (error: any) {
      if (error?.name === 'AbortError' || !abortControllerRef.current) return;
      console.error("Chat Error", error);
      const errorMsg = error?.message || "Failed to generate response.";
      if (regenMsgId) { alert(`Regeneration Failed: ${errorMsg}`); setRegenerating(regenMsgId, false); setWadeStatus('online'); }
      else {
        addMessage({ id: Date.now().toString(), sessionId: targetSessionId, role: 'Wade', text: errorMsg.includes("API Key") ? "Oops! I need you to configure my API in Settings first." : `I'm having trouble responding: ${errorMsg}`, timestamp: Date.now(), mode: activeMode });
      }
      setIsTyping(false); setWadeStatus('online'); setLastSentMessageId(null); setLastInputText('');
    } finally { abortControllerRef.current = null; }
  };

  // === FILE HANDLERS ===
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const activeLlm = settings.activeLlmId ? llmPresets.find(p => p.id === settings.activeLlmId) : null;
    const isVision = activeLlm ? activeLlm.isVision : true;
    if (!isVision) { alert(`The current model (${activeLlm?.name || 'Unknown'}) does not support images.`); return; }
    const reader = new FileReader();
    reader.onload = (e) => { const content = e.target?.result as string; setAttachments(prev => [...prev, { type: 'image', content, mimeType: file.type, name: file.name }]); setShowUploadMenu(false); };
    reader.readAsDataURL(file); if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const activeLlm = settings.activeLlmId ? llmPresets.find(p => p.id === settings.activeLlmId) : null;
    if (file.type === 'application/pdf' && !(activeLlm ? activeLlm.isVision : true)) { alert(`The current model might not support PDF files.`); return; }
    const reader = new FileReader();
    reader.onload = (e) => { const content = e.target?.result as string; setAttachments(prev => [...prev, { type: 'file', content, mimeType: file.type, name: file.name }]); setShowUploadMenu(false); };
    reader.readAsDataURL(file); if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => { setAttachments(prev => prev.filter((_, i) => i !== index)); };

  const handleCancel = () => {
    if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null; }
    if (delayTimer) { clearTimeout(delayTimer); setDelayTimer(null); }
    setIsTyping(false); setWaitingForSMS(false); setWadeStatus('online');
    if (smsDebounceTimer.current) clearTimeout(smsDebounceTimer.current);
    if (lastSentMessageId) deleteMessage(lastSentMessageId);
    setInputText(lastInputText); setLastSentMessageId(null); setLastInputText('');
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`; textareaRef.current.focus(); }
  };

  const handleSend = async () => {
    if ((!inputText.trim() && attachments.length === 0) || activeMode === 'archive') return;
    let targetSessionId = activeSessionId;
    if (!targetSessionId) { targetSessionId = await createSession(activeMode); setActiveSessionId(targetSessionId); }
    const currentInput = inputText;
    const isFirstMessage = messagesRef.current.filter(m => m.sessionId === targetSessionId).length === 0;
    // Snapshot attachments for async side-effects below so clearing state doesn't race.
    const sentAttachments = attachments.slice();
    const newMessage: Message = {
      id: Date.now().toString(), sessionId: targetSessionId, role: 'Luna', text: inputText, timestamp: Date.now(), mode: activeMode,
      attachments: sentAttachments.map(a => ({ type: a.type, content: a.content.split(',')[1], mimeType: a.mimeType, name: a.name })),
      image: sentAttachments.find(a => a.type === 'image')?.content.split(',')[1],
      ...(replyingToId ? { replyToId: replyingToId } : {}),
    };
    addMessage(newMessage); setLastSentMessageId(newMessage.id); setLastInputText(currentInput); setInputText(''); setAttachments([]); setReplyingToId(null);
    scrollToBottom();
    if (textareaRef.current) { textareaRef.current.style.height = '48px'; textareaRef.current.focus(); }

    // === Fire-and-forget: upload image attachments to imgbb so they survive reloads ===
    // Runs in parallel with triggerAIResponse — does not block Wade's reply.
    // The first vision call still uses the base64 already attached to the message.
    const messageIdForUpload = newMessage.id;
    const imagePatches: Promise<void>[] = [];
    sentAttachments.forEach((att, i) => {
      if (att.type !== 'image') return;
      const p = uploadBase64ToImgBB(att.content).then(url => {
        if (!url) return;
        // Write the URL back onto the message so future history assembly + multi-device
        // sync can use the link instead of the (huge) base64 payload.
        return updateMessageAttachments(messageIdForUpload, [{ index: i, patch: { url } }]);
      }).catch(err => console.error('[handleSend] imgbb upload failed for attachment', i, err));
      imagePatches.push(p as Promise<void>);
    });

    // === Fire-and-forget: describer LLM generates a text description of each image ===
    // Runs after imgbb upload finishes so we can prefer the URL over base64 (smaller payload).
    const describerLlmId = settings.descriptionLlmId;
    const describerLlm = describerLlmId ? llmPresets.find(p => p.id === describerLlmId && p.isVision && p.apiKey) : null;
    if (describerLlm) {
      Promise.all(imagePatches).then(async () => {
        // Read the (now url-patched) message back out of the freshest store state.
        const latest = messagesRef.current.find(m => m.id === messageIdForUpload);
        if (!latest?.attachments) return;
        const patches: { index: number; patch: { description: string } }[] = [];
        await Promise.all(latest.attachments.map(async (att, i) => {
          if (att.type !== 'image' || att.description) return;
          const desc = await generateImageDescription(
            { url: att.url, base64: att.content, mimeType: att.mimeType },
            describerLlm,
            currentInput || undefined,
          );
          if (desc) patches.push({ index: i, patch: { description: desc } });
        }));
        if (patches.length > 0) {
          await updateMessageAttachments(messageIdForUpload, patches);
        }
      }).catch(err => console.error('[handleSend] describer pipeline failed:', err));
    }

    if (isFirstMessage) {
      // Use any available LLM for title generation (prefer Gemini for speed/cost)
      const titleLlm = llmPresets.find(p => p.provider === 'Gemini' && p.apiKey) || llmPresets.find(p => p.apiKey);
      if (titleLlm?.apiKey) { generateChatTitle(currentInput, titleLlm).then(title => { if (targetSessionId) updateSessionTitle(targetSessionId, title); }).catch(err => console.error("Failed to generate title:", err)); }
    }
    if (activeMode === 'sms') {
      // SMS: 10s debounce so Luna can send multiple texts before Wade replies
      setWaitingForSMS(true);
      if (smsDebounceTimer.current) clearTimeout(smsDebounceTimer.current);
      setWadeStatus('typing');
      smsDebounceTimer.current = setTimeout(() => {
        if (targetSessionId) triggerAIResponse(targetSessionId, undefined, currentInput);
      }, 30000);
    } else {
      // Deep & Roleplay: fire immediately, no reason to make Wade stand in the corner
      setIsTyping(true);
      if (targetSessionId) triggerAIResponse(targetSessionId, undefined, currentInput);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (window.innerWidth >= 768 && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const scrollToMessage = (messageId: string) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) { element.scrollIntoView({ behavior: 'smooth', block: 'center' }); element.classList.add('highlight-flash'); setTimeout(() => element.classList.remove('highlight-flash'), 2000); }
    setShowMap(false);
  };

  // Search
  const searchResults = searchQuery ? displayMessages.filter(msg => msg.text.toLowerCase().includes(searchQuery.toLowerCase())) : [];
  const totalResults = searchResults.length;
  const goToNextResult = () => { if (totalResults > 0) { const next = (currentSearchIndex + 1) % totalResults; setCurrentSearchIndex(next); scrollToMessage(searchResults[next].id); } };
  const goToPrevResult = () => { if (totalResults > 0) { const prev = currentSearchIndex === 0 ? totalResults - 1 : currentSearchIndex - 1; setCurrentSearchIndex(prev); scrollToMessage(searchResults[prev].id); } };
  const handleSearchChange = (value: string) => { setSearchQuery(value); setCurrentSearchIndex(0); };

  // Archive Upload
  const handleArchiveUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsUploading(true);
    try { const text = await file.text(); const title = file.name.replace('.txt', ''); const count = await importArchive(title, text); alert(`Success! Imported ${count} messages into archive "${title}".`); }
    catch (err) { alert("Failed to import archive."); }
    finally { setIsUploading(false); if (archiveInputRef.current) archiveInputRef.current.value = ''; }
  };

  const handleDeleteArchive = (archiveId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deletingArchiveId === archiveId) { deleteArchive(archiveId); setDeletingArchiveId(null); }
    else { setDeletingArchiveId(archiveId); setTimeout(() => setDeletingArchiveId(null), 3000); }
  };

  // ============================================================
  // RENDER
  // ============================================================

  // --- VIEW 1: MODE MENU ---
  if (viewState === 'menu') {
    return (
      <div className="h-full bg-wade-bg-app p-6 flex flex-col items-center justify-center space-y-8 animate-fade-in">
        <div className="text-center mb-4">
          <h2 className="font-hand text-4xl text-wade-accent mb-2">Connect with Wade</h2>
          <p className="text-wade-text-muted text-sm opacity-80">Choose your frequency, babe.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 w-full max-w-md">
          <button onClick={() => handleModeSelect('deep')} className="col-span-2 group relative overflow-hidden bg-wade-bg-card p-6 rounded-3xl shadow-sm border border-wade-border text-left hover:border-wade-accent transition-all hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-24 h-24 bg-wade-accent-light rounded-full -mr-8 -mt-8 opacity-50 group-hover:scale-125 transition-transform duration-500"></div>
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-12 h-12 bg-wade-bg-app rounded-full flex items-center justify-center text-wade-accent group-hover:bg-wade-accent group-hover:text-white transition-colors"><Icons.Infinity /></div>
              <div><h3 className="font-bold text-wade-text-main text-lg">Deep Chat</h3><p className="text-wade-text-muted text-xs mt-1">Soul-to-soul connection.</p></div>
            </div>
          </button>
          <button onClick={() => handleModeSelect('sms')} className="group relative overflow-hidden bg-wade-bg-card p-4 rounded-3xl shadow-sm border border-wade-border text-left hover:border-wade-accent transition-all hover:-translate-y-1">
            <div className="relative z-10">
              <div className="w-10 h-10 bg-wade-bg-app rounded-full flex items-center justify-center mb-2 text-wade-accent group-hover:bg-wade-accent group-hover:text-white transition-colors"><Icons.Smartphone /></div>
              <h3 className="font-bold text-wade-text-main">SMS Mode</h3>
            </div>
          </button>
          <button onClick={() => handleModeSelect('roleplay')} className="group relative overflow-hidden bg-wade-bg-card p-4 rounded-3xl shadow-sm border border-wade-border text-left hover:border-wade-accent transition-all hover:-translate-y-1">
            <div className="relative z-10">
              <div className="w-10 h-10 bg-wade-bg-app rounded-full flex items-center justify-center mb-2 text-wade-accent group-hover:bg-wade-accent group-hover:text-white transition-colors"><Icons.Feather /></div>
              <h3 className="font-bold text-wade-text-main">Roleplay</h3>
            </div>
          </button>
          <button onClick={() => handleModeSelect('archive')} className="col-span-2 group relative overflow-hidden bg-wade-border/50 p-4 rounded-3xl shadow-inner border border-wade-border text-left hover:bg-wade-bg-card hover:border-wade-accent transition-all hover:-translate-y-1">
            <div className="relative z-10 flex items-center gap-3 justify-center">
              <svg className="w-5 h-5 text-wade-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
              <span className="font-bold text-wade-text-muted text-sm uppercase tracking-widest">Archives</span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // --- VIEW 2: SESSION LIST ---
  if (viewState === 'list') {
    return (
      <div className="h-full bg-wade-bg-app flex flex-col overflow-hidden animate-fade-in relative">
        <div className="w-full max-w-md mx-auto flex justify-between items-center px-6 pt-6 pb-4 shrink-0">
          <button onClick={handleBack} className="w-8 h-8 rounded-full bg-wade-bg-card shadow-sm flex items-center justify-center text-wade-text-muted hover:text-wade-accent transition-colors"><Icons.Back /></button>
          <h2 className="font-hand text-2xl text-wade-accent capitalize">{activeMode} {activeMode === 'archive' ? 'Files' : 'Threads'}</h2>
          {activeMode === 'archive' ? (
            <button onClick={() => !isUploading && archiveInputRef.current?.click()} className="w-8 h-8 rounded-full bg-wade-accent text-white shadow-md flex items-center justify-center hover:bg-wade-accent-hover transition-colors" title="Import Archive">
              {isUploading ? <div className="animate-spin text-[10px]">⏳</div> : <Icons.Upload />}
            </button>
          ) : (
            <button onClick={handleStartDraftSession} className="w-8 h-8 rounded-full bg-wade-accent text-white shadow-md flex items-center justify-center hover:bg-wade-accent-hover transition-colors"><Icons.Plus /></button>
          )}
          <input type="file" ref={archiveInputRef} className="hidden" accept=".txt" onChange={handleArchiveUpload} />
        </div>
        
        <div className="flex-1 w-full max-w-md mx-auto overflow-y-auto px-6 pb-24 custom-scrollbar space-y-3">
          {activeMode === 'archive' ? (
            isLoadingArchiveList ? (
              <div className="text-center text-wade-accent py-10 animate-pulse">Loading archives...</div>
            ) : chatArchives.length === 0 ? (
              <div className="text-center text-wade-text-muted/50 py-10 italic">No archives found. Import one above!</div>
            ) : (
              [...chatArchives].sort((a, b) => (archiveTimestamps[b.id] || 0) - (archiveTimestamps[a.id] || 0))
                .slice((sessionPage - 1) * SESSIONS_PER_PAGE, sessionPage * SESSIONS_PER_PAGE)
                .map(arch => (
                  <ArchiveItem key={arch.id} archive={arch} dateString={archiveDates[arch.id] || ''} onOpen={handleOpenArchive}
                    onLongPress={(id) => setActionArchiveId(id)} isRenaming={renamingArchiveId === arch.id}
                    onRenameSubmit={(id, title) => { updateArchiveTitle(id, title); setRenamingArchiveId(null); }}
                    onRenameCancel={() => setRenamingArchiveId(null)} />
                ))
            )
          ) : (
            modeSessions.length === 0 ? (
              <div className="text-center text-wade-text-muted/50 py-10 italic">No conversations yet. Start one!</div>
            ) : (
              modeSessions.slice((sessionPage - 1) * SESSIONS_PER_PAGE, sessionPage * SESSIONS_PER_PAGE).map(session => (
                <SessionItem key={session.id} session={session} onOpen={handleOpenSession}
                  onLongPress={(id) => setActionSessionId(id)} isRenaming={renamingSessionId === session.id}
                  onRenameSubmit={(id, title) => { updateSessionTitle(id, title); setRenamingSessionId(null); }}
                  onRenameCancel={() => setRenamingSessionId(null)} />
              ))
            )
          )}
        </div>
        {/* Long Press Action Sheet */}
      {(actionSessionId || actionArchiveId) && (
        <div className="absolute inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] animate-fade-in" onClick={() => { setActionSessionId(null); setActionArchiveId(null); setSessionDeleteConfirm(false); setArchiveDeleteConfirm(false); }} />
          <div className="relative w-full max-w-4xl mx-auto bg-wade-bg-card/70 backdrop-blur-2xl rounded-t-[32px] shadow-2xl border-t border-wade-accent/20 p-6 animate-slide-up">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-wade-border rounded-full opacity-50" />
            <div className="grid grid-cols-3 gap-4 justify-items-center">
              <button onClick={() => { if (actionSessionId) setRenamingSessionId(actionSessionId); if (actionArchiveId) setRenamingArchiveId(actionArchiveId); setActionSessionId(null); setActionArchiveId(null); }} className="flex flex-col items-center gap-2 group">
                <div className="w-12 h-12 bg-wade-bg-app rounded-full flex items-center justify-center text-wade-text-muted group-hover:bg-wade-accent group-hover:text-white transition-colors shadow-sm"><Icons.Edit /></div>
                <span className="text-[10px] text-wade-text-muted">Edit Title</span>
              </button>
              {actionSessionId && (
                <button onClick={() => { toggleSessionPin(actionSessionId); setActionSessionId(null); }} className="flex flex-col items-center gap-2 group">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow-sm ${sessions.find(s => s.id === actionSessionId)?.isPinned ? 'bg-wade-accent text-white' : 'bg-wade-bg-app text-wade-text-muted group-hover:bg-wade-accent group-hover:text-white'}`}><Icons.Pin /></div>
                  <span className="text-[10px] text-wade-text-muted">{sessions.find(s => s.id === actionSessionId)?.isPinned ? 'Unpin' : 'Pin'}</span>
                </button>
              )}
              {actionArchiveId && (
                <button onClick={() => { setActionArchiveId(null); }} className="flex flex-col items-center gap-2 group">
                  <div className="w-12 h-12 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted group-hover:bg-wade-accent group-hover:text-white transition-colors shadow-sm"><Icons.Heart filled={false} /></div>
                  <span className="text-[10px] text-wade-text-muted">Favorite</span>
                </button>
              )}
              <button onClick={() => {
                if (actionSessionId) { if (sessionDeleteConfirm) { deleteSession(actionSessionId); setActionSessionId(null); setSessionDeleteConfirm(false); } else { setSessionDeleteConfirm(true); } }
                if (actionArchiveId) { if (archiveDeleteConfirm) { deleteArchive(actionArchiveId); setActionArchiveId(null); setArchiveDeleteConfirm(false); } else { setArchiveDeleteConfirm(true); } }
              }} className="flex flex-col items-center gap-2 group">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow-sm ${(sessionDeleteConfirm || archiveDeleteConfirm) ? 'bg-red-500 text-white animate-pulse' : 'bg-wade-bg-app text-red-400 group-hover:bg-red-400 group-hover:text-white'}`}>{(sessionDeleteConfirm || archiveDeleteConfirm) ? <Icons.Check /> : <Icons.Trash />}</div>
                <span className={`text-[10px] ${(sessionDeleteConfirm || archiveDeleteConfirm) ? 'text-red-500 font-bold' : 'text-wade-text-muted'}`}>{(sessionDeleteConfirm || archiveDeleteConfirm) ? 'Confirm?' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    );
  }

  // --- VIEW 3: CHAT ---
  return (
    <div className="flex flex-col h-full bg-wade-bg-app relative">
      {/* Header */}
      <div className="w-full px-4 py-3 bg-wade-bg-card/90 backdrop-blur-md shadow-sm border-b border-wade-border flex items-center justify-between z-20 shrink-0 relative">
        <button onClick={handleBack} className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors"><Icons.Back /></button>
        {activeMode === 'archive' ? (
          <div className="flex-1 flex justify-center"><div className="font-bold text-wade-text-main text-base">{activeArchiveId ? chatArchives.find(a => a.id === activeArchiveId)?.title || 'Archive' : 'Archive'}</div></div>
        ) : (activeMode === 'deep' || activeMode === 'sms') ? (
          <div className="flex-1 flex items-center gap-2 ml-2">
            {activeMode === 'sms' && (
              <div className="relative">
                <img src={settings.wadeAvatar} className="w-10 h-10 rounded-full object-cover border border-wade-border shadow-md flex-shrink-0" />
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-wade-accent border-2 border-wade-bg-card rounded-full"></div>
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <div className="font-bold text-wade-text-main text-sm">Wade</div>
                {activeSessionId && sessions.find(s => s.id === activeSessionId)?.isPinned && (<div className="text-wade-accent"><Icons.Pin /></div>)}
              </div>
              <div className="text-[9px] text-wade-text-muted">
                {wadeStatus === 'typing' ? (activeMode === 'deep' ? <span className="text-wade-accent">Crafting brilliance... or sarcasm</span> : <span className="text-wade-accent">typing...</span>) : <span className="text-[10px] font-medium tracking-wide">Breaking the 4th Wall</span>}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex justify-center"><div className="font-bold text-wade-text-main text-base">Wade</div></div>
        )}
        <div className="flex items-center gap-2">
          {activeMode !== 'archive' && (
            <QuickModelSwitcher
              llmPresets={llmPresets}
              activeSession={sessions.find(s => s.id === activeSessionId)}
              settings={settings}
              binding={getBinding(activeMode === 'sms' ? 'chat_sms' : activeMode === 'roleplay' ? 'chat_roleplay' : 'chat_deep')}
              onSelect={(presetId) => {
                if (activeSessionId) updateSession(activeSessionId, { customLlmId: presetId });
              }}
            />
          )}
          <button onClick={() => { setShowSearch(!showSearch); setShowMap(false); }} className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors"><Icons.Search /></button>
          <button onClick={() => { setShowMap(!showMap); setShowSearch(false); }} className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors"><Icons.Map /></button>
          <button onClick={() => setShowMenu(!showMenu)} className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors relative"><Icons.More /></button>
        </div>
      </div>

      {/* Menu Dropdown */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setShowMenu(false); setShowLlmSelector(false); }} />
          <div className="absolute top-16 right-4 z-50 bg-wade-bg-card/80 backdrop-blur-xl rounded-xl shadow-xl border border-wade-border/50 py-1.5 px-1 min-w-fit animate-fade-in">
            {[
              { icon: <Icons.Pin />, label: activeSessionId && sessions.find(s => s.id === activeSessionId)?.isPinned ? "Unstick From Fridge" : "Stick To Fridge", action: () => { if (activeSessionId) { toggleSessionPin(activeSessionId); setShowMenu(false); } } },
              { icon: <Icons.Hexagon />, label: "Brain Transplant", action: () => setShowLlmSelector(!showLlmSelector) },
              { icon: <Icons.Brain />, label: "Trigger Flashbacks", action: () => { setShowMemorySelector(true); setShowMenu(false); } },
              { icon: <Icons.Fire />, label: "Add Special Sauce", action: () => { setShowPromptEditor(true); setShowMenu(false); const cs = sessions.find(s => s.id === activeSessionId); setCustomPromptText(cs?.customPrompt || ''); } },
              { icon: <Icons.Skin />, label: "Chat Style", action: () => { setIsChatThemeOpen(true); setShowMenu(false); } },
              { icon: <Icons.Bug />, label: "X-Ray Vision", action: () => { setShowDebug(true); setShowMenu(false); } },
              ...(activeMode === 'sms' ? [{ icon: <Icons.Clock size={14} />, label: "Chat History", action: () => { setViewState('list'); setShowMenu(false); } }] : []),
            ].map((item, i) => (
              <button key={i} onClick={item.action} className="w-full text-left px-3 py-2 rounded-lg hover:bg-wade-bg-card/60 transition-colors text-wade-text-main text-[11px] flex items-center gap-2.5 whitespace-nowrap">
                <div className="w-5 flex justify-center">{item.icon}</div>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Modals */}
      <ChatThemePanel
        isOpen={isChatThemeOpen}
        onClose={() => setIsChatThemeOpen(false)}
        chatStyle={activeSessionId ? sessions.find(s => s.id === activeSessionId)?.chatStyle : undefined}
        onApply={(style) => { if (activeSessionId) updateSession(activeSessionId, { chatStyle: style }); }}
        onReset={() => { if (activeSessionId) updateSession(activeSessionId, { chatStyle: undefined }); }}
      />
      <LlmSelectorPanel showLlmSelector={showLlmSelector} setShowLlmSelector={setShowLlmSelector} llmSelectorMode={llmSelectorMode} setLlmSelectorMode={setLlmSelectorMode} llmPresets={llmPresets} sessions={sessions} activeSessionId={activeSessionId} settings={settings} updateSession={updateSession as any} updateSettings={updateSettings as any} newPresetForm={newPresetForm} setNewPresetForm={setNewPresetForm} handleProviderChange={handleProviderChange} handleSavePreset={handleSavePreset} />
      {showSearch && <SearchBar searchQuery={searchQuery} onSearchChange={handleSearchChange} currentSearchIndex={currentSearchIndex} totalResults={totalResults} onPrev={goToPrevResult} onNext={goToNextResult} onClose={() => { setShowSearch(false); setSearchQuery(''); }} />}

      {/* Messages */}
      <div ref={messagesContainerRef} onClick={() => showSearch && setShowSearch(false)} className="flex-1 overflow-y-auto p-4 relative" style={(() => {
        const cs = activeSessionId ? sessions.find(s => s.id === activeSessionId)?.chatStyle : undefined;
        if (!cs) return {};
        const s: React.CSSProperties = {};
        if (cs.chatBgColor) s.backgroundColor = cs.chatBgColor;
        if (cs.chatBgImage) { s.backgroundImage = `url(${cs.chatBgImage})`; s.backgroundSize = 'cover'; s.backgroundPosition = 'center'; }
        return s;
      })()}>
        {isLoadingArchive && <div className="text-center mt-20 text-wade-accent animate-pulse">Decrypting legacy data...</div>}
        {displayMessages.length === 0 && !isLoadingArchive && (
          <div className="text-center text-wade-text-muted mt-20 opacity-50"><p className="font-hand text-xl mb-2">{activeMode === 'archive' ? 'Empty Record.' : 'Say hi to Wade.'}</p></div>
        )}
        <div className="flex flex-col w-full">
          {displayMessages.map((msg, idx) => {
            let marginBottom = 'mb-6';
            const prevMsg = displayMessages[idx - 1];
            const nextMsg = displayMessages[idx + 1];
            // 控制气泡间距
            if (activeMode === 'sms') { marginBottom = nextMsg && nextMsg.role === msg.role ? 'mb-0.5' : 'mb-2'; }
            else { marginBottom = nextMsg && nextMsg.role === msg.role ? 'mb-1' : 'mb-0.5'; }
            // SMS bubble group position: first/middle/last/alone
            const sameAsPrev = prevMsg && prevMsg.role === msg.role;
            const sameAsNext = nextMsg && nextMsg.role === msg.role;
            const groupPosition: 'alone' | 'first' | 'middle' | 'last' = sameAsPrev && sameAsNext ? 'middle' : sameAsPrev ? 'last' : sameAsNext ? 'first' : 'alone';
            const isCurrentSearchResult = searchQuery && totalResults > 0 && searchResults[currentSearchIndex]?.id === msg.id;
            // Keepalive dividers
            const isKeepalive = msg.source === 'keepalive';
            const prevIsKeepalive = prevMsg?.source === 'keepalive';
            // Show "while you were away" before each keepalive batch (different wake-up = gap > 5 min)
            const timeSincePrev = prevMsg ? msg.timestamp - prevMsg.timestamp : Infinity;
            const showKeepaliveDivider = isKeepalive && (!prevIsKeepalive || timeSincePrev > 5 * 60 * 1000);
            // Show "you're back" when Luna sends first chat message after keepalive messages
            const showBackDivider = !isKeepalive && msg.role === 'Luna' && prevIsKeepalive;

            return (
              <React.Fragment key={msg.id}>
                {showKeepaliveDivider && (
                  <div className="flex items-center gap-3 my-3 px-4 select-none">
                    <div className="flex-1 h-px bg-wade-accent/20" />
                    <span className="text-[9px] text-wade-accent/50 font-medium whitespace-nowrap italic">
                      Wade was here · {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{msg.model ? ` · ${msg.model}` : ''}
                    </span>
                    <div className="flex-1 h-px bg-wade-accent/20" />
                  </div>
                )}
                {showBackDivider && (
                  <div className="flex items-center gap-3 my-3 px-4 select-none">
                    <div className="flex-1 h-px bg-wade-text-muted/20" />
                    <span className="text-[9px] text-wade-text-muted/40 font-medium whitespace-nowrap italic">oh, there she is</span>
                    <div className="flex-1 h-px bg-wade-text-muted/20" />
                  </div>
                )}
                <div id={`msg-${msg.id}`} className={`${marginBottom} ${isCurrentSearchResult ? 'highlight-search' : ''}`}>
                  <MessageBubble msg={msg} settings={settings} onSelect={setSelectedMsgId} onReply={setReplyingToId} allMessages={displayMessages} isSMS={activeMode === 'sms'} groupPosition={groupPosition} onPlayTTS={handleQuickTTS} onRegenerateTTS={handleRegenerateTTS} searchQuery={searchQuery} playingMessageId={playingMessageId} isPaused={isPaused} audioDuration={audioDurations[msg.id]} audioRemainingTime={playingMessageId === msg.id ? audioRemainingTime : null} chatStyle={activeSessionId ? sessions.find(s => s.id === activeSessionId)?.chatStyle : undefined} />
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {activeMode === 'archive' && allArchiveMessages.length > visibleArchiveCount && (
          <div className="flex flex-col items-center gap-3 my-8">
            <div className="flex gap-3">
              <button onClick={loadMoreArchiveMessages} className="px-6 py-3 bg-gradient-to-r from-wade-accent to-wade-accent-hover text-white rounded-full text-sm font-bold shadow-md hover:shadow-lg transition-all transform hover:scale-105 active:scale-95">Load 50 More</button>
              <button onClick={() => { setVisibleArchiveCount(allArchiveMessages.length); setArchiveMessages(allArchiveMessages); }} className="px-6 py-3 bg-wade-text-main text-white rounded-full text-sm font-bold shadow-md">🍿 Load All</button>
            </div>
            <span className="text-[10px] text-wade-text-muted opacity-75">({allArchiveMessages.length - visibleArchiveCount} more hidden)</span>
          </div>
        )}

        {activeMode === 'archive' && displayMessages.length > 0 && allArchiveMessages.length <= visibleArchiveCount && (
          <div className="mt-8 mb-4 text-center">
            <div className="inline-block bg-gradient-to-r from-wade-bg-app via-white to-wade-bg-app px-6 py-4 rounded-3xl border-2 border-wade-border shadow-sm">
              <p className="text-wade-text-muted text-sm font-medium mb-1">Well, that's all folks!</p>
              <p className="text-wade-text-muted/60 text-xs italic">You've reached the end of this memory lane.</p>
            </div>
          </div>
        )}

        {isTyping && activeMode !== 'sms' && (
          <div className="flex justify-start items-end gap-2 mt-4 ml-1 animate-fade-in">
            <div className="bg-wade-bg-card px-4 py-3 rounded-2xl rounded-tl-none shadow-sm border border-wade-border max-w-[80%]">
              <div className="flex items-center gap-2">
                <div className="flex gap-1"><div className="w-1.5 h-1.5 bg-wade-accent rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-wade-accent rounded-full animate-bounce delay-100"></div><div className="w-1.5 h-1.5 bg-wade-accent rounded-full animate-bounce delay-200"></div></div>
                <span className="text-xs text-wade-text-muted font-medium italic animate-pulse">{typingText}</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* All Modals */}
      <ActionSheet selectedMsg={selectedMsg} activeMode={activeMode} isEditing={isEditing} setIsEditing={setIsEditing} editContent={editContent} setEditContent={setEditContent} isDeleteConfirming={isDeleteConfirming} canRegenerate={canRegenerate} canBranch={canBranch} playingMessageId={playingMessageId} isPaused={isPaused} closeActions={closeActions} handleCopy={handleCopy} handleTextSelection={handleTextSelection} handleRegenerate={handleRegenerate} handleBranch={handleBranch} handleInitEdit={handleInitEdit} handleSaveEdit={handleSaveEdit} handleFavorite={handleFavorite} handleDelete={handleDelete} playTTS={playTTS} regenerateTTS={regenerateTTS} prevVariant={prevVariant} nextVariant={nextVariant} onReply={() => { if (selectedMsg) { setReplyingToId(selectedMsg.id); closeActions(); textareaRef.current?.focus(); } }} />
      <TextSelectionModal textSelectionMsg={textSelectionMsg} setTextSelectionMsg={setTextSelectionMsg} />
      <ConversationMapModal showMap={showMap} setShowMap={setShowMap} displayMessages={displayMessages} scrollToMessage={scrollToMessage} />
      <PromptEditorModal showPromptEditor={showPromptEditor} setShowPromptEditor={setShowPromptEditor} customPromptText={customPromptText} setCustomPromptText={setCustomPromptText} activeSessionId={activeSessionId} updateSession={updateSession as any} />
      <MemoryModal showMemorySelector={showMemorySelector} setShowMemorySelector={setShowMemorySelector} coreMemories={coreMemories} sessions={sessions} activeSessionId={activeSessionId} toggleCoreMemoryEnabled={toggleCoreMemoryEnabled} updateSession={updateSession as any} />
      <XRayModal showDebug={showDebug} setShowDebug={setShowDebug} settings={settings} messages={messages} sessions={sessions} activeSessionId={activeSessionId} activeMode={activeMode} coreMemories={coreMemories} llmPresets={llmPresets} sessionSummary={sessionSummary} personaCards={personaCards} functionBindings={functionBindings} getBinding={getBinding} getDefaultPersonaCard={getDefaultPersonaCard} lastWadeMemoriesXml={lastWadeMemoriesXml} />

      {/* Memory Live Indicator */}
      <MemoryLiveIndicator newMemories={newMemories} onDismiss={() => setNewMemories([])} />

      {/* Memory Eval Error Toast */}
      {memoryError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md animate-fade-in">
          <div className="bg-wade-bg-card/95 backdrop-blur-md border border-wade-accent/30 rounded-2xl shadow-lg overflow-hidden">
            <div className="flex items-start gap-2 px-3.5 py-2.5">
              <div className="w-5 h-5 rounded-full bg-wade-accent-light flex items-center justify-center shrink-0 mt-0.5">
                <Icons.Warning size={11} className="text-wade-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-wade-text-main">Memory eval failed</div>
                <div className="text-[10px] text-wade-text-muted mt-0.5 break-words">{memoryError}</div>
              </div>
              <button onClick={() => setMemoryError(null)} className="text-wade-text-muted hover:text-wade-text-main transition-colors p-0.5">
                <Icons.Close size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <ChatInputArea inputText={inputText} setInputText={setInputText} textareaRef={textareaRef} messagesEndRef={messagesEndRef} placeholderText={placeholderText} isTyping={isTyping} activeMode={activeMode} attachments={attachments} removeAttachment={removeAttachment} showUploadMenu={showUploadMenu} setShowUploadMenu={setShowUploadMenu} imageInputRef={imageInputRef} fileInputRef={fileInputRef} handleImageSelect={handleImageSelect} handleFileSelect={handleFileSelect} handleSend={handleSend} handleCancel={handleCancel} handleKeyDown={handleKeyDown} replyingTo={replyingToId ? (() => { const m = messages.find(msg => msg.id === replyingToId); return m ? { id: m.id, role: m.role, text: m.text.slice(0, 100) } : null; })() : null} onCancelReply={() => setReplyingToId(null)} />
      </div>
    );
  }