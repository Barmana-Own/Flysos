import { z } from 'zod';
import { claimStatusSchema } from './claimSchemas.js';

export const sendDirectSmsSchema = z.object({
  message: z.string().trim().min(1).max(1000),
});

export const updateSettingsSchema = z
  .object({
    siteName: z.string().trim().min(1).max(150).optional(),
    smsGateway: z.string().trim().max(250).nullable().optional(),
    defaultCommission: z.number().int().min(0).max(100).optional(),
    autoSms: z.boolean().optional(),
    maintenanceMode: z.boolean().optional(),
    requireNationalId: z.boolean().optional(),
    powerOfAttorneyUrl: z.string().trim().max(2000).nullable().optional(),
    smsTemplates: z.object({
      registration: z.string().trim().max(3000).optional(),
      statusUpdate: z.string().trim().max(3000).optional(),
      replacementTicket: z.string().trim().max(3000).optional(),
      bankDetails: z.string().trim().max(3000).optional(),
      supportReceived: z.string().trim().max(3000).optional(),
      supportReply: z.string().trim().max(3000).optional(),
    }).partial().optional(),
  })
  .refine(
    (body) => Object.keys(body).length > 0,
    'At least one setting must be provided.'
  );
const customerStatusSchema = z.enum(['active', 'pending_docs', 'suspended']);
const adminRoleSchema = z.enum([
  'supervisor',
  'content_admin',
  'passenger_admin',
  'senior_expert',
  'expert',
  'expert_domestic',
  'expert_intl',
]);
const adminStatusSchema = z.enum(['active', 'inactive']);
const accessLevelSchema = z.union([z.literal('all'), claimStatusSchema]);

export const updateCustomerSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    firstName: z.string().trim().max(100).nullable().optional(),
    lastName: z.string().trim().max(150).nullable().optional(),
    email: z.string().trim().email().max(150).nullable().optional().or(z.literal('')),
    phoneNumber: z.string().trim().max(30).nullable().optional(),
    birthDate: z.string().trim().max(30).nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
    status: customerStatusSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'At least one customer field must be provided.');

const expertBaseSchema = z.object({
  username: z.string().trim().min(3).max(80),
  name: z.string().trim().min(1).max(150),
  email: z.string().trim().email().max(150).nullable().optional().or(z.literal('')),
  phone: z.string().trim().max(30).nullable().optional(),
  role: adminRoleSchema,
  status: adminStatusSchema,
  accessLevel: accessLevelSchema,
  accessLevels: z.array(accessLevelSchema).min(1).max(16).optional(),
  photoUrl: z.string().trim().max(2_000_000).nullable().optional(),
});

export const createExpertSchema = expertBaseSchema.extend({
  password: z.string().min(8).max(255),
});

export const updateExpertSchema = expertBaseSchema
  .partial()
  .extend({
    password: z.string().min(8).max(255).optional().or(z.literal('')),
  })
  .refine((body) => Object.keys(body).length > 0, 'At least one expert field must be provided.');
