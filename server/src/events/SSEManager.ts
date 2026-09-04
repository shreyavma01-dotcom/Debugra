import { Request, Response } from 'express';
import { eventBus } from './EventBus';
import { jobRegistry } from '../jobs/JobRegistry';
import { checkOwner } from '../middleware/auth';

const MAX_EVENT_PAYLOAD = 64 * 1024; // never stream oversized/malicious payloads
const MAX_LISTENERS_PER_RUN = 200;

// In-process connection tracker so a single run cannot be flooded with
// unlimited SSE subscriptions (which would buffer memory indefinitely).
const activeConnections = new Map<string, Set<Response>>();

function trackedSend(res: Response, data: any) {
  let payload: string;
  try {
    payload = JSON.stringify(data);
  } catch {
    payload = JSON.stringify({ type: 'error', error: 'Event not serializable' });
  }
  if (Buffer.byteLength(payload, 'utf8') > MAX_EVENT_PAYLOAD) {
    payload = JSON.stringify({ type: 'error', error: 'Event payload too large' });
  }
  res.write(`data: ${payload}\n\n`);
}

export function sseHandler(req: Request, res: Response) {
  const runId = req.params.id;

  // validate the run exists AND caller owns it (IDOR protection on the stream)
  const run = jobRegistry.getRun(runId);
  const auth = checkOwner(run?.ownerId, req.ownerId);
  if (!auth.authorized) {
    res.setHeader('Content-Type', 'application/json');
    res.status(auth.code === 'NOT_FOUND' ? 404 : 403);
    res.end(JSON.stringify({ success: false, error: { code: auth.code, message: auth.code === 'NOT_FOUND' ? 'Run not found' : 'Forbidden' } }));
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const listener = (event: any) => trackedSend(res, event);
  eventBus.on(`run:${runId}`, listener);

  const set = activeConnections.get(runId) || new Set();
  set.add(res);
  activeConnections.set(runId, set);
  if (set.size > MAX_LISTENERS_PER_RUN) {
    const arr = Array.from(set);
    arr[0].end();
    set.delete(arr[0]);
  }

  trackedSend(res, { type: 'connected', runId, timestamp: new Date().toISOString() });

  const keepalive = setInterval(() => {
    res.write(`: keepalive\n\n`);
  }, 15000);

  const cleanup = () => {
    clearInterval(keepalive);
    eventBus.off(`run:${runId}`, listener);
    set.delete(res);
    if (set.size === 0) activeConnections.delete(runId);
    res.end();
  };

  req.on('close', cleanup);
  req.on('aborted', cleanup);
  req.on('error', cleanup);
  res.on('error', cleanup);
}
