import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { query, transaction } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const MAX_BLOCKS = 250;
const MAX_DEPTH = 6;
const PROTECTED_SLUGS = new Set(['home', 'about', 'faq', 'rules']);
const SUPPORTED_BLOCKS = new Set([
  'hero', 'banner', 'title', 'heading', 'paragraph', 'rich-text', 'image', 'gallery',
  'video', 'button', 'features', 'services', 'pricing', 'team', 'testimonials',
  'partners', 'contact-form', 'faq', 'claim-form', 'container', 'section', 'columns',
  'newsletter', 'statistics', 'timeline', 'accordion', 'cards', 'blog-list',
  'product-list', 'flight-search', 'live-flights', 'html', 'spacer', 'divider', 'map', 'footer',
  'site-header', 'site-footer',
]);
const STYLE_KEYS = new Set([
  'color', 'background', 'backgroundColor', 'backgroundImage', 'fontFamily', 'fontSize',
  'fontWeight', 'lineHeight', 'width', 'maxWidth', 'minHeight', 'height', 'padding',
  'margin', 'gap', 'borderRadius', 'border', 'borderColor', 'borderWidth', 'shadow',
  'boxShadow', 'opacity', 'display', 'textAlign', 'direction', 'objectFit', 'overlayOpacity',
  'gridTemplateColumns', 'gridTemplateRows', 'alignItems', 'justifyContent', 'flexDirection',
  'backgroundPosition', 'backgroundSize', 'position', 'overflow',
]);
const URL_KEYS = new Set(['url', 'image', 'src', 'href', 'link', 'primaryUrl', 'secondaryUrl', 'canonical', 'openGraphImage']);

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function parseJsonStrict(value, fallback, field) {
  if (value === null || value === undefined || value === '') return fallback;
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new AppError(`محتوای ذخیره‌شده صفحه در بخش ${field} معتبر نیست.`, 422, 'INVALID_PAGE_CONTENT');
  }
}

function cleanText(value, field, max = 191, required = false) {
  const text = String(value ?? '').trim();
  if (required && !text) throw new AppError(`${field} is required.`, 400, 'VALIDATION_ERROR');
  if (text.length > max) throw new AppError(`${field} is too long.`, 400, 'VALIDATION_ERROR');
  return text;
}

function cleanSlug(value) {
  const slug = cleanText(value, 'slug', 191, true).toLowerCase().replace(/^\/+|\/+$/g, '').replace(/\s+/g, '-');
  if (!/^[\p{L}\p{N}][\p{L}\p{N}-]*$/u.test(slug)) throw new AppError('Slug may contain letters, numbers, and hyphens only.', 400, 'INVALID_SLUG');
  return slug;
}

function cleanUrl(value, field) {
  const url = cleanText(value, field, 2000);
  if (!url || url.startsWith('/') || url.startsWith('#') || url.startsWith('data:image/')) return url;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) throw new Error('unsafe protocol');
    return url;
  } catch {
    throw new AppError(`${field} contains an unsafe URL.`, 400, 'UNSAFE_URL');
  }
}

function cleanRecord(value, depth = 0) {
  if (depth > MAX_DEPTH) throw new AppError('CMS content nesting is too deep.', 400, 'INVALID_CONTENT');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => cleanRecord(item, depth + 1));
  if (!value || typeof value !== 'object') return '';

  const output = Object.create(null);
  for (const [key, item] of Object.entries(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) continue;
    output[key] = URL_KEYS.has(key) && typeof item === 'string'
      ? cleanUrl(item, `content.${key}`)
      : cleanRecord(item, depth + 1);
  }
  return output;
}

function cleanStyles(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (!STYLE_KEYS.has(key)) continue;
    output[key] = typeof item === 'number' || typeof item === 'boolean' ? item : cleanText(item, `styles.${key}`, 500);
  }
  return output;
}

function cleanResponsive(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const output = {};
  for (const device of ['desktop', 'tablet', 'mobile']) {
    if (input[device]) output[device] = cleanStyles(input[device]);
  }
  return output;
}

