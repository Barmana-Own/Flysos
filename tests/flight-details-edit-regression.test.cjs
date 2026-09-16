const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

async function loadClaimMapper() {
  return import('../backend/services/claimMapper.js');
}

function makeClaim(overrides = {}) {
  return {
    id: 'claim-1',
    trackingCode: 'FS534281',
    claimType: 'delay',
    status: 'under_review',
    stage: 2,
    nationalId: '0012345678',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    questionnaire: [],
    files: [],
    statusHistory: [],
    notes: [],
    ...overrides,
  };
}

test('admin mapping keeps manually edited destination ahead of stale OCR data', async () => {
  const { mapClaimForAdmin } = await loadClaimMapper();
  const claim = makeClaim({
    extractedTicketData: JSON.stringify({
      destination: 'مقصد قدیمی OCR',
      issueDate: 'تاریخ قدیمی OCR',
    }),
    flightInfo: {
      destination: 'مقصد جدید',
      ticketIssueDate: 'تاریخ صدور جدید',
    },
  });

  const mapped = mapClaimForAdmin(claim);

  assert.equal(mapped.destination, 'مقصد جدید');
  assert.equal(mapped.ticketIssueDate, 'تاریخ صدور جدید');
});

test('admin mapping falls back to OCR values when editable flight values are absent', async () => {
  const { mapClaimForAdmin } = await loadClaimMapper();
  const claim = makeClaim({
    extractedTicketData: JSON.stringify({
      destination: 'مقصد OCR',
      issueDate: 'تاریخ OCR',
    }),
    flightInfo: {
      destination: null,
      ticketIssueDate: null,
    },
  });

  const mapped = mapClaimForAdmin(claim);

  assert.equal(mapped.destination, 'مقصد OCR');
  assert.equal(mapped.ticketIssueDate, 'تاریخ OCR');
});

test('admin flight update schema keeps the editable ticket issue date', async () => {
  const { updateClaimSchema } = await import('../backend/validation/adminSchemas.js');
  const result = updateClaimSchema.safeParse({
    flightInfo: { ticketIssueDate: '۱۴۰۵/۰۵/۰۷' },
  });

  assert.equal(result.success, true);
  assert.equal(result.data.flightInfo.ticketIssueDate, '۱۴۰۵/۰۵/۰۷');
});

test('admin flight update writes the editable ticket issue date to FlightInfo', () => {
  const controller = fs.readFileSync(
    path.join(__dirname, '..', 'backend', 'controllers', 'adminController.js'),
    'utf8',
  );

  assert.match(
    controller,
    /allowedFlightFields = \['passengerName', 'airline', 'flightNumber', 'flightDate', 'scheduledTime', 'ticketIssueDate'/,
  );
});
