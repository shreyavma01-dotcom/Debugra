export type AgentStatus = 'CREATED'|'INITIALIZING'|'ANALYZING'|'PLANNING'|'EXECUTING'|'TESTING'|'EVALUATING'|'REPLANNING'|'VERIFYING'|'VERIFIED'|'FAILED'|'STOPPED'|'TIMEOUT';

export interface ToolCallRequest {
  tool: string;
  args: Record<string, any>;
  summary?: string;
}

export interface ToolResult {
  success: boolean;
  tool: string;
  duration: number;
  summary: string;
  output: any;
  error?: string;
}

export interface AgentContext {
  runId: string;
  goal: string;
  projectMeta: any;
  workspacePath: string;
  projectPath: string;
  previousActions: any[];
  testResults: any[];
  changedFiles: string[];
  attempt: number;
  replanCount: number;
}
