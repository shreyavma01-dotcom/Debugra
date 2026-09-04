import { execFile } from 'child_process';
import { promisify } from 'util';
import { env } from '../config/env';
const execAsync = promisify(execFile);

export function createGitDiffTool() {
  return {
    name: 'git_diff',
    description: 'Show git diff of current changes vs baseline',
    permission: 'SAFE' as const,
    inputSchema: { type: 'object', properties: {} },
    execute: async (args:any, ctx:any) => {
      try {
        const { stdout } = await execAsync('git', ['diff', 'HEAD'], { cwd: ctx.projectPath, windowsHide: true, maxBuffer: env.MAX_DIFF_BYTES });
        const stat = await execAsync('git', ['diff', '--stat', 'HEAD'], { cwd: ctx.projectPath, windowsHide: true, maxBuffer: 64 * 1024 });
        return { summary: `Diff ${stdout.length} chars`, output: { diff: stdout.slice(0,15000), stat: stat.stdout } };
      } catch (e:any) {
        return { summary: 'No diff or git error', output: { diff: '', error: 'git diff unavailable' } };
      }
    }
  };
}
