/** Admin: stats, users, audit trail, doc regeneration (mounted at /api/admin) */
import { Router } from 'express';
import { repo } from '../../db/connection';
import { User, UserDocument, AuditLog, PaymentTransaction, Template } from '../../db/entities';
import { asyncHandler, HttpError } from '../../utils/helpers';
import { authRequired, adminRequired, AuthUser } from '../../middleware/auth';
import { logAudit } from '../../middleware/audit';
import { generateFinalDocument } from '../../services/document.service';

export const adminRouter = Router();
adminRouter.use(authRequired, adminRequired);

adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const users = await repo(User).count();
    const docs = await repo(UserDocument).find();
    const templates = await repo(Template).find();
    const txs = await repo(PaymentTransaction).find({ where: { status: 'captured' } });
    const recentAudit = await repo(AuditLog).find({ order: { createdAt: 'DESC' }, take: 12 });

    const byStatus: Record<string, number> = {};
    for (const d of docs) byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    const revenue = txs.reduce((s, t) => s + (t.amount || 0), 0);

    res.json({
      stats: {
        users,
        revenue,
        documents: { total: docs.length, byStatus },
        templates: { total: templates.length, published: templates.filter((t) => t.status === 'published').length },
        payments: { captured: txs.length },
      },
      recentAudit,
    });
  }),
);

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const q = String((req.query.q as string) || '').toLowerCase();
    const users = await repo(User).find({ order: { createdAt: 'DESC' }, take: 200 });
    const docs = await repo(UserDocument).find();
    const counts = new Map<string, number>();
    for (const d of docs) counts.set(d.userId, (counts.get(d.userId) || 0) + 1);
    const rows = users
      .filter((u) => !q || u.email.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q))
      .map((u) => ({
        id: u.id, fullName: u.fullName, email: u.email, role: u.role, authProvider: u.authProvider,
        isActive: u.isActive, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt,
        documentCount: counts.get(u.id) || 0,
      }));
    res.json({ users: rows, total: rows.length });
  }),
);

adminRouter.get(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const user = await repo(User).findOne({ where: { id: String(req.params.id) } });
    if (!user) throw new HttpError(404, 'User not found');
    const docs = await repo(UserDocument).find({ where: { userId: user.id }, order: { createdAt: 'DESC' } });
    const logs = await repo(AuditLog).find({ where: { userId: user.id }, order: { createdAt: 'DESC' }, take: 50 });
    const templates = await repo(Template).find();
    const tmap = new Map(templates.map((t) => [t.id, t.name]));
    res.json({
      user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, authProvider: user.authProvider, isActive: user.isActive, createdAt: user.createdAt, lastLoginAt: user.lastLoginAt },
      documents: docs.map((d) => ({ id: d.id, title: d.title, status: d.status, templateName: tmap.get(d.templateId) ?? '', createdAt: d.createdAt, paymentStatus: d.paymentStatus })),
      auditLogs: logs,
    });
  }),
);

adminRouter.get(
  '/audit',
  asyncHandler(async (req, res) => {
    const { action, category, userId, documentId, from, to } = req.query as Record<string, string | undefined>;
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
    const limitN = Math.min(parseInt(String(req.query.limit || '25'), 10) || 25, 100);
    const qb = repo(AuditLog).createQueryBuilder('a');
    if (action) qb.andWhere('a.action LIKE :action', { action: `%${action}%` });
    if (category) qb.andWhere('a.actionCategory = :category', { category });
    if (userId) qb.andWhere('a.userId = :userId', { userId });
    if (documentId) qb.andWhere('a.resourceId = :documentId', { documentId });
    if (from) qb.andWhere('a.createdAt >= :from', { from: new Date(from) });
    if (to) qb.andWhere('a.createdAt <= :to', { to: new Date(`${to}T23:59:59`) });
    const total = await qb.getCount();
    const logs = await qb
      .orderBy('a.createdAt', 'DESC')
      .skip((page - 1) * limitN).take(limitN)
      .getMany();
    res.json({ logs, total, page, pages: Math.ceil(total / limitN) });
  }),
);

/** Edge case #4: paid doc generation failed → admin bypasses the payment wall */
adminRouter.post(
  '/documents/:documentId/regenerate',
  asyncHandler(async (req, res) => {
    const doc = await repo(UserDocument).findOne({ where: { id: String(req.params.documentId) } });
    if (!doc) throw new HttpError(404, 'Document not found');
    if (doc.paymentStatus !== 'paid' && doc.paymentStatus !== 'free') {
      throw new HttpError(402, 'Payment not verified for this document');
    }
    const template = await repo(Template).findOne({ where: { id: doc.templateId } });
    if (!template) throw new HttpError(404, 'Template not found');
    await generateFinalDocument(doc, template);
    const prev = doc.status;
    if (['expired', 'awaiting_payment'].includes(doc.status) && prev !== 'draft') {
      doc.status = 'generated'; // admin override of the state machine (logged)
    }
    await repo(UserDocument).save(doc);
    await logAudit(req, {
      action: 'Admin Regenerated Document', actionCategory: 'admin', resourceType: 'document', resourceId: doc.id,
      details: { previousStatus: prev, adminId: (req.user as AuthUser).id },
    });
    res.json({ document: doc, message: `Document regenerated (was ${prev})` });
  }),
);
