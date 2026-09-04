import { EventEmitter } from 'events';

class EventBus extends EventEmitter {
  emitRunEvent(runId: string, type: string, data: any = {}) {
    const event = { type, runId, timestamp: new Date().toISOString(), ...data };
    this.emit(`run:${runId}`, event);
    this.emit('event', event);
    // console log
    console.log(`[run:${runId}] [${type}] ${data.summary || ''}`);
  }
}

export const eventBus = new EventBus();
