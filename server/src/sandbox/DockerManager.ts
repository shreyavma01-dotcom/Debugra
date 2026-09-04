import { execFile } from 'child_process';
import { promisify } from 'util';
import { env } from '../config/env';
const execAsync = promisify(execFile);

/**
 * Docker sandbox execution. All docker invocations use execFile with an
 * explicit argument array and NO shell, so no value can be interpolated into
 * a shell command line.
 *
 * Container hardening:
 *  - non-root user (baked into sandbox/Dockerfile image)
 *  - --network none (no internet, no internal network, no metadata services)
 *  - memory / CPU / PIDs limits
 *  - --cap-drop ALL, no-new-privileges
 *  - no docker socket, no host root mounts (only the run workspace bind mount)
 *  - no secrets in container environment (minimal env only)
 */
export class DockerManager {
  async isAvailable(): Promise<boolean> {
    try {
      await execAsync('docker', ['--version'], { timeout: 3000, windowsHide: true });
      return true;
    } catch { return false; }
  }

  async createContainer(name: string, workspaceHostPath: string, image = env.SANDBOX_IMAGE): Promise<string> {
    const hostPath = workspaceHostPath.replace(/\\/g, '/');
    const args = [
      'run', '-d',
      '--name', name,
      '--memory', env.SANDBOX_MEMORY_LIMIT,
      '--memory-swap', env.SANDBOX_MEMORY_LIMIT,
      '--cpus', env.SANDBOX_CPU_LIMIT,
      '--pids-limit', String(env.SANDBOX_PIDS_LIMIT),
      '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges',
      '--ulimit', 'nofile=256:256',
      // network isolation: no internet, no LAN, no host services, no metadata
      '--network', env.SANDBOX_NETWORK_ENABLED ? 'bridge' : 'none',
      '-v', `${hostPath}:/workspace`,
      '-w', '/workspace',
      '-e', 'NODE_ENV=sandbox',
      '-e', 'CI=true',
      image,
      'tail', '-f', '/dev/null'
    ];
    const { stdout } = await execAsync('docker', args, { timeout: 30000, windowsHide: true, maxBuffer: 1024 * 1024 });
    return stdout.trim();
  }

  async execInContainer(name: string, tokens: string[], timeout = 60000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // tokens are already validated + allowlisted by the ExecutionPolicy
    const args = ['exec', name, ...tokens];
    try {
      const { stdout, stderr } = await execAsync('docker', args, {
        timeout,
        windowsHide: true,
        maxBuffer: env.SANDBOX_MAX_OUTPUT_BYTES
      });
      return { stdout: stdout?.toString() || '', stderr: stderr?.toString() || '', exitCode: 0 };
    } catch (e: any) {
      return {
        stdout: e.stdout?.toString() || '',
        stderr: e.stderr?.toString() || e.message || '',
        exitCode: typeof e.code === 'number' ? e.code : (e.killed ? 124 : 1)
      };
    }
  }

  async stopAndRemove(name: string) {
    // name is server-generated (uuid-derived) and validated at creation
    if (!/^debugra-[a-zA-Z0-9-]+$/.test(name)) return;
    try { await execAsync('docker', ['rm', '-f', name], { timeout: 15000, windowsHide: true }); } catch {}
  }
}
export const dockerManager = new DockerManager();

