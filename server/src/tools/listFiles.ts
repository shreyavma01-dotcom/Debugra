import fs from 'fs';
import path from 'path';
import { resolveRealInWorkspace, resolveInWorkspace } from '../security/pathGuard';

function toPosix(p: string): string { return p.split(path.sep).join('/'); }

export function createListFilesTool() {
  return {
    name: 'list_files',
    description: 'List files in project directory recursively (ignores node_modules, .git, dist, build)',
    permission: 'SAFE' as const,
    inputSchema: {
      type: 'object',
      properties: {
        dir: { type: 'string', description: 'Relative directory to list, empty for root' },
        maxDepth: { type: 'number' }
      }
    },
    execute: async (args: any, ctx: any) => {
      const base = ctx.projectPath;
      const target = args.dir ? resolveRealInWorkspace(base, args.dir) : base;
      let stat: fs.Stats;
      try { stat = fs.statSync(target); } catch { throw new Error('Directory not found'); }
      if (!stat.isDirectory()) throw new Error('Not a directory');
      const ignore = new Set(['node_modules','.git','dist','build','.next','coverage']);
      const results: string[] = [];
      function walk(dir:string, depth:number, rel:string) {
        if (depth>6) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          if (ignore.has(e.name)) continue;
          if (e.isSymbolicLink()) continue; // never traverse symlinks
          const full = path.join(dir, e.name);
          const r = path.join(rel, e.name);
          if (e.isDirectory()) { results.push(toPosix(r)+'/'); walk(full, depth+1, r); }
          else results.push(toPosix(r));
          if (results.length>500) return;
        }
      }
      walk(target, 0, args.dir ? resolveInWorkspace(base, args.dir) : '');
      return { summary: `Found ${results.length} files`, output: { files: results } };
    }
  };
}
