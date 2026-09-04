import { sandboxManager } from '../sandbox/SandboxManager';
import { parseCommand } from '../sandbox/ExecutionPolicy';

export function createRunLinterTool() {
  return {
    name: 'run_linter',
    description: 'Run linter inside sandbox',
    permission: 'EXEC' as const,
    inputSchema: { type: 'object', properties: { command: { type: 'string' } } },
    execute: async (args:any, ctx:any) => {
      const sandbox = ctx.sandbox;
      if (!sandbox) throw new Error('No sandbox');
      const cmd = args.command || ctx.projectMeta?.lintCommand || 'npm run lint';
      // pre-validate the shape even though sandboxManager re-validates
      const check = parseCommand(String(cmd));
      if (!check.allowed) throw new Error(`Linter command rejected: ${check.reason}`);
      const result = await sandboxManager.exec(sandbox, String(cmd), 60000);
      return { summary: `Linter exit ${result.exitCode}`, output: { stdout: result.stdout.slice(0,5000), stderr: result.stderr.slice(0,5000), exitCode: result.exitCode } };
    }
  };
}
