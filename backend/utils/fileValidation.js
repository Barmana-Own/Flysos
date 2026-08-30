import path from 'node:path';

const PDF_MIME_TYPES = new Set([
  '',
  'application/pdf',
  'application/octet-stream',
  'application/x-pdf',
]);

const IMAGE_MIME_BY_EXTENSION = new Map([
  ['.jpg', new Set(['image/jpeg'])],
  ['.jpeg', new Set(['image/jpeg'])],
  ['.png', new Set(['image/png'])],
  ['.webp', new Set(['image/webp'])],
]);

const SUPPORTED_EXTENSIONS = new Set([
  '.pdf',
  ...IMAGE_MIME_BY_EXTENSION.keys(),
]);

export function getFileExtension(filename) {
  return path.extname(String(filename || '')).toLowerCase();
}

export function isPdfUploadMetadata(file = {}) {
  const extension = getFileExtension(file.originalname);
  const mimetype = String(file.mimetype || '').trim().toLowerCase();
  return extension === '.pdf' && PDF_MIME_TYPES.has(mimetype);
}

export function isSupportedUploadMetadata(file = {}) {
  const extension = getFileExtension(file.originalname);
  const mimetype = String(file.mimetype || '').trim().toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(extension)) return false;
  if (extension === '.pdf') return PDF_MIME_TYPES.has(mimetype);

  return IMAGE_MIME_BY_EXTENSION.get(extension)?.has(mimetype) === true;
}

export function hasPdfSignature(buffer) {
  return Buffer.isBuffer(buffer)
    && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

export function normalizeStoredMimeType(file = {}) {
  if (isPdfUploadMetadata(file)) return 'application/pdf';
  return String(file.mimetype || '').trim().toLowerCase();
}
