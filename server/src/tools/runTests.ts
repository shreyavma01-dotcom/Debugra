import { sandboxManager } from '../sandbox/SandboxManager';

export function createRunTestsTool() {
  return {
    name: 'run_tests',
    description: 'Run the project test suite inside sandbox',
    permission: 'EXEC' as const,
    inputSchema: { type: 'object', properties: { command: { type: 'string' }, filter: { type: 'string' } } },
    execute: async (args:any, ctx:any) => {
      const sandbox = ctx.sandbox;
      if (!sandbox) throw new Error('No sandbox');
      let cmd = args.command || ctx.projectMeta?.testCommand || 'npm test';
      // a test filter is UNTRUSTED input from the model: only allow a safe
      // word-like token appended as a separate argument (no shell concat)
      if (args.filter !== undefined && args.filter !== null && args.filter !== '') {
        if (typeof args.filter !== 'string' || !/^[\w./:@-]{1,100}$/.test(args.filter)) {
          throw new Error('Invalid test filter');
        }
        cmd += ` -- ${args.filter}`;
      }
      const isVitest = ctx.projectMeta?.testCommand?.includes('vitest') || false;
      void isVitest;
      const result = await sandboxManager.exec(sandbox, cmd, 90000);
      // parse results naive
      const combined = result.stdout + '\n' + result.stderr;
      let passed=0, failed=0, total=0;
      const m3 = combined.match(/(\d+)\s+passed/);
      const m4 = combined.match(/(\d+)\s+failed/);
      if (m4) failed = parseInt(m4[1],10);
      if (m3) passed = parseInt(m3[1],10);
      const tm = combined.match(/Tests:\s*(?:(\d+)\s+failed,\s*)?(\d+)\s+passed(?:,\s*(\d+)\s+total)?/);
      if (tm) {
        failed = tm[1] ? parseInt(tm[1],10): failed;
        passed = parseInt(tm[2],10);
        if (tm[3]) total = parseInt(tm[3],10);
      }
      if (!passed && !failed) {
        if (result.exitCode===0 && combined.includes('PASS')) passed=1;
        else if (result.exitCode!==0) failed=1;
      }
      if (!total) total = passed+failed;
      const testResult = { runId: ctx.runId, attempt: ctx.attempt||0, command: cmd, exitCode: result.exitCode, passed, failed, total, stdout: result.stdout.slice(0,10000), stderr: result.stderr.slice(0,10000), duration: result.duration, timestamp: new Date().toISOString() };
      if (ctx.testResults) ctx.testResults.push(testResult);
      ctx.recentLogs = ctx.recentLogs||[];
      ctx.recentLogs.push({ type:'test', command: cmd, exitCode: result.exitCode, summary: `${passed}/${total} passed` });
      return { summary: `${passed}/${total} passed, ${failed} failed (exit ${result.exitCode})`, output: { testResult, stdout: result.stdout.slice(0,5000), stderr: result.stderr.slice(0,5000), exitCode: result.exitCode } };
    }
  };
}
