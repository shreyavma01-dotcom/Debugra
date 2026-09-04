import fs from 'fs';
import path from 'path';

function toPosix(p: string): string { return p.split(path.sep).join('/'); }

export function createSearchCodeTool() {
  return {
    name: 'search_code',
    description: 'Search for a text pattern across project files (ignores node_modules, .git, dist)',
    permission: 'SAFE' as const,
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' }, maxResults: { type: 'number' } },
      required: ['query']
    },
    execute: async (args:any, ctx:any) => {
      const base = ctx.projectPath;
      if (!args.query || typeof args.query !== 'string' || args.query.length > 200) throw new Error('Invalid query');
      const ignoreDirs = new Set(['node_modules','.git','dist','build','coverage']);
      const results: any[] = [];
      const max = Math.min(Number(args.maxResults) || 20, 100);
      function walk(dir:string) {
        if (results.length>=max) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          if (results.length>=max) break;
          if (ignoreDirs.has(e.name)) continue;
          if (e.isSymbolicLink()) continue; // never follow symlinks
          const full = path.join(dir, e.name);
          if (e.isDirectory()) walk(full);
          else {
            if (/\.(png|jpg|jpeg|gif|ico|zip|tar|gz|pdf|woff|woff2)$/.test(e.name)) continue;
            try {
              const stat = fs.statSync(full);
              if (stat.size>500*1024) continue;
              const content = fs.readFileSync(full,'utf8');
              const lines = content.split('\n');
              lines.forEach((line, idx)=>{
                if (line.toLowerCase().includes(args.query.toLowerCase())) {
                  if (results.length<max) results.push({ file: toPosix(path.relative(base, full)), line: idx+1, text: line.trim().slice(0,300) });
                }
              });
            } catch {}
          }
        }
      }
      walk(base);
      return { summary: `Found ${results.length} matches for "${args.query.slice(0,50)}"`, output: { matches: results } };
    }
  };
}
