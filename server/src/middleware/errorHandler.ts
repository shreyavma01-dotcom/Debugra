import { Request, Response, NextFunction } from 'express';

/**
 * Centralized production-safe error handler.
 *
 * NEVER leak: stack traces, filesystem paths, environment variables,
 * database errors, Gemini credentials or Docker internals to the client.
 * Detailed diagnostics are sent to the server log only.
 */
export function errorHandler(err:any, req:Request, res:Response, next:NextFunction){
    const code = err?.code || err?.name || 'INTERNAL_ERROR';
  let status = typeof err?.status === 'number' ? err.status : 500;
  if (status === 500 && ['VALIDATION_ERROR','VALIDATION','ZodError'].includes(String(code))) status = 400;
  if (status === 500 && String(code) === 'NOT_FOUND') status = 404;
  // server-side diagnostics (never reach the client)
  console.error('[error]', {
    path: req.path,
    method: req.method,
    code,
    message: err?.message,
    stack: err?.stack,
    ownerId: req.ownerId
  });
  res.status(status).json({
    success: false,
    error: {
      code: String(code).slice(0, 40),
      message: 'Internal server error'
    }
  });
}

