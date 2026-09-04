# Agent Flow

```
GOAL
 ↓
OBSERVE (list_files, read_file, search_code, detect_project, read_logs)
 ↓
DECIDE (Gemini function calling with context: goal, meta, previous actions, test results, changed files, recent outputs)
 ↓
ACT (execute tool via ToolRegistry → Sandbox)
 ↓
TEST (run_tests inside sandbox, parse passed/failed)
 ↓
EVALUATE (Level1: tool success? Level2: goal verified? baseline vs final)
 ↓
ADAPT (if FAIL: increment attempts, replans, rollback if needed, change strategy)
 ↓
VERIFY (run final regression: tests + build, git diff, mark VERIFIED or FAILED)
```

## Detailed Loop

```pseudo
initializeRun()
createSandbox()
detectProject()
captureBaseline() // npm install -> run_tests -> store baselineResult
captureInitialTestState()

while step < maxSteps:
  observe()
  buildContext() // only recent 5 actions, last 2 test results, last 3 tool outputs (truncated)
  requestNextActionFromGemini() // or heuristic fallback
  validateToolCall()
  executeTool()
  recordAction() // JobRegistry + eventBus
  updateState()
  evaluateResult()
  if goalVerified:
    runFinalVerification() // build command if exists
    finish VERIFIED
  if toolFailed: allowRecovery()
  if repeatedFailure: change strategy (replan)
  if retryLimitExceeded: fail
```

## Recovery

- `RecoveryManager` tracks attempts/replans, maxRetries=3
- After patch, next action forced to `run_tests` for evaluation
- If same tool repeated 3x, force REPLANNING and choose different tool
- If test still fails after patch, increment replans, emit `agent.replanning`, read next candidate file
- `rollback` available to reset to baseline commit
- Prevent infinite loops via step limit (20) and retry limit

## Context Management

- Prompts limited to ~4k tokens: goal, meta, attempt/replans, last test summaries (stdout truncated 1k), last 5 actions, last 3 tool outputs (800 chars each)
- Large logs truncated to 5k, output to 20k
- No entire repo sent

## Memory

Per-run memory only: goal, observations, actions, tool results, test results, failures, changed files, hypotheses, attempts, replans. No vector DB for MVP.

