import fs from 'fs';
import path from 'path';

export function validateUpload(file: Express.Multer.File, maxSizeMB: number) {
  if (!file) throw Object.assign(new Error('No file uploaded'), { code: 'NO_FILE' });
  if (!file.originalname.endsWith('.zip')) throw Object.assign(new Error('Only ZIP files allowed'), { code: 'INVALID_EXT' });
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) throw Object.assign(new Error(`File exceeds ${maxSizeMB}MB`), { code: 'TOO_LARGE' });
  if (file.size === 0) throw Object.assign(new Error('Empty file'), { code: 'EMPTY' });
}
