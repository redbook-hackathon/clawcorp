# KaiTianClaw Control Plane Design

Date: 2026-03-17
Status: Approved in conversation, pending final file review
Scope: UI/IA design for the current ClawCorp demo adaptation, plus session persistence mechanism under `continue/`

## 1. Goal

Adapt the current ClawCorp demo into a KaiTianClaw desktop control plane that:

- uses a light, workbench-style interface inspired by the simplicity of AutoClaw
- does not directly copy the reference layout
- stays aligned with the product requirements in `产品文档.md`
- prioritizes a single main workbench over a multi-page admin console
- implements UI presentation first, without backend logic integration
- introduces a durable session-persistence mechanism so future sessions can continue work without losing state

This design intentionally shifts the product away from a broad 12-page first impression. Instead, it uses:

- one primary workbench
- one settings center with grouped secondary pages
- a product-task tree persisted in `continue/`

## 2. Product Positioning

The product is not being designed as a heavy enterprise console. It is a personal desktop AI control plane with these characteristics:

- the main surface is a conversation-centric workbench
- multi-agent capability is visible, but not shown as a dense dashboard
- files, tasks, channels, and agents are available as work context, not hidden implementation details
- deeper system configuration is moved out of the main surface into settings subpages

The main UX principle is:

> The homepage is the workbench, not a dashboard wall.

## 3. Information Architecture

### 3.1 Top-Level Structure

The app uses two macro areas:

1. Main Workbench
2. Settings Center

This replaces the earlier 12 top-level page concept for the first UI version.

### 3.2 Main Workbench Responsibilities

The main workbench is the default landing surface and contains:

- left work-object sidebar
- center conversation/work area
- right lightweight context rail
- bottom input/composer area

It is responsible for:

- switching between work objects
- showing the current active clone/agent conversation
- exposing high-frequency contextual actions
- keeping the main interaction focused and uncluttered

### 3.3 Settings Center Responsibilities

The settings center is the home for lower-frequency, deeper configuration and governance items. It does not own daily work objects directly.

It is responsible for:

- model/provider setup
- memory and knowledge policies
- skills and MCP management
- tool permissions and safety modes
- channel advanced configuration
- monitoring, statistics, backup, migration, and developer utilities

## 4. Main Workbench Layout

### 4.1 Overall Shell

The approved shell is:

- left collapsible sidebar
- center main work area
- right collapsible context rail

The shell should remain visually light:

- soft background
- weak borders
- generous whitespace
- minimal framing
- restrained use of cards

### 4.2 Left Sidebar

The left sidebar is not a route navigation. It is a work-object container.

It contains four accordion groups:

1. 分身
2. 团队
3. IM 频道
4. 定时任务

Each group directly contains its own items when expanded.

#### 分身

The `分身` group directly contains the clone/session list, such as:

- KaiTianClaw
- 沉思小助手
- 监控
- Browser Agent
- 新分身 1

Each item shows:

- avatar
- name
- short role description
- recent time
- active styling when selected

#### 团队

The `团队` group is part of the left workbench, not part of settings.

It represents multi-agent team structures from the PRD, such as:

- 研究团队
- 值守团队
- 内容团队

Each team item shows:

- team name
- short member composition
- status or size summary

Reasoning:

- teams are daily work objects
- teams need fast switching
- teams should feel as operationally available as clones, not buried in configuration

#### IM 频道

The `IM 频道` group contains concrete communication endpoints, for example:

- 飞书项目群
- Telegram 通知
- QQ Bot

Each item can show:

- channel name
- short purpose description
- current state

#### 定时任务

The `定时任务` group contains actual scheduled work items, for example:

- 早报总结
- 监控巡检
- 周报汇总

Each item can show:

- task name
- trigger schedule
- short description or state

### 4.3 Left Sidebar Collapse Behavior

The left sidebar supports collapse into a narrow icon rail.

Expanded state:

- shows accordion groups and their contents

Collapsed state:

- shows only icon entries for clones, teams, channels, tasks, create, settings
- preserves quick switching behavior
- does not remove the workbench structure from the UI

The collapsed rail should still communicate that these are work objects, not page routes.

### 4.4 Center Main Area

The center area is always the visual focus.

It contains:

- current clone title
- high-frequency quick actions in the top bar
- main empty/intro/work state in the center
- composer/input anchored at the bottom

Top bar quick actions:

- 文件
- Agent
- 快速配置

These are intentionally lightweight entry points, not large permanent panels.

The center area should be capable of representing:

- welcome state
- active conversation state
- work result state
- task feedback state

but the design should maintain visual calm.

### 4.5 Right Context Rail

The right context rail is always secondary to the center.

It should show only lightweight contextual cards, such as:

- 当前任务
- 当前 Agent
- 当前文件
- 通道状态

This rail exists to preserve PRD-required visibility without turning the main workbench into a dashboard.

It should not contain:

- long forms
- dense tables
- full configuration UI

### 4.6 Right Rail Collapse Behavior

The right rail can collapse into a narrow context handle.

Expanded state:

- shows 3 to 4 lightweight contextual cards

Collapsed state:

- leaves a visible expansion handle
- keeps the user aware that work context exists
- gives more space back to the conversation/work surface

### 4.7 Responsive Priority

When width becomes constrained:

1. keep center area intact
2. collapse right context rail first
3. collapse left sidebar into icon rail second

The composer area must stay usable in all states.

## 5. Settings Center Design

