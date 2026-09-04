import { describe, it, expect } from 'vitest';
import {
  validateRelativePath,
  resolveInWorkspace,
  validateZipEntryName,
  decodeUntrustedPath,
  PathValidationError,
} from './pathGuard';

describe('pathGuard — ZIP / path traversal security', () => {
  describe('validateRelativePath', () => {
    it('accepts normal nested paths', () => {
      expect(validateRelativePath('src/index.ts')).toBe('src/index.ts');
      expect(validateRelativePath('src/utils/helpers.js')).toBe('src/utils/helpers.js');
      expect(validateRelativePath('package.json')).toBe('package.json');
    });

    it('rejects classic ../ traversal', () => {
      expect(() => validateRelativePath('../etc/passwd')).toThrow(PathValidationError);
      expect(() => validateRelativePath('foo/../../etc/passwd')).toThrow(PathValidationError);
      expect(() => validateRelativePath('..')).toThrow(PathValidationError);
    });

    it('rejects URL-encoded traversal', () => {
      expect(() => validateRelativePath('%2e%2e/%2e%2e/etc/passwd')).toThrow(PathValidationError);
      expect(() => validateRelativePath('..%2f..%2fetc/passwd')).toThrow(PathValidationError);
    });

    it('rejects absolute paths', () => {
      expect(() => validateRelativePath('/etc/passwd')).toThrow(/Absolute/);
      expect(() => validateRelativePath('/usr/local/bin/evil')).toThrow(PathValidationError);
    });

    it('rejects Windows drive-letter paths', () => {
      expect(() => validateRelativePath('C:\\Windows\\System32')).toThrow(/drive-letter/);
      expect(() => validateRelativePath('D:/secret')).toThrow(PathValidationError);
    });

    it('rejects UNC paths', () => {
      expect(() => validateRelativePath('\\\\server\\share')).toThrow(/UNC/);
    });

    it('rejects backslash traversal (Windows-style)', () => {
      expect(() => validateRelativePath('..\\..\\secret')).toThrow(/Backslash/);
    });

    it('rejects null bytes', () => {
      expect(() => validateRelativePath('foo\0bar')).toThrow(/Null byte/);
      expect(() => decodeUntrustedPath('foo\0')).toThrow(/Null byte/);
    });

    it('rejects reserved device names', () => {
      expect(() => validateRelativePath('CON')).toThrow(/Reserved/);
      expect(() => validateRelativePath('PRN.txt')).toThrow(/Reserved/);
      expect(() => validateRelativePath('LPT1')).toThrow(/Reserved/);
    });

    it('strips leading ./', () => {
      expect(validateRelativePath('./src/index.ts')).toBe('src/index.ts');
    });
  });

  describe('validateZipEntryName', () => {
    it('accepts normal zip entry names', () => {
      expect(validateZipEntryName('index.js')).toBe('index.js');
      expect(validateZipEntryName('src/index.ts')).toBe('src/index.ts');
      expect(validateZipEntryName('deep/nested/path/file.json')).toBe('deep/nested/path/file.json');
    });

    it('rejects zip-slip (../ inside zip)', () => {
      expect(() => validateZipEntryName('../../etc/passwd')).toThrow(/Traversal/);
      expect(() => validateZipEntryName('foo/../../secret')).toThrow(PathValidationError);
    });

    it('rejects absolute paths in zip entries', () => {
      expect(() => validateZipEntryName('/etc/passwd')).toThrow(/Absolute/);
      expect(() => validateZipEntryName('C:\\Windows')).toThrow(/Backslash in zip entry name|Absolute/);
    });

    it('rejects empty entries', () => {
      expect(() => validateZipEntryName('')).toThrow(PathValidationError);
    });
  });

  describe('resolveInWorkspace', () => {
    const base = '/tmp/test-workspace';

    it('resolves a safe path within workspace', () => {
      const result = resolveInWorkspace(base, 'src/index.ts');
      expect(result).toContain('src');
      expect(result).toContain('index.ts');
    });

    it('rejects workspace escape via traversal', () => {
      expect(() => resolveInWorkspace(base, '../../etc/passwd')).toThrow(PathValidationError);
    });
  });
});
