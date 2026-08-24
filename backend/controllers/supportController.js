import { createHash, randomUUID } from 'node:crypto';
import { query, transaction } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { sendAutomaticSms } from '../services/smsService.js';
import { getSmsTemplate } from '../services/smsTemplateService.js';

import {
  createSupportMessageSchema,
  createSupportTicketSchema,
  publicTicketQuerySchema,
  updateSupportTicketStatusSchema,
} from '../validation/supportSchemas.js';

function parseOrThrow(schema, value) {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new AppError(
      result.error.issues[0]?.message || 'Invalid request data.',
      400,
      'VALIDATION_ERROR'
    );
  }

  return result.data;
}

let supportAccessColumnReady;

async function ensureSupportAccessColumn() {
  if (!supportAccessColumnReady) {
    supportAccessColumnReady = (async () => {
      const columns = await query(
        'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = "SupportTicket" AND COLUMN_NAME = "publicAccessTokenHash"'
      );
      if (!columns.length) {
        await query('ALTER TABLE SupportTicket ADD COLUMN publicAccessTokenHash VARCHAR(64) NULL AFTER subject');
      }
    })().catch((error) => {
      supportAccessColumnReady = undefined;
      throw error;
    });
  }
  return supportAccessColumnReady;
}

function hashSupportToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function mapMessage(message) {
  return {
    id: message.id,
    sender: message.sender,
    body: message.body,
    createdAt: message.createdAt,

    author: message.authorAdmin
      ? {
          id: message.authorAdmin.id,
          username: message.authorAdmin.username,
          name: message.authorAdmin.name || message.authorAdmin.username,
        }
      : null,
  };
}

function mapTicket(ticket) {
  return {
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    lastMessageAt: ticket.lastMessageAt,
    closedAt: ticket.closedAt,

    customer: ticket.customer
      ? {
          id: ticket.customer.id,
          name: ticket.customer.name || '',
          nationalId: ticket.customer.nationalId,
          phoneNumber: ticket.customer.phoneNumber || '',
          email: ticket.customer.email || '',
        }
      : null,

    claim: ticket.claim
      ? {
          id: ticket.claim.id,
          trackingCode: ticket.claim.trackingCode,
          status: ticket.claim.status,
        }
      : null,

    messages: (ticket.messages || []).map(mapMessage),
  };
}

async function loadFullTicket(ticketId, tx = null) {
  const runner = tx || { query };
  const tickets = await runner.query('SELECT * FROM SupportTicket WHERE id = ?', [ticketId]);
  if (!tickets.length) return null;
  const ticket = tickets[0];

  // Normalize booleans and dates
  ticket.closedAt = ticket.closedAt ? new Date(ticket.closedAt) : null;
  ticket.lastMessageAt = ticket.lastMessageAt ? new Date(ticket.lastMessageAt) : new Date();
  ticket.createdAt = ticket.createdAt ? new Date(ticket.createdAt) : new Date();
  ticket.updatedAt = ticket.updatedAt ? new Date(ticket.updatedAt) : new Date();

  // Load customer
  let customer = null;
  if (ticket.customerId) {
    const customers = await runner.query('SELECT * FROM Customer WHERE id = ?', [ticket.customerId]);
    customer = customers[0] || null;
  }

  // Load claim
  let claim = null;
  if (ticket.claimId) {
    const claims = await runner.query('SELECT id, trackingCode, status FROM Claim WHERE id = ?', [ticket.claimId]);
    claim = claims[0] || null;
  }

  // Load messages
  const messages = await runner.query(
    'SELECT sm.*, au.username, au.name as adminName FROM SupportMessage sm LEFT JOIN AdminUser au ON sm.authorAdminId = au.id WHERE sm.ticketId = ? ORDER BY sm.createdAt ASC',
    [ticketId]
  );

  const mappedMessages = messages.map(msg => ({
    id: msg.id,
    ticketId: msg.ticketId,
    sender: msg.sender,
    body: msg.body,
    createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
    authorAdmin: msg.authorAdminId ? {
      id: msg.authorAdminId,
      username: msg.username,
      name: msg.adminName || msg.username
    } : null
  }));

  return {
    ...ticket,
    customer,
    claim,
    messages: mappedMessages
  };
}

async function getPublicTicketOrThrow(ticketId, req, nationalId) {
  await ensureSupportAccessColumn();
  const token = String(req.get('x-support-token') || '').trim();
  const tickets = token
    ? await query('SELECT * FROM SupportTicket WHERE id = ? AND publicAccessTokenHash = ? LIMIT 1', [ticketId, hashSupportToken(token)])
    : nationalId
      ? await query(
          'SELECT t.* FROM SupportTicket t JOIN Customer c ON t.customerId = c.id WHERE t.id = ? AND c.nationalId = ? LIMIT 1',
          [ticketId, nationalId]
        )
      : [];

  if (!tickets.length) {
    throw new AppError(
      'Support ticket not found.',
      404,
      'SUPPORT_TICKET_NOT_FOUND'
    );
  }

  return loadFullTicket(ticketId);
}

