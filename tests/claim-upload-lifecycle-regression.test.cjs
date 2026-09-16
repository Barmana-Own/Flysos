const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const controllerPath = path.resolve(__dirname, '..', 'backend', 'controllers', 'claimController.js');
const jobServicePath = path.resolve(__dirname, '..', 'backend', 'services', 'ticketExtractionJobService.js');

test('ticket extraction is queued after the upload response path', () => {
  const controller = fs.readFileSync(controllerPath, 'utf8');
  const jobService = fs.readFileSync(jobServicePath, 'utf8');

  assert.match(controller, /scheduleTicketExtraction/);
  assert.match(controller, /pending: ticketExtractionQueued/);
  assert.doesNotMatch(controller, /const extractedData = await extractTicketData\(/);
  assert.match(jobService, /setImmediate/);
  assert.match(jobService, /processTicketExtraction/);
});

test('background extraction persists through one short transaction and isolates persistence failures', async () => {
  process.env.DB_NAME = 'ticket_extraction_regression';
  process.env.DB_USER = 'ticket_extraction_regression';
  process.env.DB_PASSWORD = '';

  const {
    processTicketExtraction,
    scheduleTicketExtraction,
  } = await import('../backend/services/ticketExtractionJobService.js');

  const queryCalls = [];
  const transactionCalls = [];
  const fakeQuery = async (sql, params) => {
    queryCalls.push({ sql, params });
    return [{ id: 'uploaded-file-1' }];
  };
  const fakeTransaction = async (callback) => {
    transactionCalls.push('begin');
    const result = await callback({
      query: async (sql, params) => {
        queryCalls.push({ sql, params, transaction: true });
        if (sql.startsWith('SELECT id FROM FlightInfo')) return [];
        return [];
      },
    });
    transactionCalls.push('commit');
    return result;
  };

  const result = await processTicketExtraction(
    {
      file: {
        id: 'uploaded-file-1',
        path: 'uploads/ticket.pdf',
        mimetype: 'application/pdf',
        filename: 'ticket.pdf',
      },
      claim: { id: 'claim-1', nationalId: '0012345678', customerId: 'customer-1' },
    },
    {
      query: fakeQuery,
      transaction: fakeTransaction,
      extractTicketData: async () => ({
        passengerName: 'Passenger',
        airline: 'Airline',
        flightNumber: 'AB123',
        rawText: 'ticket text',
      }),
      hasTicketFields: () => true,
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.extracted, true);
  assert.deepEqual(transactionCalls, ['begin', 'commit']);
  assert.equal(queryCalls.length, 6);
  assert.match(queryCalls[0].sql, /UploadedFile/);

  const failedPersistence = await processTicketExtraction(
    {
      file: {
        id: 'uploaded-file-1',
        path: 'uploads/ticket.pdf',
        mimetype: 'application/pdf',
        filename: 'ticket.pdf',
      },
      claim: { id: 'claim-1', nationalId: '0012345678' },
    },
    {
      query: fakeQuery,
      transaction: async () => {
        throw Object.assign(new Error('database unavailable'), { code: 'ECONNRESET' });
      },
      extractTicketData: async () => ({
        passengerName: 'Passenger',
        airline: 'Airline',
        flightNumber: 'AB123',
      }),
      hasTicketFields: () => true,
    },
  );

  assert.equal(failedPersistence.ok, false);
  assert.equal(failedPersistence.extracted, true);
  assert.match(failedPersistence.warning, /could not be saved/i);

  let scheduledCallback;
  let processed = false;
  const queued = scheduleTicketExtraction(
    { file: {}, claim: {} },
    {
      enqueue: (callback) => {
        scheduledCallback = callback;
        return 'queued';
      },
      process: async () => {
        processed = true;
      },
    },
  );
  assert.equal(queued, 'queued');
  assert.equal(processed, false);
  await scheduledCallback();
  assert.equal(processed, true);
});
