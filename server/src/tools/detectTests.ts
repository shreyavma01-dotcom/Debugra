import fs from 'fs';
import path from 'path';
import { detectProject } from '../projects/ProjectDetector';

export function createDetectTestsTool() {
  return {
    name: 'detect_tests',
    description: 'Detect test framework and test files',
    permission: 'SAFE' as const,
    inputSchema: { type: 'object', properties: {} },
    execute: async (args:any, ctx:any) => {
      const meta = detectProject(ctx.projectPath);
      const files: string[] = [];
      function walk(dir:string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          if (['node_modules','.git','dist'].includes(e.name)) continue;
          const full = path.join(dir, e.name);
          if (e.isDirectory()) walk(full);
          else if (/\.(test|spec)\.(js|ts|jsx|tsx)$/.test(e.name)) files.push(path.relative(ctx.projectPath, full));
        }
      }
      try { walk(ctx.projectPath); } catch {}
      return { summary: `Found ${files.length} test files, command: ${meta.testCommand||'none'}`, output: { meta, testFiles: files } };
    }
  };
}
