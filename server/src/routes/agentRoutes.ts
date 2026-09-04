import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { agentJobManager } from '../jobs/AgentJobManager';
import { jobRegistry } from '../jobs/JobRegistry';
import { sseHandler } from '../events/SSEManager';
import { validateRunId, validateCreateRun } from '../middleware/validation';
import { runRateLimiter } from '../middleware/rateLimit';
import { checkOwner } from '../middleware/auth';
import { env } from '../config/env';

const execAsync = promisify(execFile);
const router = Router();
const SENSITIVE_NAME = /^\.env($|\.)/i; // never ship env files in downloads

function authorizeRun(req:any) {
  const run = jobRegistry.getRun(req.params.id);
  const auth = checkOwner(run?.ownerId, req.ownerId);
  if (!auth.authorized) {
    return { run: null, error: { status: auth.code === 'NOT_FOUND' ? 404 : 403, code: auth.code, message: auth.code === 'NOT_FOUND' ? 'Run not found' : 'Forbidden' } };
  }
  if (!run) return { run: null, error: { status: 404, code: 'NOT_FOUND', message: 'Run not found' } };
  return { run, error: null };
}

// POST /agent/runs — validate body (uuid + goal length), rate-limited, ownership-tagged
router.post('/runs', runRateLimiter, validateCreateRun, (req,res)=> {
  const { projectId, goal } = req.body;
  const project = jobRegistry.getProject(projectId);
  const auth = checkOwner(project?.ownerId, req.ownerId);
  if (!auth.authorized) {
    return res.status(auth.code === 'NOT_FOUND' ? 404 : 403).json({ success:false, error:{ code: auth.code, message: auth.code === 'NOT_FOUND' ? 'Project not found' : 'Forbidden' } });
  }
  if (!project) return res.status(404).json({ success:false, error:{ code:'PROJECT_NOT_FOUND', message:'Project not found' } });
  agentJobManager.createRun(project, goal, req.ownerId).then((run:any)=> {
    res.status(201).json({ success:true, data: { runId: run.runId, projectId: run.projectId, status: run.status, startedAt: run.startedAt } });
  }).catch((e:any)=> {
    res.status(500).json({ success:false, error:{ code: e.code || 'RUN_ERROR', message: e.message || 'Failed to create run' } });
  });
});

// list only the caller's own runs (no cross-user leakage)
router.get('/runs', (req,res)=> {
  const runs = agentJobManager.getAllRuns().filter((r:any)=> r.ownerId === req.ownerId);
  res.json({ success:true, data: runs });
});

// GET /runs/:id — ownership-checked; server paths never leaked
router.get('/runs/:id', validateRunId, (req,res)=> {
  const { run, error } = authorizeRun(req);
  if (error) return res.status(error.status).json({ success:false, error:{ code:error.code, message:error.message } });
  res.json({ success:true, data: { runId: run.runId, projectId: run.projectId, goal: run.goal, status: run.status, stepCount: run.stepCount, attempts: run.attempts, replans: run.replans, startedAt: run.startedAt, completedAt: run.completedAt } });
});

router.get('/runs/:id/actions', validateRunId, (req,res)=> {
  const { run, error } = authorizeRun(req);
  if (error) return res.status(error.status).json({ success:false, error:{ code:error.code, message:error.message } });
  res.json({ success:true, data: jobRegistry.getActions(req.params.id) });
});

router.get('/runs/:id/status', validateRunId, (req,res)=> {
  const { run, error } = authorizeRun(req);
  if (error) return res.status(error.status).json({ success:false, error:{ code:error.code, message:error.message } });
  res.json({ success:true, data: { status: run.status, stepCount: run.stepCount, attempts: run.attempts, replans: run.replans } });
});

router.get('/runs/:id/events', validateRunId, sseHandler);

