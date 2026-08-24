import { z } from 'zod';

export const claimTypeSchema = z.enum([
  'delay',
  'cancellation',
]);

export const claimStatusSchema = z.enum([
  'new',
  'under_review',
  'needs_action',
  'pending_info',
  'approved',
  'waiting_poa_draft',
  'waiting_passenger_poa_approval',
  'lawyer_action',
  'waiting_judgment',
  'waiting_enforcement_order',
  'waiting_compensation',
  'finance_review',
  'waiting_customer_payment',
  'rejected',
  'closed',
]);

export const fileTypeSchema = z.enum([
  'ticket',
  'boarding_pass',
  'replacement_ticket',
  'admin_attachment',
]);

export const startClaimSchema = z.object({
  nationalId: z
    .string()
    .regex(/^\d{10}$/, 'National ID must contain 10 digits.'),

  birthDate: z
    .string()
    .trim()
    .min(1, 'Birth date is required.'),

  phoneNumber: z
    .string()
    .regex(/^09\d{9}$/, 'Phone number format is invalid.'),

  acceptedTerms: z.coerce
    .boolean()
    .refine((value) => value === true, 'Terms must be accepted.'),

  claimType: claimTypeSchema.default('cancellation'),
});

export const questionnaireSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().trim().min(1),
        question: z.string().trim().min(1),
        answer: z.boolean().nullable(),
      })
    )
    .min(1, 'At least one answer is required.'),
});

export const submitClaimSchema = z.object({
  claimType: claimTypeSchema.optional(),
});

export const trackClaimSchema = z.object({
  trackingCode: z.string().trim().min(1),

  nationalId: z
    .string()
    .regex(/^\d{10}$/)
    .optional(),
});
