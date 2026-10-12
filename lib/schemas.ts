import { z } from "zod";

export const MAX_INPUT_CHARS = Number(process.env.AI_MAX_INPUT_CHARS ?? 12000) || 12000;

const dateISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "deadline must be date-only YYYY-MM-DD");

export const requirementSchema = z.object({
  text: z.string().min(1).max(500),
  source: z.enum(["explicit", "suggested"]),
});

export const proposalPayloadSchema = z.object({
  title: z.string().min(3).max(140),
  summary: z.string().min(1).max(2000),
  clientName: z.string().min(1).max(120).nullable(),
  deliverables: z.array(z.string().min(1).max(300)).max(20).default([]),
  requirements: z.array(requirementSchema).max(30).default([]),
  deadline: z.object({
    dateISO: dateISO.nullable(),
    textOriginal: z.string().max(200).nullable(),
    ambiguous: z.boolean(),
    interpretation: z.string().max(300).nullable(),
  }),
  budget: z.object({
    amount: z.number().nonnegative().nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
    unknown: z.boolean(),
  }),
  tasks: z
    .array(
      z.object({
        title: z.string().min(1).max(300),
        isClientRequirement: z.boolean(),
      })
    )
    .max(30)
    .default([]),
  missingEssential: z
    .array(z.object({ field: z.string().max(80), question: z.string().max(500) }))
    .max(3)
    .default([]),
  optionalUnknowns: z.array(z.string().max(200)).max(10).default([]),
  assumptions: z
    .array(
      z.object({ text: z.string().max(500), needsConfirmation: z.boolean() })
    )
    .max(10)
    .default([]),
  language: z.enum(["en", "ar", "mixed"]),
});

export type ProposalPayloadInput = z.infer<typeof proposalPayloadSchema>;

export const intakeMessageSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1).max(MAX_INPUT_CHARS),
  timezone: z.string().min(1).max(80).optional(),
});

export const intakeAnswerSchema = z.object({
  conversationId: z.string().uuid(),
  answers: z
    .array(
      z.object({
        questionId: z.string().max(80),
        field: z.string().max(80),
        answer: z.string().min(1).max(2000),
      })
    )
    .min(1)
    .max(5),
  timezone: z.string().min(1).max(80).optional(),
});

export const confirmIntakeSchema = z.object({
  conversationId: z.string().uuid(),
  proposalId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  clientId: z.string().uuid().nullable().default(null),
  newClientName: z.string().min(1).max(120).nullable().default(null),
  title: z.string().min(3).max(140),
  description: z.string().max(4000).nullable().default(null),
  deliverables: z.array(z.string().min(1).max(300)).max(20).default([]),
  requirements: z.array(z.string().min(1).max(500)).max(30).default([]),
  deadlineDate: dateISO.nullable().default(null),
  deadlineText: z.string().max(200).nullable().default(null),
  budgetAmount: z.number().nonnegative().nullable().default(null),
  budgetCurrency: z.string().regex(/^[A-Z]{3}$/).nullable().default(null),
  tasks: z
    .array(
      z.object({
        title: z.string().min(1).max(300),
        isClientRequirement: z.boolean().default(false),
      })
    )
    .max(30)
    .default([]),
});

export const orderCreateSchema = confirmIntakeSchema.omit({
  conversationId: true,
  proposalId: true,
});

export const orderPatchSchema = z.object({
  title: z.string().min(3).max(140).optional(),
  description: z.string().max(4000).nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  deliverables: z.array(z.string().min(1).max(300)).max(20).optional(),
  requirements: z.array(z.string().min(1).max(500)).max(30).optional(),
  deadlineDate: dateISO.nullable().optional(),
  deadlineText: z.string().max(200).nullable().optional(),
  budgetAmount: z.number().nonnegative().nullable().optional(),
  budgetCurrency: z.string().regex(/^[A-Z]{3}$/).nullable().optional(),
  status: z
    .enum(["draft", "ready", "in_progress", "delivered", "completed", "cancelled"])
    .optional(),
});

export const taskCreateSchema = z.object({
  title: z.string().min(1).max(300),
  isClientRequirement: z.boolean().default(false),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
});

export const taskPatchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
});

export const clientCreateSchema = z.object({
  name: z.string().min(1).max(120),
  contact: z.string().max(300).nullable().default(null),
  notes: z.string().max(4000).nullable().default(null),
});

export const clientPatchSchema = clientCreateSchema.partial();

export const settingsPatchSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  timezone: z.string().min(1).max(80).optional(),
  defaultCurrency: z.string().regex(/^[A-Z]{3}$/).optional(),
});

export const aiSettingsPutSchema = z.object({
  provider: z.enum(["openai_compatible", "offline"]).optional(),
  model: z.string().min(1).max(80).optional(),
  apiKey: z.string().min(8).max(500).nullable().optional(),
});

export const signupSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
  displayName: z.string().min(1).max(120),
  timezone: z.string().min(1).max(80).optional(),
  defaultCurrency: z.string().regex(/^[A-Z]{3}$/).optional(),
});

export const signinSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
});
