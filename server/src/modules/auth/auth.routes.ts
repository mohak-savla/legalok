import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { repo } from '../../db/connection';
import { User, UserSession } from '../../db/entities';
import { asyncHandler, HttpError, sha256 } from '../../utils/helpers';
import { authRequired, issueSession, AuthUser } from '../../middleware/auth';
import { config, isProd } from '../../config';
import { verifySupabaseToken } from '../../services/oauth.service';
import { logAudit } from '../../middleware/audit';
import { sendMail } from '../../services/mailer.service';

export const authRouter = Router();

export function publicUser(u: User) {
  return {
    id: u.id, email: u.email, fullName: u.fullName, role: u.role,
    authProvider: u.authProvider, preferredLanguage: u.preferredLanguage,
    emailVerified: u.emailVerified, phone: u.phone, createdAt: u.createdAt,
  };
}

export async function findByEmail(email: string): Promise<User | null> {
  return repo(User).findOne({ where: { email: String(email).toLowerCase().trim() } });
}

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { fullName, email, password } = req.body || {};
    if (!fullName || String(fullName).trim().length < 2) throw new HttpError(400, 'Name must be at least 2 characters');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) throw new HttpError(400, 'Please enter a valid email');
    if (!password || String(password).length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
    if (await findByEmail(email)) throw new HttpError(409, 'This email is already registered. Please login.');

    const user = repo(User).create({
      email: String(email).toLowerCase().trim(),
      fullName: String(fullName).trim(),
      passwordHash: await bcrypt.hash(String(password), 10),
      authProvider: 'email',
      emailVerified: true, // MVP: auto-verified (welcome mail logged instead of sent)
    });
    await repo(User).save(user);

    const tokens = await issueSession(user, req);
    await logAudit(req, { action: 'User Registered', actionCategory: 'auth', resourceType: 'user', resourceId: user.id });
    await sendMail({
      toEmail: user.email, toName: user.fullName, template: 'welcome',
      vars: { name: user.fullName },
    });
    res.status(201).json({ ...tokens, user: publicUser(user) });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    const user = await findByEmail(email || '');
    if (!user || !user.passwordHash || !(await bcrypt.compare(String(password || ''), user.passwordHash))) {
      throw new HttpError(401, 'Invalid email or password. Please try again.');
    }
    if (!user.isActive) throw new HttpError(403, 'Account disabled. Contact support.');
    user.lastLoginAt = new Date();
    await repo(User).save(user);
    const tokens = await issueSession(user, req);
    await logAudit(req, { action: 'User Login', actionCategory: 'auth', resourceType: 'user', resourceId: user.id });
    res.json({ ...tokens, user: publicUser(user) });
  }),
);

/** Mocked social login (simulates the Google/Facebook OAuth round-trip).
 *  Dev-only convenience — production uses real OAuth via POST /auth/oauth. */
authRouter.post(
  '/social',
  asyncHandler(async (req, res) => {
    if (isProd) throw new HttpError(404, 'Not found');
    const { provider, email, fullName } = req.body || {};
    if (!['google', 'facebook'].includes(provider)) throw new HttpError(400, 'Unsupported provider');
    if (!email || !fullName) throw new HttpError(400, 'email and fullName are required for mock social login');
    let user = await findByEmail(email);
    if (!user) {
      user = repo(User).create({
        email: String(email).toLowerCase().trim(), fullName: String(fullName).trim(),
        authProvider: provider, emailVerified: true,
      });
      await repo(User).save(user);
    }
    const tokens = await issueSession(user, req);
    await logAudit(req, { action: `Social Login (${provider})`, actionCategory: 'auth', resourceType: 'user', resourceId: user.id });
    res.json({ ...tokens, user: publicUser(user) });
  }),
);

/** Real social login: verifies a Supabase Auth access token (Google/Facebook)
 *  server-side, links-or-creates the Legalok user, then issues the standard
 *  Legalok session (same JWT + refresh flow as email login). */
authRouter.post(
  '/oauth',
  asyncHandler(async (req, res) => {
    const { provider, accessToken } = req.body || {};
    if (!['google', 'facebook'].includes(provider)) throw new HttpError(400, 'Unsupported provider');
    if (!accessToken || typeof accessToken !== 'string') throw new HttpError(400, 'accessToken is required');
    if (!config.supabaseUrl || !config.supabaseAnonKey) throw new HttpError(501, 'OAuth is not configured on this server');

    // Never trust the client's claim — verify the token with Supabase first
    const identity = await verifySupabaseToken(accessToken);

    // Link preference: same OAuth identity first, then same email (email users adopt their social login)
    let user =
      (await repo(User).findOne({ where: { providerId: identity.providerId } })) ??
      (await findByEmail(identity.email));
    if (!user) {
      user = repo(User).create({
        email: identity.email,
        fullName: identity.fullName,
        authProvider: provider as 'google' | 'facebook',
        providerId: identity.providerId,
        emailVerified: identity.emailVerified,
      });
      await repo(User).save(user);
    } else if (!user.providerId || (!user.emailVerified && identity.emailVerified)) {
      if (!user.providerId) user.providerId = identity.providerId;
      if (!user.emailVerified && identity.emailVerified) user.emailVerified = true;
      await repo(User).save(user);
    }
    if (!user.isActive) throw new HttpError(403, 'Account disabled. Contact support.');
    user.lastLoginAt = new Date();
    await repo(User).save(user);

    const tokens = await issueSession(user, req);
    await logAudit(req, { action: `Social Login (${provider})`, actionCategory: 'auth', resourceType: 'user', resourceId: user.id });
    res.json({ ...tokens, user: publicUser(user) });
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body || {};
    if (!refreshToken) throw new HttpError(400, 'refreshToken required');
    const session = await repo(UserSession).findOne({ where: { refreshTokenHash: sha256(String(refreshToken)) } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new HttpError(401, 'Invalid or expired session');
    }
    const user = await repo(User).findOne({ where: { id: session.userId } });
    if (!user || !user.isActive) throw new HttpError(401, 'Account unavailable');
    session.revokedAt = new Date();
    await repo(UserSession).save(session);
    res.json(await issueSession(user, req));
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body || {};
    if (refreshToken) {
      const session = await repo(UserSession).findOne({ where: { refreshTokenHash: sha256(String(refreshToken)) } });
      if (session) {
        session.revokedAt = new Date();
        await repo(UserSession).save(session);
      }
    }
    res.status(204).send();
  }),
);

authRouter.get(
  '/me',
  authRequired,
  asyncHandler(async (req, res) => {
    const user = await repo(User).findOne({ where: { id: (req.user as AuthUser).id } });
    if (!user) throw new HttpError(404, 'User not found');
    res.json({ user: publicUser(user) });
  }),
);
