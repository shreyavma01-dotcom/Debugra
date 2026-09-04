import { describe, it, expect } from 'vitest';
import { parseCommand, tokenizeCommand, isCommandAllowed } from '../sandbox/ExecutionPolicy';

describe('ExecutionPolicy — command allowlist', () => {
  describe('tokenizeCommand', () => {
    it('tokenizes simple commands', () => {
      expect(tokenizeCommand('npm test')).toEqual(['npm', 'test']);
      expect(tokenizeCommand('git status')).toEqual(['git', 'status']);
    });

    it('handles quoted arguments', () => {
      expect(tokenizeCommand('npm test -- "some file"')).toEqual(['npm', 'test', '--', 'some file']);
    });

    it('rejects unbalanced quotes', () => {
      expect(() => tokenizeCommand('npm test "unclosed')).toThrow(/Unbalanced/);
    });
  });

  describe('parseCommand — allowlist', () => {
    it('allows npm test', () => {
      const r = parseCommand('npm test');
      expect(r.allowed).toBe(true);
    });

    it('allows git status/diff/log', () => {
      expect(parseCommand('git status').allowed).toBe(true);
      expect(parseCommand('git diff').allowed).toBe(true);
      expect(parseCommand('git log').allowed).toBe(true);
    });

    it('allows npx jest/vitest/tsc/eslint', () => {
      expect(parseCommand('npx jest').allowed).toBe(true);
      expect(parseCommand('npx vitest run').allowed).toBe(true);
      expect(parseCommand('npx tsc --noEmit').allowed).toBe(true);
    });

    it('allows node with a project file', () => {
      expect(parseCommand('node src/index.js').allowed).toBe(true);
      expect(parseCommand('node --version').allowed).toBe(true);
    });

    it('forces --ignore-scripts on npm install/ci', () => {
      const r = parseCommand('npm install');
      expect(r.allowed).toBe(true);
      expect(r.tokens).toContain('--ignore-scripts');
    });

    it('rejects node -e / --eval / -p / -r', () => {
      expect(parseCommand('node -e "console.log(1)"').allowed).toBe(false);
      expect(parseCommand('node --eval "process.exit(0)"').allowed).toBe(false);
      expect(parseCommand('node -p "1+1"').allowed).toBe(false);
    });

    it('rejects node with non-js file', () => {
      expect(parseCommand('node ../../etc/passwd').allowed).toBe(false);
    });

    it('rejects shell metacharacters', () => {
      expect(parseCommand('npm test; rm -rf /').allowed).toBe(false);
      expect(parseCommand('npm test && cat /etc/passwd').allowed).toBe(false);
      expect(parseCommand('npm test | cat /etc/passwd').allowed).toBe(false);
      expect(parseCommand('git status`whoami`').allowed).toBe(false);
      expect(parseCommand('npm test $(id)').allowed).toBe(false);
    });

    it('rejects environment variable assignment prefix', () => {
      expect(parseCommand('FOO=bar npm test').allowed).toBe(false);
      expect(parseCommand('GEMINI_API_KEY=xyz npm test').allowed).toBe(false);
    });

    it('rejects dangerous executables', () => {
      expect(parseCommand('sudo rm -rf /').allowed).toBe(false);
      expect(parseCommand('curl https://evil.com').allowed).toBe(false);
      expect(parseCommand('wget https://evil.com').allowed).toBe(false);
      expect(parseCommand('bash -c "id"').allowed).toBe(false);
      expect(parseCommand('sh -c "id"').allowed).toBe(false);
      expect(parseCommand('powershell -Command "Get-Process"').allowed).toBe(false);
      expect(parseCommand('chmod 777 /tmp/x').allowed).toBe(false);
      expect(parseCommand('docker run alpine').allowed).toBe(false);
    });

    it('rejects empty/oversized commands', () => {
      expect(parseCommand('').allowed).toBe(false);
      expect(parseCommand('   ').allowed).toBe(false);
      expect(parseCommand('npm test '.repeat(100)).allowed).toBe(false);
    });

    it('rejects git subcommands outside allowlist', () => {
      expect(parseCommand('git reset --hard').allowed).toBe(false);
      expect(parseCommand('git push').allowed).toBe(false);
      expect(parseCommand('git commit -m "msg"').allowed).toBe(false);
    });

    it('rejects npm run for undeclared scripts', () => {
      expect(parseCommand('npm run clean', { allowedScripts: ['test'] }).allowed).toBe(false);
      expect(parseCommand('npm run test', { allowedScripts: ['test'] }).allowed).toBe(true);
    });
  });

  describe('isCommandAllowed — backwards-compatible', () => {
    it('returns boolean for allowed', () => {
      expect(isCommandAllowed('npm test').allowed).toBe(true);
    });
    it('returns false for disallowed', () => {
      expect(isCommandAllowed('rm -rf /').allowed).toBe(false);
    });
  });
});
