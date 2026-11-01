import { z } from 'zod';

/** Validate req.body with a zod schema; replaces it with the parsed, trimmed result. */
export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const first = result.error.issues[0];
    return res.status(400).json({
      error: first?.message || 'Invalid request',
      field: first?.path?.join('.'),
    });
  }
  req.body = result.data;
  next();
};

export const emailSchema = z.string().trim().email('Enter a valid email address').max(254);

export const signupSchema = z.object({
  email: emailSchema,
  full_name: z.string().trim().min(1, 'Name is required').max(100),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});

const MAX_MESSAGE = 4000;

export const tutorSchema = z.object({
  userMessage: z.string().trim().min(1).max(MAX_MESSAGE).optional(),
  // Only user/assistant turns are accepted from the client: a client-supplied
  // "developer" or "system" turn would let anyone rewrite the tutor's rules.
  chatHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(MAX_MESSAGE),
      }),
    )
    .max(40)
    .default([]),
  questionData: z
    .object({
      goal: z.string().max(2000).optional(),
      implicitData: z.string().max(4000).optional(),
      explicitData: z.string().max(4000).optional(),
      solution: z.string().max(8000).optional(),
      figureDescription: z.string().max(4000).optional(),
    })
    .optional(),
  questionId: z.union([z.number().int(), z.string().regex(/^\d+$/)]).optional(),
  stream: z.boolean().optional(),
});
