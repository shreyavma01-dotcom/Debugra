# Troubleshooting

## Server won't start

- Check `.env` exists (copy from `.env.example`)
- If `GEMINI_API_KEY` missing, server still starts with warning `AI provider is not configured.`
- If `MONGODB_URI` unreachable, server uses in-memory store (log warning, not crash)
- Port 4000 in use? `netstat -ano | findstr :4000` then kill or change `PORT`

## Upload fails

- Ensure ZIP <50MB, valid PK header, no `..` entries
- Sample ZIP should be 46KB without node_modules; recreate via PowerShell snippet in README
- Check `server/workspaces` writable

## Baseline tests stuck INITIALIZING

- `npm install` can take 30-60s for sample; wait. Check `server.log` for install logs
- If `node_modules` already in ZIP, install skipped

## Agent stuck, no progress

- Check `GET /api/agent/runs/:id/actions` — should see steps incrementing every ~3s
- If Gemini key invalid, logs `Gemini error, using heuristic` — heuristic still works for sample
- Max steps 20: if reached, status TIMEOUT, check server.log for errors

## Tests still 5/12 after patch

- Heuristic expects to patch `server/auth.js` then `server/middleware/auth.js`; if files named differently, heuristic may fail — check `list_files` output via actions
- Gemini may choose different strategy; with valid key, prompt guides it to read relevant files

## Diff empty

- Ensure run reached VERIFIED/FAILED, not still RUNNING
- `git diff HEAD` requires baseline commit; check `git log` in workspace `server/workspaces/<projectId>/project`

## Download fails

- Workspace cleaned? Only preserved until server restart. Re-run to generate new.

## Frontend not loading

- `npm --workspace client run build` then restart server (serves `client/dist`)
- Dev mode: `npm run dev:client` → http://localhost:5173 proxies /api to :4000

## Docker unavailable

- Set `SANDBOX_MODE=local` (default) for demo. For production Docker: install Docker Desktop, set `SANDBOX_MODE=docker`, ensure `docker --version` works.

