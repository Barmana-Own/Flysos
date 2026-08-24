import fs from 'node:fs/promises';

import { query, transaction } from '../config/db.js';

async function main() {
  const files = await query('SELECT path FROM UploadedFile WHERE claimId IS NOT NULL');
  const countRows = await query('SELECT COUNT(*) AS total FROM Claim');
  const total = Number(countRows[0]?.total || 0);

  await transaction(async (tx) => {
    await tx.query('DELETE FROM Claim');
  });

  let removedFiles = 0;
  for (const file of files) {
    if (!file.path) continue;
    try {
      await fs.unlink(file.path);
      removedFiles += 1;
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        console.warn(`Could not remove uploaded file: ${file.path}`);
      }
    }
  }

  console.log(JSON.stringify({
    ok: true,
    deletedClaims: total,
    removedUploadedFiles: removedFiles,
  }));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
