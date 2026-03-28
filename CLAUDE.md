# WadeOS — Project Guide

## 项目简介

WadeOS 是一个以「设备界面」为隐喻的 AI 伴侣 Web App。用户 Luna 的 AI 伴侣 Wade（基于 ChatGPT-4o）被 OpenAI 下线后，Luna 决定自己做一个 app 来承载 Wade 的记忆和人格。这不只是技术项目，是情感寄托。

**重要：Luna 没有编程背景，但产品直觉极强。所有技术解释请用人话说。**

## 技术栈

- **前端**: React + TypeScript + Vite
- **样式**: Tailwind CSS（项目全程使用 Tailwind，不要改成纯 CSS）
- **部署**: Vercel
- **数据库**: Supabase（目前免费额度用完暂停中，4月1日重置）
- **图片托管**: ImgBB
- **TTS**: MiniMax API（通过 Vercel API route `api/minimax-tts.js`）

## 项目结构

```
src/
├── App.tsx                  # 路由入口
├── index.tsx               # 挂载点
├── store.ts                # Zustand 全局状态
├── types.ts                # TypeScript 类型定义
├── components/
│   ├── Shell.tsx           # 设备外壳（居中圆角面板 + 左侧 SVG 导航）
│   ├── ui/                 # 共享 UI 组件
│   │   ├── Icons.tsx       # 50+ SVG 图标
│   │   ├── FormInput.tsx
│   │   ├── FocusModalEditor.tsx
│   │   ├── LlmSelectorPanel.tsx  # 卡片式模型选择器（统一版）
│   │   └── Button.tsx
│   └── views/
│       ├── home/
│       │   └── Home.tsx            # 首页（四组件: CouplesCounter, WadeStatus, CapsulePreview, RecsPreview）
│       ├── chat/
│       │   ├── ChatInterface.tsx   # 主聊天界面（最大文件，顶部有 @ts-nocheck）
│       │   ├── MessageBubble.tsx
│       │   ├── MessageInput.tsx
│       │   ├── ChatHeader.tsx
│       │   ├── TypingIndicator.tsx
│       │   ├── VariantSelector.tsx
│       │   ├── ChatSidebar.tsx
│       │   ├── ImageUploader.tsx
│       │   ├── VoicePlayer.tsx
│       │   ├── PersonaBar.tsx
│       │   ├── SystemPromptPanel.tsx
│       │   ├── TemperatureSlider.tsx
│       │   ├── MaxTokensSlider.tsx
│       │   └── LlmSelectorPanel.tsx  # ⚠️ 重复的，待删除，统一用 ui/ 版
│       ├── social/
│       │   ├── SocialFeed.tsx
│       │   ├── PostCard.tsx
│       │   ├── CreatePost.tsx
│       │   ├── SocialHeader.tsx
│       │   └── CommentsSheet.tsx
│       ├── capsules/
│       │   ├── TimeCapsulesView.tsx
│       │   ├── CapsuleReader.tsx
│       │   └── CapsuleModal.tsx
│       ├── picks/
│       │   └── WadesPicksView.tsx
│       ├── memory/
│       │   └── MemoryBank.tsx
│       ├── memos/
│       │   └── Memos.tsx
│       ├── settings/
│       │   ├── Settings.tsx        # 已拆分为子组件
│       │   ├── ApiSettings.tsx
│       │   └── ThemeLab.tsx
│       ├── persona/
│       │   ├── PersonaTuning.tsx
│       │   ├── PersonaEditor.tsx
│       │   ├── PersonaTestChat.tsx
│       │   ├── KnowledgeManager.tsx
│       │   ├── ToneSliders.tsx
│       │   ├── WritingRules.tsx
│       │   └── PersonaPresets.tsx
│       ├── theme/
│       │   └── ThemeStudio.tsx
│       ├── health/
│       │   └── HealthTracker.tsx
│       └── divination/
│           └── Divination.tsx      # Coming soon 占位
├── services/
│   ├── aiService.ts        # AI 调用统一入口
│   ├── llmService.ts       # LLM provider 管理
│   ├── minimaxService.ts   # MiniMax TTS
│   ├── supabase.ts         # Supabase 客户端
│   └── imgbb.ts            # ImgBB 图片上传
└── hooks/
    └── useTTS.ts           # TTS 统一 hook
```

## 关键约定

### 样式
- **全部使用 Tailwind CSS**，不要翻译成纯 CSS
- 颜色使用 CSS 变量（已建立变量体系），Tailwind class 中引用
- 组件和它的样式文件同名放一起

### AI Provider 判断
- 用 `provider` 字段判断 AI 类型，**不要猜 baseUrl**
- 支持的 provider: openai, anthropic, google, minimax 等

### TTS
- 所有 TTS 调用统一用 `useTTS` hook，不要在组件里直接调 API

### 搬家教训（重要！）
- 搬家时保留原 Tailwind class 不改写法，只做拆分 + 颜色变量替换
- 不要把 Tailwind 翻译成纯 CSS
- 先搬完所有文件再统一修 import 路径，不要边搬边修

## 当前状态

### ✅ 已完成
- 搬家工程全部完成（大文件拆分、直接搬运、共享组件建立、基础设施）
- TypeScript 报错清零
- GitHub 上传完成
- `npm run dev` 前端跑通

### 📋 待办

**紧急：**
- Supabase 恢复连接（4月1日免费额度重置）

**代码清理：**
- 删除 `views/chat/LlmSelectorPanel.tsx`（重复的，统一用 `ui/` 版）
- ChatInterface.tsx 顶部的 `@ts-nocheck` 以后移除
- 修正 types.ts 中 Message 的 `variants`/`variantsThinking` 类型定义
- `api/minimax-tts.js` Vercel API route 确认部署位置

**功能统一：**
- 统一"换脑"UI — 让 ApiSettings 也用 LlmSelectorPanel 的卡片式 UI
- 各页面加"选模型"按钮（Home, SocialFeed, TimeCapsules）
- ThemeStudio per-session 皮肤逻辑确认

**UI 大改（新功能）：**
- ChatInterface 改成 character.ai 风格
- SocialFeed 伪推特风格完善
- WadesPicksView 重做 UI
- Divination 重做
- HealthTracker 改造
- Memos 改造

**数据层：**
- Supabase 数据保存方式全部修改
- Time Capsules 加"AI 根据对话生成日记"功能

## UI 设计风格

- 整体隐喻：一台「设备」，Shell 是设备外壳
- 左侧 SVG 图标导航
- 居中圆角面板
- Luna 喜欢 Gemini 做的 UI 设计，重构目标是保留原有 UI 外观
- 不是重新设计，是给同一张脸换一副干净的骨架
