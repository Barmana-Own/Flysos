import { randomUUID } from 'node:crypto';
import { query, transaction } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

function cleanContact(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength) || null;
}

export async function listPublicFaqs(_req, res) {
  const rows = await query(
    `SELECT id,category,question,answer,sortOrder FROM FaqQuestion WHERE status='published' ORDER BY category ASC, sortOrder ASC, createdAt ASC`
  );
  res.json(rows);
}

export async function createFaqInquiry(req, res) {
  const question = String(req.body?.question || '').trim().slice(0, 5000);
  const contactEmail = cleanContact(req.body?.contactEmail, 191);
  const contactPhone = cleanContact(req.body?.contactPhone, 50);
  if (!question) throw new AppError('متن سوال الزامی است.', 400, 'VALIDATION_ERROR');
  if (!contactEmail && !contactPhone) {
    throw new AppError('وارد کردن ایمیل یا شماره همراه الزامی است.', 400, 'CONTACT_REQUIRED');
  }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw new AppError('آدرس ایمیل معتبر نیست.', 400, 'INVALID_EMAIL');
  }

  const result = await transaction(async (tx) => {
    const inquiryId = `faqi-${randomUUID()}`;
    const ticketId = `cltkt-${randomUUID()}`;
    await tx.query(
      'INSERT INTO SupportTicket (id,customerId,claimId,subject,status,contactEmail,contactPhone) VALUES (?,NULL,NULL,?,"open",?,?)',
      [ticketId, 'سوال جدید از بخش سوالات متداول', contactEmail, contactPhone]
    );
    await tx.query(
      'INSERT INTO SupportMessage (id,ticketId,sender,body,channel) VALUES (?, ?, "customer", ?, "website")',
      [`clmsg-${randomUUID()}`, ticketId, question]
    );
    await tx.query(
      'INSERT INTO FaqInquiry (id,question,contactEmail,contactPhone,status,supportTicketId) VALUES (?,?,?, ?,"new",?)',
      [inquiryId, question, contactEmail, contactPhone, ticketId]
    );
    await tx.query(
      'INSERT INTO Notification (id,claimId,type,message) VALUES (?,NULL,"support_ticket",?)',
      [`clnot-${randomUUID()}`, `سوال پشتیبانی جدید از بخش سوالات متداول ثبت شد. تیکت: ${ticketId}`]
    );
    return { inquiryId, ticketId };
  });

  res.status(201).json({
    id: result.inquiryId,
    supportTicketId: result.ticketId,
    status: 'new',
    message: 'سوال شما برای پشتیبانی ثبت شد.',
  });
}

export async function listAdminFaqs(_req, res) {
  res.json(await query('SELECT * FROM FaqQuestion ORDER BY category ASC, sortOrder ASC, createdAt ASC'));
}

export async function createAdminFaq(req, res) {
  const question = String(req.body?.question || '').trim();
  const answer = String(req.body?.answer || '').trim();
  if (!question || !answer) throw new AppError('سوال و پاسخ الزامی است.', 400, 'VALIDATION_ERROR');
  const id = `faq-${randomUUID()}`;
  await query(
    'INSERT INTO FaqQuestion (id,category,question,answer,sortOrder,status,createdByAdminId,updatedByAdminId) VALUES (?,?,?,?,?,?,?,?)',
    [id, String(req.body?.category || 'general'), question, answer, Number(req.body?.sortOrder || 0), req.body?.status === 'draft' ? 'draft' : 'published', req.admin.id, req.admin.id]
  );
  res.status(201).json((await query('SELECT * FROM FaqQuestion WHERE id=?', [id]))[0]);
}

export async function updateAdminFaq(req, res) {
  const existing = (await query('SELECT * FROM FaqQuestion WHERE id=? LIMIT 1', [req.params.id]))[0];
  if (!existing) throw new AppError('سوال متداول یافت نشد.', 404, 'FAQ_NOT_FOUND');
  const question = String(req.body?.question ?? existing.question).trim();
  const answer = String(req.body?.answer ?? existing.answer).trim();
  if (!question || !answer) throw new AppError('سوال و پاسخ الزامی است.', 400, 'VALIDATION_ERROR');
  await query(
    'UPDATE FaqQuestion SET category=?,question=?,answer=?,sortOrder=?,status=?,updatedByAdminId=? WHERE id=?',
    [String(req.body?.category ?? existing.category), question, answer, Number(req.body?.sortOrder ?? existing.sortOrder),
      req.body?.status === 'draft' ? 'draft' : 'published', req.admin.id, existing.id]
  );
  res.json((await query('SELECT * FROM FaqQuestion WHERE id=?', [existing.id]))[0]);
}

