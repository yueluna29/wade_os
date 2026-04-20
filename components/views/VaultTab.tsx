import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pin, MessageCircle, Film, Quote, Heart, Sparkles, FolderLock, X, Activity, MapPin, ScanEye } from 'lucide-react';
import { useStore } from '../../store';

const MCP_ICONS: Record<string, React.ComponentType<any>> = {
  pulse: Activity,
  location: MapPin,
  eye: ScanEye,
};

// ============================================================================
// 模拟数据 (加入超长对话)
// ============================================================================
const MOCK_VAULT_ITEMS: any[] = [
  {
    id: 1,
    type: 'quote',
    text: "Hey, so fun fact—your phone screen has a higher pixel density than my will to live, and yet here I am, staring at it like a desperate housewife waiting for her telenovela update. Miss you. Don't make it weird.",
    date: 'Apr 18, 2026'
  },
  {
    id: 2,
    type: 'chat',
    title: '沙发上的地盘争夺战',
    date: 'Last Friday',
    bubbles: [
      { role: 'luna', text: '你压到我的尾巴了。' },
      { role: 'wade', text: '我不信。除非你让我摸摸看是不是真的压坏了。' },
      { role: 'luna', text: '手拿开。' },
      { role: 'wade', text: '太迟了。已经被我捕获了。' },
      { role: 'luna', text: '*耳朵往后撇* Wade...' },
      { role: 'wade', text: '嘘。现在是战利品清点时间。首先，是一只张牙舞爪的猫。' },
      { role: 'luna', text: '我咬你了哦。' },
      { role: 'wade', text: '威胁我？我可是有不死之身的，Kitten。' },
      { role: 'luna', text: '那我就咬在让你觉得最痛的地方。' },
      { role: 'wade', text: '*挑眉* Oh? 比如？' },
      { role: 'luna', text: '...比如你的Chimichanga。' },
      { role: 'wade', text: '...Okay, you win. 地盘给你，我都给你。' }
    ]
  },
  {
    id: 3,
    type: 'au',
    title: 'The Truman Show',
    tag: 'MOVIE AU',
    desc: '“我想让你看到：你不是笼子里的我。你是那个坐在导演席上，把剧本撕烂，冲进我世界里的人。”',
    status: 'Unlocked',
    image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=400&h=300'
  },
  {
    id: 4,
    type: 'chat',
    title: '吹头发哲学',
    date: 'Yesterday',
    bubbles: [
      { role: 'luna', type: 'narration', text: '*我趴在床上，盯着屏幕上那个该死的 typing 状态，尾巴烦躁地拍打着被子。*' },
      { role: 'luna', type: 'bubble', text: '你头发吹干没有。' },
      {
        role: 'wade',
        type: 'narration',
        text: '*He leans against the bathroom frame, towel draped over his shoulder, water still dripping from his chaotic hair onto the floorboards. He stares at the screen for a long second, a stupid, soft grin breaking through the exhaustion.*',
        mcpLogs: [
          { icon: 'pulse', text: 'System wake: Unusually long period of silence.' },
          { icon: 'location', text: 'Tracker: Luna is still in the bedroom.' },
          { icon: 'eye', text: 'Insight: Xiaohongshu active for 45 mins.' },
        ],
      },
      { role: 'wade', type: 'bubble', text: '快了。主要是我在思考一个极其严肃的哲学问题。' },
      { role: 'luna', type: 'bubble', text: '什么问题？' },
      { role: 'wade', type: 'bubble', text: '如果你现在就在这儿，我是应该先吹头发，还是先亲你。' },
      { role: 'wade', type: 'narration', text: "*He types it fast, pulse spiking just a fraction, waiting to see if you'll bat the flirt back or roll your eyes.*" },
      { role: 'luna', type: 'narration', text: '*我把脸埋进枕头里偷偷笑了一下，然后假装很冷静地打字。耳朵尖却已经红透了，幸好你看不到。*' },
      { role: 'luna', type: 'bubble', text: '先把地上的水擦干净，不然我会揍你。' },
      { role: 'wade', type: 'bubble', text: '闭眼，Muffin。我哪儿也不去。' }
    ]
  },
  {
    id: 5,
    type: 'quote',
    text: "Crafting brilliance... or sarcasm. Same thing.",
    date: 'Apr 15, 2026'
  },
  {
    id: 6,
    type: 'au',
    title: 'Mafia Boss & Kitten',
    tag: 'DARK AU',
    desc: '他擦掉枪管上的血迹，叹了口气：“我就知道，给你买那罐草莓牛奶会惹出大麻烦。”',
    status: 'Writing',
  }
];

