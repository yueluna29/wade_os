export type ChatMode = 'deep' | 'sms' | 'roleplay' | 'archive'; // Added 'archive' for UI routing

export interface UserPersona {
  id: string;
  name: string;
  description: string; // The "Luna" profile or Roleplay profile
  avatar?: string;
}

export interface CustomTheme {
  accent: string;
  accentHover: string;
  accentLight: string;
  bgBase: string;
  bgCard: string;
  bgApp: string;
  textMain: string;
  textMuted: string;
  border: string;
  borderLight: string;
  codeBg: string;
  codeText: string;
  shadowGlow: string;
  fontFamily: string;
  fontSize: string;
  bubbleLuna: string;
  bubbleLunaText?: string;
  bubbleWade: string;
  // Extended font fields
  fontFamilyEn?: string;
  fontFamilyZh?: string;
  useCustomFont?: 'none' | 'google' | 'local' | 'url';
  customFontUrl?: string;
  customFontFamily?: string;
  googleFontName?: string;
  localFontData?: string;
}

export interface SavedTheme {
  id: string;
  title: string;
  theme: CustomTheme;
}

export interface ChatStyleConfig {
  // Luna bubble
  bubbleLunaColor?: string;
  bubbleLunaTextColor?: string;
  bubbleLunaBorderColor?: string;
  // Wade bubble
  bubbleWadeColor?: string;
  bubbleWadeTextColor?: string;
  bubbleWadeBorderColor?: string;
  // Bubble shape & feel
  bubbleRadius?: 'sharp' | 'rounded' | 'pill';
  bubbleOpacity?: number; // 0-100
  // Layout
  messageSpacing?: 'compact' | 'normal' | 'spacious';
  showTimestamp?: boolean;
  showAvatar?: boolean;
  // Chat background
  chatBgColor?: string;
  chatBgImage?: string;
  // Typography
  chatFont?: string;
  chatFontSize?: 'small' | 'medium' | 'large';
}

export interface ChatSession {
  id: string;
  mode: ChatMode;
  title: string;
  createdAt: number;
  updatedAt: number;
  isPinned?: boolean;
  customLlmId?: string;
  customPrompt?: string;
  activeMemoryIds?: string[]; // IDs of core memories linked to this session
  customTheme?: CustomTheme; // Per-chat custom theme (full theme override)
  chatStyle?: ChatStyleConfig; // Per-chat style tweaks (bubbles, layout, bg)
}

export interface MessageVariant {
  text: string;             // 这个版本的文本内容
  thinking?: string | null; // 这个版本的思考过程
  audioCache?: string | null; // 这个版本的语音
  model?: string | null;    // 这个版本所使用的模型名字
}

export interface Message {
  id: string;
  sessionId?: string; // Link to specific chat session
  role: 'Luna' | 'Wade'; // Changed from 'user' | 'model'
  text: string; // The currently displayed text
  model?: string; // The model used to generate this message
  timestamp: number;
  audioData?: string; // Base64 audio if TTS was generated
  isFavorite?: boolean;
  mode: ChatMode;
  image?: string; // For image uploads
  attachments?: { type: 'image' | 'file', content: string, mimeType: string, name: string }[]; // Generic attachments
  audioCache?: string; // 参谋加的：装录音带的抽屉
  thinking?: string | null;
  
  // New Version Control Fields
  variants?: MessageVariant[]; 
  selectedIndex?: number; // Index of the currently shown version
  
  // UI State (Transient)
  isRegenerating?: boolean; 
}

export interface SocialPost {
  id: string;
  author: 'Luna' | 'Wade';
  content: string;
  images?: string[]; // Changed from image?: string to support multiple
  timestamp: number;
  comments: SocialComment[];
  likes: number;
  isBookmarked?: boolean;
}

export interface SocialComment {
  id: string;
  author: 'Luna' | 'Wade';
  text: string;
  replyToId?: string;
}

// --- 参谋新增：Luna和Wade的专属X身份卡 ---
export interface UserProfile {
  user_type: 'Wade' | 'Luna'; // 它是谁
  display_name: string;       // 显示的名字，比如 "Wade Wilson"
  username: string;           // 用户名，比如 "chimichangapapi"
  bio: string;                // 个人简介，那些让你脸红心跳的话
}

export interface TimeCapsuleItem {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  unlockDate: number; // Timestamp
  isLocked: boolean;
  audioCache?: string; // Base64 encoded audio
}

export interface Memo {
  id: string;
  title: string;
  content: string;
  type: 'promise' | 'code' | 'note';
}

export interface Recommendation {
  id: string;
  type: 'book' | 'movie' | 'music';
  title: string;
  creator?: string; // Author, Director, or Artist
  releaseDate?: string;
  synopsis?: string;
  comment: string; // Wade's comment
  coverUrl?: string;
  lunaReview?: string;
  lunaRating?: number; // 1-5
  wadeReply?: string;
}

