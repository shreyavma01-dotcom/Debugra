export type AgentStatus = 'CREATED'|'INITIALIZING'|'ANALYZING'|'PLANNING'|'EXECUTING'|'TESTING'|'EVALUATING'|'REPLANNING'|'VERIFYING'|'VERIFIED'|'FAILED'|'STOPPED'|'TIMEOUT';

export interface TestResult {
  runId: string;
  attempt: number;
  command: string;
  exitCode: number | null;
  passed: number;
  failed: number;
  total: number;
  stdout: string;
  stderr: string;
  duration: number;
  timestamp: string;
}

export interface AgentAction {
  runId: string;
  step: number;
  type: string;
  tool: string;
  summary: string;
  status: 'PENDING'|'SUCCESS'|'FAILED';
  duration?: number;
  input?: any;
  output?: any;
  timestamp: string;
}

export interface AgentRun {
  runId: string;
  projectId: string;
  goal: string;
  status: AgentStatus;
  stepCount: number;
  maxSteps: number;
  attempts: number;
  replans: number;
  baselineResult?: TestResult | null;
  finalResult?: TestResult | null;
  changedFiles: string[];
  workspacePath: string;
  projectPath: string;
  detectedMeta?: any;
    startedAt: string;
  completedAt?: string;
  error?: string;
  diff?: string;
  ownerId: string;
}