async function getAdminTicketOrThrow(ticketId) {
  const tickets = await query('SELECT * FROM SupportTicket WHERE id = ?', [ticketId]);

  if (!tickets.length) {
    throw new AppError(
      'Support ticket not found.',
      404,
      'SUPPORT_TICKET_NOT_FOUND'
    );
  }

  return loadFullTicket(ticketId);
}

export async function createPublicSupportTicket(req, res) {
  const body = parseOrThrow(createSupportTicketSchema, req.body);
  await ensureSupportAccessColumn();
  const publicAccessToken = randomUUID();
  const publicContactKey = body.email?.trim().toLowerCase() || body.phoneNumber?.trim() || randomUUID();
  const customerNationalId = body.nationalId || createHash('sha256')
    .update(`faq:${publicContactKey}`)
    .digest('hex')
    .slice(0, 10)
    .replace(/[a-f]/g, (character) => String(character.charCodeAt(0) % 10));

  const ticket = await transaction(async (tx) => {
    // Upsert customer
    const existingCustomers = await tx.query('SELECT id FROM Customer WHERE nationalId = ?', [customerNationalId]);
    let customerId;

    if (existingCustomers.length > 0) {
      customerId = existingCustomers[0].id;
      // Update details
      await tx.query(
        'UPDATE Customer SET name = COALESCE(?, name), email = COALESCE(?, email), phoneNumber = COALESCE(?, phoneNumber) WHERE id = ?',
        [body.name || null, body.email || null, body.phoneNumber || null, customerId]
      );
    } else {
      customerId = `clcust-${randomUUID()}`;
      await tx.query(
        'INSERT INTO Customer (id, nationalId, name, email, phoneNumber, status) VALUES (?, ?, ?, ?, ?, "active")',
        [customerId, customerNationalId, body.name || null, body.email || null, body.phoneNumber || null]
      );
    }

    // Find claim
    let claimId = null;
    if (body.claimTrackingCode) {
      const claims = await tx.query(
        'SELECT id FROM Claim WHERE trackingCode = ? AND nationalId = ? LIMIT 1',
        [body.claimTrackingCode, body.nationalId]
      );
      if (claims.length > 0) {
        claimId = claims[0].id;
      }
    }

    const ticketId = `cltkt-${randomUUID()}`;
    await tx.query(
      'INSERT INTO SupportTicket (id, customerId, claimId, subject, publicAccessTokenHash, status) VALUES (?, ?, ?, ?, ?, "open")',
      [ticketId, customerId, claimId, body.subject, hashSupportToken(publicAccessToken)]
    );

    const messageId = `clmsg-${randomUUID()}`;
    await tx.query(
      'INSERT INTO SupportMessage (id, ticketId, sender, body) VALUES (?, ?, "customer", ?)',
      [messageId, ticketId, body.message]
    );

    await tx.query(
      'INSERT INTO Notification (id, claimId, type, message) VALUES (?, ?, "support_ticket", ?)',
      [`clnot-${randomUUID()}`, claimId, `تیکت پشتیبانی جدید با موضوع «${body.subject}» ثبت شد.`]
    );

    return loadFullTicket(ticketId, tx);
  });

  if (ticket.customer?.phoneNumber) {
    await sendAutomaticSms(
      ticket.customer.phoneNumber,
      await getSmsTemplate('supportReceived', { ticketId: ticket.id })
    );
  }

  res.status(201).json({ ...mapTicket(ticket), accessToken: publicAccessToken });
}

export async function getPublicSupportTicket(req, res) {
  const querySchema = parseOrThrow(publicTicketQuerySchema, req.query);

  const ticket = await getPublicTicketOrThrow(
    req.params.id,
    req,
    querySchema.nationalId
  );

  res.json(mapTicket(ticket));
}

export async function addPublicSupportMessage(req, res) {
  const querySchema = parseOrThrow(publicTicketQuerySchema, req.query);
  const body = parseOrThrow(createSupportMessageSchema, req.body);

  await getPublicTicketOrThrow(req.params.id, req, querySchema.nationalId);

  const updatedTicket = await transaction(async (tx) => {
    const tickets = await tx.query('SELECT * FROM SupportTicket WHERE id = ? LIMIT 1', [req.params.id]);

    if (!tickets.length) {
      throw new AppError(
        'Support ticket not found.',
        404,
        'SUPPORT_TICKET_NOT_FOUND'
      );
    }

    const ticket = tickets[0];
    const messageId = `clmsg-${randomUUID()}`;
    await tx.query(
      'INSERT INTO SupportMessage (id, ticketId, sender, body) VALUES (?, ?, "customer", ?)',
      [messageId, ticket.id, body.body]
    );

    await tx.query(
      'UPDATE SupportTicket SET status = "open", closedAt = NULL, lastMessageAt = NOW() WHERE id = ?',
      [ticket.id]
    );

    await tx.query(
      'INSERT INTO Notification (id, claimId, type, message) VALUES (?, ?, "support_message", ?)',
      [`clnot-${randomUUID()}`, ticket.claimId || null, `پیام جدیدی برای تیکت «${ticket.subject}» ثبت شد.`]
    );

    return loadFullTicket(ticket.id, tx);
  });

  res.json(mapTicket(updatedTicket));
}

