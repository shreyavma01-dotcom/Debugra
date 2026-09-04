import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

// strictly validate IDs that are looked up from untrusted client input
const paramIdSchema = z.string().uuid();

export function validateRunId(req:Request, res:Response, next:NextFunction) {
  const parsed = paramIdSchema.safeParse(req.params.id);
  if (!parsed.success) return res.status(400).json({ success:false, error:{ code:'VALIDATION_ERROR', message:'Invalid runId' } });
  next();
}
export function validateProjectId(req:Request, res:Response, next:NextFunction) {
  const parsed = paramIdSchema.safeParse(req.params.id);
  if (!parsed.success) return res.status(400).json({ success:false, error:{ code:'VALIDATION_ERROR', message:'Invalid projectId' } });
  next();
}

export const createRunSchema = z.object({
  projectId: z.string().uuid(),
  goal: z.string().min(5).max(env.MAX_GOAL_LENGTH)
});

export function validateCreateRun(req:Request,res:Response,next:NextFunction){
  const parsed = createRunSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success:false, error:{ code:'VALIDATION_ERROR', message: parsed.error.issues.map(i=>i.message).join(', ') } });
  next();
}

