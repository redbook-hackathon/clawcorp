# Roadmap: ClawCorp 产品重构

## Overview

本 roadmap 实现产品全面重构：
- **界面简化**：ChatGPT 网页版侧边栏布局，中文化，删除冗余
- **任务看板重构**：统一看板 + 日程视图，按 Agent 分组，团队前缀区分
- **团队系统升级**：团队总览卡片 + 团队地图动态路由 + 拖拽创建
- **员工广场**：Agent 展示/创建/培养/管理入口
- **频道与会话重构**：同步工作台 + 精细化会话管理
- **设置中心收敛**：只保留 9 项真正有价值的设置

执行顺序：Phase 1-9 推进，重构过程中已完成的飞书/微信同步工作台（Phase 10-11）保留，放后续执行。

## Phases

**Phase Numbering:**
- Integer phases (1-9): 本次重构核心工作
- Decimal phases (11.1, 11.2): 后续插入项

- [x] **Phase 1: Sidebar Restructure** - ChatGPT 网页版侧边栏布局，3 固定 + 2 折叠，ChatGPT 风格
- [ ] **Phase 2: Task Board Redesign** - 看板 4 列 + 日程视图双切换，Agent 分组，团队前缀，对话创建
- [x] **Phase 3: Team Overview Rebuild** - 团队卡片列表，拖拽创建团队，多团队支持
- [ ] **Phase 4: Team Map Evolution** - 动态路由，Memory/Skills 管理与同步，成员管理，私聊
- [ ] **Phase 5: Employee Square** - Agent 卡片展示，创建，私聊，Memory 管理，会话管理
- [ ] **Phase 6: Channel Redesign** - 频道同步工作台，机器人一对一绑定，显式指定负责人
- [ ] **Phase 7: Session Redesign** - 会话列表重构，搜索/置顶/分组/导出，团队/个人身份区分
- [ ] **Phase 8: Settings Convergence** - 设置中心 9 项，移入移出，记忆知识库，迁移备份
- [ ] **Phase 9: Deletions & Global Cleanup** - /activity 删除，ClawX→ClawCorp 替换，冗余项清理
- [ ] **Phase 10: Channel Feishu Sync Workbench** - 飞书双向同步工作台（已实现，保留）
- [ ] **Phase 11: Channel WeChat Sync Workbench** - 微信双向同步工作台（已部分实现，保留）

---

## Phase Details

### Phase 1: Sidebar Restructure

**Goal:** 将左侧边栏改造为 ChatGPT 网页版布局，确立全局导航结构。
**Depends on:** Nothing
**Canonical refs:**
- `.planning/PRODUCT-RESTRUCTURE.md` §三（侧边栏结构）
- `src/components/layout/Sidebar.tsx` — 现有侧边栏实现
- `App.tsx` — 路由定义
**Success Criteria (what must be TRUE):**
  1. 侧边栏顺序固定为：任务看板 → 团队总览 → 员工广场 → 频道 → 会话
  2. 频道默认折叠，点击展开，展开时向下挤压
  3. 会话默认打开，点击折叠
  4. 任务看板、团队总览、员工广场不折叠，点击直接进入
  5. 左下角只保留文件/上传文件入口
  6. 删除左侧加号按钮
  7. 右上角点"文件"/"Agent"图标 → 右侧滑出 panel（不跳转路由）
  8. 侧边栏支持滚动条
  9. 参考 VS Code 折叠/展开逻辑
  10. 初始化为 main 模型对话，默认进入与 main 的会话

### Phase 2: Task Board Redesign

**Goal:** 重构任务看板为统一看板，支持看板和日程双视图，按 Agent 分组，区分团队任务与个人任务。
**Plans:** 4 plans

Plans:
- [x] 02-01-PLAN.md — Board structure: 4 columns, Agent swimlanes, team task styling
- [x] 02-02-PLAN.md — Calendar view: FullCalendar integration, week/month/year views
- [x] 02-03-PLAN.md — Task interactions: detail panel, click/hover, drag-and-drop
- [x] 02-04-PLAN.md — Chat integration: task creation bubbles, anchor cards, manual entry
**Depends on:** Phase 1
**Canonical refs:**
- `.planning/PRODUCT-RESTRUCTURE.md` §四（任务看板）
- `src/pages/TaskKanban/index.tsx` — 现有看板实现
**Success Criteria (what must be TRUE):**
  1. 看板视图：4 列（待办 → 进行中 → 审查 → 完成），删除积压列
  2. 日程视图：日历插件，支持周/月/年视图切换，历史事件保留
  3. 看板按 Agent 分组，每行一个 Agent 下面挂其任务
  4. 团队任务加"团队X："前缀，颜色区分
  5. 任务卡片展示：标题 + 负责人 + 状态 + 截止时间 + 优先级
  6. 点击卡片 → 右侧滑出详情 panel
  7. 支持点击操作和拖拽双操作
  8. 对话中创建任务为主要方式（Agent 识别 → 确认气泡 → 入看板）
  9. 前台新建入口弱化保留
  10. 任务标题由模型自动生成
  11. 日程视图只显示有截止日期的任务，无安排任务仅在看板视图显示

