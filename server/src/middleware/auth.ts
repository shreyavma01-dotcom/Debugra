import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * AUTHENTICATION / AUTHORIZATION BOUNDARY
 *
 * Production authentication (OAuth2 / OIDC / mTLS) is intentionally deferred
 * for this hackathon MVP and is a known PRODUCTION BLOCKER — see docs/deployment.md.
 *
 * To still prevent cross-session IDOR during the demo, every requester is
 * assigned an opaque, server-issued `ownerId` stored in an httponly cookie.
 * Projects and runs are tagged with the owner that created them, and every
 * access is checked against the caller's ownerId. A user can therefore never
 * view, modify, stop, retry, download or inspect events/diff of another
 * owner's resources — even though IDs are UUIDs that are not secret.
 *
 * This is authorization WITHOUT authentication (anonymous owners). Replacing
 * the anonymous-owner issuer with a real identity provider is a drop-in change
 * once authentication is added; the ownership checks themselves do not change.
 */

declare module 'express-serve-static-core' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Request { ownerId: string; }
}

const COOKIE_NAME = 'debugra_owner';

export function identityMiddleware(req: Request, res: Response, next: NextFunction) {
  let ownerId = req.cookies?.[COOKIE_NAME];
  if (typeof ownerId !== 'string' || !/^[a-f0-9-]{36}$/.test(ownerId)) {
    ownerId = uuidv4();
  }
  req.ownerId = ownerId;
  res.locals.cookieName = COOKIE_NAME;
  res.locals.cookieValue = ownerId;
  next();
}

export function checkOwner(resourceOwner: string | undefined, callerOwnerId: string) {
  if (resourceOwner === undefined) return { authorized: false, code: 'NOT_FOUND' } as const;
  if (resourceOwner === callerOwnerId) return { authorized: true } as const;
  return { authorized: false, code: 'FORBIDDEN' } as const;
}
