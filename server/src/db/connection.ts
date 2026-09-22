import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from '../config';
import {
  User, UserSession, Template, TemplateVersion, UserDocument,
  DocumentSignature, AuditLog, UserFavorite, PaymentTransaction, EmailLog,
  EmailTemplate,
} from './entities';

export const ENTITIES = [
  User, UserSession, Template, TemplateVersion, UserDocument,
  DocumentSignature, AuditLog, UserFavorite, PaymentTransaction, EmailLog,
  EmailTemplate,
];

/** Postgres options: honors DATABASE_URL (Supabase/Neon/any pg host) or discrete DB_* vars. */
function postgresOptions(): DataSourceOptions {
  const base: Record<string, unknown> = {
    type: 'postgres',
    ssl: config.dbSsl ? { rejectUnauthorized: false } : false,
    synchronize: config.dbSynchronize, // MVP: DB_SYNCHRONIZE=true; switch to versioned migrations later
    logging: false,
    entities: ENTITIES,
  };
  if (config.databaseUrl) {
    base.url = config.databaseUrl;
  } else {
    Object.assign(base, {
      host: config.dbHost, port: config.dbPort,
      username: config.dbUser, password: config.dbPassword, database: config.dbName,
    });
  }
  return base as unknown as DataSourceOptions;
}

const options: DataSourceOptions =
  config.dbType === 'postgres'
    ? postgresOptions()
    : ({
        type: 'better-sqlite3',
        database: config.dbFile,
        synchronize: true, // dev convenience; prod uses migrations
        logging: false,
        entities: ENTITIES,
      } as DataSourceOptions);

export const AppDataSource = new DataSource(options);

export async function initDb(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    console.log(`[db] initialized (${config.dbType}) at ${config.dbType === 'sqlite' ? config.dbFile : config.dbHost}`);
  }
}

export const repo = AppDataSource.getRepository.bind(AppDataSource);

