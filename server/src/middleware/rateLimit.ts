import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/** Per-IP rate limiter factory. Used to protect expensive endpoints. */
export function limiter(max: number) {
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } }
  });
}

export const uploadRateLimiter = limiter(env.RATE_LIMIT_UPLOAD_MAX);
export const runRateLimiter = limiter(env.RATE_LIMIT_RUN_MAX);
export const authRateLimiter = limiter(env.RATE_LIMIT_MAX);
