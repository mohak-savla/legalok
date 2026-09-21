import 'dotenv/config';
import path from 'path';

/** Parse a postgres:// DATABASE_URL into its parts (Supabase/Neon/any pg host). */
function databaseUrlParts(url: string): {
  host?: string; port?: number; user?: string; password?: string; database?: string;
} {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port ? parseInt(u.port, 10) : undefined,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ''),
    };
  } catch {
    return {};
  }
}

const databaseUrl = process.env.DATABASE_URL || '';
const urlParts = databaseUrlParts(databaseUrl);

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  /** 'sqlite' for zero-install dev; 'postgres' for production (Supabase/Aurora/Neon). */
  dbType: (process.env.DB_TYPE || (databaseUrl ? 'postgres' : 'sqlite')) as 'sqlite' | 'postgres',
  dbFile: process.env.DB_FILE || './data/legalok.db',
  /** Full connection string — takes precedence over discrete DB_* vars when set. */
  databaseUrl,
  dbHost: process.env.DB_HOST || urlParts.host || 'localhost',
  dbPort: parseInt(process.env.DB_PORT || String(urlParts.port || 5432), 10),
  dbUser: process.env.DB_USER || urlParts.user || 'legalok',
  dbPassword: process.env.DB_PASSWORD || urlParts.password || 'secret',
  dbName: process.env.DB_NAME || urlParts.database || 'legalok',
  /** TLS for postgres. Auto-on when DATABASE_URL carries sslmode=require. */
  dbSsl: process.env.DB_SSL === 'true' || /sslmode=(require|no-verify)/.test(databaseUrl),
  /** MVP switch: auto-sync schema to the database (no migrations yet). Turn OFF once migrations exist. */
  dbSynchronize: process.env.DB_SYNCHRONIZE === 'true',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'legalok-dev-access',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'legalok-dev-refresh',
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenTtlDays: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '7', 10),
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_legalok',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || 'legalok_mock_gateway_secret',
  signingExpiryDays: parseInt(process.env.SIGNING_EXPIRY_DAYS || '7', 10),
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  /** CORS origin(s): comma-separated list supported, e.g. "https://a.x,https://b.y" */
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  /** Supabase Auth (Google/Facebook OAuth). Empty = real OAuth disabled, mock social login stays. */
  supabaseUrl: (process.env.SUPABASE_URL || '').replace(/\/$/, ''),
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  dataDir: path.resolve(process.cwd(), 'data'),
};

export const isProd = config.nodeEnv === 'production';

/** Fail fast on unsafe production configuration. */
if (isProd) {
  const problems: string[] = [];
  if (config.jwtAccessSecret === 'legalok-dev-access') problems.push('JWT_ACCESS_SECRET must be set to a strong secret');
  if (config.jwtRefreshSecret === 'legalok-dev-refresh') problems.push('JWT_REFRESH_SECRET must be set to a strong secret');
  if (config.dbType === 'postgres' && !config.databaseUrl) problems.push('DATABASE_URL must be set when DB_TYPE=postgres');
  if (problems.length) {
    console.error('[config] refusing to start in production:\n - ' + problems.join('\n - '));
    process.exit(1);
  }
}

