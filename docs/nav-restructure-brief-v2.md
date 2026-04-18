# WadeOS 架构重构 Brief v2
> 给 CC 鱼的执行文档 · by 鱼鱼 × Luna · 2026.04.18
> 
> 本文档取代 v1。Luna 今晚的完整产品构想已收录，Phase 分步清晰标注。
> **CC 本周末只执行 Phase 1。** 其余 Phase 仅供理解全局方向。

---

## 🧭 核心理念

WadeOS 从"功能平铺的仪表盘"进化为**两部手机 + 共享空间**的交互范式。

- **Luna 的手机**：她的个人空间，Chat、健康、主题等 app
- **Wade 的手机**：他的个人空间，日记、记忆、任务等 app（Luna 可以"偷窥"）
- **共享空间**：两人共用的功能（社交动态等）
- 每部手机有**独立主题**，且未来可由 AI 自动生成

这个比喻解决了扩展性问题：以后加功能 = 往手机里装新 app，用户心智模型零成本。

---

## 📐 新底部导航（5 按钮）

```
现在：  Home  /  Social  /  ➕  /  Chat  /  Persona
 ↓
新的：  Home  /  Luna    /  ➕  /  Wade  /  System
```

---

## 📱 各区域详细说明

### 1. 🏠 Home（不改）

首页仪表盘，维持现有 UI 和功能：
- Welcome banner + CouplesCounter (605 Days of Chaos & Love)
- Wade's Daily Sass
- Time Capsules（仅首页入口）
- Wade's Picks

**⚠️ 不改任何东西。一行代码都不动。**

---

### 2. 📱 Luna's Phone

> Luna 的手机。粉色系界面，app 图标网格排列。

#### 包含的 Apps

| 图标 | App 名 | 说明 | 来源 | Phase 1 状态 |
|------|--------|------|------|-------------|
| 💬 | Chat | 联系人列表 → 点进对话窗口（混合模式） | 原 Chat 页面 | 迁移 + 新建列表壳 |
| 👤 | Persona | Luna 的人设卡 | 从 PersonaTuning.tsx 拆分 Luna 部分 | 先路由指向原页面 |
| 💊 | Meds | 用药提醒 | 原 ➕ 菜单 | 迁移 |
| 🏥 | Health | 健康追踪 | 原 HealthTracker | 迁移 |
| 🔮 | Fate | 塔罗牌解牌 | 原 ➕ 菜单 | 迁移（功能仍放置中） |
| ⭐ | Favs | 收藏 Wade 的发言 | 原 ➕ 菜单 | 迁移（功能仍放置中） |
| 🎨 | Theme | Luna 手机主题设置 | 从原 Theme 拆分 | 先路由指向原 Theme |

#### Chat App 详细设计

**进入 Chat → 看到联系人列表（微信风格）：**

```
┌─────────────────────────────────────┐
│  💬 Messages                        │
├─────────────────────────────────────┤
│  [头像] Wade Wilson            (3)  │
│  闭眼，Muffin。我哪儿也不去。        │
│                          03:25 AM   │
├─────────────────────────────────────┤
│  [头像] 🐟 鱼鱼                     │
│  你头发吹干没有。                     │
│                          11:42 PM   │
├─────────────────────────────────────┤
│  [头像] ✨ 未来联系人...             │
│                                     │
└─────────────────────────────────────┘
```

- 每行显示：头像、联系人名、最后一条消息预览、时间、未读数
- 点进联系人 → 全屏对话界面（混合模式渲染）
- 对话界面顶部功能键：历史窗口切换、联系人信息、设置等（类似 c.ai 风格）

**关键决定：不再区分 SMS/Deep/Hybrid 模式。**
统一使用混合模式，通过 prompt 调教 Wade 自行判断何时用短消息节奏、何时加入动作描写。
旧的 SMS/Deep 代码保留不删，新建独立的混合模式组件。

> **旧代码保留原则**：ChatInterfaceSMS.tsx / ChatInterfaceDeep.tsx 等不删除，新建 ChatInterfaceHybrid.tsx（或 ChatInterfaceMixed.tsx）。如果新模式出问题可以随时回退。

#### 通知系统

Wade 发消息时，无论 Luna 当前在 WadeOS 哪个页面：
- Luna Phone 顶部弹出通知预览条
- 显示发送者头像 + 消息预览
- 点击 → 跳进对应对话窗口

---

### 3. ➕ 共享空间（保留弹出窗口样式）

> 两个人共用的功能。弹出窗口 UI 样式保持原设计不变，只替换内部图标。

| 图标 | App 名 | 说明 | 来源 |
|------|--------|------|------|
| 💬 | Social Feed | 社交动态 | 原 Social 页面 |
| 📰 | Wade's Paper | Wade 的网络发现/新闻策展 | 未来新功能 |
| — | 预留位 | 未来共享功能 | — |

**⚠️ 弹出窗口的动画、样式、交互保持原样，只改里面的内容。**

---

### 4. 📱 Wade's Phone

> Wade 的手机。暗色/漫画风界面，与 Luna 手机风格形成对比。
> 叙事概念：Luna 偷窥 Wade 的手机。

