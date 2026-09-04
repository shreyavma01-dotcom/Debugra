import { validateRelativePath } from '../security/pathGuard';

/**
 * COMMAND ALLOWLIST — the primary security mechanism for command execution.
 *
 * Rules:
 *  1. The command is tokenized and NEVER executed through a shell.
 *  2. Shell metacharacters are rejected outright (no `;`, `|`, `&`, backticks,
 *     `$()`, redirections, newlines) — no concatenation can smuggle a second
 *     command past this policy.
 *  3. The first token must be an explicitly allowed executable.
 *  4. Each allowed executable only permits explicitly allowed subcommands.
 *  5. `npm install` / `npm ci` are forced to `--ignore-scripts` so package
 *     lifecycle scripts (preinstall/install/postinstall/prepare) never run
 *     (see docs/security.md — "Package installation security").
 *  6. `node` may only execute an existing project file — no `-e`/`--eval`/
 *     `-p`/`-r` code-evaluation or require flags.
 *
 * This is an allowlist, NOT a blacklist. Anything not explicitly permitted
 * is rejected.
 */

export interface ParsedCommand {
  allowed: boolean;
  reason?: string;
  tokens: string[];
}

const ALLOWED_EXECUTABLES = new Set(['npm', 'npx', 'node', 'git', 'yarn', 'pnpm']);
const NPM_DIRECT_SUBCOMMANDS = new Set(['test', 'install', 'ci']);
const NPX_ALLOWED_TOOLS = new Set(['jest', 'vitest', 'tsc', 'eslint']);
const GIT_ALLOWED_SUBCOMMANDS = new Set(['status', 'diff', 'log']);
const NODE_ALLOWED_FLAGS = new Set(['--version', '-v']);
const SHELL_METACHARS = /[;&|<>()`$\n\r]/;
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

/** Simple shell-like tokenizer (whitespace split with double-quote support). */
export function tokenizeCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of command) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (/\s/.test(ch) && !inQuotes) {
      if (current.length > 0) tokens.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (inQuotes) throw new Error('Unbalanced quotes in command');
  if (current.length > 0) tokens.push(current);
  return tokens;
}

export function parseCommand(command: string, opts?: { allowedScripts?: string[] }): ParsedCommand {
  if (!command || typeof command !== 'string') {
    return { allowed: false, reason: 'Empty command', tokens: [] };
  }
  const trimmed = command.trim();
  if (trimmed.length === 0 || trimmed.length > 500) {
    return { allowed: false, reason: 'Command empty or too long', tokens: [] };
  }
  if (SHELL_METACHARS.test(trimmed)) {
    return { allowed: false, reason: 'Shell metacharacters are not permitted', tokens: [] };
  }
  let tokens: string[];
  try {
    tokens = tokenizeCommand(trimmed);
  } catch (e: any) {
    return { allowed: false, reason: e.message, tokens: [] };
  }
  if (tokens.length === 0) return { allowed: false, reason: 'Empty command', tokens: [] };
  if (ENV_ASSIGNMENT.test(tokens[0])) {
    return { allowed: false, reason: 'Environment assignment prefixes are not permitted', tokens: [] };
  }
  const executable = tokens[0];
  if (!ALLOWED_EXECUTABLES.has(executable)) {
    return { allowed: false, reason: `Executable not in allowlist: ${executable}`, tokens };
  }
  const args = tokens.slice(1);

  switch (executable) {
    case 'npm':
    case 'pnpm':
    case 'yarn': {
      const sub = args[0];
      if (NPM_DIRECT_SUBCOMMANDS.has(sub)) {
        const out = [executable, sub, ...args.slice(1)];
        if (sub === 'install' || sub === 'ci') {
          // SECURITY: lifecycle scripts of untrusted packages must never run.
          if (!out.includes('--ignore-scripts')) out.push('--ignore-scripts');
        }
        return { allowed: true, tokens: out };
      }
      if (sub === 'run') {
        const script = args[1];
        if (!script || /[^\w:@\/\-.]/.test(script)) {
          return { allowed: false, reason: 'Invalid npm script name', tokens };
        }
        if (opts?.allowedScripts && !opts.allowedScripts.includes(script)) {
          return { allowed: false, reason: `npm script not declared in package.json: ${script}`, tokens };
        }
        return { allowed: true, tokens: [executable, 'run', script, ...args.slice(2)] };
      }
      return { allowed: false, reason: `npm subcommand not allowed: ${sub}`, tokens };
    }
    case 'npx': {
      const tool = args[0];
      if (!NPX_ALLOWED_TOOLS.has(tool)) {
        return { allowed: false, reason: `npx tool not allowed: ${tool}`, tokens };
      }
      return { allowed: true, tokens };
    }
    case 'node': {
      const first = args[0];
      if (!first) return { allowed: false, reason: 'node requires a file argument', tokens };
      if (first.startsWith('-')) {
        if (!NODE_ALLOWED_FLAGS.has(first)) {
          return { allowed: false, reason: `node flag not allowed: ${first}`, tokens };
        }
        return { allowed: true, tokens };
      }
      try {
        validateRelativePath(first);
      } catch (e: any) {
        return { allowed: false, reason: `Invalid node target: ${e.message}`, tokens };
      }
      if (!/\.(js|mjs|cjs|ts)$/.test(first)) {
        return { allowed: false, reason: 'node may only execute .js/.mjs/.cjs/.ts files in the project', tokens };
      }
      return { allowed: true, tokens };
    }
    case 'git': {
      const sub = args[0];
      if (!GIT_ALLOWED_SUBCOMMANDS.has(sub)) {
        return { allowed: false, reason: `git subcommand not allowed: ${sub}`, tokens };
      }
      return { allowed: true, tokens };
    }
    default:
      return { allowed: false, reason: 'Command not allowed', tokens };
  }
}

/** Backwards-compatible boolean check. */
export function isCommandAllowed(command: string): { allowed: boolean; reason?: string } {
  const parsed = parseCommand(command);
  return { allowed: parsed.allowed, reason: parsed.reason };
}