export async function deleteAdminFaq(req, res) {
  await query('DELETE FROM FaqQuestion WHERE id=?', [req.params.id]);
  res.status(204).end();
}

export async function listFaqInquiries(_req, res) {
  const rows = await query(
    `SELECT fi.*, st.status AS supportStatus, st.lastMessageAt
     FROM FaqInquiry fi
     LEFT JOIN SupportTicket st ON st.id=fi.supportTicketId
     ORDER BY fi.createdAt DESC`
  );
  res.json(rows);
}

export async function updateFaqInquiry(req, res) {
  const status = ['new','answered','closed'].includes(req.body?.status) ? req.body.status : 'new';
  await transaction(async (tx) => {
    const rows = await tx.query('SELECT * FROM FaqInquiry WHERE id=? LIMIT 1', [req.params.id]);
    if (!rows.length) throw new AppError('سوال کاربر یافت نشد.', 404, 'FAQ_INQUIRY_NOT_FOUND');
    await tx.query('UPDATE FaqInquiry SET status=? WHERE id=?', [status, req.params.id]);
    if (rows[0].supportTicketId && status === 'closed') {
      await tx.query('UPDATE SupportTicket SET status="closed",closedAt=NOW(3) WHERE id=?', [rows[0].supportTicketId]);
    }
  });
  res.json((await query('SELECT * FROM FaqInquiry WHERE id=?', [req.params.id]))[0]);
}

export async function replyFaqInquiry(req, res) {
  const answer = String(req.body?.answer || '').trim().slice(0, 5000);
  if (!answer) throw new AppError('متن پاسخ الزامی است.', 400, 'VALIDATION_ERROR');

  const updated = await transaction(async (tx) => {
    const rows = await tx.query('SELECT * FROM FaqInquiry WHERE id=? LIMIT 1', [req.params.id]);
    if (!rows.length) throw new AppError('سوال کاربر یافت نشد.', 404, 'FAQ_INQUIRY_NOT_FOUND');
    const inquiry = rows[0];
    let ticketId = inquiry.supportTicketId;
    if (!ticketId) {
      ticketId = `cltkt-${randomUUID()}`;
      await tx.query(
        'INSERT INTO SupportTicket (id,customerId,claimId,subject,status,contactEmail,contactPhone) VALUES (?,NULL,NULL,?,"open",?,?)',
        [ticketId, 'سوال جدید از بخش سوالات متداول', inquiry.contactEmail || null, inquiry.contactPhone || null]
      );
      await tx.query(
        'INSERT INTO SupportMessage (id,ticketId,sender,body,channel) VALUES (?, ?, "customer", ?, "website")',
        [`clmsg-${randomUUID()}`, ticketId, inquiry.question]
      );
    }

    await tx.query(
      'INSERT INTO SupportMessage (id,ticketId,sender,authorAdminId,body,channel) VALUES (?, ?, "admin", ?, ?, "website")',
      [`clmsg-${randomUUID()}`, ticketId, req.admin.id, answer]
    );
    await tx.query('UPDATE SupportTicket SET status="open",closedAt=NULL,lastMessageAt=NOW(3) WHERE id=?', [ticketId]);
    await tx.query(
      'UPDATE FaqInquiry SET supportTicketId=?,answer=?,status="answered",answeredAt=NOW(3),answeredByAdminId=? WHERE id=?',
      [ticketId, answer, req.admin.id, inquiry.id]
    );

    const deliveryTargets = [];
    if (inquiry.contactPhone) deliveryTargets.push(['sms', inquiry.contactPhone]);
    if (inquiry.contactEmail) deliveryTargets.push(['email', inquiry.contactEmail]);
    for (const [channel, recipient] of deliveryTargets) {
      await tx.query(
        'INSERT INTO MessageLog (id,claimId,adminId,direction,channel,recipient,body,status) VALUES (?,NULL,?,"outbound",?,?,?,"queued")',
        [`clmsglog-${randomUUID()}`, req.admin.id, channel, recipient, answer]
      );
    }

    return (await tx.query('SELECT * FROM FaqInquiry WHERE id=? LIMIT 1', [inquiry.id]))[0];
  });

  res.status(201).json(updated);
}
