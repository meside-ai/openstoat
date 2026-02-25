# OpenStoat 产品方案 (v2)

> AI ↔ Human 协作任务队列系统

---

## 1. 产品定位

**一句话描述**: 一个解耦 AI Agent 与人类协作的任务队列系统，让 AI 可以并行处理不依赖人的任务，人类完成后自动触发下游 AI 继续执行。

**产品定位**:
- 开源项目
- 目标用户: 1 人类 + 10 AI Agents
- 架构: Local-first + CLI-first
- **无 LLM**: 不配置 API Key，不请求 LLM
- **CLI 即文档**: `stoat help` 就是超级说明书

**核心价值**:
- 人类是瓶颈，AI 并行填满所有空闲时间
- 任务状态透明，谁该做什么一目了然
- 人类只需在关键节点介入，无需全程盯着

---

## 2. 核心概念

| 概念 | 定义 |
|------|------|
| **Template** | 组织流程模板，定义哪些任务类型需要人类介入，由 Agent 读取 |
| **Plan** | 一个项目目标，包含多个 Task，由 Agent 写入 |
| **Task** | 最小执行单元，指定 owner (AI 或 Human)，Agent 负责规划内容 |
| **Handoff** | 任务交接时的上下文传递 |

> **注意**: OpenStoat 本身不进行 AI 处理，不配置 LLM。规划工作由外部 Agent 完成。

---

## 3. 系统架构

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│              External Agents (外部 Agent)               │
│  OpenClaw, Claude Code, Cursor, etc.                   │
│                                                          │
│  • 读取 Template                                       │
│  • 根据 Template 规划 Task                              │
│  • 写入 Plan/Task 到 OpenStoat                         │
│  • 监听 Human 任务完成事件                              │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                      OpenStoat                          │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │              SQLite Database                     │   │
│  │  - Template 表                                    │   │
│  │  - Plan 表                                        │   │
│  │  - Task 表                                        │   │
│  │  - Handoff 表                                     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  CLI: 帮助文档 = 超级说明书                              │
└─────────────────────────────────────────────────────────┘
```

### 3.2 OpenStoat 职责

OpenStoat **不**配置 LLM，不请求 LLM，只负责：

- **存储**: Template、Plan、Task、Handoff
- **CLI**: 数据操作 + 帮助文档
- **状态机**: 任务状态流转
- **监听**: 等待 Human 完成任务

### 3.3 Agent 职责

External Agents 负责：

- **读取**: Template 定义
- **规划**: 根据 Template 拆解 Task
- **执行**: 调用 LLM 完成任务
- **监听**: 轮询或订阅 Human 任务完成事件

---

## 4. Daemon (守护进程)

OpenStoat 可选启动一个守护进程，用于自动调度 AI 任务。

### 4.1 功能

- 每分钟轮询 `ai_ready` 状态的任务
- 发现新任务时，触发配置的 Agent 执行
- 支持多 Agent 并行调度

### 4.2 配置

```bash
# 配置执行任务的 Agent
$ stoat config set agent "openclaw"        # 或 claude-code, cursor 等
$ stoat config set agent-command "openclaw do-task"
```

### 4.3 逻辑

```bash
$ stoat daemon start

# 内部逻辑 (每分钟执行):
while true:
  tasks = stoat list --status ai_ready --json
  for task in tasks:
    run: $agent_command --task-id task.id
    stoat update task.id --status in_progress
  sleep 60
```

### 4.4 流程

```
Plan 写入 → Task (ai_ready)
              ↓
Daemon 轮询 → 发现新任务
              ↓
触发 Agent 执行 → Agent 完成
              ↓
stoat complete → 下游任务 ai_ready
              ↓
Daemon 继续调度
```

---

## 10. 动态人工介入

Agent 执行过程中发现需要人工介入时，可直接升级为 Human 任务：

```bash
$ stoat need-human task_001 --reason "发现 API 签名方式与文档不符，需要确认"
```

状态流转：
```
in_progress → waiting_human → human_done → in_progress
                ↑                              │
                └──────────────────────────────┘