function cleanAnimations(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const allowed = new Set(['none', 'fade', 'fade-up', 'fade-down', 'slide-left', 'slide-right', 'zoom-in']);
  return {
    type: allowed.has(input.type) ? input.type : 'none',
    duration: Math.min(5000, Math.max(0, Number(input.duration) || 500)),
    delay: Math.min(5000, Math.max(0, Number(input.delay) || 0)),
  };
}

function sanitizeHtml(value) {
  return String(value || '')
    .replace(/<\/?(?:script|style|iframe|object|embed|form|meta|link)\b[^>]*>/gi, '')
    .replace(/\s(?:on\w+|style|srcdoc)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(?:href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\1/gi, 'href="#"');
}

function cleanBlockList(value, seen = new Set(), depth = 0) {
  if (!Array.isArray(value)) throw new AppError('Block content must be an array.', 400, 'VALIDATION_ERROR');
  if (value.length > MAX_BLOCKS) throw new AppError(`A page can contain at most ${MAX_BLOCKS} blocks.`, 400, 'VALIDATION_ERROR');
  if (depth > MAX_DEPTH) throw new AppError('Block nesting is too deep.', 400, 'INVALID_BLOCK_TREE');

  return value.map((block, index) => {
    if (!block || typeof block !== 'object' || Array.isArray(block)) throw new AppError('Every block must be an object.', 400, 'VALIDATION_ERROR');
    const id = cleanText(block.id || randomUUID(), 'block.id', 191, true);
    if (seen.has(id)) throw new AppError(`Duplicate block id: ${id}`, 400, 'DUPLICATE_BLOCK_ID');
    seen.add(id);
    const type = cleanText(block.type, 'block.type', 60, true);
    if (!SUPPORTED_BLOCKS.has(type)) throw new AppError(`Unsupported block type: ${type}`, 400, 'UNSUPPORTED_BLOCK');
    const content = cleanRecord(block.content || {});
    if (type === 'html' && typeof content.html === 'string') content.html = sanitizeHtml(content.html);
    return {
      id, type, order: index, visible: block.visible !== false,
      content,
      styles: cleanStyles(block.styles),
      settings: cleanRecord(block.settings || {}),
      animations: cleanAnimations(block.animations),
      responsive: cleanResponsive(block.responsive),
      children: cleanBlockList(block.children || [], seen, depth + 1),
    };
  });
}

function cleanSeo(value) {
  const seo = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    metaTitle: cleanText(seo.metaTitle, 'seo.metaTitle', 191),
    metaDescription: cleanText(seo.metaDescription, 'seo.metaDescription', 500),
    keywords: cleanText(seo.keywords, 'seo.keywords', 500),
    category: cleanText(seo.category, 'seo.category', 120),
    tags: cleanText(seo.tags, 'seo.tags', 500),
    canonical: cleanUrl(seo.canonical, 'seo.canonical'),
    robotsIndex: seo.robotsIndex !== false,
    robotsFollow: seo.robotsFollow !== false,
    openGraphTitle: cleanText(seo.openGraphTitle, 'seo.openGraphTitle', 191),
    openGraphDescription: cleanText(seo.openGraphDescription, 'seo.openGraphDescription', 500),
    openGraphImage: cleanUrl(seo.openGraphImage, 'seo.openGraphImage'),
  };
}

function draftBlocksFrom(row, strict = false) {
  const read = strict ? parseJsonStrict : parseJson;
  const draft = read(row.draftBlocks, null, 'draftBlocks');
  if (Array.isArray(draft) && draft.length) return draft;
  const published = read(row.publishedBlocks, null, 'publishedBlocks');
  if (Array.isArray(draft) && draft.length === 0 && Array.isArray(published) && published.length) return published;
  const legacy = read(row.blocks, [], 'blocks');
  return Array.isArray(draft) ? draft : Array.isArray(legacy) ? legacy : [];
}

