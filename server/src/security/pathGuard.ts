import fs from 'fs';
import path from 'path';

/**
 * Centralized secure path resolver.
 *
 * Security properties:
 *  - rejects null bytes, absolute paths, Windows drive letters / UNC paths
 *  - rejects `..` traversal after decoding URL-encoded variants
 *  - rejects backslash-separated paths (Windows-style traversal inside ZIPs)
 *  - resolves the final path and verifies containment with a path-separator-aware
 *    prefix check (normalize() and startsWith() alone are NOT security boundaries)
 *  - verifies the real filesystem path (symlinks resolved) stays inside the
 *    workspace real path, so a symlink inside the workspace cannot escape it
 */

export class PathValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathValidationError';
  }
}

/** Normalize a candidate path string before validation. */
export function decodeUntrustedPath(input: string): string {
  if (typeof input !== 'string') throw new PathValidationError('Path must be a string');
  if (input.includes('\0')) throw new PathValidationError('Null byte in path');
  let p = input;
  for (let i = 0; i < 2; i++) {
    try {
      const decoded = decodeURIComponent(p);
      if (decoded === p) break;
      p = decoded;
    } catch {
      break;
    }
  }
  return p;
}

/** Validate a workspace-relative path WITHOUT touching the filesystem. */
export function validateRelativePath(input: string): string {
  const p = decodeUntrustedPath(input);
  if (p.length === 0) throw new PathValidationError('Empty path');
  if (p.length > 512) throw new PathValidationError('Path too long');
  if (p.includes('\0')) throw new PathValidationError('Null byte in path');
  if (p.startsWith('/')) throw new PathValidationError('Absolute paths not allowed');
  if (/^[A-Za-z]:[\\/]/.test(p)) throw new PathValidationError('Windows drive-letter paths not allowed');
  if (/^\\\\|^\/\//.test(p)) throw new PathValidationError('UNC paths not allowed');
  if (p.includes('\\')) throw new PathValidationError('Backslash paths not allowed');
  const segments = p.split('/');
  if (segments.some((s) => s === '..')) throw new PathValidationError('Path traversal not allowed');
  if (segments.some((s) => /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i.test(s))) {
    throw new PathValidationError('Reserved device name in path');
  }
  return p.replace(/^\.\/+/, '').replace(/^\/+/, '');
}

/** Resolve a relative path against `base` and verify containment. */
export function resolveInWorkspace(base: string, relativeInput: string): string {
  const rel = validateRelativePath(relativeInput);
  const resolvedBase = path.resolve(base);
  const resolved = path.resolve(resolvedBase, rel);
  const resolvedRel = path.relative(resolvedBase, resolved);
  if (resolvedRel === '' || resolvedRel.startsWith('..') || path.isAbsolute(resolvedRel)) {
    throw new PathValidationError('Resolved path escapes workspace');
  }
  return resolved;
}

/**
 * Like resolveInWorkspace but verifies the REAL (symlink-resolved) path stays
 * inside the real base path, so a symlink inside the workspace cannot escape.
 */
export function resolveRealInWorkspace(base: string, relativeInput: string): string {
  const resolved = resolveInWorkspace(base, relativeInput);
  const resolvedBase = path.resolve(base);
  let realBase = resolvedBase;
  try {
    realBase = fs.realpathSync(resolvedBase);
  } catch {
    /* base may not exist yet for write targets */
  }
  let current = resolved;
  const ancestors: string[] = [];
  while (true) {
    ancestors.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  for (const dir of ancestors.reverse()) {
    if (!fs.existsSync(dir)) break;
    let real: string;
    try {
      real = fs.realpathSync(dir);
    } catch {
      throw new PathValidationError('Unresolvable path component');
    }
    const relReal = path.relative(realBase, real);
    if (relReal.startsWith('..') || path.isAbsolute(relReal)) {
      throw new PathValidationError('Symlink escapes workspace');
    }
  }
  if (fs.existsSync(resolved)) {
    const realTarget = fs.realpathSync(resolved);
    const relTarget = path.relative(realBase, realTarget);
    if (relTarget.startsWith('..') || path.isAbsolute(relTarget)) {
      throw new PathValidationError('Symlink escapes workspace');
    }
  }
  return resolved;
}

/** Validate a ZIP entry name (never trust archive metadata). */
export function validateZipEntryName(name: string): string {
  if (name.includes('\0')) throw new PathValidationError('Null byte in zip entry');
  if (name.includes('\\')) throw new PathValidationError('Backslash in zip entry name');
  const p = decodeUntrustedPath(name);
  if (p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p) || /^\\\\|^\/\//.test(p)) {
    throw new PathValidationError('Absolute path in zip entry');
  }
  const segments = p.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) throw new PathValidationError('Empty zip entry');
  if (segments.some((s) => s === '..' || s === '.')) {
    throw new PathValidationError('Traversal component in zip entry');
  }
  return segments.join('/');
}

