import path from 'path';
import fs from 'fs';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import { parseCommand } from './ExecutionPolicy';
import { dockerManager } from './DockerManager';
import { env } from '../config/env';
const execAsync = promisify(execFile);

export interface Sandbox {
  id: string;
  workspacePath: string;
  projectPath: string;
  containerName?: string;
  useDocker: boolean;
}

export class SandboxUnavailableError extends Error {
  code = 'SANDBOX_UNAVAILABLE';
  constructor(message = 'Sandbox is unavailable.') {
    super(message);
    this.name = 'SandboxUnavailableError';
  }
}

/**
 * Explicit minimal environment passed to executed processes.
 * NEVER pass process.env into uploaded/untrusted code — it would leak
 * GEMINI_API_KEY, MONGODB_URI and any other deployment secrets.
 */
function sandboxEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'sandbox',
    PATH: process.env.PATH || process.env.Path || '',
    HOME: process.env.HOME || process.env.USERPROFILE || '',
    NO_COLOR: '1',
    CI: 'true'
  };
}

export class SandboxManager {
  async create(workspacePath: string, projectPath: string, runId: string): Promise<Sandbox> {
    const dockerRequested = env.SANDBOX_MODE === 'docker';
    let containerName: string | undefined;
    let useDocker = false;

    if (dockerRequested) {
      const available = await dockerManager.isAvailable();
      if (!available) {
        if (!env.SANDBOX_ALLOW_LOCAL_FALLBACK) {
          // FAIL CLOSED: never silently execute untrusted code on the host.
          throw new SandboxUnavailableError();
        }
        console.warn('[sandbox] Docker unavailable — explicit local fallback enabled (development/demo only)');
      } else {
        containerName = `debugra-${runId.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40)}`;
        try {
          await dockerManager.createContainer(containerName, workspacePath);
          useDocker = true;
        } catch (e) {
          if (!env.SANDBOX_ALLOW_LOCAL_FALLBACK) {
            console.warn('[sandbox] Docker container creation failed — failing closed');
            throw new SandboxUnavailableError();
          }
          console.warn('[sandbox] Docker create failed, explicit local fallback enabled', e instanceof Error ? e.message : e);
        }
      }
    }
    // init git baseline
    await this.ensureGitBaseline(projectPath);
    return { id: runId, workspacePath, projectPath, containerName, useDocker };
  }

  private async ensureGitBaseline(projectPath: string) {
    try {
      const exists = fs.existsSync(path.join(projectPath, '.git'));
      const git = (args: string[]) => execAsync('git', args, { cwd: projectPath, windowsHide: true });
      if (!exists) {
        await git(['init']);
        await git(['config', 'user.email', 'debugra@local']);
        await git(['config', 'user.name', 'Debugra']);
        await git(['add', '-A']);
        await git(['commit', '-m', 'baseline', '--allow-empty']);
      } else {
        try { await git(['rev-parse', 'HEAD']); }
        catch {
          await git(['add', '-A']);
          await git(['commit', '-m', 'baseline', '--allow-empty']);
        }
      }
    } catch (e) { console.warn('git baseline failed', e instanceof Error ? e.message : e); }
  }

  async exec(sandbox: Sandbox, command: string, timeout = 60000): Promise<{ stdout:string, stderr:string, exitCode:number, duration:number }> {
    const check = parseCommand(command);
    if (!check.allowed) {
      return { stdout:'', stderr:`Execution blocked: ${check.reason}`, exitCode: 127, duration: 0 };
    }
    const start = Date.now();
    let result: { stdout:string, stderr:string, exitCode:number };
    if (sandbox.useDocker && sandbox.containerName) {
      result = await dockerManager.execInContainer(sandbox.containerName, check.tokens, timeout);
    } else {
      result = await this.execLocal(check.tokens, sandbox.projectPath, timeout);
    }
    const duration = Date.now() - start;
    const max = 20000;
    if (result.stdout.length > max) result.stdout = result.stdout.slice(0,max)+'\n...truncated';
    if (result.stderr.length > max) result.stderr = result.stderr.slice(0,max)+'\n...truncated';
    return { ...result, duration };
  }

  /**
   * Execute validated tokens with shell DISABLED, capped output and full
   * process-tree cleanup on timeout. Never concatenate input into a shell
   * string.
   */
  private execLocal(tokens: string[], cwd: string, timeout: number): Promise<{ stdout: string, stderr: string, exitCode: number }> {
    return new Promise((resolve) => {
      const child = spawn(tokens[0], tokens.slice(1), {
        cwd,
        env: sandboxEnv(),
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      let stdout = '';
      let stderr = '';
      let killed = false;
      const cap = env.SANDBOX_MAX_OUTPUT_BYTES;
      child.stdout?.on('data', (d: Buffer) => { if (stdout.length < cap) stdout += d.toString('utf8'); });
      child.stderr?.on('data', (d: Buffer) => { if (stderr.length < cap) stderr += d.toString('utf8'); });
      const timer = setTimeout(() => {
        killed = true;
        this.killProcessTree(child.pid);
      }, timeout);
      child.on('error', (e) => {
        clearTimeout(timer);
        resolve({ stdout, stderr: (stderr ? stderr + '\n' : '') + `spawn error: ${e.message}`, exitCode: 1 });
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (killed) {
          resolve({ stdout, stderr: stderr + '\nProcess terminated: execution timeout', exitCode: 124 });
        } else {
          resolve({ stdout, stderr, exitCode: code ?? 1 });
        }
      });
    });
  }

  /** Kill the entire process tree, not just the parent. */
  private killProcessTree(pid: number | undefined) {
    if (!pid) return;
    if (process.platform === 'win32') {
      // /T = tree kill, /F = force
      spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    } else {
      try {
        try { process.kill(-pid, 'SIGKILL'); } catch { process.kill(pid, 'SIGKILL'); }
      } catch { /* best effort */ }
    }
  }

  async cleanup(sandbox: Sandbox) {
    if (sandbox.useDocker && sandbox.containerName) {
      await dockerManager.stopAndRemove(sandbox.containerName);
    }
  }

  async destroyWorkspace(workspacePath: string) {
    try {
      // only ever delete inside the server workspaces root
      const wsRoot = path.resolve(__dirname, '../../workspaces');
      const resolved = path.resolve(workspacePath);
      if (!resolved.startsWith(wsRoot + path.sep)) return;
      fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 2 });
    } catch {}
  }
}
export const sandboxManager = new SandboxManager();

