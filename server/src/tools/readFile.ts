import fs from 'fs';
import { resolveRealInWorkspace } from '../security/pathGuard';
import { env } from '../config/env';

export function createReadFileTool() {
  return {
    name: 'read_file',
    description: 'Read a file from the project workspace',
    permission: 'SAFE' as const,
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path']
    },
    execute: async (args:any, ctx:any) => {
      const base = ctx.projectPath;
      if (!args.path || typeof args.path !== 'string') throw new Error('path required');
      // resolveRealInWorkspace rejects traversal, absolute paths, null bytes and
      // verifies symlink-realpath containment inside the workspace
      const full = resolveRealInWorkspace(base, args.path);
      let stat: fs.Stats;
      try {
        stat = fs.lstatSync(full);
      } catch {
        throw new Error(`File not found: ${args.path}`);
      }
      if (stat.isSymbolicLink()) throw new Error('Symbolic links are not readable');
      if (stat.isDirectory()) throw new Error('Path is a directory');
      if (stat.size > env.MAX_READ_FILE_BYTES) throw new Error(`File too large (${env.MAX_READ_FILE_BYTES} byte limit)`);
      const buf = fs.readFileSync(full);
      if (buf.includes(0)) throw new Error('Binary file');
      const content = buf.toString('utf8');
      return { summary: `Read ${args.path} (${content.length} chars)`, output: { content, path: args.path } };
    }
  };
}
