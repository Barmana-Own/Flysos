import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import multer from 'multer';

import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { isSupportedUploadMetadata } from '../utils/fileValidation.js';

export const uploadDirectory = path.resolve(process.cwd(), env.uploadDir);
export const cmsUploadDirectory = path.join(uploadDirectory, 'cms');

fs.mkdirSync(uploadDirectory, { recursive: true });
fs.mkdirSync(cmsUploadDirectory, { recursive: true });

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

function createStorage(destination) {
  return multer.diskStorage({
    destination(_req, _file, callback) {
      callback(null, destination);
    },

    filename(_req, file, callback) {
      const extension = path.extname(file.originalname).toLowerCase();

      callback(
        null,
        `${Date.now()}-${randomUUID()}${extension}`
      );
    },
  });
}

function fileFilter(_req, file, callback) {
  file.originalname = normalizeOriginalName(file.originalname);

  if (!isSupportedUploadMetadata(file)) {
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
  storage: createStorage(uploadDirectory),
  fileFilter,

  limits: {
    files: 4,
    fileSize: 15 * 1024 * 1024,
  },
});

export const cmsUpload = multer({
  storage: createStorage(cmsUploadDirectory),
  fileFilter,

  limits: {
    files: 4,
    fileSize: 15 * 1024 * 1024,
  },
});