### 5.1 Core Principle

Settings must not become a junk drawer. The grouping needs to reflect product concerns clearly.

The approved settings grouping is:

#### 基础

- 常规
- 模型与 Provider
- 网络与代理

#### 工作流

- 团队与角色策略
- 通道高级配置
- 自动化默认策略

#### 能力

- 记忆与知识
- Skills 与 MCP
- 工具权限

#### 治理

- 监控与统计策略
- 安全与审批
- 迁移与备份
- 反馈与开发者

### 5.2 Why Team Is Split Across Left Sidebar and Settings

`团队` appears in both places, but with different roles:

- left sidebar: current team objects, quick switching, operational access
- settings center: team templates, role policies, execution strategy, shared context rules

This split is intentional and avoids both extremes:

- burying teams in settings
- overloading the workbench with deep configuration forms

## 6. Mapping PRD Features Into This Structure

The following PRD capabilities remain visible in the new IA:

### On the Main Workbench

- 主 Agent / 子分身
- 多分身切换
- 团队工作对象
- IM channel entry points
- scheduled tasks
- current task visibility
- file and agent quick access
- contextual channel state

### In Settings Center

- provider management
- permissions and security modes
- memory rules and scope
- skills and MCP governance
- advanced channel bindings
- monitoring and statistics policy
- migration and backup
- feedback and developer tools

This preserves the product-document direction while avoiding a page-heavy, admin-like first version.

## 7. Visual Direction

The visual direction remains:

- simple
- bright
- low-density
- soft-edge desktop feel
- minimal chrome
- limited strong color usage

But it must not directly reproduce the reference product.

Required differences:

- integrate PRD-specific work objects and team structure
- keep context rail visible but lightweight
- split operational objects vs deep configuration more clearly
- support collapse states for both side rails

## 8. Session Persistence Mechanism Under `continue/`

The project needs a durable workflow-tracking mechanism that survives session loss.

The mechanism will be implemented in:

- `continue/AGENT.MD`
- `continue/progress.txt`
- `continue/task.json`

### 8.1 Purpose

The mechanism is used to:

- recover project state across sessions
- persist design progress before implementation begins
- preserve implementation history and decisions
- drive future agents using the same workflow rules

### 8.2 `continue/AGENT.MD`

Responsibilities:

- defines mandatory session startup workflow
- instructs each new session to read `task.json` and `progress.txt` first
- defines valid task status transitions
- forbids implementation when a task is still in design stages
- requires updates to both `task.json` and `progress.txt` at the end of each task session

Suggested status flow:

- `brainstorming`
- `planned`
- `in_progress`
- `review`
- `done`

### 8.3 `continue/task.json`

This is the structured source of truth.

Suggested top-level fields:

- `project`
- `objective`
- `current_phase`
- `current_focus`
- `last_updated`
- `tasks`

Each task should support:

- `id`
- `title`
- `type`
- `status`
- `priority`
- `depends_on`
- `description`
- `acceptance_criteria`
- `notes`
- `subtasks`

The task tree should include both design and implementation tasks.

### 8.4 `continue/progress.txt`

This is an append-only human-readable log.

It should record:

- timestamp
- current focus
- completed work
- design decisions
- blockers
- next recommended step

### 8.5 First Planned Task Tree

Suggested initial top-level tasks:

- `PERSIST-001` establish persistence mechanism
- `DESIGN-001` main workbench shell
- `DESIGN-002` left sidebar clone/team/channel/task structure
- `DESIGN-003` right context rail
- `DESIGN-004` settings center secondary navigation
- `PLAN-001` break approved design into implementation tasks
- `BUILD-001` integrate new shell into current app
- `BUILD-002` implement collapsible left/right rails
- `BUILD-003` implement settings center UI
- `BUILD-004` implement static PRD-first UI presentation
- `VERIFY-001` run UI verification and update docs if needed

## 9. Non-Goals For First Implementation

- no real task execution logic yet
- no real multi-agent runtime orchestration yet
- no complete backend data integration for settings pages
- no enterprise-grade team management logic
- no full migration or approval workflow yet

The first implementation target is visual structure, static data, and clear future extension paths.

## 10. Implementation Sequencing

Recommended order:

1. create persistence mechanism in `continue/`
2. land the new main workbench shell in the current app
3. implement left accordion groups, including team structure
4. implement collapsible left and right rails
5. create the settings center shell and secondary navigation
6. fill workbench and settings center with static PRD-aligned modules
7. verify layout behavior and update progress/task state

## 11. Risks

### Risk 1: Homepage Becomes Too Dense

Mitigation:

- keep only work objects in the left sidebar
- keep only lightweight context cards in the right rail
- move deep configuration to settings center

### Risk 2: Settings Center Becomes a Dumping Ground

Mitigation:

- enforce grouped subnavigation
- keep operational objects out of settings
- place only deep strategy/configuration there

### Risk 3: Reference Influence Becomes Too Literal

Mitigation:

- preserve only the simplicity and workbench rhythm
- adapt layout around PRD requirements rather than copying shapes directly

## 12. Review Notes

This spec was prepared after iterative user-confirmed design discussion.

Subagent review was not used in this session because the current tool policy does not allow delegation unless explicitly requested by the user. A local review was used instead.

## 13. Next Step

After the user reviews this file, the next step is:

- create the implementation plan
- then create the persistent tracking files in `continue/`
- then begin the first implementation task