function mapAdminPage(row, includeBlocks = true) {
  const read = includeBlocks ? parseJsonStrict : parseJson;
  const draftBlocks = draftBlocksFrom(row, includeBlocks);
  const legacyBlocks = read(row.blocks, [], 'blocks');
  const publishedBlocks = read(row.publishedBlocks, row.status === 'published' ? legacyBlocks : [], 'publishedBlocks');
  const legacySeo = read(row.seo, {}, 'seo');
  const draftSeo = read(row.draftSeo, legacySeo, 'draftSeo');
  const publishedSeo = read(row.publishedSeo, row.status === 'published' ? legacySeo : {}, 'publishedSeo');
  const result = {
    id: row.id, title: row.title, slug: row.slug, status: row.status,
    seo: draftSeo, draftSeo, publishedSeo,
    publishedAt: row.publishedAt, createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
  if (includeBlocks) Object.assign(result, { blocks: draftBlocks, draftBlocks, publishedBlocks });
  else result.blockCount = draftBlocks.length;
  return result;
}

function cleanLayoutType(value) {
  const type = cleanText(value, 'layoutType', 30, true);
  if (!['header', 'footer'].includes(type)) throw new AppError('نوع چیدمان سراسری معتبر نیست.', 400, 'INVALID_LAYOUT_TYPE');
  return type;
}

function mapGlobalLayout(row, publishedOnly = false) {
  const publishedBlocks = parseJsonStrict(row.publishedBlocks, [], 'publishedBlocks');
  if (publishedOnly) return {
    id: row.id, layoutType: row.layoutType, title: row.title, status: 'published',
    blocks: publishedBlocks, publishedAt: row.publishedAt, updatedAt: row.updatedAt,
  };
  const draftBlocks = parseJsonStrict(row.draftBlocks, publishedBlocks, 'draftBlocks');
  return {
    id: row.id, layoutType: row.layoutType, title: row.title, status: row.status,
    blocks: draftBlocks, draftBlocks, publishedBlocks,
    publishedAt: row.publishedAt, createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

async function findPage(id) {
  const rows = await query('SELECT * FROM `CmsPage` WHERE `id` = ? LIMIT 1', [id]);
  if (!rows[0]) throw new AppError('Page not found.', 404, 'PAGE_NOT_FOUND');
  return rows[0];
}

async function createVersion(tx, page, adminId) {
  const rows = await tx.query('SELECT COALESCE(MAX(`versionNumber`), 0) + 1 AS `nextVersion` FROM `CmsPageVersion` WHERE `pageId` = ?', [page.id]);
  const versionNumber = Number(rows[0]?.nextVersion || 1);
  const blocks = JSON.stringify(draftBlocksFrom(page, true));
  const seo = JSON.stringify(parseJsonStrict(page.draftSeo, parseJsonStrict(page.seo, {}, 'seo'), 'draftSeo'));
  await tx.query(
    'INSERT INTO `CmsPageVersion` (`id`,`pageId`,`versionNumber`,`title`,`slug`,`status`,`blocks`,`seo`,`createdByAdminId`) VALUES (?,?,?,?,?,?,?,?,?)',
    [randomUUID(), page.id, versionNumber, page.title, page.slug, page.status, blocks, seo, adminId || null]
  );
}

export async function listCmsPages(_req, res) {
  const rows = await query('SELECT * FROM `CmsPage` ORDER BY `updatedAt` DESC', []);
  res.json(rows.map((row) => mapAdminPage(row, false)));
}

export async function getCmsPage(req, res) { res.json(mapAdminPage(await findPage(req.params.id))); }

export async function getPublishedCmsPage(req, res) {
  const rows = await query('SELECT * FROM `CmsPage` WHERE `slug` = ? AND `status` = ? LIMIT 1', [cleanSlug(req.params.slug), 'published']);
  if (!rows[0]) throw new AppError('Published page not found.', 404, 'PAGE_NOT_FOUND');
  const row = rows[0];
  const blocks = parseJsonStrict(row.publishedBlocks, [], 'publishedBlocks');
  if (!Array.isArray(blocks) || blocks.length === 0) throw new AppError('Published page has no content.', 404, 'PAGE_NOT_FOUND');
  res.json({
    id: row.id, title: row.title, slug: row.slug, status: 'published', blocks,
    seo: parseJsonStrict(row.publishedSeo, {}, 'publishedSeo'), publishedAt: row.publishedAt, updatedAt: row.updatedAt,
  });
}

export async function listCmsGlobalLayouts(_req, res) {
  const rows = await query('SELECT * FROM `CmsGlobalLayout` ORDER BY `layoutType`', []);
  res.json(rows.map((row) => mapGlobalLayout(row)));
}

export async function getCmsGlobalLayout(req, res) {
  const type = cleanLayoutType(req.params.type);
  const rows = await query('SELECT * FROM `CmsGlobalLayout` WHERE `layoutType`=? LIMIT 1', [type]);
  if (!rows[0]) throw new AppError('چیدمان سراسری پیدا نشد.', 404, 'GLOBAL_LAYOUT_NOT_FOUND');
  res.json(mapGlobalLayout(rows[0]));
}

export async function updateCmsGlobalLayout(req, res) {
  const type = cleanLayoutType(req.params.type);
  const rows = await query('SELECT * FROM `CmsGlobalLayout` WHERE `layoutType`=? LIMIT 1', [type]);
  if (!rows[0]) throw new AppError('چیدمان سراسری پیدا نشد.', 404, 'GLOBAL_LAYOUT_NOT_FOUND');
  const stored = parseJsonStrict(rows[0].draftBlocks, [], 'draftBlocks');
  const blocks = cleanBlockList(req.body?.draftBlocks ?? req.body?.blocks ?? stored);
  const title = req.body?.title === undefined ? rows[0].title : cleanText(req.body.title, 'title', 191, true);
  await query('UPDATE `CmsGlobalLayout` SET `title`=?,`draftBlocks`=?,`updatedByAdminId`=? WHERE `layoutType`=?', [title, JSON.stringify(blocks), req.admin.id, type]);
  const updated = await query('SELECT * FROM `CmsGlobalLayout` WHERE `layoutType`=? LIMIT 1', [type]);
  res.json(mapGlobalLayout(updated[0]));
}

export async function publishCmsGlobalLayout(req, res) {
  const type = cleanLayoutType(req.params.type);
  const rows = await query('SELECT * FROM `CmsGlobalLayout` WHERE `layoutType`=? LIMIT 1', [type]);
  if (!rows[0]) throw new AppError('چیدمان سراسری پیدا نشد.', 404, 'GLOBAL_LAYOUT_NOT_FOUND');
  const blocks = cleanBlockList(parseJsonStrict(rows[0].draftBlocks, [], 'draftBlocks'));
  if (!blocks.length) throw new AppError('چیدمان خالی قابل انتشار نیست.', 400, 'EMPTY_LAYOUT');
  await query('UPDATE `CmsGlobalLayout` SET `status`=?,`publishedBlocks`=?,`publishedAt`=NOW(3),`updatedByAdminId`=? WHERE `layoutType`=?', ['published', JSON.stringify(blocks), req.admin.id, type]);
  const updated = await query('SELECT * FROM `CmsGlobalLayout` WHERE `layoutType`=? LIMIT 1', [type]);
  res.json(mapGlobalLayout(updated[0]));
}

export async function getPublishedCmsGlobalLayouts(_req, res) {
  const rows = await query("SELECT * FROM `CmsGlobalLayout` WHERE `status`='published' ORDER BY `layoutType`", []);
  res.json(rows.filter((row) => Array.isArray(parseJson(row.publishedBlocks, [])) && parseJson(row.publishedBlocks, []).length > 0).map((row) => mapGlobalLayout(row, true)));
}

export async function createCmsPage(req, res) {
  const id = randomUUID();
  const title = cleanText(req.body?.title, 'title', 191, true);
  const slug = cleanSlug(req.body?.slug);
  const draftBlocks = cleanBlockList(req.body?.draftBlocks ?? req.body?.blocks ?? []);
  const draftSeo = cleanSeo(req.body?.draftSeo ?? req.body?.seo);
  try {
    await query(
      'INSERT INTO `CmsPage` (`id`,`title`,`slug`,`status`,`blocks`,`seo`,`draftBlocks`,`publishedBlocks`,`draftSeo`,`publishedSeo`,`createdByAdminId`,`updatedByAdminId`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [id, title, slug, 'draft', JSON.stringify(draftBlocks), JSON.stringify(draftSeo), JSON.stringify(draftBlocks), null, JSON.stringify(draftSeo), null, req.admin.id, req.admin.id]
    );
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') throw new AppError('This page slug already exists.', 409, 'SLUG_EXISTS');
    throw error;
  }
  res.status(201).json(mapAdminPage(await findPage(id)));
}

export async function updateCmsPage(req, res) {
  const existing = await findPage(req.params.id);
  const title = req.body?.title === undefined ? existing.title : cleanText(req.body.title, 'title', 191, true);
  const slug = req.body?.slug === undefined ? existing.slug : cleanSlug(req.body.slug);
  const draftBlocks = req.body?.draftBlocks === undefined && req.body?.blocks === undefined
    ? draftBlocksFrom(existing, true)
    : cleanBlockList(req.body?.draftBlocks ?? req.body?.blocks);
  const draftSeo = req.body?.draftSeo === undefined && req.body?.seo === undefined
    ? parseJsonStrict(existing.draftSeo, parseJsonStrict(existing.seo, {}, 'seo'), 'draftSeo')
    : cleanSeo(req.body?.draftSeo ?? req.body?.seo);
  try {
    await transaction(async (tx) => {
      await tx.query(
        'UPDATE `CmsPage` SET `title`=?,`slug`=?,`draftBlocks`=?,`draftSeo`=?,`updatedByAdminId`=? WHERE `id`=?',
        [title, slug, JSON.stringify(draftBlocks), JSON.stringify(draftSeo), req.admin.id, existing.id]
      );
      if (req.body?.saveVersion === true) await createVersion(tx, { ...existing, title, slug, draftBlocks: JSON.stringify(draftBlocks), draftSeo: JSON.stringify(draftSeo) }, req.admin.id);
    });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') throw new AppError('This page slug already exists.', 409, 'SLUG_EXISTS');
    throw error;
  }
  res.json(mapAdminPage(await findPage(existing.id)));
}

export async function publishCmsPage(req, res) {
  const existing = await findPage(req.params.id);
  const draftBlocks = cleanBlockList(draftBlocksFrom(existing, true));
  if (!draftBlocks.length) throw new AppError('An empty page cannot be published.', 400, 'EMPTY_PAGE');
  const draftSeo = cleanSeo(parseJsonStrict(existing.draftSeo, parseJsonStrict(existing.seo, {}, 'seo'), 'draftSeo'));
  await transaction(async (tx) => {
    await createVersion(tx, existing, req.admin.id);
    await tx.query(
      'UPDATE `CmsPage` SET `status`=?,`publishedBlocks`=?,`publishedSeo`=?,`publishedAt`=NOW(3),`updatedByAdminId`=? WHERE `id`=?',
      ['published', JSON.stringify(draftBlocks), JSON.stringify(draftSeo), req.admin.id, existing.id]
    );
  });
  res.json(mapAdminPage(await findPage(existing.id)));
}

export async function unpublishCmsPage(req, res) {
  const existing = await findPage(req.params.id);
  await query('UPDATE `CmsPage` SET `status`=?,`publishedAt`=NULL,`updatedByAdminId`=? WHERE `id`=?', ['draft', req.admin.id, existing.id]);
  res.json(mapAdminPage(await findPage(existing.id)));
}

export async function duplicateCmsPage(req, res) {
  const existing = await findPage(req.params.id);
  const id = randomUUID();
  let slug = `${existing.slug}-copy`;
  const matching = await query('SELECT COUNT(*) AS `count` FROM `CmsPage` WHERE `slug` LIKE ?', [`${slug}%`]);
  if (Number(matching[0]?.count || 0) > 0) slug = `${slug}-${Number(matching[0].count) + 1}`;
  const draftBlocks = JSON.stringify(draftBlocksFrom(existing, true));
  const draftSeo = JSON.stringify(parseJsonStrict(existing.draftSeo, parseJsonStrict(existing.seo, {}, 'seo'), 'draftSeo'));
  await query(
    'INSERT INTO `CmsPage` (`id`,`title`,`slug`,`status`,`blocks`,`seo`,`draftBlocks`,`draftSeo`,`createdByAdminId`,`updatedByAdminId`) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [id, `${existing.title} (کپی)`, slug, 'draft', draftBlocks, draftSeo, draftBlocks, draftSeo, req.admin.id, req.admin.id]
  );
  res.status(201).json(mapAdminPage(await findPage(id)));
}

export async function deleteCmsPage(req, res) {
  const existing = await findPage(req.params.id);
  if (PROTECTED_SLUGS.has(existing.slug)) throw new AppError('Built-in pages cannot be deleted.', 409, 'PROTECTED_PAGE');
  await query('DELETE FROM `CmsPage` WHERE `id` = ?', [existing.id]);
  res.status(204).end();
}

export async function listCmsPageVersions(req, res) {
  await findPage(req.params.id);
  const rows = await query('SELECT `id`,`pageId`,`versionNumber`,`title`,`slug`,`status`,`createdAt` FROM `CmsPageVersion` WHERE `pageId`=? ORDER BY `versionNumber` DESC LIMIT 50', [req.params.id]);
  res.json(rows);
}

export async function restoreCmsPageVersion(req, res) {
  const rows = await query('SELECT * FROM `CmsPageVersion` WHERE `id`=? AND `pageId`=? LIMIT 1', [req.params.versionId, req.params.id]);
  if (!rows[0]) throw new AppError('Version not found.', 404, 'VERSION_NOT_FOUND');
  const version = rows[0];
  await query('UPDATE `CmsPage` SET `title`=?,`slug`=?,`draftBlocks`=?,`draftSeo`=?,`updatedByAdminId`=? WHERE `id`=?', [version.title, version.slug, version.blocks, version.seo, req.admin.id, req.params.id]);
  res.json(mapAdminPage(await findPage(req.params.id)));
}

export async function listCmsMedia(req, res) {
  const search = cleanText(req.query.search, 'search', 150);
  const rows = search
    ? await query('SELECT * FROM `CmsMedia` WHERE `originalName` LIKE ? OR `title` LIKE ? ORDER BY `createdAt` DESC LIMIT 200', [`%${search}%`, `%${search}%`])
    : await query('SELECT * FROM `CmsMedia` ORDER BY `createdAt` DESC LIMIT 200', []);
  res.json(rows);
}

export async function uploadCmsMedia(req, res) {
  if (!req.file) throw new AppError('A media file is required.', 400, 'FILE_REQUIRED');
  if (!req.file.mimetype.startsWith('image/') && req.file.mimetype !== 'application/pdf') {
    throw new AppError('Only image and PDF uploads are supported.', 415, 'UNSUPPORTED_FILE_TYPE');
  }
  const id = randomUUID();
  const url = `/uploads/${encodeURIComponent(req.file.filename)}`;
  await query(
    'INSERT INTO `CmsMedia` (`id`,`filename`,`originalName`,`mimetype`,`size`,`url`,`category`,`altText`,`title`,`description`,`uploadedByAdminId`) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [id, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, url, cleanText(req.body?.category, 'category', 100), cleanText(req.body?.altText, 'altText', 300), cleanText(req.body?.title || req.file.originalname, 'title', 191), cleanText(req.body?.description, 'description', 2000), req.admin.id]
  );
  const rows = await query('SELECT * FROM `CmsMedia` WHERE `id`=?', [id]);
  res.status(201).json(rows[0]);
}

export async function updateCmsMedia(req, res) {
  const rows = await query('SELECT * FROM `CmsMedia` WHERE `id`=? LIMIT 1', [req.params.id]);
  if (!rows[0]) throw new AppError('Media not found.', 404, 'MEDIA_NOT_FOUND');
  await query('UPDATE `CmsMedia` SET `category`=?,`altText`=?,`title`=?,`description`=? WHERE `id`=?', [
    cleanText(req.body?.category ?? rows[0].category, 'category', 100), cleanText(req.body?.altText ?? rows[0].altText, 'altText', 300),
    cleanText(req.body?.title ?? rows[0].title, 'title', 191), cleanText(req.body?.description ?? rows[0].description, 'description', 2000), req.params.id,
  ]);
  const updated = await query('SELECT * FROM `CmsMedia` WHERE `id`=?', [req.params.id]);
  res.json(updated[0]);
}

export async function deleteCmsMedia(req, res) {
  const rows = await query('SELECT * FROM `CmsMedia` WHERE `id`=? LIMIT 1', [req.params.id]);
  if (!rows[0]) throw new AppError('Media not found.', 404, 'MEDIA_NOT_FOUND');
  await query('DELETE FROM `CmsMedia` WHERE `id`=?', [req.params.id]);
  await fs.unlink(path.resolve(process.cwd(), env.uploadDir, rows[0].filename)).catch(() => undefined);
  res.status(204).end();
}
