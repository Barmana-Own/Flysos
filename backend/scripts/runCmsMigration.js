import fs from 'node:fs/promises';
import path from 'node:path';

import { pool } from '../config/db.js';
import { seedCmsPageContent } from '../services/cmsSeedService.js';

const migrationPath = path.resolve(process.cwd(), 'database', 'alter_cms_page_builder.sql');

try {
  const sql = await fs.readFile(migrationPath, 'utf8');
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    for (let index = 0; index < statements.length; index += 1) {
      const statement = statements[index];
      await connection.query(statement);
      if (index === 0) {
        const [columns] = await connection.query('SHOW COLUMNS FROM `CmsPage`');
        const existing = new Set(columns.map((column) => column.Field));
        const additions = [
          ['draftBlocks', 'LONGTEXT NULL'], ['publishedBlocks', 'LONGTEXT NULL'],
          ['draftSeo', 'LONGTEXT NULL'], ['publishedSeo', 'LONGTEXT NULL'],
        ];
        for (const [name, definition] of additions) {
          if (!existing.has(name)) await connection.query(`ALTER TABLE \`CmsPage\` ADD COLUMN \`${name}\` ${definition}`);
        }
      }
    }
    await connection.query('UPDATE `CmsPage` SET `draftBlocks`=COALESCE(`draftBlocks`,`blocks`,?), `draftSeo`=COALESCE(`draftSeo`,`seo`,?)', ['[]', '{}']);
    await connection.query("UPDATE `CmsPage` SET `publishedBlocks`=COALESCE(`publishedBlocks`,`blocks`), `publishedSeo`=COALESCE(`publishedSeo`,`seo`) WHERE `status`='published'");
    await seedCmsPageContent(connection);
    await connection.commit();
    console.log('CMS Page Builder migration completed successfully.');
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
} catch (error) {
  console.error(`CMS migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
