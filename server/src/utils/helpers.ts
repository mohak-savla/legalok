import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { QuestionField } from '../db/entities';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/** Evaluate a question's conditional-visibility rule against current answers */
export function isFieldVisible(field: QuestionField, answers: Record<string, unknown>): boolean {
  if (!field.condition || !field.condition.field) return true;
  const raw = answers?.[field.condition.field];
  const val = Array.isArray(raw) ? raw : raw === undefined || raw === null ? '' : String(raw);
  const target = field.condition.value;
  const equals = Array.isArray(raw) ? raw.includes(target) : val === target;
  return field.condition.op === 'not_equals' ? !equals : equals;
}

export function visibleFields(fields: QuestionField[], answers: Record<string, unknown>): QuestionField[] {
  return (fields || []).filter((f) => f.type !== 'heading' && isFieldVisible(f, answers));
}

/** Missing required answers among currently visible fields */
export function missingRequired(fields: QuestionField[], answers: Record<string, unknown>): string[] {
  return visibleFields(fields, answers)
    .filter((f) => f.required)
    .filter((f) => {
      const v = answers?.[f.key];
      if (v === undefined || v === null || v === '') return true;
      if (Array.isArray(v) && v.length === 0) return true;
      return false;
    })
    .map((f) => f.label);
}

export function clientMeta(req: Request): { ip: string; userAgent: string } {
  return {
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '',
    userAgent: (req.headers['user-agent'] as string) || '',
  };
}
