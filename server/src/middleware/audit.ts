import { Request } from 'express';
import { repo } from '../db/connection';
import { AuditLog } from '../db/entities';
import { clientMeta } from '../utils/helpers';

export interface AuditEntry {
  action: string;
  actionCategory: 'auth' | 'document' | 'payment' | 'signature' | 'template' | 'admin' | 'system';
  resourceType: string;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
}

/** Fire-and-forget audit logging — never blocks the request path */
export async function logAudit(req: Request, entry: AuditEntry): Promise<void> {
  try {
    const meta = clientMeta(req);
    const row = repo(AuditLog).create({
      userId: req.user?.id ?? null,
      userEmail: req.user?.email ?? null,
      action: entry.action,
      actionCategory: entry.actionCategory,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      details: entry.details ?? null,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    await repo(AuditLog).save(row);
  } catch (e) {
    console.error('[audit] failed to write entry', e);
  }
}
