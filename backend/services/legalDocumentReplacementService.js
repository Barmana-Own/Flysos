import fs from 'node:fs/promises';
import path from 'node:path';

const LEGAL_DOCUMENT_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: 'powerOfAttorney',
    settingColumn: 'powerOfAttorneyUrl',
    legacySettingColumn: 'powerOfAttorneyDocumentUrl',
    aliases: Object.freeze([
      'powerOfAttorney',
      'power-of-attorney',
      'power_of_attorney',
      'powerOfAttorneyUrl',
      'powerOfAttorneyDocumentUrl',
    ]),
    titles: Object.freeze(['نمونه وکالت‌نامه رسمی', 'نمونه وکالتنامه رسمی']),
  }),
  Object.freeze({
    key: 'passengerRights',
    settingColumn: 'rightsDocumentUrl',
    legacySettingColumn: 'passengerRightsUrl',
    aliases: Object.freeze([
      'passengerRights',
      'passenger-rights',
      'passenger_rights',
      'passengerRightsUrl',
      'rightsDocumentUrl',
    ]),
    titles: Object.freeze(['آیین‌نامه حقوق مسافر', 'آیین نامه حقوق مسافر']),
  }),
]);

function normalizeLookupValue(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[\u200c\u200f\u202a-\u202e]/gu, '')
    .replace(/[يى]/gu, 'ی')
    .replace(/ك/gu, 'ک')
    .replace(/ۀ/gu, 'ه')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

export function resolveLegalDocumentDefinition(input = {}) {
  const documentKey = normalizeLookupValue(input.documentKey);
  const title = normalizeLookupValue(input.title);

  return LEGAL_DOCUMENT_DEFINITIONS.find((definition) => (
    definition.aliases.some((alias) => normalizeLookupValue(alias) === documentKey)
    || definition.titles.some((candidate) => normalizeLookupValue(candidate) === title)
  )) || null;
}

function decodeUploadPath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function resolveManagedUploadPath(documentUrl, uploadDirectory) {
  const value = String(documentUrl ?? '').trim();
  if (!value || !uploadDirectory) return null;

  const prefixes = ['/api/uploads/', '/uploads/'];
  const prefix = prefixes.find((candidate) => value.startsWith(candidate));
  if (!prefix) return null;

  const rawRelative = decodeUploadPath(value.slice(prefix.length).split(/[?#]/u, 1)[0]);
  if (!rawRelative) return null;
  const rawSegments = rawRelative.split(/[\\/]+/u);
  if (rawSegments.some((segment) => segment === '..' || segment === '.')) return null;

  let pathname;
  try {
    pathname = new URL(value, 'http://flysos.local').pathname;
  } catch {
    return null;
  }

  const pathnamePrefix = prefixes.find((candidate) => pathname.startsWith(candidate));
  if (!pathnamePrefix) return null;

  const decodedRelative = decodeUploadPath(pathname.slice(pathnamePrefix.length));
  if (!decodedRelative || decodedRelative.includes('\u0000')) return null;

  const segments = decodedRelative.split(/[\\/]+/u);
  if (segments.some((segment) => segment === '..' || segment === '.')) return null;

  const root = path.resolve(uploadDirectory);
  const candidate = path.resolve(root, decodedRelative);
  const relative = path.relative(root, candidate);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;

  return candidate;
}

export async function removeManagedUploadFile(filePath, uploadDirectory) {
  const uploadRoot = path.resolve(uploadDirectory);
  const managedPath = resolveManagedUploadPath(
    `/uploads/${path.relative(uploadRoot, path.resolve(filePath)).split(path.sep).join('/')}`,
    uploadRoot,
  );

  if (!managedPath || path.resolve(managedPath) !== path.resolve(filePath)) {
    return { removed: false };
  }

  try {
    const [realRoot, realParent] = await Promise.all([
      fs.realpath(uploadRoot),
      fs.realpath(path.dirname(managedPath)),
    ]);
    const parentRelative = path.relative(realRoot, realParent);
    if (parentRelative.startsWith('..') || path.isAbsolute(parentRelative)) {
      return { removed: false };
    }

    const stats = await fs.lstat(managedPath);
    if (!stats.isFile() || stats.isSymbolicLink()) return { removed: false };
    await fs.unlink(managedPath);
    return { removed: true };
  } catch (error) {
    if (error?.code === 'ENOENT') return { removed: false };
    throw error;
  }
}
