import { AgentStatus } from '../models/AgentRun';

const validTransitions: Record<AgentStatus, AgentStatus[]> = {
  CREATED: ['INITIALIZING','FAILED','STOPPED'],
  INITIALIZING: ['ANALYZING','FAILED','STOPPED'],
  ANALYZING: ['PLANNING','EXECUTING','TESTING','FAILED','STOPPED'],
  PLANNING: ['EXECUTING','FAILED','STOPPED'],
  EXECUTING: ['TESTING','EVALUATING','REPLANNING','FAILED','STOPPED'],
  TESTING: ['EVALUATING','FAILED','STOPPED'],
  EVALUATING: ['REPLANNING','VERIFYING','EXECUTING','FAILED','STOPPED'],
  REPLANNING: ['EXECUTING','PLANNING','FAILED','STOPPED'],
  VERIFYING: ['VERIFIED','FAILED','STOPPED'],
  VERIFIED: [],
  FAILED: [],
  STOPPED: [],
  TIMEOUT: []
};

export class AgentState {
  private status: AgentStatus;
  private history: { from: AgentStatus; to: AgentStatus; at: string }[] = [];
  constructor(initial: AgentStatus = 'CREATED') { this.status = initial; }
  get(): AgentStatus { return this.status; }
  canTransition(to: AgentStatus): boolean {
    return (validTransitions[this.status] || []).includes(to);
  }
  transition(to: AgentStatus): boolean {
    if (this.status === to) return true;
    if (!this.canTransition(to)) {
      // allow forced transition to FAILED/TIMEOUT/STOPPED from any
      if (['FAILED','STOPPED','TIMEOUT','VERIFIED'].includes(to)) {
        this.history.push({ from: this.status, to, at: new Date().toISOString() });
        this.status = to;
        return true;
      }
      return false;
    }
    this.history.push({ from: this.status, to, at: new Date().toISOString() });
    this.status = to;
    return true;
  }
  force(to: AgentStatus) {
    this.history.push({ from: this.status, to, at: new Date().toISOString() });
    this.status = to;
  }
  getHistory() { return this.history; }
}