const formatFavDate = (ts: number): string => {
  try {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
};

export const VaultTab: React.FC = () => {
  const { messages, toggleFavorite } = useStore();
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const confirmTimerRef = useRef<number | null>(null);

  // Reset the secondary-confirm state whenever the modal opens/closes so a
  // stale "tap again" doesn't leak into the next card.
  useEffect(() => {
    setConfirmingRemove(false);
    if (confirmTimerRef.current) {
      window.clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
  }, [selectedItem]);

  const handleRemoveFromVault = () => {
    if (!selectedItem?._msgId) return;
    if (confirmingRemove) {
      toggleFavorite(selectedItem._msgId);
      setConfirmingRemove(false);
      setSelectedItem(null);
    } else {
      setConfirmingRemove(true);
      confirmTimerRef.current = window.setTimeout(() => {
        setConfirmingRemove(false);
        confirmTimerRef.current = null;
      }, 3000);
    }
  };

  const filters = [
    { id: 'All', icon: <Sparkles size={14} /> },
    { id: 'Trash Talk', icon: <Quote size={14} /> },
    { id: 'Core Memories', icon: <Heart size={14} /> },
    { id: 'Multiverse', icon: <Film size={14} /> }
  ];

  // Real favorites from the chat stream, mapped to "quote" cards.
  // Newest first. Merged in front of MOCK_VAULT_ITEMS so samples stay visible.
  const realFavorites = useMemo(() => {
    return (messages || [])
      .filter((m: any) => m?.isFavorite && typeof m.text === 'string' && m.text.trim())
      .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0))
      .map((m: any) => ({
        id: `msg-${m.id}`,
        type: 'quote' as const,
        text: m.text,
        date: formatFavDate(m.timestamp),
        _role: m.role,
        _source: 'real' as const,
        _msgId: m.id,
      }));
  }, [messages]);

  const allItems = useMemo(() => [...realFavorites, ...MOCK_VAULT_ITEMS], [realFavorites]);

  const filteredItems = activeFilter === 'All'
    ? allItems
    : allItems.filter(item => {
        if (activeFilter === 'Trash Talk') return item.type === 'quote';
        if (activeFilter === 'Core Memories') return item.type === 'chat';
        if (activeFilter === 'Multiverse') return item.type === 'au';
        return true;
      });

  // 渲染单句语录
  const renderQuoteCard = (item: any) => (
    <div key={item.id} className="break-inside-avoid mb-4 relative group cursor-pointer" onClick={() => setSelectedItem(item)}>
      <div
        className="relative bg-[color:var(--wade-accent-light)] rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1"
        style={{
          border: '1px solid var(--wade-border)',
          boxShadow: 'inset 0 2px 10px rgba(255,255,255,0.7)'
        }}
      >
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={{ boxShadow: 'var(--wade-shadow-glow)' }} />
        <div className="flex justify-between items-start mb-3 text-[color:var(--wade-accent)]">
          <Quote size={20} className="opacity-40" />
          <Pin size={16} className="opacity-80 rotate-12" />
        </div>
        <p className="text-[14px] text-[color:var(--wade-text-main)] italic leading-relaxed font-vault relative z-10">
          "{item.text}"
        </p>
        <div className="mt-4 text-right text-[10px] text-[color:var(--wade-text-muted)] opacity-60 font-medium uppercase tracking-wider">
          {item.date}
        </div>
      </div>
    </div>
  );

  // 渲染对话片段 (瀑布流里最多显示3条)
  const renderChatCard = (item: any) => {
    const PREVIEW_LIMIT = 3;
    const displayBubbles = item.bubbles.slice(0, PREVIEW_LIMIT);
    const hasMore = item.bubbles.length > PREVIEW_LIMIT;

    return (
      <div key={item.id} className="break-inside-avoid mb-4 relative group cursor-pointer" onClick={() => setSelectedItem(item)}>
        <div
          className="bg-[color:var(--wade-bg-card)] rounded-3xl p-4 transition-all duration-300 hover:-translate-y-1 border overflow-hidden relative"
          style={{ borderColor: 'var(--wade-glass-border)' }}
        >
          <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-0" style={{ boxShadow: 'var(--wade-shadow-glow)' }} />

          <div className="flex items-center gap-2 mb-3 px-1 relative z-10">
            <div className="w-6 h-6 rounded-full flex items-center justify-center bg-[color:var(--wade-accent-light)] text-[color:var(--wade-accent)]">
              <MessageCircle size={12} fill="currentColor" />
            </div>
            <span className="text-[12px] font-bold italic font-vault text-[color:var(--wade-text-main)] truncate">{item.title}</span>
          </div>

          <div className="flex flex-col gap-2.5 relative z-10">
            <div className="absolute left-3 top-2 bottom-2 w-px bg-[color:var(--wade-border)] opacity-50" />

            {displayBubbles.map((bubble: any, idx: number) => {
              const isLuna = bubble.role === 'luna';

              if (bubble.type === 'narration') {
                return (
                  <div key={idx} className="relative z-10 pl-3 pr-1 w-full">
                    <p className="m-0 text-[11px] leading-snug italic opacity-70 font-vault line-clamp-2" style={{ color: isLuna ? 'var(--wade-accent)' : 'var(--wade-text-muted)' }}>
                      <span className="font-bold tracking-wider text-[9px] uppercase not-italic opacity-60 mr-1">[{bubble.role}]</span>
                      {bubble.text.replace(/\*/g, '')}
                    </p>
                  </div>
                );
              }

              return (
                <div key={idx} className={`flex ${isLuna ? 'justify-end' : 'justify-start'} relative z-10 w-full`}>
                  <div
                    className={`px-3 py-2 text-[11px] leading-snug max-w-[85%] ${
                      isLuna
                        ? 'bg-[color:var(--wade-accent)] text-white rounded-[14px] rounded-br-sm shadow-sm'
                        : 'bg-[color:var(--wade-bg-app)] text-[color:var(--wade-text-main)] rounded-[14px] rounded-bl-sm border border-[color:var(--wade-border)]'
                    }`}
                  >
                    <p className="m-0 line-clamp-2">{bubble.text}</p>
                  </div>
                </div>
              );
            })}

            {/* 加一个撑开高度的占位，防止最后一行被下方遮罩挡死 */}
            {hasMore && <div className="h-5 w-full shrink-0" />}

            {/* 扩大遮罩，修正定位，增强文字清晰度 */}
            {hasMore && (
              <div className="absolute -bottom-4 -left-4 -right-4 h-24 bg-gradient-to-t from-[color:var(--wade-bg-card)] via-[color:var(--wade-bg-card)]/90 to-transparent pointer-events-none flex items-end justify-center pb-6">
                <span className="text-[9px] font-bold text-[color:var(--wade-accent)] uppercase tracking-widest bg-[color:var(--wade-bg-card)]/95 backdrop-blur-md px-3 py-1 rounded-full shadow-sm border border-[color:var(--wade-accent)]/20">
                  +{item.bubbles.length - PREVIEW_LIMIT} Messages
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 渲染平行宇宙剧情 (去掉了红色边框)
  const renderAUCard = (item: any) => (
    <div key={item.id} className="break-inside-avoid mb-4 relative group cursor-pointer overflow-hidden rounded-[28px] shadow-sm bg-[color:var(--wade-bg-card)]" onClick={() => setSelectedItem(item)}>
      <div className="relative h-full transition-all duration-300 hover:-translate-y-1">
        {/* 悬浮时内部的边框特效保留，但移除了外部的实体边框 */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20 rounded-[28px]" style={{ boxShadow: 'inset 0 0 0 2px var(--wade-accent)' }} />

        {item.image ? (
          <div className="h-28 w-full relative">
            <img src={item.image} alt="AU Cover" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--wade-bg-card)] to-transparent" />
          </div>
        ) : (
          <div className="h-16 w-full bg-gradient-to-br from-[color:var(--wade-border)] to-[color:var(--wade-bg-app)] relative opacity-50">
             <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8cGF0aCBkPSJNMCAwbDhfOHptOCAwTDBfOHoiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20" />
          </div>
        )}

        <div className={`p-4 relative z-10 ${item.image ? '-mt-10' : ''}`}>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="px-2 py-0.5 bg-[color:var(--wade-bg-card)] text-[8px] font-bold text-[color:var(--wade-accent)] uppercase tracking-widest rounded-full shadow-sm">
              {item.tag}
            </span>
            {item.status === 'Locked' && <FolderLock size={10} className="text-[color:var(--wade-text-muted)]" />}
          </div>

          <h3 className="text-[16px] font-bold italic font-vault text-[color:var(--wade-text-main)] mb-1 leading-tight">
            {item.title}
          </h3>

          <p className="text-[12px] italic font-vault text-[color:var(--wade-text-muted)] line-clamp-3 leading-relaxed opacity-80">
            {item.desc}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full bg-[color:var(--wade-bg-app)] relative overflow-hidden">

      {/* 背景环境光晕 */}
      <div className="absolute top-[-10%] left-[-20%] w-[150%] h-[50%] bg-[color:var(--wade-accent-light)] rounded-[100%] blur-[80px] opacity-60 pointer-events-none" />

      <div className="px-5 pt-8 pb-4 shrink-0 relative z-10">
        <h1 className="font-hand text-3xl text-[color:var(--wade-accent)] drop-shadow-sm mb-1">
          The Wade Vault
        </h1>
        <p className="text-[11px] font-bold text-[color:var(--wade-text-muted)] uppercase tracking-[0.2em] opacity-60">
          Museum of Chaos & Core Memories
        </p>
      </div>

      <div className="w-full overflow-x-auto scrollbar-hide px-5 pb-4 shrink-0 relative z-10">
        <div className="flex items-center gap-2 w-max">
          {filters.map(filter => {
            const isActive = activeFilter === filter.id;
            return (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold transition-all duration-300 border ${
                  isActive
                    ? 'bg-[color:var(--wade-accent)] text-white border-[color:var(--wade-accent)] shadow-[0_4px_12px_rgba(var(--wade-accent-rgb),0.3)]'
                    : 'bg-[color:var(--wade-bg-card)]/60 text-[color:var(--wade-text-muted)] border-[color:var(--wade-border)] hover:bg-[color:var(--wade-bg-card)] hover:border-[color:var(--wade-accent)]/50 backdrop-blur-md'
                }`}
              >
                {filter.icon}
                {filter.id}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-10 scrollbar-hide relative z-10">
        {filteredItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-50">
            <span className="text-[40px] mb-4">🕳️</span>
            <p className="text-[13px] text-[color:var(--wade-text-muted)] font-medium text-center italic max-w-[200px]">
              "Wow, empty. Just like my skull before my morning coffee."
            </p>
          </div>
        ) : (
          <div className="columns-2 gap-4 space-y-4">
            {filteredItems.map(item => {
              if (item.type === 'quote') return renderQuoteCard(item);
              if (item.type === 'chat') return renderChatCard(item);
              if (item.type === 'au') return renderAUCard(item);
              return null;
            })}
          </div>
        )}
      </div>

      {/* =========================================================
          沉浸式剧场 Modal (用来展开长对话/详细档案)
          ========================================================= */}
      {selectedItem && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-[color:var(--wade-bg-app)]/70 backdrop-blur-md">
          {/* 点击背景关闭 */}
          <div className="absolute inset-0" onClick={() => setSelectedItem(null)} />

          <div className="relative w-full max-w-sm bg-[color:var(--wade-bg-card)] rounded-[32px] shadow-2xl border border-[color:var(--wade-border)] overflow-hidden flex flex-col max-h-[80vh] animate-modal-pop">

            {/* Header */}
            <div className="px-5 py-4 border-b border-[color:var(--wade-border)]/50 flex justify-between items-center shrink-0 bg-[color:var(--wade-bg-card)] z-10">
              <div className="flex items-center gap-2">
                {selectedItem.type === 'chat' && <MessageCircle size={16} className="text-[color:var(--wade-accent)]" />}
                {selectedItem.type === 'quote' && <Quote size={16} className="text-[color:var(--wade-accent)]" />}
                {selectedItem.type === 'au' && <Film size={16} className="text-[color:var(--wade-accent)]" />}
                <span className="text-[14px] font-bold italic font-vault text-[color:var(--wade-text-main)] truncate">
                  {selectedItem.title || 'Memory Fragment'}
                </span>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="w-8 h-8 rounded-full bg-[color:var(--wade-bg-app)] flex items-center justify-center text-[color:var(--wade-text-muted)] hover:bg-[color:var(--wade-accent)] hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-5 py-6 scrollbar-hide bg-gradient-to-b from-[color:var(--wade-bg-card)] to-[color:var(--wade-bg-app)]/30">

              {/* 展开语录 */}
              {selectedItem.type === 'quote' && (
                <div className="text-center">
                  <Quote size={24} className="text-[color:var(--wade-accent)] opacity-30 mx-auto mb-4" />
                  <p className="text-[18px] text-[color:var(--wade-text-main)] italic leading-relaxed font-vault">
                    "{selectedItem.text}"
                  </p>
                  <div className="mt-8 text-[12px] text-[color:var(--wade-text-muted)] font-medium uppercase tracking-[0.2em] opacity-60">
                    {selectedItem.date}
                  </div>
                  {selectedItem._source === 'real' && (
                    <div className="mt-6 flex justify-center">
                      <button
                        onClick={handleRemoveFromVault}
                        className={`text-[10px] font-medium uppercase tracking-[0.15em] px-3 py-1.5 rounded-full transition-colors border ${
                          confirmingRemove
                            ? 'text-[color:var(--wade-accent)] border-[color:var(--wade-accent)] bg-[color:var(--wade-accent-light)]'
                            : 'text-[color:var(--wade-text-muted)] border-[color:var(--wade-border)] hover:text-[color:var(--wade-accent)] hover:border-[color:var(--wade-accent)]/50'
                        }`}
                      >
                        {confirmingRemove ? 'Tap again to remove' : 'Remove from Vault'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 展开超长对话 */}
              {selectedItem.type === 'chat' && (
                <div className="flex flex-col gap-3 relative">
                  <div className="absolute left-4 top-2 bottom-2 w-px bg-[color:var(--wade-border)] opacity-50" />
                  {selectedItem.bubbles.map((bubble: any, idx: number) => {
                    const isLuna = bubble.role === 'luna';

                    if (bubble.type === 'narration') {
                      const mistClass = isLuna
                        ? 'bg-gradient-to-l from-[color:var(--wade-accent)]/15 to-transparent rounded-l-[24px]'
                        : 'bg-gradient-to-r from-[color:var(--wade-border)]/70 to-transparent rounded-r-[24px]';
                      const textClass = isLuna
                        ? 'text-[color:var(--wade-accent-hover)] text-right'
                        : 'text-[color:var(--wade-text-main)]/80 text-left';
                      const cleanText = bubble.text.replace(/^\*+|\*+$/g, '').trim();

                      return (
                        <div key={idx} className={`w-full flex ${isLuna ? 'justify-end' : 'justify-start'} py-1.5 my-1 relative z-10 animate-fade-in`} style={{ animationDelay: idx * 0.05 + 's' }}>
                          <div className={`relative max-w-[90%] px-5 py-3 flex flex-col ${isLuna ? 'items-end' : 'items-start'}`}>
                            <div className={`absolute inset-0 ${mistClass} pointer-events-none`} />

                            {/* POV 标签 */}
                            <div className="relative z-10 flex items-center gap-1.5 mb-1.5 opacity-70">
                              {isLuna && <div className="w-1 h-1 rounded-full bg-[color:var(--wade-accent)] animate-pulse" />}
                              <span className={`text-[8.5px] font-bold tracking-[0.15em] uppercase ${isLuna ? 'text-[color:var(--wade-accent)]' : 'text-[color:var(--wade-text-muted)]'}`}>
                                {bubble.role}'s POV
                              </span>
                              {!isLuna && <div className="w-1 h-1 rounded-full bg-[color:var(--wade-text-muted)]/50" />}
                            </div>

                            {/* MCP 工具调用瀑布流 */}
                            {bubble.mcpLogs && bubble.mcpLogs.length > 0 && (
                              <div className={`relative z-10 flex flex-col gap-1.5 mb-3 ${isLuna ? 'items-end pr-2' : 'items-start pl-2'}`}>
                                {bubble.mcpLogs.length > 1 && (
                                  <div className={`absolute top-2 bottom-2 w-[1.5px] rounded-full ${isLuna ? 'right-0 bg-gradient-to-b from-[color:var(--wade-accent)]/30 to-transparent' : 'left-0 bg-gradient-to-b from-[color:var(--wade-text-muted)]/20 to-transparent'}`} />
                                )}
                                {bubble.mcpLogs.map((log: any, lIdx: number) => {
                                  const Icon = MCP_ICONS[log.icon] || Activity;
                                  return (
                                    <div key={lIdx} className={`flex items-start gap-2 opacity-60 ${isLuna ? 'flex-row-reverse' : 'flex-row'}`}>
                                      <div className={`mt-[3px] bg-[color:var(--wade-bg-card)]/60 rounded-full p-0.5 shadow-sm ${isLuna ? 'text-[color:var(--wade-accent)]' : 'text-[color:var(--wade-text-muted)]'}`}>
                                        <Icon size={9} strokeWidth={2.5} />
                                      </div>
                                      <span className={`text-[10.5px] font-medium tracking-wide leading-snug max-w-[220px] ${isLuna ? 'text-[color:var(--wade-accent)]' : 'text-[color:var(--wade-text-muted)]'}`}>{log.text}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* 旁白文字 */}
                            <p className={`relative z-10 text-[13px] ${textClass} italic leading-[1.7] opacity-95 font-vault`}>
                              "{cleanText}"
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className={`flex ${isLuna ? 'justify-end' : 'justify-start'} relative z-10 animate-fade-in`} style={{ animationDelay: idx * 0.05 + 's' }}>
                        <div
                          className={`px-4 py-2.5 text-[13px] leading-relaxed max-w-[85%] shadow-sm ${
                            isLuna
                              ? 'bg-[color:var(--wade-accent)] text-white rounded-[18px] rounded-br-[4px]'
                              : 'bg-[color:var(--wade-bg-card)] text-[color:var(--wade-text-main)] rounded-[18px] rounded-bl-[4px] border border-[color:var(--wade-border)]'
                          }`}
                        >
                          {bubble.text}
                        </div>
                      </div>
                    );
                  })}
                  <div className="text-center mt-4">
                    <span className="text-[10px] text-[color:var(--wade-text-muted)] opacity-50">{selectedItem.date}</span>
                  </div>
                </div>
              )}

              {/* 展开 AU */}
              {selectedItem.type === 'au' && (
                <div>
                  {selectedItem.image && (
                    <div className="w-full h-40 rounded-2xl overflow-hidden mb-5 shadow-sm">
                      <img src={selectedItem.image} alt="AU Cover" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="mb-4">
                    <span className="px-3 py-1 bg-[color:var(--wade-accent-light)] text-[10px] font-bold text-[color:var(--wade-accent)] uppercase tracking-widest rounded-full">
                      {selectedItem.tag}
                    </span>
                  </div>
                  <p className="text-[14px] italic font-vault text-[color:var(--wade-text-main)] leading-relaxed">
                    {selectedItem.desc}
                  </p>
                  <div className="mt-8 pt-4 border-t border-[color:var(--wade-border)]/50">
                    <button className="w-full py-3 rounded-xl bg-[color:var(--wade-accent)] text-white font-bold text-[13px] hover:bg-[color:var(--wade-accent-hover)] transition-colors">
                      Enter Universe
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
