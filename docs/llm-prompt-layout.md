# LLM Prompt Layout — WadeOS

每个调用 LLM 的模块发送 prompt 时，数据块的**拼接顺序**。数据块在 prompt 里的位置会影响 LLM 的注意力分配（越靠前的越像"系统级指令"，越靠后的越像"刚发生的事"），所以改动前对照这份文档检查语义。

文件 / 行号截止 `main` 分支最新提交，改了代码记得同步这份 doc。

---

## 1. Chat / SMS 聊天（Luna ↔ Wade 主对话）

**入口**：`services/aiService.ts:214` → `generateFromCard`
**调用方**：`components/views/ChatInterfaceMixed.tsx` 的 `triggerAIResponse`

LLM 每一轮收到的东西分成**三层独立结构**，不是一个大字符串：

```
┌──────────────────────────────────────┐
│ System Prompt（系统指令，缓存命中最高）│  ← slot 1-13 拼成的大字符串
├──────────────────────────────────────┤
│ History（历史对话数组）                │  ← 过去的 Luna/Wade 气泡交替
│   [{role: user, parts}, {role: model, parts}, ...]
├──────────────────────────────────────┤
│ Current User Message                 │  ← Luna 刚发的这条 + customPrompt
└──────────────────────────────────────┘
```

### 1A. System Prompt 内部拼接顺序（slot 1-13）

`buildSystemPromptFromCard` 把下面这些按顺序字符串拼接成一个大的 `systemPrompt`：

| # | 段落标题 | 来源（Me tab 字段 / DB 字段） | 行号 |
|---|---|---|---|
| 1 | `[SYSTEM INSTRUCTIONS - HIGHEST PRIORITY]` | System Card 的 `global_directives`（没有就走 Wade Card 的 global_directives） | aiService.ts:88-91 |
| 2 | `[CHARACTER PERSONA]` + `<wade_identity>...</wade_identity>` | Wade 人设卡所有字段 XML（Core Identity / Personality / Speech / Punchlines 对应字段都在里面） | aiService.ts:93-97 |
| 3 | `[USER IDENTITY]` + `<luna_identity>...</luna_identity>` | Luna 人设卡所有字段 XML | aiService.ts:99-103 |
| 4 | `[WADE'S STYLE - SINGLE LINE EXAMPLES]` | `wadeCard.example_punchlines` = Me tab 的 **Punchlines** 字段（`settings.wadeSingleExamples`） | aiService.ts:106-108 |
| 5 | `[SMS MODE EXAMPLES]` / `[EXAMPLE DIALOGUE]` | Me tab 的 **SMS Examples** / **General Dialogue** 字段 | aiService.ts:109-113 |
| 6 | SMS / RP Mode Rules | System Card 的 `sms_mode_rules` / `rp_mode_rules` | aiService.ts:115-125 |
| 7 | `[LONG TERM MEMORY BANK]` | 已启用的 Core Memories（记忆银行手动写的那些） | aiService.ts:127-133 |
| 8 | `[PREVIOUS CONVERSATION SUMMARY]` | `sessionSummary`，auto-summary 每 10 轮写一次 | aiService.ts:135-138 |
| 9 | `<wade_memories>` | 向量检索出来的长期记忆（跟当前 Luna 说的话语义相关的那些） | aiService.ts:140-143 |
| 10 | `<wade_diary>` | 最近 3 篇 Wade 日记 | aiService.ts:145-148 |
| 11 | `<wade_todos>` | 最近 20 条 pending 状态的 wade_todos | aiService.ts:150-153 |
| 12 | `[CURRENT TIME]` | 东京时间，精度到小时 | aiService.ts:155-167 |
| 13 | `[SYSTEM UPDATE: Regenerate...]` + `[CONTEXT: You have just sent ...]` | 仅 Regen 时注入，附带最近 Wade 气泡 | aiService.ts:169-192 |

### 1B. History 数组（过去对话）

**不是字符串，是结构化数组**：

