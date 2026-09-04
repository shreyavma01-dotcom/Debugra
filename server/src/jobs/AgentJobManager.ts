import { v4 as uuidv4 } from 'uuid';
import { jobRegistry } from './JobRegistry';
import { agentController } from '../agent/AgentController';
import { env } from '../config/env';

export class AgentJobManager {
  async createRun(project: any, goal: string, ownerId: string) {
    const runId = uuidv4();
    const run: any = {
      runId,
      projectId: project.projectId,
      ownerId,
      goal,
      status: 'CREATED',
      stepCount: 0,
      maxSteps: env.MAX_AGENT_STEPS,
      attempts: 0,
      replans: 0,
      baselineResult: null,
      finalResult: null,
      changedFiles: [],
      workspacePath: project.workspacePath,
      projectPath: project.projectPath,
      detectedMeta: project.meta,
      startedAt: new Date().toISOString(),
      diff: ''
    };
    jobRegistry.createRun(run);
    // start agent asynchronously
    const opts = {
      runId,
      projectId: project.projectId,
      goal,
      workspacePath: project.workspacePath,
      projectPath: project.projectPath,
      projectMeta: project.meta,
      maxSteps: env.MAX_AGENT_STEPS,
      maxRetries: env.MAX_AGENT_RETRIES,
    };
    agentController.startRun(opts, jobRegistry);
    return run;
  }
  getRun(id:string){ return jobRegistry.getRun(id); }
  getAllRuns(){ return jobRegistry.getAllRuns(); }
  getActions(id:string){ return jobRegistry.getActions(id); }
  async stopRun(id:string){
    const run = jobRegistry.getRun(id);
    if (!run) throw new Error('Run not found');
    if (['VERIFIED','FAILED','STOPPED','TIMEOUT'].includes(run.status)) return run;
    await jobRegistry.updateRun(id, { status: 'STOPPED', completedAt: new Date().toISOString() });
    return jobRegistry.getRun(id);
  }
}
export const agentJobManager = new AgentJobManager();
