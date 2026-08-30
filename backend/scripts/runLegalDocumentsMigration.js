import { pool } from '../config/db.js';

async function columnExists(connection, table, column) {
  const [rows] = await connection.execute(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1',
    [table, column]
  );
  return rows.length > 0;
}

async function addColumn(connection, table, column, definition) {
  if (!(await columnExists(connection, table, column))) {
    await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
}

const connection = await pool.getConnection();
try {
  await connection.beginTransaction();

  await addColumn(connection, 'AppSetting', 'powerOfAttorneyUrl', 'LONGTEXT NULL');
  await addColumn(connection, 'AppSetting', 'rightsDocumentUrl', 'LONGTEXT NULL');

  if (await columnExists(connection, 'AppSetting', 'powerOfAttorneyDocumentUrl')) {
    await connection.query(
      'UPDATE AppSetting SET powerOfAttorneyUrl = COALESCE(powerOfAttorneyUrl, powerOfAttorneyDocumentUrl) WHERE id = "default"'
    );
  }

  if (await columnExists(connection, 'AppSetting', 'passengerRightsUrl')) {
    await connection.query(
      'UPDATE AppSetting SET rightsDocumentUrl = COALESCE(rightsDocumentUrl, passengerRightsUrl) WHERE id = "default"'
    );
  }

  await connection.commit();
  console.log('Legal document settings migration completed successfully.');
} catch (error) {
  await connection.rollback();
  console.error(`Legal document settings migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
}
