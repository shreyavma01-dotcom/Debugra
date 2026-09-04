export interface AgentRun {
  runId: string;
  projectId: string;
  goal: string;
  status: string;
  stepCount: number;
  maxSteps: number;
  attempts: number;
  replans: number;
  baselineResult?: any;
  finalResult?: any;
  changedFiles: string[];
  startedAt: string;
  completedAt?: string;
  error?: string;
  diff?: string;
}
