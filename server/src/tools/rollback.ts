import { execFile } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(execFile);

export function createRollbackTool() {
  return {
    name: 'rollback',
    description: 'Rollback all changes to last baseline commit',
    permission: 'WRITE' as const,
    inputSchema: { type: 'object', properties: { hard: { type: 'boolean' } } },
    execute: async (args:any, ctx:any) => {
      // rollback is strictly scoped to the current run's workspace (ctx.projectPath
      // is a server-generated workspace path, never client input)
      try {
        await execAsync('git', ['reset', '--hard', 'HEAD'], { cwd: ctx.projectPath, windowsHide: true });
        await execAsync('git', ['clean', '-fd'], { cwd: ctx.projectPath, windowsHide: true });
        ctx.changedFiles = new Set();
        return { summary: 'Rolled back to baseline', output: { success: true } };
      } catch (e:any) {
        throw new Error(`Rollback failed: ${(e.message || '').slice(0,200)}`);
      }
    }
  };
}
