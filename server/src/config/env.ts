import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

function int(name: string, def: number): number {
  const v = parseInt(process.env[name] || '', 10);
  return Number.isFinite(v) && v > 0 ? v : def;
}

const NODE_ENV = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const SANDBOX_MODE = process.env.SANDBOX_MODE === 'docker' ? 'docker' : 'local';

export const env = {
  // SERVER-ONLY SECRETS — never expose to the client, SSE, logs or sandbox
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  MONGODB_URI: process.env.MONGODB_URI || '',

  NODE_ENV,
  PORT: int('PORT', 4000),
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',

  // Agent loop hard limits (enforced by backend code, never by Gemini)
  MAX_AGENT_STEPS: int('MAX_AGENT_STEPS', 20),
  MAX_AGENT_RETRIES: int('MAX_AGENT_RETRIES', 3),
  SANDBOX_TIMEOUT_MS: int('SANDBOX_TIMEOUT_MS', 120000),

  // Upload / extraction limits
  MAX_UPLOAD_SIZE_MB: int('MAX_UPLOAD_SIZE_MB', 50),
  MAX_EXTRACTED_SIZE_MB: int('MAX_EXTRACTED_SIZE_MB', 200),
  MAX_EXTRACTED_FILES: int('MAX_EXTRACTED_FILES', 2000),
  MAX_EXTRACTED_FILE_SIZE_MB: int('MAX_EXTRACTED_FILE_SIZE_MB', 20),
  EXTRACT_TIMEOUT_MS: int('EXTRACT_TIMEOUT_MS', 30000),

  // Tool / patch limits
  MAX_READ_FILE_BYTES: int('MAX_READ_FILE_BYTES', 1024 * 1024),
  MAX_PATCH_BYTES: int('MAX_PATCH_BYTES', 512 * 1024),
  MAX_PATCH_FILES_PER_RUN: int('MAX_PATCH_FILES_PER_RUN', 50),
  MAX_DIFF_BYTES: int('MAX_DIFF_BYTES', 1024 * 1024),
  MAX_GOAL_LENGTH: int('MAX_GOAL_LENGTH', 1000),

  // Sandbox
  SANDBOX_MODE,
  // Production must fail closed: docker mode NEVER silently falls back to local
  // execution of untrusted code on the host. Local fallback remains available for
  // development/demo only, and must be explicitly opted into.
  SANDBOX_ALLOW_LOCAL_FALLBACK: process.env.SANDBOX_ALLOW_LOCAL_FALLBACK === 'true',
  SANDBOX_NETWORK_ENABLED: process.env.SANDBOX_NETWORK_ENABLED === 'true',
  SANDBOX_MEMORY_LIMIT: process.env.SANDBOX_MEMORY_LIMIT || '512m',
  SANDBOX_CPU_LIMIT: process.env.SANDBOX_CPU_LIMIT || '0.5',
  SANDBOX_PIDS_LIMIT: int('SANDBOX_PIDS_LIMIT', 128),
  SANDBOX_IMAGE: process.env.SANDBOX_IMAGE || 'node:20-alpine',
  SANDBOX_MAX_OUTPUT_BYTES: int('SANDBOX_MAX_OUTPUT_BYTES', 1024 * 1024),

  // Rate limiting (per IP, per window)
  RATE_LIMIT_WINDOW_MS: int('RATE_LIMIT_WINDOW_MS', 60_000),
  RATE_LIMIT_MAX: int('RATE_LIMIT_MAX', 100),
  RATE_LIMIT_UPLOAD_MAX: int('RATE_LIMIT_UPLOAD_MAX', 10),
  RATE_LIMIT_RUN_MAX: int('RATE_LIMIT_RUN_MAX', 10)
};

export function validateEnv() {
  const warnings: string[] = [];
  if (!env.GEMINI_API_KEY) warnings.push('GEMINI_API_KEY is not set — AI provider is not configured. Agent will use heuristic fallback.');
  if (!env.MONGODB_URI) warnings.push('MONGODB_URI is not set — using in-memory store (non-persistent).');
  if (NODE_ENV === 'production' && SANDBOX_MODE !== 'docker') {
    warnings.push('SANDBOX_MODE is "local" in production — uploaded code will run directly on the host. Set SANDBOX_MODE=docker.');
  }
  return warnings;
}

