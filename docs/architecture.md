# Architecture

## Overview

```
Client (React/Vite) --HTTP+SSE--> Server (Express) --AgentController--> Tools --> Sandbox (Docker/Local)
                                        |
                                     EventBus (SSE) + JobRegistry (in-memory/Mongo fallback)
```

## Components

### Frontend
- Pages: Dashboard (recent runs, success rate), NewRun (upload + goal), AgentRun (timeline, test results, diff)
- Hooks: useSSE (EventSource), useAgentRun (polling)
- Services: api.ts (axios)

### Backend

**Routes:**
- `projectRoutes` handles ZIP upload via Multer memoryStorage, yauzl extraction with zip-slip protection, project detection.
- `agentRoutes` handles run creation, status, actions, SSE, diff, download, stop/retry.
- `healthRoutes` returns config status.

**Agent:**
- `AgentLoop` — core loop, orchestrates sandbox, baseline, step loop, Gemini calls, tool execution, evaluation, recovery, verification, cleanup.
- `AgentState` — explicit state machine with valid transitions.
- `Planner`, `GoalManager`, `Evaluator`, `RecoveryManager` — modular decision helpers.

**AI:**
- `GeminiClient` — wraps @google/generative-ai, uses functionDeclarations, fallback heuristic if key missing/invalid.
- `ToolDefinitions`, `AgentPrompt`, `ResponseParser` — prompt building and JSON parsing.

**Tools:**
- `ToolRegistry` — register/execute, returns structured {success, tool, duration, summary, output}.
- Each tool in `server/src/tools/*.ts` implements `execute(args, ctx)`.

**Sandbox:**
- `SandboxManager` — creates workspace, git baseline, delegates to DockerManager or local exec, enforces ExecutionPolicy.
- `DockerManager` — docker run/exec/rm via child_process.
- `ExecutionPolicy` — allowlist for npm/npx/node/git, block dangerous patterns.
- `SandboxConfig`, `ResourceLimits`.

**Projects:**
- `ProjectExtractor` — yauzl stream, safe path check, single-folder zip handling, detectProject.
- `ProjectDetector` — infers framework/packageManager/testCommand from package.json etc.
- `ProjectValidator`.

**Jobs:**
- `JobRegistry` — in-memory Map for runs/actions/projects (replaceable with Mongo).
- `AgentJobManager` — createRun, getRun, stopRun, in-process async execution via AgentController.

**Events:**
- `EventBus` — EventEmitter per runId.
- `SSEManager` — sets headers, emits `data: {json}\n\n`, keepalive.

**Models:**
- `AgentRun`, `AgentAction`, `TestResult` interfaces.

**Middleware:**
- `errorHandler`, `validation` (Zod), `uploadValidation` (Multer).

**Config:**
- `env.ts` — dotenv + validation, warnings if Gemini/Mongo missing.

### Database

Currently in-memory for MVP (JobRegistry). Designed to swap with MongoDB/Mongoose: add `models/Project.ts` etc. Startup marks stale RUNNING as INTERRUPTED.

### Sandbox Lifecycle

`CREATE → PREPARE → EXECUTE → MONITOR → STOP → CLEANUP`
- Isolated workspace per run
- Git baseline commit
- npm install if node_modules missing
- Timeout + resource limits

### Realtime

SSE events: `run.created`, `agent.started`, `project.detected`, `tool.started`, `tool.completed`, `test.started`, `test.completed`, `patch.applied`, `agent.replanning`, `verification.started`, `agent.completed`, `agent.failed`, `agent.stopped`.

Frontend subscribes via EventSource, merges with polled actions for timeline.

