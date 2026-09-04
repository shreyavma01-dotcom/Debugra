# Hackathon Requirement Mapping

| Requirement | Debugra Implementation | Evidence |
|-------------|-------------------------|----------|
| **Goal-Driven Execution** | User provides debugging goal string, `GoalManager` stores it, `buildAgentPrompt` injects goal into every Gemini call, Evaluator checks goal verified via actual test results not LLM alone | `server/src/agent/GoalManager.ts:1`, `server/src/ai/AgentPrompt.ts`, `server/src/agent/Evaluator.ts` |
| **Dynamic Action Selection** | Agent loop calls `geminiClient.getNextAction(context)` each step, Gemini returns one of 12 tools based on recent observations, not hardcoded sequence | `server/src/agent/AgentLoop.ts:94`, `server/src/ai/GeminiClient.ts:28` |
| **Multi-Step Execution** | Loop runs up to 20 steps, baseline install + tests, multiple reads/patches/tests, verified run took 7 steps, timeout run 20 steps | `docs/architecture.md` state machine, `AgentLoop.ts` while loop |
| **Adaptation** | `RecoveryManager` tracks attempts/replans, on failure emits `agent.replanning`, heuristic changes strategy (reads different file after first patch fails), replans=1 in verified run | `server/src/agent/RecoveryManager.ts`, `server/src/agent/AgentLoop.ts:185` |
| **Robustness** | Handles invalid ZIP, zip-slip, missing Gemini (heuristic fallback), Docker fallback, malformed LLM JSON (retry), tool failure, patch failure, timeout, max steps, SSE disconnect, cleanup | `server/src/projects/ProjectExtractor.ts:31`, `server/src/sandbox/ExecutionPolicy.ts`, `server/src/ai/ResponseParser.ts` |
| **Tool Interaction** | 12 tools via `ToolRegistry`, each with name/description/schema/permission/execute, structured results with duration/exitCode/stdout | `server/src/tools/ToolRegistry.ts`, `server/src/tools/*.ts` |
| **Evaluation** | Two levels: Tool (exitCode 0?) and Goal (baseline vs final passed/failed, build check). Evaluator uses `finalResult.failed===0 && exitCode===0` | `server/src/agent/Evaluator.ts:15` |
| **Failure Handling** | Explicit `FAILED/TIMEOUT/STOPPED` states, `recordFailure`, `canRetry`, `rollback`, `change strategy` if repeated failures, `git reset --hard` | `server/src/agent/AgentState.ts`, `server/src/tools/rollback.ts` |
| **Autonomous Execution** | `POST /api/agent/runs` returns runId immediately, `AgentController.startRun` via `setImmediate` background, frontend polls/SSE, no human in loop | `server/src/routes/agentRoutes.ts:10`, `server/src/agent/AgentController.ts:5` |

## Additional MVP Features

- **Sandbox Isolation:** Docker + local fallback, CPU/memory/network limits, git baseline
- **Realtime:** SSE events, timeline UI
- **Downloads:** diff + patched ZIP from workspace, no host path exposure
- **Sample Broken Project:** `task-manager` with 2 bugs, deterministic 5/12 → 12/12

