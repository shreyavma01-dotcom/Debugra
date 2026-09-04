import { sandboxManager } from '../sandbox/SandboxManager';
import { parseCommand } from '../sandbox/ExecutionPolicy';

export function createRunCommandTool() {
  return {
    name: 'run_command',
    description: 'Run an allowed command inside the sandbox (npm test/install, npm run <script>, npx jest/vitest, node <file>, git status/diff/log)',
    permission: 'EXEC' as const,
    inputSchema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
    execute: async (args:any, ctx:any) => {
      const sandbox = ctx.sandbox;
      if (!sandbox) throw new Error('No sandbox');
      if (!args.command || typeof args.command !== 'string') throw new Error('command required (string)');
      // pre-validate with allowlist (sandboxManager validates again before exec)
      const check = parseCommand(args.command);
      if (!check.allowed) throw new Error(`Command rejected: ${check.reason}`);
      const result = await sandboxManager.exec(sandbox, args.command, 60000);
      ctx.recentLogs = ctx.recentLogs||[];
      ctx.recentLogs.push({ type:'command', command: args.command, exitCode: result.exitCode });
      return { summary: `Command "${args.command.slice(0,100)}" exit ${result.exitCode}`, output: { stdout: result.stdout.slice(0,5000), stderr: result.stderr.slice(0,5000), exitCode: result.exitCode, duration: result.duration } };
    }
  };
}
