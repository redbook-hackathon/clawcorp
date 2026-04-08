# 常见问题与最佳实践 / FAQ & Best Practices

> Looking for English? See [FAQ Guide (English)](#english-version) below.

## 中文版

### 1. 多 Agent 工作区 — 为什么成员列表看不到职责？

**问题：** 已经在 `SOUL.md` 和 `AGENTS.md` 中写好了角色和职责，但控制中心的员工页面看不到具体分工。

**常见原因：** 控制中心会参考 OpenClaw 的 workspace 目录和运行时信号。是否能看到完整职责信息，通常取决于：
- OpenClaw Gateway 返回的 session 数据中是否包含 agent 元信息
- `OPENCLAW_AGENT_ROOT` 环境变量是否指向了正确的 workspace 目录

**解决方法：**

1. **确认 workspace 目录结构正确：**
   ```
   workspace-你的agent名/
   ├── SOUL.md          # 性格和角色定义
   ├── IDENTITY.md      # 名字、emoji 等身份信息
   ├── AGENTS.md        # 多 agent 协作规则
   └── MEMORY.md        # 长期记忆
   ```

2. **检查环境变量：**
   ```bash
   # 确保 OPENCLAW_AGENT_ROOT 指向包含所有 workspace 的父目录
   export OPENCLAW_AGENT_ROOT=/path/to/.openclaw
   ```

3. **确认 Gateway 正在运行：**
   ```bash
   openclaw gateway status
   ```
   控制中心通过 Gateway API 获取 agent 列表和状态。如果 Gateway 没运行，员工页会显示空白或错误。

4. **员工页信息通常会参考这些来源：**
   - **名字/emoji** → 常见做法是放在 `IDENTITY.md`
   - **状态（执行中/空闲）** → 主要来自 Gateway 的 session 运行信号
   - **workspace** → 通常来自 agent 配置中的 `workspace` 字段
   - **具体职责描述** → 当前不会自动把 `SOUL.md` 摘要直接显示成员工卡片文案，更适合作为文档线索保存在 `IDENTITY.md`、`SOUL.md`、`AGENTS.md`

> **最佳实践：** 如果你希望控制中心更容易展示身份与职责线索，建议优先把简短身份说明写进 `IDENTITY.md`，并把详细角色说明写进 `SOUL.md` / `AGENTS.md`。

---

### 2. 订阅/账单 — 数据怎么接？限额在哪设置？

**问题：** 用量页面有费用数据，但不知道这些数据从哪来、限额怎么设置。

**数据来源（常见情况）：**

控制中心的主要用量数据通常来自 OpenClaw Gateway，不需要额外接入第三方账单系统。

```
OpenClaw Gateway → 记录每次 API 调用的 token 用量
                 → 根据模型定价计算费用
                 → 控制中心通过 API 拉取显示
```

**限额设置方式（最佳实践）：**

预算/限额通常在你的 OpenClaw 配置里设置，而不是在控制中心 UI 里直接填写。具体字段名和写法，请以你当前使用的 OpenClaw 版本与官方文档为准。

下面这段可以作为**常见示例**理解，不要把它当成所有环境都完全一致的唯一标准：

```yaml
# 常见示例：在 OpenClaw 配置中设置 budget
# 具体字段请以你的 OpenClaw 版本为准

budget:
  # Token 限额
  tokensIn: 1000000
  tokensOut: 500000
  totalTokens: 1500000

  # 费用限额（美元）
  cost: 50.00

  # 预警比例（达到此比例时发出警告）
  warnRatio: 0.8
```

**控制中心显示的内容：**
- **用量页 → Token 消耗：** 按 agent、按模型、按时间段的 token 使用
- **用量页 → 费用：** 基于模型定价的预估费用
- **用量页 → 上下文压力：** 哪些 session 接近上下文窗口上限
- **总览页 → 预算摘要：** 当前用量 vs 限额的进度条

> **最佳实践：** 如果你希望控制中心看到更完整的一致用量，建议尽量通过 OpenClaw Gateway 统一管理 API 调用。

---

### 3. 会话停滞检测 — 怎么判定的？

**问题：** 控制中心显示某个会话"停滞执行"，但找不到是哪个会话，也不确定判定标准。

**判定逻辑（控制中心视角）：**

控制中心会根据当前拿到的运行信号，把会话整理成类似下面这些可读状态：

| 状态 | 英文 | 判定条件 |
|------|------|----------|
| 执行中 | `running` | 会话有活跃的 API 调用或工具执行 |
| 空闲 | `idle` | 会话存在但没有活跃任务 |
| 阻塞 | `blocked` | 会话等待外部输入或资源 |
| 等待审批 | `waiting_approval` | 会话需要用户手动确认才能继续 |
| 错误 | `error` | 会话遇到错误 |

**“停滞执行”通常表示：** 控制中心看到某个会话仍在运行态，但最近缺少新的活动信号，因此将它标记为疑似停滞。常见参考信号包括：

1. **Gateway 层面：** OpenClaw Gateway 跟踪每个 session 的最后活跃时间
2. **控制中心层面：** 定期轮询 Gateway，比较 `running` 状态会话的最后活跃时间
3. **健康检查：** 某些环境里还会结合健康状态或 freshness 信号

**如何进一步确认：**

```bash
# 查看所有 running 状态的 sessions
openclaw sessions list --filter running

# 查看特定 session 的详情
openclaw sessions history <session-key> --limit 5
```

**常见处理方式：**
- 如果是 heartbeat 检查导致的误判，先回到会话详情看最近活动
- 如果确实停滞了，可以尝试手动发消息恢复：
  ```bash
  openclaw sessions send <session-key> "继续"
  ```
- 如果仍无进展，再考虑终止或重启对应 session

> **最佳实践：** 把这套流程理解成控制中心视角下的排查建议更合适，不要把它当成所有 OpenClaw 环境都完全一致的唯一底层判定标准。

---

## English Version

### 1. Multi-Agent Workspace — Why Can't I See Roles in the Staff Page?

**Issue:** Roles defined in `SOUL.md` and `AGENTS.md` don't appear in the Control Center staff list.

**Common guidance / best practice:**
- Ensure your workspace directory follows the standard structure (`SOUL.md`, `IDENTITY.md`, `AGENTS.md`, `MEMORY.md`)
- Set `OPENCLAW_AGENT_ROOT` environment variable to point to the parent directory of all workspaces
- Confirm OpenClaw Gateway is running (`openclaw gateway status`)
- A practical best practice is to put short identity/role hints in `IDENTITY.md`, and longer role definitions in `SOUL.md` / `AGENTS.md`

### 2. Billing & Budget — How to Connect Data and Set Limits?

**Data source (common case):** Most usage data shown in the Control Center comes from OpenClaw Gateway. No third-party billing integration is usually required.

**Setting limits:** A common best practice is to configure budget thresholds in your OpenClaw config. The exact field names depend on your OpenClaw version and setup.

The example below is a common pattern, not a universal schema for every environment:
```yaml
budget:
  totalTokens: 1500000
  cost: 50.00
  warnRatio: 0.8
```

### 3. Session Stall Detection — How Does It Work?

A session is usually treated as "stalled" when the Control Center still sees it as running but recent activity signals stop updating for a while. Use `openclaw sessions list --filter running` to review candidates.

Best-practice next step: inspect recent session activity first, then optionally send a message to the session (`openclaw sessions send <key> "continue"`). If it still does not recover, terminate or restart the session. Treat this as operator guidance from the Control Center perspective, not as the only possible OpenClaw runtime rule.