export async function listAdminSupportTickets(_req, res) {
  const tickets = await query('SELECT * FROM SupportTicket ORDER BY status ASC, lastMessageAt DESC');

  const mappedTickets = await Promise.all(
    tickets.map(async (ticket) => {
      // Normalize dates
      ticket.closedAt = ticket.closedAt ? new Date(ticket.closedAt) : null;
      ticket.lastMessageAt = ticket.lastMessageAt ? new Date(ticket.lastMessageAt) : new Date();
      ticket.createdAt = ticket.createdAt ? new Date(ticket.createdAt) : new Date();
      ticket.updatedAt = ticket.updatedAt ? new Date(ticket.updatedAt) : new Date();

      // Load customer
      let customer = null;
      if (ticket.customerId) {
        const customers = await query('SELECT * FROM Customer WHERE id = ?', [ticket.customerId]);
        customer = customers[0] || null;
      }

      // Load claim
      let claim = null;
      if (ticket.claimId) {
        const claims = await query('SELECT id, trackingCode, status FROM Claim WHERE id = ?', [ticket.claimId]);
        claim = claims[0] || null;
      }

      // Load latest message
      const latestMessages = await query(
        'SELECT sm.*, au.username, au.name as adminName FROM SupportMessage sm LEFT JOIN AdminUser au ON sm.authorAdminId = au.id WHERE sm.ticketId = ? ORDER BY sm.createdAt DESC LIMIT 1',
        [ticket.id]
      );

      // Load messages count
      const countRes = await query('SELECT COUNT(*) as cnt FROM SupportMessage WHERE ticketId = ?', [ticket.id]);
      const messagesCount = countRes[0]?.cnt || 0;

      const latestMessage = latestMessages[0] ? {
        id: latestMessages[0].id,
        sender: latestMessages[0].sender,
        body: latestMessages[0].body,
        createdAt: latestMessages[0].createdAt ? new Date(latestMessages[0].createdAt) : new Date(),
        authorAdmin: latestMessages[0].authorAdminId ? {
          id: latestMessages[0].authorAdminId,
          username: latestMessages[0].username,
          name: latestMessages[0].adminName || latestMessages[0].username,
        } : null
      } : null;

      const ticketWithRelations = {
        ...ticket,
        customer,
        claim,
        messages: latestMessage ? [latestMessage] : [],
      };

      return {
        ...mapTicket(ticketWithRelations),
        messagesCount,
        lastMessage: latestMessage ? mapMessage(latestMessage) : null,
      };
    })
  );

  res.json(mappedTickets);
}

export async function getAdminSupportTicket(req, res) {
  const ticket = await getAdminTicketOrThrow(req.params.id);

  res.json(mapTicket(ticket));
}

export async function addAdminSupportMessage(req, res) {
  const body = parseOrThrow(createSupportMessageSchema, req.body);

  const updatedTicket = await transaction(async (tx) => {
    const tickets = await tx.query('SELECT * FROM SupportTicket WHERE id = ?', [req.params.id]);

    if (!tickets.length) {
      throw new AppError(
        'Support ticket not found.',
        404,
        'SUPPORT_TICKET_NOT_FOUND'
      );
    }

    const ticket = tickets[0];
    const messageId = `clmsg-${randomUUID()}`;
    await tx.query(
      'INSERT INTO SupportMessage (id, ticketId, sender, authorAdminId, body) VALUES (?, ?, "admin", ?, ?)',
      [messageId, ticket.id, req.admin.id, body.body]
    );

    await tx.query(
      'UPDATE SupportTicket SET status = "open", closedAt = NULL, lastMessageAt = NOW() WHERE id = ?',
      [ticket.id]
    );

    return loadFullTicket(ticket.id, tx);
  });

  if (updatedTicket.customer?.phoneNumber) {
    const conciseReply = body.body.length > 220 ? `${body.body.slice(0, 217)}...` : body.body;
    await sendAutomaticSms(
      updatedTicket.customer.phoneNumber,
      await getSmsTemplate('supportReply', { message: conciseReply })
    );
  }

  res.status(201).json(mapTicket(updatedTicket));
}

export async function updateAdminSupportTicketStatus(req, res) {
  const body = parseOrThrow(updateSupportTicketStatusSchema, req.body);

  await getAdminTicketOrThrow(req.params.id);

  const closedAt = body.status === 'closed' ? new Date() : null;
  await query(
    'UPDATE SupportTicket SET status = ?, closedAt = ? WHERE id = ?',
    [body.status, closedAt, req.params.id]
  );

  const updated = await loadFullTicket(req.params.id);

  res.json(mapTicket(updated));
}