### Phase 3: Team Overview Rebuild

**Goal:** 重构团队总览为卡片列表，支持拖拽式创建团队。
**Plans:** 4 plans

Plans:
- [x] 03-01-PLAN.md — Team data structure & store (types, Zustand store, backend API)
- [x] 03-02-PLAN.md — Team card grid layout (TeamCard, TeamGrid, responsive layout)
- [x] 03-03-PLAN.md — Drag and drop infrastructure (AgentPanel, CreateTeamZone, @dnd-kit)
- [x] 03-04-PLAN.md — Team creation flow (confirmation form, auto-naming, inline editing)
**Depends on:** Phase 1
**Canonical refs:**
- `.planning/PRODUCT-RESTRUCTURE.md` §五（团队总览）
- `src/pages/TeamOverview/index.tsx` — 现有团队总览
**Success Criteria (what must be TRUE):**
  1. 团队以卡片方式展示（参考开源项目卡片式）
  2. 卡片展示：名称 + Leader 头像/名称 + 成员数量/列表 + 状态 + 活跃时间 + 执行中任务数 + 职责描述
  3. 点击卡片 → 进入团队地图（当前团队）
  4. 新建团队：拖拽式，Leader 区限 1 人，建议 2-3 成员
  5. 团队名称自动生成，用户可编辑
  6. 支持多团队（Agent 可属于多个团队）
  7. 创建后自动更新成员关系、Memory、Soul、Identity、引用关系

### Phase 4: Team Map Evolution
**Plans:** 4 plans

Plans:
- [x] 04-01-PLAN.md 鈥?Canonical routing + team-scoped TeamMap shell and contracts
- [x] 04-02-PLAN.md 鈥?Header/add-member/remove-member member-management surfaces
- [x] 04-03-PLAN.md 鈥?Shared memory/skills data adapters + writable agent skill routes
- [ ] 04-04-PLAN.md 鈥?Final TeamMap wiring + private chat sessions + manual verification closeout

**Goal:** 将 TeamMap 改造为团队内部管理页面，每个团队有独立的团队地图，支持 Memory/Skills 管理与同步。
**Depends on:** Phase 3
**Canonical refs:**
- `.planning/PRODUCT-RESTRUCTURE.md` §六（团队地图）
- `src/pages/TeamMap/index.tsx` — 现有团队地图
- `.planning/PRODUCT-RESTRUCTURE.md` §十二.3（团队地图 ↔ 记忆知识库联动）
**Success Criteria (what must be TRUE):**
  1. TeamMap 变为动态路由：当前在哪个团队的地图里
  2. 查看所有团队成员信息及详情
  3. 管理员工 Skills（查看/编辑，实时同步到设置页"记忆知识库"）
  4. 增加员工（点击后出现 Agent 列表选择）
  5. 删除员工（需二次确认）
  6. 私聊：可和下属员工聊，也可和 Leader 聊
  7. 修改 Memory（实时同步到设置页"记忆知识库"，双向同步）
  8. 查看下属工作状态详情（Agent 当前任务、阻塞状态等）
  9. 展示员工待命/活跃状态

### Phase 5: Employee Square

**Goal:** 将现有 Agents 页面升级为员工广场，作为 Agent 的展示、创建、培养、管理入口。
**Depends on:** Phase 4
**Canonical refs:**
- `.planning/PRODUCT-RESTRUCTURE.md` §七（员工广场）
- `src/pages/Agents/index.tsx` — 现有 Agents 页面
- `src/pages/AgentDetail/index.tsx` — 现有 Agent 详情页
**Success Criteria (what must be TRUE):**
  1. Agent 以卡片方式展示（参考开源项目卡片式，不做成案例广场）
  2. 卡片展示：头像/名称 + 角色(Leader/员工) + 状态 + 所属团队 + 活跃时间 + 待办数 + Chat 入口
  3. 创建 Agent：名称 + 角色(Leader/员工) + 模型，Leader 可选配置团队
  4. 员工广场内可管理 Agent Memory（同步到设置页"记忆知识库"）
  5. 可查看 Agent Skills（编辑在团队地图）
  6. 和 Agent 私聊（右键或 Chat 按钮）
  7. 聊天记录沉淀到左侧会话列表
  8. 会话管理：改名/删除/重命名/设置

