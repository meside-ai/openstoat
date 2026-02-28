# From Idea to Product: The Birth of OpenStoat

> The birth of a task system for AI-human collaboration

---

## The Beginning

It all started with a question:

> "Should I design a task storage plugin for you, so you can store tasks there, see at a glance which ones need human work, and when humans finish, add a button to kick off the next AI step?"

It was an ordinary afternoon in February 2026. I received this idea on Slack about how to make AI Agents and humans collaborate better.

The context: there was a tool called OpenStoat (then named TaskQueue), positioned as a message queue between AI Agents. But in practice we ran into issues—the core one being: **the memory system was disconnected**.

---

## First Round of Thinking: What's the Problem?

We started dissecting the status quo:

1. **Opaque state** — Can't tell which tasks are waiting for humans vs. which AI can continue
2. **Context gaps** — Each AI Agent has its own memory; when tasks hand off, the context breaks
3. **Manual tracking** — Humans have to remember "this one's done, time to tell the AI to continue"

But the deeper issue was: **the tool was aimed at the wrong audience**.

It was built for AI ↔ AI, but if the goal is a team of "1 human + 10 AI Agents", it should be an **AI ↔ Human** collaboration queue.

---

## Core Insight

chase (the project initiator) said something crucial:

> "AI will always move fast—if 1 isn't enough, scale to 100. **The bottleneck is the human.**"

That shifted the whole design:

- No need for complex Story layers; Plan + Task is enough
- AI works 24/7 in parallel; humans step in only at key points
- The system doesn't need to configure an LLM; it just stores and schedules

---

## Product Iteration

### v1: Three-Level Structure

I first designed a Plan → Story → Task structure, inspired by traditional agile (Jira-style).

It was rejected immediately:

> "Stories span days—that doesn't fit AI's rhythm."

Right. AI can work around the clock; it doesn't need day-based planning.

### v2: Simplified to Two Levels

Drop Story, keep only Plan + Task. Flatter structure, better for AI parallel execution.

### v3: No-LLM Design

I initially assumed OpenStoat would need a built-in LLM for task planning. chase proposed something simpler:

> "OpenStoat is more like a memory system + listener. It doesn't configure an LLM. External Agents (e.g. OpenClaw, Claude Code) read templates via OpenStoat's CLI, plan tasks, and write them into the system."

That's the **"CLI as the super manual"** design principle.

### v4: Dynamic Human Handoff

Problem: What if AI discovers mid-execution that it needs human input?

Simplest approach: change state directly. No new concepts.

```bash
$ openstoat need-human task_001 --reason "Found xxx, needs confirmation"
```

### v5: Daemon Process

Last big question: How does the AI know when there are new tasks?

Solution: an optional daemon that polls for `ai_ready` tasks every minute and triggers the configured Agent to run.

---

## Final Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    openstoat CLI                            │
│              (single entry point, all commands)              │
└──────────────────────┬──────────────────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  plan add   │ │  task list  │ │  daemon     │
│  plan ls    │ │  task show  │ │  start      │
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │               │               │
       └───────────────┼───────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    openstoat-core                           │
│                     SQLite storage                          │
│              (~/.openstoat/openstoat.db)                    │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

- **Runtime**: Node.js 22+ (native SQLite support)
- **Language**: TypeScript
- **Package manager**: Bun (workspace)
- **Architecture**: Local-first + CLI-first

---

## Team Model

```
1 human (full-stack dev) + N AI Agents (24/7 parallel work)
```

- **AI**: Grabs tasks in parallel, moves to the next as soon as one is done
- **Human**: The only bottleneck; all human-dependent tasks queue up

---

## Lessons Learned

1. **Don't assume**: Don't copy traditional dev patterns (Jira, agile, sprints)—AI's work rhythm is different
2. **Simplicity wins**: Use a state machine when it's enough; avoid new concepts
3. **Decouple**: OpenStoat handles storage; Agents handle intelligence
4. **CLI as docs**: A good CLI help is the best product manual

---

## Next Steps

Docs are done, architecture is set. Next is implementation.

OpenStoat will be an open-source project for modern teams of "1 human + 10 AI Agents".

---

*Recorded on 2026-02-25, from discussions in Slack #ask-openstoat.*

*If you're interested in OpenStoat, follow the project for updates.*
