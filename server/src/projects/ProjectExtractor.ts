import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import yauzl from 'yauzl';
import { detectProject } from './ProjectDetector';
import { validateZipEntryName } from '../security/pathGuard';
import { env } from '../config/env';

const WORKSPACE_ROOT = path.resolve(__dirname, '../../workspaces');

export class ZipSecurityError extends Error {
  code: string;
  constructor(message: string, code = 'ZIP_SECURITY') {
    super(message);
    this.code = code;
    this.name = 'ZipSecurityError';
  }
}

function ensureDir(p: string) { fs.mkdirSync(p, { recursive: true }); }

/**
 * Extract an UNTRUSTED ZIP buffer safely.
 *
 * Threat model: the archive is attacker-controlled. We never trust entry
 * filenames, metadata, sizes or types. Defenses:
 *  - entry name validation (zip-slip, absolute paths, drive letters, UNC,
 *    traversal, backslashes, null bytes, encoded variants) BEFORE writing
 *  - resolved-path containment check with path separator awareness
 *  - file count, per-file size, total uncompressed size limits (zip-bomb)
 *  - compression-ratio sanity check
 *  - symlink / non-regular entries rejected
 *  - extraction timeout
 *  - full cleanup of the workspace on any failure
 */
export async function extractProject(fileBuffer: Buffer, originalFilename: string, maxSizeMB: number) {
  const projectId = uuidv4();
  const workspacePath = path.join(WORKSPACE_ROOT, projectId);
  const projectPath = path.join(workspacePath, 'project');
  ensureDir(projectPath);

  try {
    await extractZipBuffer(fileBuffer, projectPath);

    // check empty
    const files = fs.readdirSync(projectPath);
    if (files.length === 0) throw new ZipSecurityError('Empty project after extraction', 'EMPTY_PROJECT');

    // handle single top-level folder zip
    if (files.length === 1) {
      const single = path.join(projectPath, files[0]);
      if (fs.statSync(single).isDirectory()) {
        const inner = fs.readdirSync(single);
        for (const f of inner) {
          fs.renameSync(path.join(single, f), path.join(projectPath, f));
        }
        fs.rmSync(single, { recursive: true, force: true });
      }
    }

    // final safety sweep: reject any symlink that made it into the workspace
    rejectSymlinks(projectPath);

    const meta = detectProject(projectPath);
    return { projectId, workspacePath, projectPath, meta, originalFilename };
  } catch (e) {
    // CLEANUP ON FAILURE: never leave a partially-extracted malicious archive
    try { fs.rmSync(workspacePath, { recursive: true, force: true, maxRetries: 2 }); } catch {}
    throw e;
  }
}

/** Walk the extracted tree and reject symlinks (uploaded symlinks must never escape). */
function rejectSymlinks(root: string) {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch { continue; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isSymbolicLink()) {
        throw new ZipSecurityError(`Symlink entry rejected: ${path.relative(root, full)}`);
      }
      if (e.isDirectory()) stack.push(full);
    }
  }
}

function extractZipBuffer(buffer: Buffer, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    // hard extraction timeout
    const timeout = setTimeout(() => {
      fail(new ZipSecurityError('Extraction timeout', 'EXTRACT_TIMEOUT'));
    }, env.EXTRACT_TIMEOUT_MS);

    let entryCount = 0;
    let totalUncompressed = 0;

    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        clearTimeout(timeout);
        return fail(new ZipSecurityError('Corrupted ZIP', 'CORRUPTED_ZIP'));
      }

      const maxEntries = env.MAX_EXTRACTED_FILES;
      const maxTotalBytes = env.MAX_EXTRACTED_SIZE_MB * 1024 * 1024;
      const maxFileBytes = env.MAX_EXTRACTED_FILE_SIZE_MB * 1024 * 1024;

      // validate central directory up front: never trust archive metadata
      if (zipfile.entryCount > maxEntries) {
        zipfile.close();
        clearTimeout(timeout);
        return fail(new ZipSecurityError(`Too many files in archive (${zipfile.entryCount} > ${maxEntries})`, 'TOO_MANY_FILES'));
      }

      zipfile.readEntry();
      zipfile.on('entry', (entry: any) => {
        if (settled) return;
        let name: string;
        try {
          name = validateZipEntryName(entry.fileName);
        } catch (e: any) {
          zipfile.close();
          clearTimeout(timeout);
          return fail(new ZipSecurityError(`Unsafe zip entry rejected: ${e.message}`, 'ZIP_SLIP'));
        }

        if (/\/$/.test(entry.fileName)) {
          // directory entry
          const fullPath = path.resolve(dest, name);
          if (!fullPath.startsWith(dest + path.sep)) {
            zipfile.close();
            clearTimeout(timeout);
            return fail(new ZipSecurityError('Path traversal detected', 'ZIP_SLIP'));
          }
          ensureDir(fullPath);
          zipfile.readEntry();
          return;
        }

        entryCount++;
        if (entryCount > maxEntries) {
          zipfile.close();
          clearTimeout(timeout);
          return fail(new ZipSecurityError('Too many files in archive', 'TOO_MANY_FILES'));
        }

        const uncompressedSize = entry.uncompressedSize || 0;
        if (uncompressedSize > maxFileBytes) {
          zipfile.close();
          clearTimeout(timeout);
          return fail(new ZipSecurityError(`File too large in archive: ${name}`, 'FILE_TOO_LARGE'));
        }
        totalUncompressed += uncompressedSize;
        if (totalUncompressed > maxTotalBytes) {
          zipfile.close();
          clearTimeout(timeout);
          return fail(new ZipSecurityError('Extracted size exceeds limit (possible zip bomb)', 'EXTRACTED_TOO_LARGE'));
        }
        if (entry.compressedSize > 0 && uncompressedSize / entry.compressedSize > 1000) {
          zipfile.close();
          clearTimeout(timeout);
          return fail(new ZipSecurityError('Suspicious compression ratio (possible zip bomb)', 'ZIP_BOMB'));
        }

        const fullPath = path.resolve(dest, name);
        if (!fullPath.startsWith(dest + path.sep)) {
          zipfile.close();
          clearTimeout(timeout);
          return fail(new ZipSecurityError('Path traversal detected', 'ZIP_SLIP'));
        }

        ensureDir(path.dirname(fullPath));
        zipfile.openReadStream(entry, (err2: Error | null, readStream: any) => {
          if (settled) return;
          if (err2 || !readStream) {
            zipfile.close();
            clearTimeout(timeout);
            return fail(err2 || new ZipSecurityError('Failed to read zip entry'));
          }
          let written = 0;
          const writeStream = fs.createWriteStream(fullPath, { flags: 'wx' });
          readStream.on('data', (chunk: Buffer) => {
            written += chunk.length;
            if (written > maxFileBytes) {
              writeStream.destroy();
              zipfile.close();
              clearTimeout(timeout);
              fail(new ZipSecurityError(`File exceeds size limit: ${name}`, 'FILE_TOO_LARGE'));
            }
          });
          readStream.pipe(writeStream);
          writeStream.on('close', () => {
            if (!settled) zipfile.readEntry();
          });
          writeStream.on('error', (e: Error) => {
            zipfile.close();
            clearTimeout(timeout);
            fail(e);
          });
        });
      });
      zipfile.on('end', () => { clearTimeout(timeout); done(); });
      zipfile.on('error', () => {
        clearTimeout(timeout);
        fail(new ZipSecurityError('Corrupted ZIP', 'CORRUPTED_ZIP'));
      });
    });
  });
}

