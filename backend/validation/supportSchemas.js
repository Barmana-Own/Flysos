import { z } from 'zod';

const nationalIdSchema = z
  .string()
  .trim()
  .regex(/^\d{10}$/, 'National ID must contain 10 digits.');

export const createSupportTicketSchema = z.object({
  nationalId: nationalIdSchema.optional().or(z.literal('')),
  name: z.string().trim().max(150).optional(),
  email: z.string().trim().email().max(150).optional().or(z.literal('')),
  phoneNumber: z.string().trim().max(30).optional(),
  claimTrackingCode: z.string().trim().max(50).optional().or(z.literal('')),
  subject: z.string().trim().min(3).max(250),
  message: z.string().trim().min(1).max(5000),
}).refine(
  (value) => Boolean(value.email?.trim() || value.phoneNumber?.trim()),
  { message: 'Email or phone number is required.', path: ['email'] },
);

export const publicTicketQuerySchema = z.object({
  nationalId: nationalIdSchema.optional(),
});

export const createSupportMessageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export const updateSupportTicketStatusSchema = z.object({
  status: z.enum(['open', 'closed']),
});