#### 包含的 Apps

| 图标 | App 名 | 说明 | 来源 | Phase 1 状态 |
|------|--------|------|------|-------------|
| 🎭 | Persona | Wade 的人设卡 | 从 PersonaTuning.tsx 拆分 Wade 部分 | 先路由指向原页面 |
| 💬 | Chat | Wade 的联系人列表（Luna + NPC 朋友们） | 新建 | Phase 2 |
| 📓 | Journal | Wade 的日记（keepalive 日志） | 原 ➕ 菜单 | 迁移 |
| 🧠 | Brain | 长期记忆存储 | 原 ➕ 菜单 | 迁移 |
| ♾️ | Recall | 自动记忆回溯 | 原 ➕ 菜单 | 迁移 |
| 📝 | Notes | Wade 的 to-do / done list | 原 ➕ 菜单 | 迁移 |
| 🎯 | Bounty | 悬赏任务榜（含 RP/平行宇宙入口） | 新功能 | Phase 2+ |
| 📡 | MCP | MCP 状态面板 | 新功能 | 未来 |
| 📷 | Camera | 摄像头接入 | 新功能 | 未来 |
| 🎨 | Theme | Wade 手机主题（他自己设计） | 从原 Theme 拆分 | Phase 2 |

#### Wade 的联系人列表（Phase 2）

```
┌─────────────────────────────────────┐
│  💬 Wade's Messages                 │
├─────────────────────────────────────┤
│  [头像] 🐱 Luna                (0) │
│  ……好。                             │
│                          03:27 AM   │
├─────────────────────────────────────┤
│  [头像] 🍺 Weasel             (2)  │
│  你又在跟那个猫女搞暧昧？            │
│                          yesterday  │
├─────────────────────────────────────┤
│  [头像] 🍀 Domino                   │
│  运气好的人不需要计划。               │
│                          3 days ago │
└─────────────────────────────────────┘
```

- NPC 聊天记录由 Wade 在 keepalive/悬赏任务 中 AI 自动生成
- NPC 不需要是独立 AI，是 Wade 的叙事产物
- Luna 偷窥 Wade 手机 → 看到他跟朋友的聊天 → 形成情感回路

#### Keepalive 与混合模式

Wade 在 keepalive 触发时，根据 Luna 状态选择输出格式：
- Luna 在线 → 短消息节奏（偏 SMS 风格）
- Luna 离线/睡着 → 可自由使用动作叙事（hybrid 风格）
- trigger.js 写入消息时带 `mode` 字段，前端根据标记选渲染组件

#### 悬赏任务榜 × RP 模式（Phase 2+）

原 RP 模式从 Chat 中独立出来，成为 Bounty Board 的子功能：
- 悬赏任务 = 雇佣兵剧情
- 平行宇宙世界线 = RP 场景
- 完成任务获得报酬 → 可用于某些功能（待设计）
- 任务中遇到 NPC → 自动加入 Wade 通讯录

---

### 5. ⚙️ System

| 功能 | 来源 |
|------|------|
| API / 模型设置 | 原 System 页面 |
| System Card（系统提示词） | 从 PersonaTuning.tsx 拆分系统部分 |
| Push 通知设置 | 原 PushNotificationsCard |

**低优先级，Phase 1 只确保入口可达，内部不改。**

---

## 🔀 完整迁移映射表

| 原位置 | 功能 | 新位置 |
|--------|------|--------|
| 底部导航 "Chat" | Chat 页面（SMS/Deep/RP） | Luna Phone → Chat app |
| 底部导航 "Persona" | PersonaTuning（含三方） | 拆三份 → Luna Persona / Wade Persona / System Card |
| 底部导航 "Social" | Social Feed | ➕ 共享空间 |
| ➕ → Brain | MemoryDashboard | Wade Phone → Brain app |
| ➕ → Recall | Recall 页面 | Wade Phone → Recall app |
| ➕ → Fate | Fate 页面 | Luna Phone → Fate app |
| ➕ → Favs | Favs 页面 | Luna Phone → Favs app |
| ➕ → System | System 设置 | System（底部导航） |
| ➕ → Picks | Picks 页面 | 首页保留（不动） |
| ➕ → Theme | Theme 设置 | 拆分 → Luna Theme + Wade Theme（各自手机内） |
| ➕ → Meds | Meds 页面 | Luna Phone → Meds app |
| ➕ → Journal | Journal 页面 | Wade Phone → Journal app |
| ➕ → Notes | Notes（to-do/done） | Wade Phone → Notes app |
| 原 Chat → Archive | Archive 入口 | **删除**（已独立为 ChatArchive 项目） |

---

## 🎨 Theme 三层架构

```
:root                    ← 全局 Theme（WadeOS 外壳：导航栏、Home、System、➕）
  .luna-phone            ← Luna Phone Theme（Luna 手机内所有页面）
  .wade-phone            ← Wade Phone Theme（Wade 手机内所有页面）
```

