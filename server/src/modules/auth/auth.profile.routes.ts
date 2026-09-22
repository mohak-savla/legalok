import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { repo } from '../../db/connection';
import { User, UserSession } from '../../db/entities';
import { config } from '../../config';
import { asyncHandler, HttpError } from '../../utils/helpers';
import { authRequired, AuthUser } from '../../middleware/auth';
import { logAudit } from '../../middleware/audit';
import { sendMail } from '../../services/mailer.service';
import { publicUser, findByEmail } from './auth.routes';

export const authProfileRouter = Router();

authRouterHelper();

function authRouterHelper(): void {
  /* profile routes live on the same /api/auth mount */
}

authProfileRouter.put(
  '/me',
  authRequired,
  asyncHandler(async (req, res) => {
    const user = await repo(User).findOne({ where: { id: (req.user as AuthUser).id } });
    if (!user) throw new HttpError(404, 'User not found');
    const { fullName, phone, preferredLanguage } = req.body || {};
    if (fullName !== undefined) {
      if (String(fullName).trim().length < 2) throw new HttpError(400, 'Name must be at least 2 characters');
      user.fullName = String(fullName).trim();
    }
    if (phone !== undefined) user.phone = phone ? String(phone) : null;
    if (preferredLanguage && ['en', 'hi', 'ta', 'kn', 'gu'].includes(preferredLanguage)) {
      user.preferredLanguage = preferredLanguage;
    }
    await repo(User).save(user);
    await logAudit(req, { action: 'Profile Updated', actionCategory: 'auth', resourceType: 'user', resourceId: user.id });
    res.json({ user: publicUser(user) });
  }),
);

authProfileRouter.post(
  '/change-password',
  authRequired,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    const user = await repo(User).findOne({ where: { id: (req.user as AuthUser).id } });
    if (!user) throw new HttpError(404, 'User not found');
    if (user.passwordHash && !(await bcrypt.compare(String(currentPassword || ''), user.passwordHash))) {
      throw new HttpError(400, 'Current password is incorrect');
    }
    if (!newPassword || String(newPassword).length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
    user.passwordHash = await bcrypt.hash(String(newPassword), 10);
    await repo(User).save(user);
    await logAudit(req, { action: 'Password Changed', actionCategory: 'auth', resourceType: 'user', resourceId: user.id });
    res.json({ message: 'Password updated successfully!' });
  }),
);

authProfileRouter.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const { email } = req.body || {};
    const user = await findByEmail(email || '');
    if (user) {
      const token = jwt.sign({ sub: user.id, type: 'reset' }, config.jwtAccessSecret, { expiresIn: '30m' });
      await sendMail({
        toEmail: user.email, toName: user.fullName, template: 'reset-password',
        vars: { name: user.fullName, reset_link: `${config.appUrl}/reset-password?token=${token}` },
      });
    }
    res.json({ message: 'If an account exists for this email, a reset link has been sent.' });
  }),
);

authProfileRouter.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { token, password } = req.body || {};
    if (!password || String(password).length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
    let sub: string;
    try {
      const payload = jwt.verify(String(token), config.jwtAccessSecret) as { sub: string; type: string };
      if (payload.type !== 'reset') throw new Error('bad type');
      sub = payload.sub;
    } catch {
      throw new HttpError(400, 'Invalid or expired reset link');
    }
    const user = await repo(User).findOne({ where: { id: sub } });
    if (!user) throw new HttpError(404, 'User not found');
    user.passwordHash = await bcrypt.hash(String(password), 10);
    await repo(User).save(user);
    const sessions = await repo(UserSession).find({ where: { userId: user.id } });
    for (const s of sessions) s.revokedAt = new Date();
    await repo(UserSession).save(sessions);
    await logAudit(req, { action: 'Password Reset', actionCategory: 'auth', resourceType: 'user', resourceId: user.id });
    res.json({ message: 'Password updated. Please login with your new password.' });
  }),
);
