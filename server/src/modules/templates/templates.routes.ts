import { Router } from 'express';
import { repo } from '../../db/connection';
import { Template, UserFavorite } from '../../db/entities';
import { asyncHandler, HttpError } from '../../utils/helpers';
import { authOptional } from '../../middleware/auth';

export const templatesRouter = Router();

function listFields(t: Template) {
  return {
    id: t.id, name: t.name, slug: t.slug, audience: t.audience, category: t.category,
    description: t.description, estimatedTimeMinutes: t.estimatedTimeMinutes,
    isPaid: t.isPaid, price: t.price, questionCount: (t.questionnaireSchema || []).length,
    usageCount: t.usageCount, version: t.version,
  };
}

/** Public template library with Wonder.Legal-style browsing (Business/Personal/A–Z) */
templatesRouter.get(
  '/',
  authOptional,
  asyncHandler(async (req, res) => {
    const { q, category, audience, pricing, favorites } = req.query as Record<string, string | undefined>;
    const qb = repo(Template)
      .createQueryBuilder('t')
      .where("t.isActive = true AND t.status = 'published' AND t.deletedAt IS NULL");
    if (audience) qb.andWhere('t.audience = :audience', { audience });
    if (category) qb.andWhere('t.category = :category', { category });
    if (pricing === 'free') qb.andWhere('t.isPaid = false');
    if (pricing === 'paid') qb.andWhere('t.isPaid = true');
    if (q) qb.andWhere('(t.name LIKE :like OR t.description LIKE :like OR t.category LIKE :like)', { like: `%${q}%` });

    let favIds: string[] = [];
    if (req.user) {
      const favs = await repo(UserFavorite).find({ where: { userId: req.user.id } });
      favIds = favs.map((f) => f.templateId);
    }
    if (favorites === '1') {
      if (!req.user) throw new HttpError(401, 'Login required');
      if (favIds.length === 0) return res.json({ templates: [], meta: { total: 0 } });
      qb.andWhere('t.id IN (:...ids)', { ids: favIds });
    }

    const rows = await qb.orderBy('t.usageCount', 'DESC').addOrderBy('t.name', 'ASC').getMany();
    const all = await repo(Template).find({ where: { isActive: true, status: 'published' } });
    const categories = [...new Set(all.map((t) => t.category))].sort();
    res.json({
      templates: rows.map((t) => ({ ...listFields(t), isFavorite: favIds.includes(t.id) })),
      meta: {
        total: rows.length,
        categories,
        counts: {
          all: all.length,
          business: all.filter((t) => t.audience === 'business').length,
          personal: all.filter((t) => t.audience === 'personal').length,
        },
      },
    });
  }),
);

/** Full template incl. schema + Handlebars body (no user data — safe for live preview) */
templatesRouter.get(
  '/:idOrSlug',
  authOptional,
  asyncHandler(async (req, res) => {
    const key = String(req.params.idOrSlug);
    const t =
      (await repo(Template).findOne({ where: { slug: key } })) ||
      (await repo(Template).findOne({ where: { id: key } }));
    if (!t || t.deletedAt) throw new HttpError(404, 'Template not found');
    const isAdmin = req.user?.role === 'admin';
    if (t.status !== 'published' && !isAdmin) throw new HttpError(404, 'Template not found');
    const isFavorite = req.user
      ? !!(await repo(UserFavorite).findOne({ where: { userId: req.user.id, templateId: t.id } }))
      : false;
    res.json({
      template: {
        ...listFields(t), isActive: t.isActive, status: t.status,
        questionnaireSchema: t.questionnaireSchema, documentHtml: t.documentHtml,
        createdAt: t.createdAt, publishedAt: t.publishedAt, isFavorite,
      },
    });
  }),
);
