/** Favorites, user audit trail, file uploads (mounted at /api) */
import { Router } from 'express';
import { repo } from '../../db/connection';
import { UserFavorite, Template, AuditLog } from '../../db/entities';
import { asyncHandler, HttpError, randomToken } from '../../utils/helpers';
import { authRequired } from '../../middleware/auth';
import { logAudit } from '../../middleware/audit';
import { saveObject } from '../../services/storage.service';

export const miscRouter = Router();

miscRouter.get(
  '/favorites',
  authRequired,
  asyncHandler(async (req, res) => {
    const favs = await repo(UserFavorite).find({ where: { userId: req.user!.id }, order: { createdAt: 'DESC' } });
    const templates = await repo(Template).find();
    const tmap = new Map(templates.map((t) => [t.id, t]));
    res.json({
      favorites: favs
        .filter((f) => tmap.has(f.templateId))
        .map((f) => {
          const t = tmap.get(f.templateId)!;
          return {
            id: t.id, name: t.name, slug: t.slug, category: t.category, audience: t.audience,
            description: t.description, isPaid: t.isPaid, price: t.price,
            questionCount: (t.questionnaireSchema || []).length, isFavorite: true,
          };
        }),
    });
  }),
);

miscRouter.post(
  '/favorites/:templateId',
  authRequired,
  asyncHandler(async (req, res) => {
    const templateId = String(req.params.templateId);
    const template = await repo(Template).findOne({ where: { id: templateId } });
    if (!template) throw new HttpError(404, 'Template not found');
    const existing = await repo(UserFavorite).findOne({ where: { userId: req.user!.id, templateId } });
    if (!existing) {
      await repo(UserFavorite).save(repo(UserFavorite).create({ userId: req.user!.id, templateId }));
    }
    res.json({ isFavorite: true, message: `${template.name} added to favorites` });
  }),
);

miscRouter.delete(
  '/favorites/:templateId',
  authRequired,
  asyncHandler(async (req, res) => {
    const templateId = String(req.params.templateId);
    const existing = await repo(UserFavorite).findOne({ where: { userId: req.user!.id, templateId } });
    if (existing) await repo(UserFavorite).remove(existing);
    res.json({ isFavorite: false, message: 'Removed from favorites' });
  }),
);

miscRouter.get(
  '/audit',
  authRequired,
  asyncHandler(async (req, res) => {
    const { action, documentId } = req.query as Record<string, string | undefined>;
    const qb = repo(AuditLog).createQueryBuilder('a').where('a.userId = :userId', { userId: req.user!.id });
    if (action && action !== 'all') qb.andWhere('a.action = :action', { action });
    if (documentId) qb.andWhere('a.resourceId = :documentId', { documentId });
    const logs = await qb.orderBy('a.createdAt', 'DESC').take(200).getMany();
    res.json({ logs });
  }),
);

miscRouter.post(
  '/uploads',
  authRequired,
  asyncHandler(async (req, res) => {
    const { name, dataB64 } = req.body || {};
    if (!name || !dataB64) throw new HttpError(400, 'name and dataB64 are required');
    const buf = Buffer.from(String(dataB64), 'base64');
    if (buf.length > 5 * 1024 * 1024) throw new HttpError(400, 'File exceeds the 5MB limit');
    const safe = String(name).replace(/[^\w.\-]+/g, '_');
    const key = `uploads/${Date.now()}_${randomToken(6)}_${safe}`;
    saveObject(key, buf);
    await logAudit(req, { action: 'File Uploaded', actionCategory: 'document', resourceType: 'file', details: { name: safe, size: buf.length } });
    res.status(201).json({ key, url: `/uploads/${key}`, name: safe, size: buf.length });
  }),
);
