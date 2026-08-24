import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { parseAdminAccessLevels } from '../services/adminPermissionService.js';

export function requireAdminAuth(req, _res, next) {
  if (!env.jwtSecret) {
    return next(
      new AppError(
        'JWT_SECRET is missing from environment configuration.',
        500,
        'JWT_NOT_CONFIGURED'
      )
    );
  }

  const authorization = req.headers.authorization || '';

  if (!authorization.startsWith('Bearer ')) {
    return next(
      new AppError(
        'Admin authentication token is required.',
        401,
        'AUTH_REQUIRED'
      )
    );
  }

  const token = authorization.slice('Bearer '.length).trim();

  if (!token) {
    return next(
      new AppError(
        'Admin authentication token is required.',
        401,
        'AUTH_REQUIRED'
      )
    );
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);

    if (!payload || typeof payload !== 'object' || !payload.id) {
      throw new Error('Invalid token payload');
    }

    req.admin = {
      id: String(payload.id),
      username: String(payload.username || ''),
      name: String(payload.name || payload.username || ''),
      role: String(payload.role || 'expert_domestic'),
      accessLevel: String(payload.accessLevel || 'under_review'),
      accessLevels: parseAdminAccessLevels(payload.accessLevels, payload.accessLevel),
    };

    next();
  } catch {
    next(
      new AppError(
        'Admin authentication token is invalid or expired.',
        401,
        'INVALID_TOKEN'
      )
    );
  }
}

export function requireSupervisor(req, _res, next) {
  if (req.admin?.role !== 'supervisor') {
    return next(
      new AppError(
        'This action is only available to supervisor accounts.',
        403,
        'SUPERVISOR_ONLY'
      )
    );
  }

  next();
}

function requireRole(roles, message, code) {
  return (req, _res, next) => {
    if (!roles.includes(req.admin?.role)) {
      return next(new AppError(message, 403, code));
    }
    next();
  };
}

export const requireCmsEditor = requireRole(
  ['supervisor', 'content_admin'],
  'This action is only available to content administrators.',
  'CMS_EDITOR_ONLY',
);

export const requirePassengerManager = requireRole(
  ['supervisor', 'passenger_admin'],
  'This action is only available to passenger administrators.',
  'PASSENGER_MANAGER_ONLY',
);

export const requireClaimEditor = requireRole(
  ['supervisor', 'passenger_admin', 'senior_expert', 'expert_domestic', 'expert_intl'],
  'This account has read-only access to claim information.',
  'CLAIM_EDITOR_ONLY',
);
