export function createReadLogsTool() {
  return {
    name: 'read_logs',
    description: 'Get recent stdout/stderr from previous tool executions and test runs',
    permission: 'SAFE' as const,
    inputSchema: { type: 'object', properties: { lastN: { type: 'number' } } },
    execute: async (args:any, ctx:any) => {
      const logs = (ctx.recentLogs || []).slice(-(args.lastN||10));
      return { summary: `Retrieved ${logs.length} log entries`, output: { logs } };
    }
  };
}
