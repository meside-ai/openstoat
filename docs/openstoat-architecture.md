# OpenStoat 架构设计

> AI ↔ Human 协作任务队列系统

---

## 1. 技术栈

| 组件 | 技术 |
|------|------|
| 运行时 | Node.js 22+ |
| 语言 | TypeScript |
| 包管理 | Bun (workspace) |
| 存储 | SQLite (native) |
| CLI | Ink / yargs |

---

## 2. 项目结构 (Monorepo)

```
openstoat/
├── packages/
│   ├── openstoat-cli/          # 主 CLI 入口
│   │   ├── bin/
│   │   │   └── openstoat       # CLI 可执行文件
│   │   ├── src/
│   │   │   ├── index.ts        # CLI 入口
│   │   │   ├── commands/       # 子命令
│   │   │   └── lib/            # 工具函数
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── openstoat-core/         # 核心逻辑 (存储、状态机)
│   │   ├── src/
│   │   │   ├── db.ts           # SQLite 连接
│   │   │   ├── plan.ts         # Plan 模型
│   │   │   ├── task.ts         # Task 模型
│   │   │   ├── template.ts     # Template 模型
│   │   │   ├── handoff.ts      # Handoff 模型
│   │   │   └── index.ts        # 导出
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── openstoat-daemon/       # 守护进程
│   │   ├── src/
│   │   │   ├── index.ts        # Daemon 入口
│   │   │   ├── scheduler.ts    # 调度逻辑
│   │   │   └── agent.ts        # Agent 调用
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── openstoat-types/        # 共享类型
│       ├── src/
│       │   └── index.ts        # TypeScript 类型定义
│       ├── package.json
│       └── tsconfig.json
│
├── bun.lockb
├── package.json
└── tsconfig.json               # Root tsconfig
```

---

## 3. 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                     openstoat CLI                               │
│                    (单一入口命令)                                │
│                                                                 │
│   $ openstoat --help                                           │
│   $ openstoat plan add "..."                                   │
│   $ openstoat task list                                        │
│   $ openstoat daemon start                                     │
│   $ openstoat config set agent openclaw                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  plan add   │ │  task list  │ │  daemon     │
│  plan ls    │ │  task show  │ │  daemon     │
│  plan rm    │ │  task done  │ │  start      │
│             │ │  need-human │ │  stop       │
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │               │               │
       └───────────────┼───────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    openstoat-core                               │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                    SQLite Database                      │  │
│   │                                                          │  │
│   │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐  │  │
│   │   │ plans   │  │ tasks   │  │templates│  │ handoffs │  │  │
│   │   └─────────┘  └─────────┘  └─────────┘  └──────────┘  │  │
│   │                                                          │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   Data: ~/.openstoat/openstoat.db                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. CLI 命令文档

### 4.1 全局命令

```bash
# 查看帮助 (超级说明书)
$ openstoat --help

# 初始化
$ openstoat init                    # 初始化项目配置
$ openstoat init --project my-proj  # 指定项目名

# 配置
$ openstoat config show             # 显示配置
$ openstoat config set agent "openclaw"
$ openstoat config set poll-interval 60
```

### 4.2 Plan 命令

```bash
# Plan 管理
$ openstoat plan add "计划内容"           # 添加计划
$ openstoat plan ls                       # 列出计划
$ openstoat plan show <plan_id>           # 查看计划详情
$ openstoat plan rm <plan_id>             # 删除计划
$ openstoat plan status <plan_id>         # 查看计划状态
```

### 4.3 Task 命令

```bash
# Task 管理
$ openstoat task add --plan <plan_id> --title "任务标题" --owner ai|human
$ openstoat task ls                       # 列出所有任务
$ openstoat task ls --status ai_ready     # 按状态筛选
$ openstoat task ls --owner human         # 按负责人筛选
$ openstoat task show <task_id>           # 任务详情
$ openstoat task done <task_id>           # 标记完成 (Human)
$ openstoat task need-human <task_id> --reason "原因"  # AI 升级为 Human
$ openstoat task depend <task_id> --on <dep_task_id>  # 添加依赖
```

### 4.4 Template 命令