### Phase 6: Channel Redesign

**Goal:** 重构频道为独立的同步工作台，支持机器人一对一绑定，显式指定负责人。
**Depends on:** Phase 1
**Canonical refs:**
- `.planning/PRODUCT-RESTRUCTURE.md` §八（频道）
- `.planning/PRODUCT-RESTRUCTURE.md` §十二.6（外部接入绑定规则）
- `src/pages/Channels/index.tsx` — 现有频道页面
**Plans:** 3/5 plans executed

Plans:
- [x] 06-01-PLAN.md — Channel type extension + Bot rail refactor
- [x] 06-02-PLAN.md — BotBindingModal + simplified config pages (DingTalk/WeCom/QQ)
- [x] 06-03-PLAN.md — End-to-end integration + Phase 10/11 compatibility verification
- [ ] 06-04-PLAN.md — Reference feature backfill: account groups, scoped config modal, binding/default-account routes
- [ ] 06-05-PLAN.md — Reference utility backfill: channel targets, generic QR/login plumbing, current-shape integration
**Success Criteria (what must be TRUE):**
  1. 频道为独立的同步工作台（session list + message panel + composer）
  2. 消息不进入主会话列表
  3. 接入状态管理（在线/离线）
  4. 支持飞书/钉钉/企微/QQ/微信机器人接入
  5. 仅接机器人，不接群聊
  6. 每个 bot 对应一个 Agent/团队（一对一绑定）
  7. 配置频道时必须显式指定负责人，不允许默认绑定
  8. 频道默认折叠，点击展开
  9. 在保持当前“Chat-first 工作台”形态的前提下，吸收 reference 仓库中的多账号配置、默认账号切换、目标选择与 QR/登录通用能力

### Phase 7: Session Redesign

**Goal:** 重构会话列表，支持搜索/置顶/分组/导出，区分团队身份与个人身份。
**Plans:** 3 plans

Plans:
- [x] 07-01-PLAN.md — Data model extension + collapsible groups UI
- [x] 07-02-PLAN.md — Search functionality + session item redesign
- [x] 07-03-PLAN.md — Unread count & Agent status integration
### Phase 8: Settings Convergence

**Goal:** 重构设置中心，收敛为 9 项真正有价值的设置，整合记忆知识库和费用用量。
**Depends on:** Phase 5
**Canonical refs:**
- `.planning/PRODUCT-RESTRUCTURE.md` §十（设置中心）
- `.planning/PRODUCT-RESTRUCTURE.md` §十二.3（记忆知识库双向同步）
- `src/pages/Settings/index.tsx` — 现有设置页面
**Success Criteria (what must be TRUE):**
  1. 无分组，平铺顺序排列 9 项
  2. 费用与用量（第 1 位）：实时用量 + 大盘监控 + 用量分析 + 告警策略，真实数据，删除模拟数据组件
  3. 模型与提供能力：全局默认模型 + fallback 模型 + AI 模型提供商 + Gateway，删占位自定义模型
  4. 常规设置：账号安全(占位) + 外观行为(主题/自启/托盘) + 品牌身份 + 通知开关(默认开) + 语言(默认中文)
  5. Skills 与 MCP：内置模板 + 预设 MCP 服务器配置，/skills 路由收敛
  6. 工具权限：全局开关，界面保持现状，按现有分类组织
  7. 记忆知识库（第 6 位）：概览 + 文件浏览(workspace文件) + Memory编辑器，与团队地图双向同步
  8. 迁移与备份：保留并实现
  9. 应用更新：版本/检查更新/更新日志
  10. 关于：反馈入口 + 产品介绍 + 团队介绍 + 开源说明 + 二维码 + 备案号

### Phase 9: Deletions & Global Cleanup

**Goal:** 删除废弃路由和页面，全局替换品牌名，清理冗余配置。
**Depends on:** Phase 8
**Canonical refs:**
- `.planning/PRODUCT-RESTRUCTURE.md` §十一（其他调整）
- `src/pages/Activity/index.tsx` — /activity 路由
- `src/components/settings-center/settings-monitoring-panel.tsx` — 模拟数据组件
**Success Criteria (what must be TRUE):**
  1. /activity 路由删除
  2. 代码中所有 "ClawX" 替换为 "ClawCorp"
  3. 删除 settings-monitoring-panel.tsx（模拟数据）
  4. 删除 Bandwidth Assessment
  5. 删除知识库额外来源 Tab
  6. 删除实验室/实验页面
  7. 删除 Brand assets
  8. 删除 @提及能力
  9. 全局界面中文化（Pages 名称/概览文案/费用文案等）
  10. 验证所有删除项不影响现有功能

