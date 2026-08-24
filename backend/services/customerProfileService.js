import { query } from '../config/db.js';

let customerProfileColumnsReady;

export async function ensureCustomerProfileColumns() {
  if (!customerProfileColumnsReady) {
    customerProfileColumnsReady = (async () => {
      const columns = await query(
        'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = "Customer"'
      );
      const existing = new Set(columns.map((column) => column.COLUMN_NAME));

      if (!existing.has('notes')) {
        await query('ALTER TABLE Customer ADD COLUMN notes LONGTEXT NULL AFTER birthDate');
      }
    })().catch((error) => {
      customerProfileColumnsReady = undefined;
      throw error;
    });
  }

  return customerProfileColumnsReady;
}
