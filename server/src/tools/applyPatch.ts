import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { resolveRealInWorkspace, resolveInWorkspace } from '../security/pathGuard';
import { env } from '../config/env';
const execAsync = promisify(execFile);

export function createApplyPatchTool() {
  return {
    name: 'apply_patch',
    description: 'Apply a patch to a file (provide file path and new content, or unified diff). Prefer full file replacement.',
    permission: 'WRITE' as const,
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'Relative path to file' },
        content: { type: 'string', description: 'New file content (full file)' },
        patch: { type: 'string', description: 'Unified diff patch (alternative)' }
      },
      required: ['file']
    },
    execute: async (args:any, ctx:any) => {
      const base = ctx.projectPath;
      if (!args.file || typeof args.file !== 'string') throw new Error('file required');
      // Central secure path resolution: rejects absolute, traversal, null bytes
      // and symlink escapes. Patch paths must stay inside the workspace.
      const full = resolveRealInWorkspace(base, args.file);
      if (args.content !== undefined && typeof args.content !== 'string') throw new Error('content must be a string');
      if (args.content !== undefined && args.content.length > env.MAX_PATCH_BYTES) {
        throw new Error(`Patch content too large (max ${env.MAX_PATCH_BYTES} bytes)`);
      }
      if (args.patch !== undefined && typeof args.patch !== 'string') throw new Error('patch must be a string');
      if (args.patch !== undefined && args.patch.length > env.MAX_PATCH_BYTES) {
        throw new Error(`Patch too large (max ${env.MAX_PATCH_BYTES} bytes)`);
      }
      // limit number of distinct files patched per run (DoS guard)
      ctx.changedFiles = ctx.changedFiles || new Set();
      if (!ctx.changedFiles.has(args.file) && ctx.changedFiles.size >= env.MAX_PATCH_FILES_PER_RUN) {
        throw new Error('Too many distinct files patched in this run');
      }

      // if a unified diff is supplied, every target path inside it must resolve
      // inside the workspace (a diff can otherwise touch files not named in `file`)
      if (args.patch !== undefined && args.content === undefined) {
        const diffTargets = extractDiffTargetPaths(args.patch);
        for (const t of diffTargets) {
          resolveInWorkspace(base, t); // throws if any target escapes
        }
      }

      let before = '';
      try { if (fs.existsSync(full)) before = fs.readFileSync(full,'utf8'); } catch {}

      if (args.content !== undefined) {
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, args.content, 'utf8');
      } else if (args.patch !== undefined) {
        // write patch to workspace-local temp and apply via git apply (arg array, no shell)
        const patchPath = path.join(base, '.tmp.patch');
        fs.writeFileSync(patchPath, args.patch);
        try {
          await execAsync('git', ['apply', '--whitespace=fix', '.tmp.patch'], { cwd: base, windowsHide: true });
        } catch (e:any) {
          throw new Error(`Patch apply failed: ${(e.stderr || e.message || '').toString().slice(0, 300)}`);
        } finally {
          try { fs.unlinkSync(patchPath); } catch {}
        }
      } else throw new Error('Either content or patch required');

      const after = fs.readFileSync(full,'utf8');
      ctx.changedFiles.add(args.file);
      let diff = '';
      try {
        const { stdout } = await execAsync('git', ['diff', '--', args.file], { cwd: base, windowsHide: true, maxBuffer: env.MAX_DIFF_BYTES });
        diff = stdout;
      } catch {}
      return { summary: `Patched ${args.file} (${before.length} -> ${after.length} chars)`, output: { file: args.file, diff: diff.slice(0,8000), beforeSize: before.length, afterSize: after.length } };
    }
  };
}

/** Extract target paths from a unified diff so each can be workspace-validated. */
function extractDiffTargetPaths(patch: string): string[] {
  const targets = new Set<string>();
  for (const line of patch.split('\n')) {
    const m = /^\+\+\+ (?:"?)([^"\t\n]+?)(?:"?)\s*$/.exec(line);
    if (m && m[1] !== '/dev/null') targets.add(m[1].replace(/^b\//, ''));
  }
  return Array.from(targets);
}
