# Deployment & Security

## Production Architecture

```
Internet
  ↓  HTTPS (TLS 1.2+)
Reverse Proxy / Load Balancer (nginx, Caddy, cloud LB)
  ↓  HTTP (internal)
Debugra API (Express, Node.js)
  ↓  internal
Agent Job Manager → Agent Controller → Tool Registry → Sandbox (Docker)
  ↓                                    ↓
EventBus (SSE)                    Gemini API (server-only)
JobRegistry (Mongo)
```

**Trust boundaries:**
- API container ≠ sandbox containers (different processes, different filesystem views)
- The Docker daemon socket is NOT mounted into the API container
- Gemini API key lives ONLY in the API container, never in the sandbox or frontend

## Production Configuration

```bash
NODE_ENV=production
SANDBOX_MODE=docker           # never falls back to local for untrusted code
CLIENT_URL=https://your-domain.com
GEMINI_API_KEY=<deployment secret, injected at runtime>
MONGODB_URI=<mongodb+srv://...>
SANDBOX_NETWORK_ENABLED=false
SANDBOX_MEMORY_LIMIT=512m
SANDBOX_CPU_LIMIT=0.5
SANDBOX_PIDS_LIMIT=128
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_UPLOAD_MAX=10
RATE_LIMIT_RUN_MAX=10
```

Secrets are injected at runtime (env vars, secrets manager, or mounted files). They are NEVER committed to Git.

## Docker Production Image (API)

```dockerfile
# Multi-stage: build
FROM node:20-alpine AS build
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ .
RUN npm run build

# Multi-stage: runtime
FROM node:20-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY server/package.json ./
USER app
EXPOSE 4000
HEALTHCHECK --interval=30s CMD wget -qO- http://localhost:4000/api/health || exit 1
CMD ["node", "dist/server.js"]
```

- Non-root user
- No `.env` copied into the image
- No credentials baked into layers
- `.dockerignore` excludes `node_modules`, `.env`, `workspaces/`, `logs/`

## Sandbox Hardening (Docker mode)

Each run gets a fresh container:

## Gemini API Security

- `GEMINI_API_KEY` is a **server-only secret**
- The frontend NEVER receives the key (not via env, API responses, SSE, or logs)
- The frontend NEVER calls Gemini directly — all calls go through the backend
- The key is never passed into the Docker sandbox
- Verified: no `AIza...` pattern found in frontend source or production bundle

## Authentication / Authorization (Production Blocker)

**Current state:** The MVP uses an anonymous per-client cookie (`ownerId`) as an identity boundary. This is **NOT** real authentication.

For production:
- Add OAuth2/OIDC or mTLS authentication
- Every endpoint must verify the authenticated identity owns the requested resource
- No cross-user access (IDOR protection on projects, runs, SSE, diff, download)
- Until real authentication is added: **NOT READY FOR PRODUCTION** for internet-facing deployment

## CORS

```js
origin: env.CLIENT_URL  // NOT '*'
credentials: true
methods: ['GET','POST']
```

Production uses `https://your-domain.com`. Development uses `http://localhost:5173`.

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/projects/upload` | 10 | 60s |
| `/api/agent/runs`, `/retry`, `/stop` | 10 | 60s |
| Global | 100 | 60s |

## Secrets Audit

| Check | Status |
|-------|--------|
| Gemini key in frontend source | PASS |
| Gemini key in production bundle | PASS |
| Secrets in `.env.example` | PASS |
| Secrets in Git history | PASS |
| Secrets in logs/SSE/API responses | PASS |
| Secrets passed to sandbox | PASS |
| `sk-`, `AKIA`, `ghp_`, `xoxb-` patterns | PASS (no matches) |

## Dependency Audit

`npm audit` found **6 moderate severity** vulnerabilities:
- `express` / `body-parser` / `qs` (dependency chain)
- `react-router` / `react-router-dom` (open redirect + constructor injection)
- `uuid` (buffer bounds check)

No critical/high vulnerabilities. Fixes require breaking upgrades (`react-router` → 7.18+, `uuid` → 14+). Do **not** blindly `npm audit fix --force` without testing.

## Build Verification

| Check | Status |
|-------|--------|
| Server typecheck | PASS |
| Client typecheck | PASS |
| Server build (`tsc`) | PASS |
| Client build (`vite build`) | PASS |
| Security tests (34) | PASS |
| Production bundle secret scan | PASS |

## Production Verdict

**NOT READY FOR PRODUCTION** — authentication/authorization is missing for an internet-facing deployment. The agent executes untrusted code; without real authentication, there is no way to reliably enforce per-user authorization boundaries for internet-facing use.

For a **demo/hackathon** environment (localhost or private network), the security posture is solid:
- Gemini key is server-only
- ZIP extraction is hardened (zip-slip, traversal, symlink, size limits)
- Command execution uses an allowlist with shell metacharacters rejected
- Docker sandbox is non-root, network-disabled, resource-limited
- Path validation is centralized and verified
- CORS, rate limiting, Helmet headers are configured
- No secrets leak through SSE, API responses, downloads, or logs


```
docker run
  --rm
  --network=none
  --memory=512m
  --cpus=0.5
  --pids-limit=128
  --user=1000:1000
  --cap-drop=ALL
  --security-opt=no-new-privileges
  -v <workspace>:/workspace:rw
  node:20-alpine
```

- **Network disabled** — uploaded code cannot reach the internet or internal services
- **No Docker socket** — the sandbox cannot spawn sibling containers
- **No host mounts** — only the per-run workspace is bind-mounted
- **No env secrets** — `GEMINI_API_KEY`, `MONGODB_URI`, etc. are never passed in
- **Non-root** — `USER 1000` inside the container
- **Auto-cleanup** — `docker rm -f` on completion/timeout/crash
- **Resource limits** — memory, CPU, PID, output size, execution timeout

## Local Sandbox Warning

The local fallback (`SANDBOX_MODE=local`) executes commands directly on the host. It is **NOT** equivalent to Docker isolation. In production:

- `SANDBOX_MODE=docker` **fails closed** — returns `SANDBOX_UNAVAILABLE` instead of executing untrusted code on the host
- Local mode is for development/demo only, explicitly opted into via `SANDBOX_MODE=local`
