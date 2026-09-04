import { AgentRun, AgentAction } from '../models/AgentRun';

class JobRegistry {
  private runs = new Map<string, AgentRun>();
  private actions = new Map<string, AgentAction[]>();
  private projects = new Map<string, any>();

  createProject(proj:any){ this.projects.set(proj.projectId, proj); return proj; }
  getProject(id:string){ return this.projects.get(id); }

  createRun(run: AgentRun){ this.runs.set(run.runId, run); this.actions.set(run.runId, []); return run; }
  getRun(id:string){ return this.runs.get(id); }
  getAllRuns(){ return Array.from(this.runs.values()).sort((a,b)=> new Date(b.startedAt).getTime()-new Date(a.startedAt).getTime()); }
  async updateRun(id:string, patch:any){
    const run = this.runs.get(id);
    if (!run) return;
    Object.assign(run, patch);
    this.runs.set(id, run);
  }
  async addAction(action: AgentAction){
    const list = this.actions.get(action.runId) || [];
    list.push(action);
    this.actions.set(action.runId, list);
  }
  getActions(runId:string){ return this.actions.get(runId) || []; }
}

export const jobRegistry = new JobRegistry();
