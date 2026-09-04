export interface ToolDefinition {
  name: string;
  description: string;
  permission: 'SAFE'|'EXEC'|'WRITE';
  inputSchema: any;
  execute: (args: any, ctx: any) => Promise<any>;
}

const VALID_TOOL_NAME = /^[a-z_]{1,40}$/;
const MAX_ARG_JSON_BYTES = 1024 * 1024; // 1MB of tool arguments maximum

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  register(tool: ToolDefinition) {
    if (!VALID_TOOL_NAME.test(tool.name)) throw new Error(`Invalid tool name: ${tool.name}`);
    this.tools.set(tool.name, tool);
  }
  get(name: string) { return this.tools.get(name); }
  list() { return Array.from(this.tools.values()); }
  definitionsForLLM() {
    return this.list().map(t=>({ name: t.name, description: t.description, parameters: t.inputSchema }));
  }

  /**
   * Execute a tool proposed by an UNTRUSTED source (Gemini output or heuristic
   * fallback). The tool name, arguments, paths and contents are never trusted:
   *  - the tool must exist in the registry (no hallucinated tools)
   *  - arguments must be a plain object under a hard size cap
   *  - each tool implementation re-validates its own inputs (paths via the
   *    central path guard, commands via the ExecutionPolicy allowlist)
   */
  async execute(name: string, args:any, ctx:any) {
    if (typeof name !== 'string' || !VALID_TOOL_NAME.test(name)) {
      return { success: false, tool: String(name).slice(0,40), duration: 0, error: 'Invalid tool name', summary: 'Rejected invalid tool call' };
    }
    const tool = this.get(name);
    if (!tool) {
      return { success: false, tool: name, duration: 0, error: `Tool not found: ${name}`, summary: `Rejected unknown tool: ${name}` };
    }
    if (args === null || typeof args !== 'object' || Array.isArray(args)) {
      return { success: false, tool: name, duration: 0, error: 'Tool arguments must be an object', summary: 'Rejected invalid tool arguments' };
    }
    try {
      if (JSON.stringify(args).length > MAX_ARG_JSON_BYTES) {
        return { success: false, tool: name, duration: 0, error: 'Tool arguments too large', summary: 'Rejected oversized tool arguments' };
      }
    } catch {
      return { success: false, tool: name, duration: 0, error: 'Tool arguments not serializable', summary: 'Rejected invalid tool arguments' };
    }
    const start = Date.now();
    try {
      const result = await tool.execute(args, ctx);
      return { success: true, tool: name, duration: Date.now()-start, ...result };
    } catch (e:any) {
      return { success: false, tool: name, duration: Date.now()-start, error: e.message, summary: `Tool ${name} failed: ${e.message}` };
    }
  }
}