### Phase 10: Channel Feishu Sync Workbench

**Goal:** 飞书双向同步工作台（已完成，保留）。
**Depends on:** Phase 6
**Canonical refs:**
- `.planning/phases/10-channel-feishu-sync-workbench/10-CONTEXT.md` — 锁定决策（执行产物沿用原 09-xx 编号）
- `src/pages/Channels/index.tsx` — 现有频道页面
**Success Criteria (what must be TRUE):**
  1. 频道页面显示所有飞书会话（群聊 + 私聊），支持完整消息历史
  2. 消息角色着色：自己(右对齐蓝)、bot(左对齐品牌色)、他人(左对齐灰)
  3. 用户可通过 per-session 切换以 bot 或自己身份发送
  4. 滚动至顶部触发分页历史加载（向上无限滚动）
  5. 图片内联显示，点击打开 lightbox；文件显示信息卡片 + 下载按钮
  6. 搜索按标题优先过滤，再过滤消息内容
  7. 被 bot 移除的会话标记为 invalid 但保留；token 过期降级为 bot-only 模式
  8. 布局自适应：宽屏 3 列，窄屏 2 列（合并 rail + 会话列表）
**Plans:** 2/4 plans executed

Plans:
- [x] 09-01: Message display layer
- [x] 09-02: Composer upgrade
- [ ] 09-03: Session list upgrade
- [ ] 09-04: Backend sync endpoints

### Phase 11: Channel WeChat Sync Workbench

**Goal:** 微信双向同步工作台，镜像 Phase 10。
**Depends on:** Phase 10
**Canonical refs:**
- `.planning/phases/11-channel-wechat-sync-workbench/11-CONTEXT.md` — 锁定决策（执行产物沿用原 10-xx 编号）
- `src/types/channel.ts` — ChannelType union
- `electron/utils/whatsapp-login.ts` — QR login EventEmitter pattern
**Success Criteria (what must be TRUE):**
  1. `wechat` 出现在 domestic channels 列表（飞书/钉钉/企微/QQ/微信）
  2. Onboarding wizard: install plugin → scan QR (30s refresh) → ready
  3. 工作台显示群聊/私聊会话，分页消息历史
  4. 消息角色着色：自己(右对齐蓝)、bot(左对齐品牌色)、他人(左对齐灰)
  5. 图片内联 + lightbox，文件信息卡片，语音播放按钮 + 时长
  6. Composer 有 bot/self 身份切换；用户认证不可用时降级为 bot-only + 警告
  7. Media proxy 验证域名：`*.qpic.cn`, `*.weixin.qq.com`, `*.wx.qq.com`
  8. 单账号（`accountId: 'default'`）
**Plans:** 1/3 plans executed

Plans:
- [x] 10-01: Channel type registration + onboarding wizard (WeChatOnboardingWizard)
- [ ] 10-02: WeChat workbench UI — session list, message panel, composer with identity toggle
- [ ] 10-03: Backend sync endpoints — QR login, paginated messages, media proxy, member list, identity-aware send

---

## Progress

**Execution Order:**
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8 → Phase 9 → Phase 10 → Phase 11

**Parallel execution:**
- Phase 2, 3, 6, 7 可并行（各自独立，不冲突）
- Phase 4 depends on Phase 3
- Phase 5 depends on Phase 4
- Phase 8 depends on Phase 5
- Phase 9 depends on Phase 8
- Phase 10 depends on Phase 6
- Phase 11 depends on Phase 10

| Phase | Plans | Status |
|-------|-------|--------|
| 1. Sidebar Restructure | 3/3 | Complete |
| 2. Task Board Redesign | TBD | Not started |
| 3. Team Overview Rebuild | 4/4 | Complete |
| 4. Team Map Evolution | 3/4 | In progress |
| 5. Employee Square | TBD | Not started |
| 6. Channel Redesign | TBD | Not started |
| 7. Session Redesign | 3 plans | Not started |
| 8. Settings Convergence | TBD | Not started |
| 9. Deletions & Global Cleanup | TBD | Not started |
| 10. Channel Feishu Sync Workbench | 2/4 | In progress |
| 11. Channel WeChat Sync Workbench | 1/3 | In progress |
