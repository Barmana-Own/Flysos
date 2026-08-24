import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import multer from 'multer';

import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const uploadDirectory = path.resolve(process.cwd(), env.uploadDir);

fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const allowedExtensions = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
]);

function normalizeOriginalName(name) {
  if (!name) return 'upload';

  // Multer/busboy may expose UTF-8 multipart filenames as latin1 on Node.js.
  // Only use the repaired value when it produces real Persian characters.
  const repaired = Buffer.from(name, 'latin1').toString('utf8');
  const selected = /[\u0600-\u06ff]/u.test(repaired) ? repaired : name;

  return selected
    .normalize('NFC')
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_')
    .slice(0, 190);
}

const storage = multer.diskStorage({
  destination(_req, _file, callback) {
    callback(null, uploadDirectory);
  },

  filename(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();

    callback(
      null,
      `${Date.now()}-${randomUUID()}${extension}`
    );
  },
});

function fileFilter(_req, file, callback) {
  file.originalname = normalizeOriginalName(file.originalname);
  const extension = path.extname(file.originalname).toLowerCase();

  if (
    !allowedMimeTypes.has(file.mimetype) ||
    !allowedExtensions.has(extension)
  ) {
    callback(
      new AppError(
        'Only PDF, JPG, JPEG, PNG, and WEBP files are allowed.',
        415,
        'UNSUPPORTED_FILE_TYPE'
      )
    );

    return;
  }

  callback(null, true);
}

export const upload = multer({
  storage,
  fileFilter,

  limits: {
    files: 4,
    fileSize: 15 * 1024 * 1024,
  },
});
