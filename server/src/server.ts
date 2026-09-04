import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env, validateEnv } from './config/env';
import healthRoutes from './routes/healthRoutes';
import projectRoutes from './routes/projectRoutes';
import agentRoutes from './routes/agentRoutes';
import { identityMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { authRateLimiter } from './middleware/rateLimit';

const app = express();

const warnings = validateEnv();
warnings.forEach(w=> console.warn('[env]', w));
if (!env.GEMINI_API_KEY) console.warn('[env] AI provider is not configured. Agent will use heuristic fallback.');
console.log(`[env] Sandbox mode: ${env.SANDBOX_MODE}`);

// Security headers (CSP default-src 'self' is safe because the client is
// served from the same origin in production).
app.use(helmet());
app.use(cookieParser());

// Strict CORS: only the configured CLIENT_URL may read responses.
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
  methods: ['GET','POST'],
  allowedHeaders: ['Content-Type','Authorization']
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Anonymize+identity: assign an opaque ownerId per client (httponly cookie).
// Authorization (ownership) is enforced on every resource access; real
// authentication (OAuth/mTLS) is a production blocker — see docs/deployment.md.
app.use(identityMiddleware);
app.use((_req, res, next) => {
  if (res.locals.cookieName && res.locals.cookieValue) {
    res.cookie(res.locals.cookieName, res.locals.cookieValue, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 30
    });
  }
  next();
});

// global light rate limit
app.use(authRateLimiter);

// ensure workspaces dir
const wsRoot = path.resolve(__dirname, '../workspaces');
if (!fs.existsSync(wsRoot)) fs.mkdirSync(wsRoot, { recursive: true });

app.use('/api/health', healthRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/agent', agentRoutes);

// serve client in production (same origin so the strict CSP holds)
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, {
    index: 'index.html',
    setHeaders: (res, filePath) => {
      if (/\.(html)$/i.test(filePath)) res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
  }));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
} else {
  app.get('*', (_req, res) => res.status(404).json({ success:false, error:{ code:'NOT_FOUND', message:'Client build not available' } }));
}

app.use(errorHandler);

const PORT = env.PORT;
app.listen(PORT, ()=> {
  console.log(`Debugra server running on http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
});

export default app;