router.get('/runs/:id/diff', validateRunId, async (req,res)=> {
  const { run, error } = authorizeRun(req);
  if (error) return res.status(error.status).json({ success:false, error:{ code:error.code, message:error.message } });
  try {
    const { stdout } = await execAsync('git', ['diff', 'HEAD'], { cwd: run.projectPath, windowsHide: true, maxBuffer: env.MAX_DIFF_BYTES });
    const diff = stdout || run.diff || '';
    res.json({ success:true, data: { diff: diff.slice(0, env.MAX_DIFF_BYTES), changedFiles: run.changedFiles } });
  } catch (e:any) {
    res.json({ success:true, data: { diff: (run.diff||'').slice(0, env.MAX_DIFF_BYTES), changedFiles: run.changedFiles } });
  }
});

// GET /agent/runs/:id/download — ownership-checked; excludes .env + symlinks
router.get('/runs/:id/download', validateRunId, async (req,res)=> {
  const { run, error } = authorizeRun(req);
  if (error) return res.status(error.status).json({ success:false, error:{ code:error.code, message:error.message } });
  const projectPath = run.projectPath;
  if (!fs.existsSync(projectPath)) return res.status(404).json({ success:false, error:{ code:'NOT_FOUND', message:'Workspace not found' } });
  res.setHeader('Content-Type','application/zip');
  const safeName = String(run.projectId).replace(/[^a-zA-Z0-9-]/g, '');
  res.setHeader('Content-Disposition',`attachment; filename="${safeName}-patched.zip"`);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', ()=> res.status(500).end('archive error'));
  archive.pipe(res);
  const maxBytes = env.MAX_EXTRACTED_SIZE_MB * 1024 * 1024;
  let total = 0;
  const walkAndAdd = (dir:string, base:string='')=> {
    if (total > maxBytes) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (total > maxBytes) return;
      if (e.name==='node_modules' || e.name==='.git' || e.name==='coverage' || e.name==='dist' || e.name==='build') continue;
      if (e.name === '.env' || SENSITIVE_NAME.test(e.name)) continue; // never expose env/secret files
      const full = path.join(dir, e.name);
      const rel = path.join(base, e.name);
      if (e.isDirectory()) { if (!e.isSymbolicLink()) walkAndAdd(full, rel); continue; }
      if (e.isFile() && !e.isSymbolicLink()) {
        let stat: fs.Stats;
        try { stat = fs.statSync(full); } catch { continue; }
        total += stat.size;
        if (total > maxBytes) return;
        archive.file(full, { name: rel });
      }
    }
  };
  walkAndAdd(projectPath);
  await archive.finalize();
});

// POST /runs/:id/stop — ownership checked, rate-limited
router.post('/runs/:id/stop', validateRunId, runRateLimiter, async (req,res)=> {
  const { run, error } = authorizeRun(req);
  if (error) return res.status(error.status).json({ success:false, error:{ code:error.code, message:error.message } });
    try {
    const stopped = (await agentJobManager.stopRun(req.params.id)) as any;
    res.json({ success:true, data: { runId: stopped.runId, status: stopped.status } });
  } catch (e:any) {
    res.status(404).json({ success:false, error:{ code:'NOT_FOUND', message: e.message } });
  }
});

// POST /runs/:id/retry — ownership checked; reset is scoped to the run's OWN workspace only
router.post('/runs/:id/retry', validateRunId, runRateLimiter, (req,res)=> {
  const { run, error } = authorizeRun(req);
  if (error) return res.status(error.status).json({ success:false, error:{ code:error.code, message:error.message } });
  const project = jobRegistry.getProject(run.projectId);
  const pauth = checkOwner(project?.ownerId, req.ownerId);
  if (!pauth.authorized) return res.status(pauth.code === 'NOT_FOUND' ? 404 : 403).json({ success:false, error:{ code:pauth.code, message:'Forbidden' } });
  if (!project) return res.status(404).json({ success:false, error:{ code:'PROJECT_NOT_FOUND', message:'Project not found' } });
  agentJobManager.createRun(project, run.goal, req.ownerId).then((newRun:any)=> {
    res.status(201).json({ success:true, data: { runId: newRun.runId, projectId: newRun.projectId, status: newRun.status } });
  }).catch((e:any)=> {
    res.status(500).json({ success:false, error:{ code: e.code || 'RUN_ERROR', message: e.message || 'Failed to create run' } });
  });
});

export default router;