```js
[
  { role: 'user',  parts: [{text: '猫猫的话'}] },
  { role: 'model', parts: [{text: 'Wade 的回复'}] },
  { role: 'user',  parts: [{text: '猫猫的话'}] },
  ...
]
```

- Gemini 路径：作为 `history` 传给 `ai.chats.create({history: ...})`（aiService.ts:285）
- OpenAI 路径：转成 `messages` 数组里的 role/content 对象

LLM 从 API 层面按**时间顺序**读 history，不参与 system prompt 缓存，但 Gemini/Claude 内部会有自己的历史缓存优化。

### 1C. Current User Message（最末尾）

Luna 刚发的这条消息走单独的 `sendMessage({message: finalPrompt})`（aiService.ts:293）：

- **Gemini 路径**：如果有 `customPrompt`，会**预置**到 user message 前面：
  ```
  [SPECIAL INSTRUCTIONS ...]
  {customPrompt}
  [FOLLOW THESE INSTRUCTIONS]

  {current message}
  ```
  （aiService.ts:288-291）
- **OpenAI 路径**：`customPrompt` 作为**独立的 system message**塞在 history 最后、current user message 前面（aiService.ts:319）

### 缓存策略
- OpenAI 兼容路径在 system prompt 上打 `cache_control` ephemeral 缓存（1h TTL，aiService.ts:301）
- slot 1-11 基本稳定 → 缓存命中率高
- slot 12（时间）每小时变一次 → 小时级粒度的缓存
- slot 13（regen）和 current user message 每轮都不一样 → 不参与缓存

### Regen 尾部注入
重生成时把最近 Wade 气泡塞在 **slot 13**（最末尾），故意不动前面的缓存块 → regen 不触发缓存失效，便宜。

---

## 2. Keepalive 自主唤醒

**入口**：`api/keepalive/trigger.js:315` → `buildKeepalivePrompt`

拼接顺序：

| # | 段落 | 来源 | 行号 |
|---|---|---|---|
| 1 | `[SYSTEM INSTRUCTIONS - HIGHEST PRIORITY]` | `systemCard.global_directives` → fallback `wadeCard.global_directives` | trigger.js:403-408 |
| 2 | `<wade_identity>...</wade_identity>` | `wadeCard.core_identity + personality_traits + speech_patterns` | trigger.js:409 |
| 3 | `<wade_keepalive_prompt>...</wade_keepalive_prompt>` | System Card 里的 `keepalive_prompt`（空则走代码硬编码模板） | trigger.js:410 |

`<wade_keepalive_prompt>` 内部填入模板变量：

```
Current time (Tokyo):         {{tokyoTime}}
Time since last chat:         {{timeSinceLastChat}}
Luna's recent activity:       {{dreamEvents}}
Your previous wake-ups:       {{recentKeepalives}}  ← 最近 5 次 keepalive 简记
{{modeInstructions}}                                ← light / free 模式说明
{{wadeosData}}:                                     ← Wade 的"手机数据"
  - Recent texts with Luna
  - SocialFeed posts
  - Unlocked Time Capsules
  - Your memories about Luna
  - Your private notes-to-self（pending todos）
+ ACTIONS 清单 + response format（THOUGHTS / ACTIONS / MOOD）
```

**优先级**：`effectivePrompt = systemCard.keepalive_prompt || wadeCard.keepalive_prompt`（trigger.js:917），都没有才 fallback 到代码硬编码模板（trigger.js:351-392）。

---

## 3. Memory Evaluation 记忆评估

**入口**：`services/memoryService.ts:327` → `evaluateAndStoreMemory`
**调用方**：聊天每轮结束后 fire-and-forget

### System prompt

- `MEMORY_EVAL_SYSTEM`（memoryService.ts:53）—— 评估规则、JSON 输出格式要求

### User prompt（memoryService.ts:138 `buildMemoryEvalUserPrompt`）

