import { detectProject } from '../projects/ProjectDetector';

export function createDetectProjectTool() {
  return {
    name: 'detect_project',
    description: 'Detect project type, package manager and available scripts',
    permission: 'SAFE' as const,
    inputSchema: { type: 'object', properties: {} },
    execute: async (args:any, ctx:any) => {
      const meta = detectProject(ctx.projectPath);
      return { summary: `Detected ${meta.framework} with ${meta.packageManager}`, output: { meta } };
    }
  };
}
