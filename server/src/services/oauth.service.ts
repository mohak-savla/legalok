import { config } from '../config';
import { HttpError } from '../utils/helpers';

export interface OAuthIdentity {
  providerId: string;
  email: string;
  fullName: string;
  emailVerified: boolean;
  /** Provider as reported by the token (google/facebook). */
  provider: string;
}

interface SupabaseAuthUser {
  id?: string;
  sub?: string;
  email?: string;
  email_confirmed_at?: string | null;
  app_metadata?: { provider?: string; providers?: string[] };
  user_metadata?: {
    full_name?: string; name?: string; given_name?: string; family_name?: string;
  };
}

/**
 * Verify a Supabase Auth access token against the project's Auth server.
 * Supabase validates signature + expiry for us; a 200 response proves the
 * token is genuine and returns the identity of the signed-in user.
 */
export async function verifySupabaseToken(accessToken: string): Promise<OAuthIdentity> {
  let res: { ok: boolean; status: number; json: () => Promise<unknown> };
  try {
    res = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: config.supabaseAnonKey,
        'Content-Type': 'application/json',
      },
    });
  } catch {
    throw new HttpError(502, 'Could not reach the authentication service. Please try again.');
  }
  if (!res.ok) {
    if (res.status === 401) throw new HttpError(401, 'Sign-in session expired or invalid. Please try again.');
    throw new HttpError(502, 'Authentication service error. Please try again.');
  }
  const su = (await res.json()) as SupabaseAuthUser;
  const email = su.email ? String(su.email).toLowerCase().trim() : '';
  if (!email) throw new HttpError(422, 'Your social account has no email address. Please sign up with email instead.');
  const providerId = su.id || su.sub || '';
  if (!providerId) throw new HttpError(502, 'Authentication response was incomplete.');
  const meta = su.user_metadata ?? {};
  const fullName =
    meta.full_name ||
    meta.name ||
    [meta.given_name, meta.family_name].filter(Boolean).join(' ') ||
    email.split('@')[0];
  const providers = su.app_metadata?.providers ?? [];
  const provider = su.app_metadata?.provider || (providers.length ? providers[providers.length - 1] : 'oauth');
  return { providerId, email, fullName, emailVerified: !!su.email_confirmed_at, provider };
}