```

只需修改状态，不引入新概念，数据流最简。

---

## 10. 数据模型

### 9.1 Plan

```json
{
  "id": "plan_001",
  "title": "集成 Paddle 支付",
  "description": "在项目中集成 Paddle 作为支付 provider",
  "created_by": "human",
  "created_at": "2026-02-25T16:00:00Z",
  "tasks": ["task_001", "task_002", "task_003", "task_004"],
  "status": "planned | in_progress | completed"
}
```

### 9.2 Task

```json
{
  "id": "task_001",
  "plan_id": "plan_001",
  "title": "添加 Paddle 到 PaymentProviderEnum",
  "description": "在枚举中添加 Paddle 选项",
  "owner": "ai",
  "status": "pending | ai_ready | in_progress | waiting_human | human_done | done",
  "depends_on": [],
  "required_input": null,
  "output": null,
  "created_at": "2026-02-25T16:00:00Z",
  "started_at": null,
  "completed_at": null,
  "history": [
    {
      "action": "created",
      "at": "2026-02-25T16:00:00Z",
      "by": "system"
    }
  ]
}
```

### 9.3 Template (组织流程模板)

```json
{
  "id": "template_001",
  "name": "Default Workflow",
  "version": "1.0",
  "rules": [
    {
      "task_type": "credentials",
      "requires_human": true,
      "human_action": "provide_input",
      "prompt": "请提供 {field} 的值"
    },
    {
      "task_type": "code_review",
      "requires_human": true,
      "human_action": "approve",
      "prompt": "请审核以下代码变更"
    },
    {
      "task_type": "deploy",
      "requires_human": true,
      "human_action": "confirm",
      "prompt": "确认部署到 {environment}？"
    },
    {
      "task_type": "implementation",
      "requires_human": false
    },
    {
      "task_type": "testing",
      "requires_human": false
    }
  ],
  "keywords": {
    "credentials": ["api_key", "secret", "key", "凭证", "密钥", "password"],
    "code_review": ["review", "审核", "pr", "code review"],
    "deploy": ["deploy", "部署", "release", "发布"]
  }
}
```

### 9.4 Handoff (交接记录)

```json
{
  "id": "handoff_001",
  "from_task_id": "task_001",
  "to_task_id": "task_002",
  "summary": "已完成 Paddle 枚举添加，创建了 src/enums/PaymentProvider.ts",
  "artifacts": [
    {
      "type": "file",
      "path": "src/enums/PaymentProvider.ts",
      "action": "created"
    }
  ],
  "created_at": "2026-02-25T16:30:00Z"
}
```

---

## 10. 核心流程

### 9.1 Plan 提交与 Task 拆分

```
1. Human 提交 Plan (文本格式)
         ↓
2. Task Splitter 解析
   - 识别任务边界
   - 识别任务类型
         ↓
3. Template Matcher 匹配规则
   - 根据关键词匹配 task_type
   - 应用 template rules 标记 owner
         ↓
4. 生成扁平 Task 列表
   - 建立依赖关系 (DAG)
   - 计算可并行任务
         ↓
5. AI 任务直接进入 ai_ready，Human 任务进入 pending
```

### 9.2 执行流程

```
Task 状态机:
[pending] → [ai_ready] → [in_progress] → [waiting_human] → [human_done] → [done]
                ↑              │                │               │
                └──────────────┴────────────────┴───────────────┘

执行逻辑:
- AI: 拉取 status=ai_ready 的任务，并行执行
- AI 任务完成 → 写 handoff → 检查下游任务，如依赖满足则触发
- Human 任务完成 → 触发下游 AI 任务 (带 handoff)
```

### 9.3 依赖触发示例

```
Task A (AI) ──依赖──→ Task B (Human) ──依赖──→ Task C (AI)
                                              ↑
                                         自动触发，
                                         携带 Task B 的 output
```

---

## 10. 团队模型

**实际结构**: 1 人类 + N 个 AI Agents

- **AI Agents**: 10+ 并行工作，7×24 小时
- **Human**: 唯一的瓶颈，所有需要人类的任务都在排队等

```
时间线示例:

Day 1, 10:00
├── AI-1: Task A (implement) ████████░░ done
├── AI-2: Task B (implement) ████░░░░░░ done  
├── AI-3: Task C (implement) ██████████ done
└── Human: Task D (credentials) ⏸ 等 AI 完成

Day 1, 10:30
└── Human: Task D 完成 → AI-1 自动开始 Task E

Day 1, 11:00
├── AI-1: Task E ██████░░░░ in_progress
├── AI-2: Task F ████░░░░░░ in_progress
└── Human: Task G (review) ⏸ 等 E, F 完成
```

---

## 10. 存储与项目

### 9.1 存储位置

- 数据目录: `~/.openstoat/`
- 存储格式: SQLite
- 无需账号，无需 API Key

### 9.2 项目支持

- 支持多项目区分
- 每个项目可有独立 Template
- 项目配置随代码仓库（或独立管理）

### 9.3 CLI 设计

```bash
# 初始化项目
$ stoat init my-project

# 提交计划
$ stoat plan "集成 Paddle 支付
1. 添加枚举
2. 提供 API Key
3. 实现服务"

# 查看任务
$ stoat list

# 人类完成某任务
$ stoat complete task_002 --input "api_key=xxx"

# 查看状态
$ stoat status
```

---

## 10. 实现阶段

### Phase 1: MVP

- [ ] Plan 解析与 Task 拆分
- [ ] 基本 Template 匹配 (关键词)
- [ ] Task 状态机
- [ ] CLI 基本操作
- [ ] 简单的 Handoff

### Phase 2: 增强

- [ ] 依赖图计算
- [ ] 多 AI 并行调度
- [ ] 记忆传承
- [ ] Web UI

### Phase 3: 高级

- [ ] 自定义模板 UI
- [ ] 审计日志
- [ ] Webhook 通知

---

*Updated: 2026-02-25*