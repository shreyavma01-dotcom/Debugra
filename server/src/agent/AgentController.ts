import { runAgentLoop } from './AgentLoop';

export class AgentController {
  async startRun(opts: any, store: any) {
    // fire and forget, but handle promise
    setImmediate(() => {
      runAgentLoop(opts, store).catch(e=> console.error('Agent loop unhandled', e));
    });
  }
}
export const agentController = new AgentController();
