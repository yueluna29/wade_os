# LLM Prompt Layout — WadeOS

每个调用 LLM 的模块发送 prompt 时，数据块的**拼接顺序**。数据块在 prompt 里的位置会影响 LLM 的注意力分配（越靠前的越像"系统级指令"，越靠后的越像"刚发生的事"），所以改动前对照这份文档检查语义。

文件 / 行号截止 `main` 分支最新提交，改了代码记得同步这份 doc。

---

## 1. Chat / SMS 聊天（Luna ↔ Wade 主对话）

**入口**：`services/aiService.ts:214` → `generateFromCard`
**调用方**：`components/views/ChatInterfaceMixed.tsx` 的 `triggerAIResponse`

拼接顺序（top → bottom）：

| # | 段落 | 来源 | 行号 |
|---|---|---|---|
| 1 | `[SYSTEM INSTRUCTIONS - HIGHEST PRIORITY]` | `systemCard.global_directives` 或 `wadeCard.global_directives` | aiService.ts:72, 90 |
| 2 | `<wade_identity>...</wade_identity>` | Wade 人设卡全字段 XML | aiService.ts:94-97 |
| 3 | `<luna_identity>...</luna_identity>` | Luna 人设卡全字段 XML | aiService.ts:100-103 |
| 4 | `[WADE'S STYLE - SINGLE LINE EXAMPLES]` | `wadeCard.example_punchlines` | aiService.ts:107 |
| 5 | `[SMS MODE EXAMPLES]` / `[EXAMPLE DIALOGUE]` | `wadeCard.example_dialogue_sms` 或 `example_dialogue_general` | aiService.ts:109-113 |
| 6 | SMS / RP Mode Rules | `systemCard.sms_mode_rules` / `systemCard.rp_mode_rules` | aiService.ts:116-125 |
| 7 | `[LONG TERM MEMORY BANK ...]` | 已启用的 Core Memories | aiService.ts:128-133 |
| 8 | `[PREVIOUS CONVERSATION SUMMARY]` | `sessionSummary`（来自 auto-summary） | aiService.ts:136-138 |
| 9 | `<wade_memories>...</wade_memories>` | 向量检索的相关长期记忆 | aiService.ts:141-143 |
| 10 | `<wade_diary>...</wade_diary>` | 最近 3 篇日记 | aiService.ts:145-148 |
| 11 | `<wade_todos>...</wade_todos>` | 待办清单（最近 20 条 pending） | aiService.ts:150-153 |
| 12 | `[CURRENT TIME]` | 东京时间，精度到小时 | aiService.ts:157-167 |
| 13 | `[SYSTEM UPDATE: Regenerate...]` | Regen 标记 + 最近 Wade 气泡（仅 `isRetry=true`） | aiService.ts:170-192 |
| 14 | `[SPECIAL INSTRUCTIONS ...]` | 会话级 `customPrompt` | aiService.ts:290 (Gemini) / 319 (OpenAI) |
| 15 | User message | 用户刚发的消息（最末尾） | aiService.ts:322 |

**缓存**：OpenAI 兼容路径在 system prompt 上打 `cache_control` ephemeral（1h TTL，aiService.ts:301）。人设 + 规则 + 记忆跨轮复用。

**Regen 尾部注入**：重生成时最近 Wade 气泡放在末尾（aiService.ts:186），故意不动前面的缓存块，regen 不触发缓存失效。

**customPrompt 两条路径**：
- Gemini：预置到 user message 前面（aiService.ts:290）
- OpenAI：独立 system message（aiService.ts:319）

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

### 位置的语义含义
- **越靠前** = 像系统指令 / 恒定事实（人设、规则）
- **越靠中** = 背景知识（记忆、日记、待办）
- **越靠后** = 时效信息 + 用户当前输入（时间、regen marker、user message）

### 缓存策略
聊天主路径利用 `cache_control` 把 slot 1-11 固化缓存，slot 12-15（时间、regen、user）每轮都变，不参与缓存。

### Embedding 限制
`wade_memories.embedding` 是 **pgvector(768)**，只支持 Gemini `text-embedding-004` 的 768 维输出。OpenAI 1536 维会被数据库 silent 400。相关代码都硬锁 Gemini gate（memoryService.ts + ChatInterfaceMixed.tsx 的 retrieval 路径）。

---

**最后更新**：`main` 分支 commit `0388c93`（auto-summary / memory toast / X-Ray 修复落地后）
