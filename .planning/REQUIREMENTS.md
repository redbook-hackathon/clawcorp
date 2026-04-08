# Requirements: ClawCorp Product Restructure

**Defined:** 2026-03-31
**Core Value:** 前台更简、中台更清、团队更强、Agent 更可培养、任务更可看、接入更明确、设置更聚焦。

## Current Scope

本 requirements 文件只跟踪 2026-03-31 确认的产品重构主线。

旧的 Team Control Plane Evolution 需求和执行历史已归档到 `.planning/milestones/legacy-team-control-plane-evolution-phases/`，不再作为当前 milestone 的活跃 requirements 来源。

## v1 Requirements

### Navigation & Entry

- [ ] **NAV-01**: 左侧导航固定为 任务看板 → 团队总览 → 员工广场 → 频道 → 会话，且频道默认折叠、会话默认展开
- [ ] **NAV-02**: 文件与 Agent 的主入口通过右侧滑出 panel 承载，而不是新增路由跳转
- [ ] **NAV-03**: 应用启动默认进入 main Agent 会话，不再落回旧引导或空白入口

### Task Board

- [x] **TASK-01**: 任务中心统一为看板 + 日程双视图，共享同一份任务数据
- [x] **TASK-02**: 看板按 Agent 分组，并清楚区分团队任务和个人任务
- [x] **TASK-03**: 对话中创建任务是主路径，前台手工新建入口只做补充

### Team Structure

- [x] **TEAM-01**: 团队总览改为卡片列表，支持拖拽式创建团队
- [x] **TEAM-02**: Team Map 成为团队内部管理页，支持动态路由、成员状态、Memory/Skills 管理与同步
- [ ] **TEAM-03**: 系统支持多团队关系，同一 Agent 可属于多个团队

### Agent Management

- [ ] **AGENT-01**: Agents 页面升级为员工广场，承担展示、创建、培养、管理入口
- [ ] **AGENT-02**: 用户可以在员工广场中直接发起私聊，并将记录沉淀回统一会话体系
- [ ] **AGENT-03**: Agent 的 Memory 管理与设置中心中的记忆知识库保持同步

### Channel & Session

- [x] **CHANNEL-01**: 频道页重构为独立同步工作台，外部消息不混入主会话列表
- [x] **CHANNEL-02**: 每个机器人接入必须显式绑定到单一 Agent 或团队，并标明负责人
- [x] **SESSION-01**: 会话中心支持搜索、置顶、分组、导出，并区分团队身份与个人身份

### Settings & Cleanup

- [ ] **SETTINGS-01**: 设置中心收敛为 9 项高价值设置，费用用量优先展示
- [ ] **SETTINGS-02**: 记忆知识库、迁移与备份能力纳入统一设置体系
- [ ] **CLEANUP-01**: 删除 `/activity` 和其他废弃入口，并完成 ClawX → ClawCorp 的全局替换

### Retained Sync Workbenches

- [ ] **SYNC-FEISHU-01**: 飞书双向同步工作台保留并继续补完，支持历史消息、身份切换、媒体代理与搜索
- [ ] **SYNC-WECHAT-01**: 微信双向同步工作台镜像飞书能力，包含扫码登录、媒体代理与身份感知发送

## Out of Scope

| Feature | Reason |
|---------|--------|
| 在本次重构中重写 OpenClaw runtime / gateway 架构 | 当前目标是产品形态重构，不是底层 agent runtime 重做 |
| 重新把旧 Team Control Plane phase 当作当前主线继续推进 | 旧执行历史只保留为归档参考，避免与新 roadmap 混线 |
| 群聊直连与多机器人共享一个频道入口 | 当前频道设计明确采用机器人一对一绑定 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAV-01 | Phase 1 | Pending |
| NAV-02 | Phase 1 | Pending |
| NAV-03 | Phase 1 | Pending |
| TASK-01 | Phase 2 | Complete |
| TASK-02 | Phase 2 | Complete |
| TASK-03 | Phase 2 | Complete |
| TEAM-01 | Phase 3 | Complete |
| TEAM-02 | Phase 4 | Complete |
| TEAM-03 | Phase 3 | Pending |
| AGENT-01 | Phase 5 | Pending |
| AGENT-02 | Phase 5 | Pending |
| AGENT-03 | Phase 5 / Phase 8 | Pending |
| CHANNEL-01 | Phase 6 | Complete |
| CHANNEL-02 | Phase 6 | Complete |
| SESSION-01 | Phase 7 | Complete |
| SETTINGS-01 | Phase 8 | Pending |
| SETTINGS-02 | Phase 8 | Pending |
| CLEANUP-01 | Phase 9 | Pending |
| SYNC-FEISHU-01 | Phase 10 | In progress |
| SYNC-WECHAT-01 | Phase 11 | In progress |

**Coverage:**
- Active restructure requirements: 20
- Covered by roadmap phases: 20
- Legacy team-control-plane requirements: archived with legacy phase history
