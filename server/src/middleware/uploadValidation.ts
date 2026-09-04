import multer from 'multer';
import { env } from '../config/env';

const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  // reject the whole request if a single file exceeds the upload cap
  limits: {
    fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
    files: 1
  },
  fileFilter: (_req, file, cb)=> {
    if (typeof file.originalname !== 'string' || file.originalname.length > 256) {
      return cb(new Error('Invalid filename'));
    }
    // only accept a .zip (defensive — magic bytes are verified in the route)
    if (!file.originalname.toLowerCase().endsWith('.zip')) {
      return cb(new Error('Only ZIP files allowed'));
    }
    if (file.mimetype && file.mimetype !== 'application/zip' && file.mimetype !== 'application/octet-stream') {
      return cb(new Error('Invalid content type'));
    }
    cb(null, true);
  }
});
