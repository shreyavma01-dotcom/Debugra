import { Router } from 'express';

const router = Router();
// Safe: only reveals process health. Never echoes env vars, secrets,
// filesystem paths, Docker internals or the Gemini key.
router.get('/', (req,res)=> {
  res.json({ success:true, data:{ status:'ok', version:'1.0.0', timestamp: new Date().toISOString() } });
});
export default router;
