# Tools

## Registry

`ToolRegistry.register({ name, description, permission, inputSchema, execute })`
Only registered tools callable. Gemini receives definitions as functionDeclarations.

## Permission Levels

- `SAFE` — read-only, no side effects
- `EXEC` — runs commands inside sandbox, allowlisted
- `WRITE` — modifies workspace, tracked via git

## Tool Catalog

### list_files
- Input: `{ dir?: string }`
- Output: `{ files: string[] }`
- Ignores `node_modules, .git, dist, build`

### read_file
- Input: `{ path: string }`
- Validates traversal, absolute, 1MB limit, binary check
- Output: `{ content, path }`

### search_code
- Input: `{ query: string, maxResults?: number }`
- Case-insensitive line search, ignores binaries, node_modules, dist

### read_logs
- Input: `{ lastN?: number }`
- Returns recent test/command logs from context

### detect_project
- Output: `{ meta: { framework, packageManager, testCommand, ... } }`

### detect_tests
- Output: `{ meta, testFiles: string[] }`

### run_tests
- Input: `{ command?: string, filter?: string }`
- Executes via SandboxManager, parses Jest/Vitest output for passed/failed/total, stores TestResult, emits test.completed

### run_linter
- Input: `{ command?: string }`
- Similar to run_tests

### run_command
- Input: `{ command: string }`
- Policy-checked via ExecutionPolicy, runs in sandbox, returns stdout/stderr/exitCode/duration

### apply_patch
- Input: `{ file: string, content?: string, patch?: string }`
- Validates path, writes file or applies unified diff via `git apply`, records changedFiles, returns diff

### git_diff
- Output: `{ diff, stat }`

### rollback
- Executes `git reset --hard HEAD && git clean -fd`

## Execution Results

```json
{
  "success": true,
  "tool": "run_tests",
  "duration": 3400,
  "summary": "12/12 passed",
  "output": { "testResult": {...}, "stdout": "..." }
}
```

## Security

- Every file path resolved relative to `projectPath`, rejects `..`, absolute, symlinks escaping
- `search_code` ignores sensitive dirs, `read_file` enforces size/encoding
- `run_command` allowlist prevents host access, sudo, docker socket, credential access

