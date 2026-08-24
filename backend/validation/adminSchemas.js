import { z } from 'zod';
import { claimStatusSchema } from './claimSchemas.js';

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

const optionalText = (max = 255) =>
  z.string().trim().max(max).nullable().optional();

const optionalAdminId = z
  .union([z.string().trim().min(1), z.literal(''), z.null()])
  .optional();

export const updateClaimSchema = z.object({
  status: claimStatusSchema.optional(),
  statusNote: z.string().trim().max(1000).optional(),

  stage: z.coerce.number().int().min(1).max(7).optional(),
  assignedAdminId: optionalAdminId,

  extractedTicketData: z
    .union([z.string().max(20000), z.record(z.unknown()), z.null()])
    .optional(),

  passenger: z.object({
    name: optionalText(150),
  }).optional(),

  customer: z.object({
    firstName: optionalText(100),
    lastName: optionalText(150),
    email: z.string().trim().email().max(150).nullable().optional().or(z.literal('')),
    phoneNumber: optionalText(30),
    birthDate: optionalText(30),
    notes: optionalText(5000),
  }).optional(),

  flightInfo: z.object({
    passengerName: optionalText(150),
    airline: optionalText(150),
    flightNumber: optionalText(80),
    flightDate: optionalText(80),
    scheduledTime: optionalText(80),
    origin: optionalText(150),
    destination: optionalText(150),
    route: optionalText(300),
    pnrCode: optionalText(100),
    ticketNumber: optionalText(150),
    ticketAmount: optionalText(100),
    flightClass: optionalText(100),
    rawText: optionalText(20000),
  }).optional(),

  bankDetails: z.object({
    bankName: optionalText(150),
    cardHolder: optionalText(150),
    cardNumber: optionalText(50),
    accountNumber: optionalText(80),
    sheba: optionalText(80),
  }).optional(),
});

export const updateClaimStatusSchema = z.object({
  status: claimStatusSchema,
  note: z.string().trim().max(1000).nullable().optional(),
});

export const createClaimNoteSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export const addNoteSchema = createClaimNoteSchema;

export const updateBankDetailsSchema = z.object({
  bankName: optionalText(150),
  cardHolder: optionalText(150),
  cardNumber: optionalText(50),
  accountNumber: optionalText(80),
  sheba: optionalText(80),
});
