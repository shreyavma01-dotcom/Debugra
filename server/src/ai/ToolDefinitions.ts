export const toolDefinitions = [
  {
    name: 'list_files',
    description: 'List files in project directory',
    parameters: { type: 'object', properties: { dir: { type: 'string' } } }
  },
  {
    name: 'read_file',
    description: 'Read a project file',
    parameters: { type: 'object', properties: { path: { type: 'string', description: 'relative path' } }, required: ['path'] }
  },
  {
    name: 'search_code',
    description: 'Search code for a query',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
  },
  {
    name: 'read_logs',
    description: 'Read recent execution logs',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'detect_project',
    description: 'Detect project type',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'detect_tests',
    description: 'Detect test files and command',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'run_tests',
    description: 'Run tests inside sandbox',
    parameters: { type: 'object', properties: { command: { type: 'string' } } }
  },
  {
    name: 'run_linter',
    description: 'Run linter',
    parameters: { type: 'object', properties: { command: { type: 'string' } } }
  },
  {
    name: 'run_command',
    description: 'Run an allowed shell command in sandbox',
    parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] }
  },
  {
    name: 'apply_patch',
    description: 'Patch a file (provide file path and new content)',
    parameters: { type: 'object', properties: { file: { type: 'string' }, content: { type: 'string' }, patch: { type: 'string' } }, required: ['file'] }
  },
  {
    name: 'git_diff',
    description: 'Show git diff',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'rollback',
    description: 'Rollback changes to baseline',
    parameters: { type: 'object', properties: {} }
  }
];
