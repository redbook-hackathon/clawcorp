# ClawCorp DESIGN-019 — 设计提炼摘要

> 基于 `reference/openclaw-control-center-main` 与 `reference/clawport-ui-main` 的深度分析

---

## 1. 布局节奏 (Layout Rhythm)

### ClawPort
- **固定 220px 左导航**：blur(40px) saturate(180%) 背景，1px separator 分隔
- **单一主内容区**：flex-1 overflow-hidden，Map/Grid/Feed 三种视图切换
- **右侧按需展开的详情面板**：380px 宽，panel-slide-in 动画（350ms cubic-bezier），overlay shadow
- **顶部控制条**：绝对定位于内容区内，material-regular 背景 + blur(20px)

### OpenClaw Control Center
- **7 个独立 section**：总览 / 用量 / 员工 / 协作 / 任务 / 文档 / 记忆 / 设置
- **卡片密度适中**：每 section 2–4 张主卡片，卡片间 gap 符合 4px grid 倍数
- **侧边导航偏 Apple HIG**：使用顶部 section header 小号大写字母标注区域

### ClawCorp 应采用的节奏
| 元素 | 规格 |
|------|------|
| 左侧栏 | 240px 展开 / 56px 折叠图标栏 |
| 主内容区 | flex-1，最小宽度 480px |
| 右侧抽屉 | 360px，按需滑出 |
| 间距基线 | 4px grid（space-1=4px → space-16=64px） |
| 内容区内边距 | 24px (space-6) |

---

## 2. 配色系统 (Color System)

### ClawPort 设计令牌
```
Light Theme:
  --bg: #f2f2f7         (Apple 系统灰)
  --bg-secondary: #fff  (白色卡片)
  --accent: #DC2626     (红色强调)
  --system-blue/green/red/orange/purple: Apple 标准色

Dark Theme:
  --bg: #000000
  --bg-secondary: rgba(28,28,30,1)
  --material-regular: rgba(28,28,30,0.92)
  --accent: #EF4444
```

### ClawCorp 应采用的配色（AutoClaw 暖色方向）
| 角色 | Light | Dark（预留） |
|------|-------|-------------|
| 背景 | `#f5f5f0`（暖白） | `#1a1a1e` |
| 卡片 | `#ffffff` | `rgba(28,28,30,0.92)` |
| 强调色 | `#e8733a`（橙色） | `#f59e5e` |
| 成功 | `#22c55e` | `#30D158` |
| 警告 | `#f59e0b` | `#FF9F0A` |
| 错误 | `#ef4444` | `#FF453A` |
| 主文字 | `#1a1a1e` | `#ffffff` |
| 次文字 | `rgba(60,60,67,0.6)` | `rgba(235,235,245,0.6)` |
| 分隔线 | `rgba(60,60,67,0.12)` | `rgba(84,84,88,0.6)` |

---

## 3. 材质 / 卡片层级 (Material Hierarchy)

### 三层材质体系（借鉴 ClawPort Apple 材质）

| 层级 | 名称 | 光学效果 | 使用场景 |
|------|------|---------|---------|
| L0 | 页面背景 | 纯色 `--bg` | 整体画布 |
| L1 | 内容卡片 | `--bg-secondary` + shadow-card + radius-lg | 侧边栏、主功能容器 |
| L2 | 悬浮/抽屉 | shadow-overlay + blur(20px) | Agent 抽屉、文件抽屉、弹窗 |

### 关键卡片样式
```css
.kt-card {
  background: var(--bg-secondary);
  border-radius: 16px;
  border: 1px solid var(--separator);
  box-shadow: 0 0 0 0.5px rgba(0,0,0,0.06),
              0 1px 3px rgba(0,0,0,0.06),
              0 4px 12px rgba(0,0,0,0.06);
}
.kt-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
}
```

---

## 4. 导航与工作台关系

### ClawPort 模式
- 导航 = **路由跳转**（Map → Kanban → Chat → Settings）
- 每个路由是独立的全屏页面
- 侧边栏选中状态 = accent-fill 背景 + accent 文字色

### OpenClaw Control Center 模式
- 导航 = **section 切换**（同一个 UI 壳内）
- URL 查询参数驱动：`?section=overview&lang=zh`
- 更接近 SPA 内部切换

### ClawCorp 应采用的模式
```
左侧栏 = 工作对象容器（非路由导航）
├── 分身（会话列表，类似 ChatGPT 左侧）
├── Channel 频道（IM 端点）
├── 任务（看板/日程入口）
└── 团队管理（总览/看板入口）

主内容区 = 视图随左侧选中对象变化
右侧抽屉 = Agent/文件详情（按需展开）
```

- **核心区别**：左侧栏不做页面路由，而是做**工作对象切换**
- **设置中心**：通过底部齿轮图标进入，是唯一的真正路由跳转

---

## 5. 微交互规范（来自 ClawPort 提炼）

| 交互 | 规格 |
|------|------|
| 卡片 hover | `translateY(-2px)` + shadow 提升，200ms spring |
| 按钮 press | `scale(0.98)` hover → `scale(0.96)` active |
| 面板滑入 | `translateX(100%)→0`，350ms cubic-bezier(0.32,0.72,0,1) |
| 淡入 | `opacity 0→1 + translateY(4px→0)`，200ms ease |
| 状态指示灯 | 6px 圆点，error 时 pulse 动画 1.5s |
| 焦点环 | 2px solid system-blue，offset 2px |

---

## 6. 字体与排版

| 属性 | 值 |
|------|-----|
| 正文字体 | Inter (Google Fonts) / -apple-system 回退 |
| 等宽字体 | SF Mono / Monaco / Menlo |
| 正文大小 | 14px–15px |
| 标题 | 20px–28px，weight 600–700 |
| 小标签 | 11px–12px，weight 600，uppercase，tracking 0.06em |
| 行高 | 1.47 (正文) / 1.15 (标题) |