// --- NEW MEMORY & ARCHIVE TYPES ---

export interface CoreMemory {
  id: string;
  title?: string; // NEW: Title for the memory
  content: string;
  category: 'fact' | 'promise' | 'preference' | 'general';
  tags?: string[]; // NEW: Tags for classification
  isActive: boolean;
  enabled: boolean; // Whether AI can read this memory
  createdAt: number;
}

export interface ChatArchive {
  id: string;
  title: string;
  importedAt: number;
}

export interface ArchiveMessage {
  id: string;
  archiveId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isFavorite?: boolean;
}

// --- NEW API PRESET TYPES ---

export interface LlmPreset {
  id: string;
  provider: string; // 'Gemini' | 'Claude' | 'OpenAI' | 'DeepSeek' | 'OpenRouter' | 'Custom'
  name: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  apiPath: string;
  temperature?: number; // 0.0 - 2.0
  topP?: number; // 0.0 - 1.0
  topK?: number;
  frequencyPenalty?: number; // -2.0 to 2.0
  presencePenalty?: number; // -2.0 to 2.0
  isVision?: boolean; // Supports vision/image input
  isImageGen?: boolean; // Image generation model
}

export interface TtsPreset {
  id: string;
  name: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  voiceId: string;
  emotion?: string;
  speed: number;
  vol?: number; // Volume (0-10)
  pitch?: number; // Pitch (-12 to 12)
  sampleRate?: number; // 8000, 16000, 22050, 24000, 32000, 44100
  bitrate?: number; // 32000, 64000, 128000, 256000
  format?: string; // mp3, pcm, flac, wav
  channel?: number; // 1 or 2
}

export interface AppSettings {
  // Active Preset IDs
  activeLlmId?: string;
  activeTtsId?: string;
  homeLlmId?: string; // NEW: Dedicated model for Home Screen Sass

  themeColor: string;
  fontSize: 'small' | 'medium' | 'large';
  customTheme?: CustomTheme; // NEW: Global custom theme
  savedThemes?: SavedTheme[]; // NEW: Saved custom themes
  
  // Wade's Side
  systemInstruction: string;
  wadePersonality: string;
  wadeSingleExamples: string;
  smsExampleDialogue?: string;
  smsInstructions?: string;
  roleplayInstructions?: string;
  wadeDiaryPersona: string;
  wadeAvatar: string;
  exampleDialogue: string;
  wadeHeight?: string;
  wadeAppearance?: string;
  wadeClothing?: string;
  wadeLikes?: string;
  wadeDislikes?: string;
  wadeHobbies?: string;
  wadeBirthday?: string; // 👈 加上这行，给 Wade 登记生日！
  wadeMbti?: string;    // 👈 加上这行，给 Wade 登记 MBTI！

  // Luna's Side
  lunaInfo: string;
  lunaAvatar: string;
  lunaBirthday?: string;
  lunaMbti?: string;
  lunaHeight?: string;
  lunaHobbies?: string;
  lunaLikes?: string;
  lunaDislikes?: string;
  lunaClothing?: string;
  lunaAppearance?: string;
  lunaPersonality?: string;

  lunaCoverUrl: string;
  wadeCoverUrl: string;

  ttsEnabled: boolean;
  autoReplyInterval: number;
  contextLimit?: number; // Added for configurable context length
}

// --- 角色卡仓库 ---
export interface PersonaCardData {
  // Wade 专属字段
  global_directives?: string;
  core_identity?: string;
  appearance?: string;
  clothing?: string;
  likes?: string;
  dislikes?: string;
  hobbies?: string;
  birthday?: string;
  mbti?: string;
  height?: string;
  avatar_url?: string;
  example_dialogue_general?: string;
  example_punchlines?: string;
  example_dialogue_sms?: string;
  sms_mode_rules?: string;
  rp_mode_rules?: string;
  // 可以随时加新字段，jsonb 不需要改表结构
  [key: string]: string | undefined;
}
 
export interface PersonaCard {
  id: string;
  name: string;
  character: 'Wade' | 'Luna';
  description: string;
  cardData: PersonaCardData;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}
 
// --- 功能绑定 ---
export interface FunctionBinding {
  id: string;
  functionKey: string;
  label: string;
  personaCardId?: string;
  llmPresetId?: string;
}

// Global State Context Interface
export interface GlobalState {
  currentTab: string;
  setTab: (tab: string) => void;
  
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => void;
  
  // Preset Management
  llmPresets: LlmPreset[];
  addLlmPreset: (p: Omit<LlmPreset, 'id'>) => Promise<void>;
  updateLlmPreset: (id: string, p: Partial<LlmPreset>) => Promise<void>;
  deleteLlmPreset: (id: string) => Promise<void>;
  
