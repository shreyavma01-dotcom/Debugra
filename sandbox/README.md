# Sandbox

Each agent run gets an isolated workspace under `server/workspaces/<runId>/project`.

If Docker is available and `SANDBOX_MODE=docker`, a container `debugra-<runId>` is created with:
- memory 512m, cpu 0.5, network none, non-root user (when using Dockerfile)
- workspace bind-mounted to /workspace

If Docker unavailable, local sandbox is used with execution policy allowlist.

Never executes untrusted code on host without policy checks.
