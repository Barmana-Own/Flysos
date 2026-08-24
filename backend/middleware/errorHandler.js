import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    ok: false,

    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  });
}

export function errorHandler(error, req, res, _next) {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error.';

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
  } else if (error?.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    code = 'FILE_TOO_LARGE';
    message = 'Each file must be smaller than 15 MB.';
  } else if (
    error?.code === 'LIMIT_FILE_COUNT' ||
    error?.code === 'LIMIT_UNEXPECTED_FILE'
  ) {
    statusCode = 400;
    code = 'INVALID_UPLOAD';
    message = 'A maximum of 4 files can be uploaded.';
  } else if (env.nodeEnv !== 'production') {
    message = error?.message || message;
  }

  console.error(
    `[API ERROR] ${req.method} ${req.originalUrl} -> ${statusCode}: ${error?.message || 'Unknown error'}`
  );

  res.status(statusCode).json({
    ok: false,

    error: {
      code,
      message,
    },
  });
}