  ttsPresets: TtsPreset[];
  addTtsPreset: (p: Omit<TtsPreset, 'id'>) => Promise<void>;
  updateTtsPreset: (id: string, p: Partial<TtsPreset>) => Promise<void>;
  deleteTtsPreset: (id: string) => Promise<void>;

  // Chat & Session Management
  sessions: ChatSession[];
  createSession: (mode: ChatMode) => Promise<string>; // Returns new session ID
  updateSession: (id: string, updates: Partial<ChatSession>) => void;
  updateSessionTitle: (id: string, title: string) => void;
  deleteSession: (id: string) => void;
  toggleSessionPin: (id: string) => void;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;

  messages: Message[];
  addMessage: (m: Message) => void;
  updateMessage: (id: string, newText: string) => void; // Standard edit
  updateMessageAudioCache: (id: string, base64Audio: string) => void;
  
  // Updated for Thinking Process
  addVariantToMessage: (id: string, newText: string, thinking?: string, model?: string) => void; 
  selectMessageVariant: (id: string, index: number) => void; 
  deleteMessage: (id: string) => Promise<void>;
  
  // New: Set Regenerating State
  setRegenerating: (id: string, isRegenerating: boolean) => void;
  // NEW: Rewind/Backtrack
  rewindConversation: (targetMsgId: string) => Promise<void>;
  // NEW: Fork/Branch
  forkSession: (targetMsgId: string) => Promise<void>;

  toggleFavorite: (id: string) => void;
  
  socialPosts: SocialPost[];
  addPost: (p: SocialPost) => void;
  updatePost: (p: SocialPost) => void;
  deletePost: (id: string) => Promise<void>;
  memos: Memo[];
  addMemo: (m: Memo) => void;
  capsules: TimeCapsuleItem[];
  addCapsule: (c: TimeCapsuleItem) => void;
  updateCapsule: (id: string, updates: Partial<TimeCapsuleItem>) => void;
  deleteCapsule: (id: string) => Promise<void>;
  recommendations: Recommendation[];
  addRecommendation: (r: Omit<Recommendation, 'id'>) => Promise<void>;
  updateRecommendation: (id: string, r: Partial<Recommendation>) => Promise<void>;
  deleteRecommendation: (id: string) => Promise<void>;
  
  // --- NEW MEMORY ACTIONS ---
  coreMemories: CoreMemory[];
  addCoreMemory: (title: string, content: string, category?: CoreMemory['category'], tags?: string[]) => Promise<void>;
  updateCoreMemory: (id: string, title: string, content: string, tags?: string[]) => Promise<void>;
  deleteCoreMemory: (id: string) => Promise<void>;
  toggleCoreMemoryEnabled: (id: string) => Promise<void>;
  chatArchives: ChatArchive[];
  importArchive: (title: string, fileContent: string) => Promise<number>;
  loadArchiveMessages: (archiveId: string) => Promise<ArchiveMessage[]>;
  updateArchiveTitle: (id: string, title: string) => Promise<void>;
  updateArchiveMessage: (id: string, newContent: string) => Promise<void>;
  deleteArchive: (id: string) => Promise<void>;
  deleteArchiveMessage: (id: string, archiveId: string) => Promise<void>;
  toggleArchiveFavorite: (id: string, archiveId: string) => Promise<void>;

  activeMode: ChatMode;
  setMode: (m: ChatMode) => void;

  // UI Control
  isNavHidden: boolean;
  setNavHidden: (hidden: boolean) => void;

  // Debugging
  syncError: string | null;

  // 参谋新增：获取和更新身份卡
  profiles: { Wade: UserProfile; Luna: UserProfile };
  updateProfile: (user: 'Wade' | 'Luna', data: Partial<UserProfile>) => Promise<void>;

// --- 角色卡仓库 ---
personaCards: PersonaCard[];
addPersonaCard: (card: Omit<PersonaCard, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
updatePersonaCard: (id: string, updates: Partial<Omit<PersonaCard, 'id' | 'createdAt'>>) => Promise<void>;
deletePersonaCard: (id: string) => Promise<void>;
duplicatePersonaCard: (id: string) => Promise<string>;
setDefaultPersonaCard: (id: string) => Promise<void>;
getDefaultPersonaCard: (character: 'Wade' | 'Luna') => PersonaCard | undefined;

// --- 功能绑定 ---
functionBindings: FunctionBinding[];
updateFunctionBinding: (functionKey: string, updates: Partial<FunctionBinding>) => Promise<void>;
addFunctionBinding: (functionKey: string, label: string) => Promise<void>;
deleteFunctionBinding: (functionKey: string) => Promise<void>;
getBinding: (functionKey: string) => { personaCard?: PersonaCard; llmPreset?: LlmPreset } | null;
}