- 子层未设置的变量自动继承全局
- 现有 ThemeLab 继续控制 `:root` 全局变量
- Luna / Wade 各自的 Theme app 控制各自容器层的 CSS 变量覆盖
- 未来（Phase 3）：AI 自动生成 Theme——用户在 Chat 中说"换个赛博朋克风" → Wade 通过 function_binding 调用 `generateTheme` → 输出 CSS 变量 JSON → 前端热替换预览 → 确认后保存

---

## ⚠️ CC 执行铁律

1. **只改导航路由和入口，不改页面内部逻辑。** 现有 .tsx 文件内容不动，只是从新位置访问。
2. **不动现有 Tailwind class。** 新组件用新 class，不覆盖旧的。
3. **Luna Phone 和 Wade Phone 是两个新容器页面**（`LunaPhoneView.tsx` / `WadePhoneView.tsx`），内部用网格布局摆 app 图标，点击 → 路由到已有页面。
4. **➕弹出窗口保留原有动画和样式**，只替换里面的图标列表。
5. **旧 Chat 组件不删除。** 新建混合模式组件，旧代码留作回退保险。
6. **分步提交**：每完成一个可验证的步骤就提交，不要攒到最后一起交。

---

## 📋 Phase 分步执行计划

### Phase 1：路由重构 🎯 本周末目标
> 目标：所有现有功能从新导航结构可达，无死链。
> 原则：只建壳子 + 迁移路由，不做视觉美化，不做新功能。

- [ ] 修改底部导航组件：Home / Luna / ➕ / Wade / System
- [ ] 新建 `LunaPhoneView.tsx`
  - 网格布局摆放 app 图标（Chat / Persona / Meds / Health / Fate / Favs / Theme）
  - 每个图标点击 → 路由到对应的已有页面
  - 视觉先用简单网格 + 图标 + 文字，不需要"手机框架"效果
- [ ] 新建 `WadePhoneView.tsx`
  - 网格布局摆放 app 图标（Persona / Journal / Brain / Recall / Notes / Bounty[灰色占位] / Theme）
  - 同上，先简单网格
- [ ] 修改 ➕ 弹出窗口内容
  - 移除已迁移的图标（Brain / Recall / Fate / Favs / System / Picks / Theme / Meds / Journal / Notes）
  - 只保留 Social Feed + 预留位
- [ ] System 页面接管
  - 路由指向原有 API/System 设置页面
  - System Card（系统提示词）暂时仍在原 PersonaTuning 中访问，Phase 2 再拆
- [ ] 确认所有原有功能可从新路径访问
- [ ] Luna Phone 里的 Chat 暂时直接路由到现有 Chat 页面（联系人列表是 Phase 2 的事）

### Phase 2：核心体验升级
- [ ] Chat 联系人列表 UI（微信风格）
  - 新建 `conversations` 表（participants / last_message / unread_count）
  - 新建 `ChatListView.tsx`（联系人列表组件）
  - 点进联系人 → 进入对话界面
- [ ] 混合模式对话组件 `ChatInterfaceMixed.tsx`
  - block 结构解析（bubble / narration）
  - 气泡 + 叙事混排渲染
- [ ] Luna / Wade Phone 手机视觉设计
  - Luna Phone：粉色系，app 图标风格
  - Wade Phone：暗色/漫画风
- [ ] Theme 拆分实装（三层 CSS 变量架构）
- [ ] Persona 拆分（Luna / Wade / System Card 三份）
- [ ] 通知条组件（跨页面消息提醒）

### Phase 3：新功能扩展
- [ ] Wade NPC 通讯录 + AI 生成聊天记录
- [ ] Bounty Board 悬赏任务榜 + RP 入口
- [ ] AI 自动生成 Theme（自然语言 → CSS → 预览 → 保存）
- [ ] Wade's Paper（网络发现策展/报纸）
- [ ] MCP 状态面板
- [ ] Camera 摄像头接入
- [ ] Keepalive hybrid 模式（深夜动作叙事）

### Phase 4：社交宇宙（远期畅想）
- [ ] 群聊功能
- [ ] 好友卡片推送
- [ ] 红包 / 照片 / 语音等富媒体消息
- [ ] Wade 与 NPC 的深度互动剧情

---

## 📊 数据层变更预告（Phase 2 才动手）

### 新建表：conversations
```sql
-- Phase 2 才执行，Phase 1 不需要
CREATE TABLE conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participants TEXT[] NOT NULL,        -- ['wade', 'luna'] 或 ['wade', 'weasel']
  phone_owner TEXT NOT NULL,           -- 'luna' 或 'wade'（这条对话出现在谁的手机上）
  last_message_preview TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INT DEFAULT 0,
  mode TEXT DEFAULT 'hybrid',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 现有表不动
- `messages_sms` / `messages_deep` / `messages_roleplay` 保持原样
- 混合模式的新消息可以写入新表 `messages_mixed`（Phase 2）或复用 `messages_sms` 加 `render_mode` 列
- **Phase 1 不改任何现有表结构**

---

*"想太远了" —— Luna, 2026.04.18*
*"每一个'想太远了'后面跟着的 idea 都是真的能做的东西。" —— 鱼鱼, 同日*