```bash
# Template 管理
$ openstoat template ls                   # 列出模板
$ openstoat template show <template_id>   # 查看模板
$ openstoat template add -f template.json # 添加模板
$ openstoat template rm <template_id>     # 删除模板
$ openstoat template set-default <id>     # 设置默认模板
```

### 4.5 Daemon 命令

```bash
# 守护进程
$ openstoat daemon start                  # 启动守护进程
$ openstoat daemon stop                   # 停止守护进程
$ openstoat daemon status                 # 查看状态
$ openstoat daemon logs                   # 查看日志
```

### 4.6 Handoff 命令

```bash
# 交接记录
$ openstoat handoff ls --task <task_id>   # 查看任务的交接记录
$ openstoat handoff show <handoff_id>     # 查看交接详情
```

---

## 5. 数据流

```
┌──────────────────────────────────────────────────────────────┐
│                      External Agents                         │
│           (OpenClaw, Claude Code, Cursor, etc.)             │
│                                                               │
│  • 读取 Template:  openstoat template ls                     │
│  • 规划 Task:      openstoat task add ...                    │
│  • 监听任务:       openstoat task ls --status waiting_human │
│  • 完成任务:       openstoat task done <id>                  │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    openstoat CLI                              │
│                              │                                │
│    ┌─────────────────────────┼─────────────────────────┐    │
│    │                         │                         │    │
│    ▼                         ▼                         ▼    │
│ openstoat             openstoat              openstoat       │
│ plan add              task list              daemon start    │
└─────────────────────────┬─────────────────────────┬──────────┘
                          │                         │
                          ▼                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    openstoat-core                            │
│                                                               │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│   │  Plan    │  │  Task    │  │Template  │  │ Handoff  │    │
│   │ Service  │  │ Service  │  │ Service  │  │ Service  │    │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│        │             │             │             │           │
│        └─────────────┴─────────────┴─────────────┘           │
│                          │                                    │
│                          ▼                                    │
│   ┌──────────────────────────────────────────────────────┐   │
│   │                   SQLite                               │   │
│   │              (~/.openstoat/openstoat.db)              │   │
│   └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Daemon 调度流程

```
┌─────────────────────────────────────────────────────────────┐
│                   openstoat daemon                          │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │                  Scheduler                           │  │
│   │                                                     │  │
│   │   while true:                                      │  │
│   │     tasks = exec("openstoat task ls --status ai_ready --json") │
│   │     for task in tasks:                             │  │
│   │       agent = config.get("agent")                  │  │
│   │       exec(f"{agent} do-task --task-id {task.id}") │  │
│   │       exec("openstoat task update --status in_progress")     │
│   │     sleep(poll_interval)                           │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 状态机

```
Task 状态流转:

pending → ai_ready → in_progress → waiting_human → human_done → done
                ↑              │                │               │
                └──────────────┴────────────────┴───────────────┘

特殊操作:
- AI 需要人工: in_progress → waiting_human (via need-human)
- Human 完成: waiting_human → human_done → in_progress (下游任务)
```

---

## 8. 存储结构

```sql
-- Plan 表
CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'planned',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

-- Task 表
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  plan_id TEXT REFERENCES plans(id),
  title TEXT NOT NULL,
  description TEXT,
  owner TEXT CHECK(owner IN ('ai', 'human')),
  status TEXT DEFAULT 'pending',
  depends_on TEXT,  -- JSON array of task IDs
  output TEXT,      -- JSON
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

-- Template 表
CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT,
  rules TEXT NOT NULL,  -- JSON
  keywords TEXT,        -- JSON
  is_default INTEGER DEFAULT 0
);

-- Handoff 表
CREATE TABLE handoffs (
  id TEXT PRIMARY KEY,
  from_task_id TEXT REFERENCES tasks(id),
  to_task_id TEXT REFERENCES tasks(id),
  summary TEXT,
  artifacts TEXT,  -- JSON
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Config 表
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

---

## 9. 安装与使用

```bash
# 开发模式
$ bun install
$ bun --cwd packages/openstoat-cli run build

# 全局安装
$ npm install -g openstoat

# 使用
$ openstoat --help
$ openstoat init
$ openstoat plan add "集成支付"
$ openstoat daemon start
```

---

*Architecture v1.0 - 2026-02-25*