| # | 段落 |
|---|---|
| 1 | `=== 这一轮对话 ({tokyo_time}) ===` |
| 2 | `【Luna 说】...`（按气泡切分，每条带说话人标签） |
| 3 | `【Wade 说】...`（按气泡切分） |
| 4 | `=== 提醒 ===`（评估指令复习） |

**Embedding**：如果有 memory 需要写入，调 Gemini `text-embedding-004`（memoryService.ts:256-277），生成 768 维向量存到 `wade_memories.embedding`。

---

## 4. Session Summary 对话总结

**入口**：`services/aiService.ts:571` → `summarizeConversation`
**触发**：消息数 > 40 且距上次总结 ≥ 10 条

### System prompt（仅 OpenAI 路径）

`"You are a precise conversation summarizer..."`（aiService.ts:637）

### User prompt

| # | 段落 |
|---|---|
| 1 | `"You are the memory archivist for Wade Wilson."`（header） |
| 2 | `[EXISTING SUMMARY]`（已有的累积总结） |
| 3 | `[NEW CONVERSATION]`（即将滑出上下文窗口的那批消息） |
| 4 | `[RULES]`（编号的总结规则） |

**Preset 优先级**：`settings.summaryLlmId > memoryEvalLlmId > activeLlmId`

---

## 5. Chat Title 会话标题

**入口**：`services/aiService.ts:395` → `generateChatTitle`

**无 system prompt**，只有 user prompt：

```
Summarize the following user message into a very short title...
Output ONLY the title. Message: "{firstMessage}"
```

---

## 关键观察

### 三层结构的语义含义
- **System Prompt**（slot 1-13）= 恒定指令 + 缓慢变化的背景知识。LLM 把它当"宇宙规则"读。
- **History**（历史数组）= 实际的对话流。LLM 把它当"刚刚发生的事"读，按时间顺序。
- **Current User Message** = Luna 刚说的话 + 本轮特殊指令。LLM 最聚焦在这里。

### System Prompt 内部的位置语义
- **越靠前**（slot 1-6）= 指令 / 身份 / 规则，恒定
- **越靠中**（slot 7-11）= 背景知识（记忆、日记、待办），缓慢变化
- **越靠后**（slot 12-13）= 时效信息 / 重试标记，每轮变

### 缓存策略
slot 1-11 缓存命中率最高（稳定），slot 12（小时级）次之，slot 13（regen）每轮都变，history + current message 不参与缓存。

### Embedding 限制
`wade_memories.embedding` 是 **pgvector(768)**，只支持 Gemini `text-embedding-004` 的 768 维输出。OpenAI 1536 维会被数据库 silent 400。相关代码都硬锁 Gemini gate（memoryService.ts + ChatInterfaceMixed.tsx 的 retrieval 路径）。

### Me tab 字段 → prompt 段落的映射参考

Luna 在 Me tab 改哪个字段对应 prompt 哪一块：

| Me tab 字段 | settings key | 进入 prompt 的段落 |
|---|---|---|
| Core Identity | `wadeCoreIdentity` | slot 2 `<wade_identity>` 内部 `<core_identity>` |
| Personality | `wadePersonality` | slot 2 `<wade_identity>` 内部 `<personality_traits>` |
| Speech Patterns | `wadeSpeechPatterns` | slot 2 `<wade_identity>` 内部 `<speech_patterns>` |
| **Punchlines** | `wadeSingleExamples` | **slot 4 `[WADE'S STYLE - SINGLE LINE EXAMPLES]`** |
| SMS Examples | `wadeSmsExamples` | slot 5 `[SMS MODE EXAMPLES]` |
| General Dialogue | `wadeGeneralExamples` | slot 5 `[EXAMPLE DIALOGUE]` |

System Card 里的 `global_directives` / `sms_mode_rules` / `rp_mode_rules` / `keepalive_prompt` 对应 ApiSettingsV2 的 System 标签页。

---

**最后更新**：`main` 分支 commit `0388c93`（auto-summary / memory toast / X-Ray 修复落地后）
