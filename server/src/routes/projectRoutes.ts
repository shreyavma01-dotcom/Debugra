import { Router } from 'express';
import { upload } from '../middleware/uploadValidation';
import { extractProject, ZipSecurityError } from '../projects/ProjectExtractor';
import { jobRegistry } from '../jobs/JobRegistry';
import { env } from '../config/env';
import { uploadRateLimiter } from '../middleware/rateLimit';
import { checkOwner } from '../middleware/auth';
import { validateProjectId } from '../middleware/validation';

const router = Router();

// POST /projects/upload — size-guarded, rate-limited ZIP extraction
router.post('/upload', uploadRateLimiter, upload.single('file'), async (req,res)=> {
  try {
    if (!req.file) return res.status(400).json({ success:false, error:{ code:'NO_FILE', message:'No file uploaded' } });
    if (req.file.buffer.length < 4 || req.file.buffer[0] !== 0x50 || req.file.buffer[1] !== 0x4B) {
      return res.status(400).json({ success:false, error:{ code:'INVALID_ZIP', message:'File is not a valid ZIP' } });
    }
    if (req.file.buffer.length > env.MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
      return res.status(413).json({ success:false, error:{ code:'PAYLOAD_TOO_LARGE', message:'Upload exceeds size limit' } });
    }
    // sanitize caller-supplied name (never trusted)
    let name = (req.body.name as string) || req.file.originalname.replace(/\.zip$/i, '');
    if (typeof name !== 'string' || name.trim().length === 0) name = 'project';
    name = name.replace(/[^\w.\- ]/g, '_').slice(0, 128);

    const result = await extractProject(req.file.buffer, req.file.originalname, env.MAX_UPLOAD_SIZE_MB);
    const project = {
      projectId: result.projectId,
      ownerId: req.ownerId,
      name,
      originalFilename: req.file.originalname,
      detectedType: result.meta.framework,
      meta: result.meta,
      workspacePath: result.workspacePath,
      projectPath: result.projectPath,
      createdAt: new Date().toISOString()
    };
    jobRegistry.createProject(project);
    res.json({ success:true, data: { projectId: project.projectId, name: project.name, detected: project.meta, originalFilename: project.originalFilename } });
  } catch (e:any) {
    const code = (e as ZipSecurityError).code || e.code || 'UPLOAD_ERROR';
    const status = code==='ZIP_SLIP' ? 400 : code==='CORRUPTED_ZIP' ? 400 : code==='TOO_MANY_FILES' ? 400 : code==='EXTRACTED_TOO_LARGE' ? 413 : code==='FILE_TOO_LARGE' ? 400 : code==='EXTRACT_TIMEOUT' ? 400 : 500;
    // never echo internal filesystem paths to the client
    const safeMessage = code==='UPLOAD_ERROR' ? 'Extraction failed' : String(e.message||'').slice(0,200);
    res.status(status).json({ success:false, error:{ code, message: safeMessage } });
  }
});

// GET /projects/:id — ownership-checked, no server paths leaked
router.get('/:id', validateProjectId, (req,res)=> {
  const proj = jobRegistry.getProject(req.params.id);
  const auth = checkOwner(proj?.ownerId, req.ownerId);
  if (!auth.authorized) {
    return res.status(auth.code === 'NOT_FOUND' ? 404 : 403).json({ success:false, error:{ code: auth.code, message: auth.code === 'NOT_FOUND' ? 'Project not found' : 'Forbidden' } });
  }
  if (!proj) return res.status(404).json({ success:false, error:{ code:'NOT_FOUND', message:'Project not found' } });
  res.json({ success:true, data: { projectId: proj.projectId, name: proj.name, detected: proj.meta, originalFilename: proj.originalFilename, createdAt: proj.createdAt } });
});

export default router;
