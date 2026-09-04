import fs from 'fs';
import path from 'path';

export interface DetectedMeta {
  framework: string;
  packageManager: string;
  testCommand?: string;
  lintCommand?: string;
  buildCommand?: string;
  startCommand?: string;
  hasTests: boolean;
}

export function detectProject(projectPath: string): DetectedMeta {
  const pkgPath = path.join(projectPath, 'package.json');
  let pkg: any = null;
  if (fs.existsSync(pkgPath)) {
    try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')); } catch {}
  }
  const has = (p:string) => fs.existsSync(path.join(projectPath, p));
  const isNode = !!pkg;
  const isReact = !!(pkg?.dependencies?.react || pkg?.devDependencies?.react);

  let framework = 'unknown';
  if (isReact) framework = 'node-react';
  else if (isNode) framework = 'node';
  else if (has('requirements.txt') || has('pyproject.toml')) framework = 'python';
  else if (has('go.mod')) framework = 'go';

  let packageManager = 'npm';
  if (has('pnpm-lock.yaml')) packageManager = 'pnpm';
  else if (has('yarn.lock')) packageManager = 'yarn';
  else if (has('package-lock.json')) packageManager = 'npm';

  const scripts = pkg?.scripts || {};
  let testCommand: string | undefined;
  if (scripts.test) testCommand = `${packageManager} test`;
  else if (scripts['test:unit']) testCommand = `${packageManager} run test:unit`;
  // fallback check files
  const hasTests = has('tests') || has('__tests__') || has('src/__tests__') || !!scripts.test || fs.existsSync(path.join(projectPath,'vitest.config.js')) || fs.existsSync(path.join(projectPath,'jest.config.js')) || fs.existsSync(path.join(projectPath,'vitest.config.ts'));

  let lintCommand = scripts.lint ? `${packageManager} run lint` : undefined;
  let buildCommand = scripts.build ? `${packageManager} run build` : undefined;
  let startCommand = scripts.start ? `${packageManager} start` : scripts.dev ? `${packageManager} run dev` : undefined;

  return { framework, packageManager, testCommand, lintCommand, buildCommand, startCommand, hasTests };
}
