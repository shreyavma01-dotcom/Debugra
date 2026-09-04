# Security

## Threat Model

Uploaded projects are **untrusted code**. An adversary could:

- Upload zip-slip (path traversal)
- Exhaust disk/memory (large archive, infinite files)
- Execute arbitrary commands to escape sandbox, access host FS, steal secrets, use network, run crypto miners
- Inject commands via prompt or file names
- Exploit package lifecycle scripts (preinstall/postinstall)

## Mitigations

### ZIP Validation
- Validate extension `.zip`, magic bytes `PK`, size < 50MB
- yauzl streaming, each entry validated via `validateZipEntryName()` (rejects `..`, absolute path, drive letter, backslash, null byte)
- Reject corrupted, empty, excessively large archives
- Extracted size limit (200MB), file count limit (2000), per-file size limit (20MB)
- Extraction timeout (30s)

### Path Validation (`server/src/security/pathGuard.ts`)
- Centralized `resolveInWorkspace()` and `resolveRealInWorkspace()` for ALL file tools
- Rejects null bytes, absolute paths, Windows drive letters (`C:\`), UNC paths (`\\server`)
- Rejects `..` traversal after URL-double-decode
- Rejects backslash-separated paths (Windows-style traversal)
- Rejects reserved device names (`CON`, `PRN`, `LPT1`, etc.)
- Verifies real filesystem path (symlinks resolved) stays inside workspace
- Normalization alone is NOT a security boundary — prefix check with path separator

### Sandbox Isolation
- **Docker mode (production):** `node:20-alpine` container per run, `--memory=512m --cpus=0.5 --pids-limit=128 --network=none`, non-root user, bind mount only workspace to `/workspace`, no Docker socket, no env secrets, tmp name, auto `docker rm -f`.
- **Local fallback:** still isolated temp workspace under `server/workspaces/<projectId>/<runId>/`, but shares host kernel. ExecutionPolicy still enforced. Clearly logged. Production returns `SANDBOX_UNAVAILABLE` instead of falling back.

### Execution Policy (`server/src/sandbox/ExecutionPolicy.ts`)
- **Allowlist**, NOT a blacklist. Anything not explicitly permitted is rejected.
- Allowed: `npm test/install/ci/run`, `npx jest/vitest/tsc/eslint`, `node <file>`, `git status/diff/log`, `yarn/pnpm`
- `npm install` / `npm ci` forced to `--ignore-scripts` (lifecycle scripts never run on untrusted code)
- `node -e/--eval/-p/-r` rejected (no code evaluation)
- Shell metacharacters rejected: `; | & ( ) $` backticks, newlines
- Environment variable assignment prefix rejected (`FOO=bar npm test`)
- Dangerous executables blocked: `sudo`, `curl`, `wget`, `bash`, `sh`, `powershell`, `docker`, `chmod`, etc.
- Timeout 120s per command, maxBuffer 1MB, output truncated 20k

### Patch Safety
- Structured `apply_patch` validates path via pathGuard, captures before/after, `git diff` tracked
- Baseline git commit before any modifications, original recoverable
- Patch size limit (512KB), max 50 files per run

### Resource Limits
- `MAX_AGENT_STEPS=20`, `MAX_RETRIES=3`, `SANDBOX_TIMEOUT_MS=120000`
- Process cleanup via `docker rm -f` or `fs.rm` on workspace after download/stop/timeout/crash
- SSE payload max 64KB, max 200 concurrent listeners per run

### Network Isolation
- Docker sandbox runs with `--network=none` by default
- Uploaded code cannot reach internet, internal network, localhost services, cloud metadata

### CORS / Headers
- Helmet security headers (CSP default-src 'self')
- CORS restricted to `CLIENT_URL` (NOT `*`), credentials enabled
- `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` for HTML

### Rate Limiting
- Upload: 10 req/60s per IP
- Run operations: 10 req/60s per IP
- Global: 100 req/60s per IP

### Gemini API Security
- `GEMINI_API_KEY` is server-side only — loaded from `process.env` in `server/src/config/env.ts`
- Never passed to frontend, SSE, logs, or sandbox
- Frontend NEVER calls Gemini directly (correct architecture: React → Backend → Gemini)
- Verified absent from frontend source and production bundle

### SSE Security
- Ownership check on every SSE connection (IDOR protection)
- Event payload capped at 64KB
- No secrets, env vars, or server paths in events
- Max 200 listeners per run, clean disconnect on client close

### Download Security
- Ownership verified before serving patched ZIP
- Excludes `node_modules`, `.git`, `coverage`, `dist`, `build`
- Excludes `.env` and any file matching sensitive name patterns
- Total size capped at `MAX_EXTRACTED_SIZE_MB`

### Error Handling
- Production errors use safe codes (`SANDBOX_UNAVAILABLE`, `NOT_FOUND`, `FORBIDDEN`)
- No stack traces, filesystem paths, env vars, or internal details leaked to client

### Logging
- Structured logs with `runId, step, tool`
- Never log `GEMINI_API_KEY`, `Authorization`, `JWT`, `MONGODB_URI`, passwords, or private keys

## What's NOT Stored
- API keys, passwords, secrets

## Security Tests (`server/src/security/*.test.ts`)
- 34 tests covering ZIP path traversal, command allowlist, shell injection, workspace escape
- All tests pass

