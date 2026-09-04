# Demo

## Prerequisites

- Server running on http://localhost:4000 (serves API + static client)
- Sample ZIP: `sample-projects/task-manager.zip` (46KB, 8 files, no node_modules)
- `.env` with `GEMINI_API_KEY` (or heuristic fallback)

## Demo Script (3-5 minutes)

1. **Open Debugra** — `http://localhost:4000` → Dashboard shows 0 runs, success rate, Gemini status, sandbox mode
2. **New Run** → `New Run` page, click upload, select `task-manager.zip`, project name `task-manager`, goal: `Fix the authentication issue and make all authentication tests pass.` → `Start Autonomous Debugging`
3. **Agent Run** → redirects to `/runs/<runId>`, status `RUNNING`, goal card, attempts/replans/step counters
4. **Project Detected** → `node` + `npm` + `npm test`, `npm install` logs (if needed)
5. **Baseline Tests** → `🧪 test.completed 5/12 passed, 7 failed` — shows failing auth tests (401 invalid signature)
6. **Investigation** → Timeline: `list_files` → `read_file server/auth.js` (shows secret mismatch)
7. **First Patch** → `🔧 Patch applied to server/auth.js` (supersecret → mysecret)
8. **Test Failure** → `🧪 test.completed 5/12 passed` (still failing, Bearer still broken) — **FAILURE VISIBLE**
9. **REPLANNING** → `↻ Replanning after unsuccessful fix` (replans=1, attempts=1→2)
10. **Second Investigation** → `read_file server/middleware/auth.js`
11. **Second Patch** → `🔧 Patch applied to server/middleware/auth.js` (case-insensitive + Bearer)
12. **Tests Passing** → `🧪 test.completed 12/12 passed`
13. **Regression Verification** → `verification.started` + `build` check (if applicable) → `🟢 VERIFIED`
14. **Final Result** → Baseline 5/12 → Final 12/12, attempts 2, replans 1, files changed 2, duration ~70s, `PASS`
15. **Diff Viewer** → `View Diff` shows unified diff for 2 files
16. **Download** → `Download Patched ZIP` → contains fixed project, `npm test` locally gives 12/12

## Key Visual Moment

```
FIRST FIX FAILS
     ↓
AGENT UNDERSTANDS FAILURE (evaluator detects 7 still failing)
     ↓
AGENT CHANGES STRATEGY (replans, reads different file)
     ↓
SECOND FIX SUCCEEDS (12/12)
```

## API Demo Alternative

```bash
curl -F "file=@sample-projects/task-manager.zip" http://localhost:4000/api/projects/upload
curl -X POST http://localhost:4000/api/agent/runs -H "Content-Type: application/json" -d '{"projectId":"...","goal":"Fix authentication..."}'
curl http://localhost:4000/api/agent/runs/<runId>/events  # SSE
curl http://localhost:4000/api/agent/runs/<runId>/diff
curl http://localhost:4000/api/agent/runs/<runId>/download --output patched.zip
```

## Troubleshooting

- If Docker unavailable, logs show `Local sandbox created (Docker unavailable)` — still functional but note security.
- If Gemini invalid, logs `Gemini error, using heuristic` — still succeeds via heuristic for sample.
- If `npm install` slow, baseline takes ~30-60s — wait for EXECUTING.
- If upload fails, check ZIP size <50MB and valid PK header.

