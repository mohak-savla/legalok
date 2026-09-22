/**
 * Core entities + shared types (part 1 of 2 — see entities.ts for the rest).
 * Dialect-agnostic: same entities run on SQLite (dev) and PostgreSQL (prod).
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type FieldType =
  | 'text' | 'textarea' | 'number' | 'date' | 'email' | 'phone'
  | 'dropdown' | 'radio' | 'checkbox' | 'file' | 'signature' | 'heading';

export interface QuestionField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Mask value in the "Murfed" preview until payment. Defaults by type. */
  sensitive?: boolean;
  helpText?: string;
  youtubeUrl?: string;
  placeholder?: string;
  options?: string[];
  condition?: { field: string; op: 'equals' | 'not_equals'; value: string } | null;
  sample?: unknown;
}

export const DOC_STATUSES = [
  'draft', 'awaiting_payment', 'generated', 'pending_signatures',
  'partially_signed', 'fully_executed', 'expired',
] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

/** Valid lifecycle transitions (PRD §4 state machine) */
export const VALID_TRANSITIONS: Record<DocStatus, DocStatus[]> = {
  draft: ['draft', 'awaiting_payment', 'generated'],
  awaiting_payment: ['awaiting_payment', 'generated', 'expired'],
  generated: ['generated', 'pending_signatures', 'partially_signed', 'fully_executed'],
  pending_signatures: ['pending_signatures', 'partially_signed', 'fully_executed', 'expired'],
  partially_signed: ['partially_signed', 'fully_executed', 'expired'],
  fully_executed: ['fully_executed'],
  expired: ['expired'],
};

@Entity('users')
@Index('idx_users_email', ['email'])
export class User {
  @PrimaryGeneratedColumn('uuid') id!: string;
    @Column({ type: 'text', unique: true }) email!: string;
  @Column({ type: 'text' }) fullName!: string;
  @Column({ type: 'text', nullable: true }) phone!: string | null;
  @Column({ type: 'text', default: 'email' }) authProvider!: 'email' | 'google' | 'facebook';
  /** OAuth identity from the auth provider (Supabase user id / provider sub). Null for email users. */
  @Column({ type: 'text', nullable: true }) providerId!: string | null;
  @Column({ type: 'text', nullable: true }) passwordHash!: string | null;
  @Column({ type: 'boolean', default: false }) emailVerified!: boolean;
  @Column({ type: 'text', default: 'en' }) preferredLanguage!: string;
  /** 'user' | 'admin' */
  @Column({ type: 'text', default: 'user' }) role!: string;
  @Column({ type: 'boolean', default: true }) isActive!: boolean;
  @Column({ type: 'timestamp', nullable: true }) lastLoginAt!: Date | null;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
  @Column({ type: 'timestamp', nullable: true }) deletedAt!: Date | null;
}

@Entity('user_sessions')
@Index('idx_sessions_hash', ['refreshTokenHash'])
export class UserSession {
    @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'text' }) userId!: string;
  @Column({ type: 'text', unique: true }) refreshTokenHash!: string;
  @Column({ type: 'text', nullable: true }) ipAddress!: string | null;
  @Column({ type: 'text', nullable: true }) userAgent!: string | null;
  @Column({ type: 'timestamp' }) expiresAt!: Date;
  @CreateDateColumn() createdAt!: Date;
  @Column({ type: 'timestamp', nullable: true }) revokedAt!: Date | null;
}

@Entity('templates')
@Index('idx_templates_slug', ['slug'])
@Index('idx_templates_active', ['isActive'])
export class Template {
    @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'text' }) name!: string;
  @Column({ type: 'text', unique: true }) slug!: string;
  /** 'business' | 'personal' — Wonder.Legal-style top-level split */
  @Column({ type: 'text', default: 'business' }) audience!: string;
  @Column({ type: 'text' }) category!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
    @Column({ type: 'integer', default: 10 }) estimatedTimeMinutes!: number;
  @Column({ type: 'boolean', default: false }) isPaid!: boolean;
    @Column({ type: 'real', default: 0 }) price!: number;
  /** QuestionField[] — built in the Admin Studio (Form Builder) */
  @Column('json', { default: '{}' }) questionnaireSchema!: QuestionField[];
  /** Handlebars body — built in the Admin Studio (Document Builder) */
  @Column('text') documentHtml!: string;
    @Column({ type: 'boolean', default: true }) isActive!: boolean;
  /** 'draft' | 'published' */
  @Column({ type: 'text', default: 'draft' }) status!: string;
  @Column({ type: 'integer', default: 1 }) version!: number;
  @Column({ type: 'integer', default: 0 }) usageCount!: number;
  @Column({ type: 'text', nullable: true }) createdBy!: string | null;
  /** Zoho-style mail merge: per-template delivery email (null = system default). */
  @Column({ type: 'text', nullable: true }) emailSubject!: string | null;
  @Column({ type: 'text', nullable: true }) emailBody!: string | null;
  @Column({ type: 'boolean', default: true }) attachPdf!: boolean;
  @Column({ type: 'boolean', default: false }) autoSendOnGenerate!: boolean;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
  @Column({ type: 'timestamp', nullable: true }) publishedAt!: Date | null;
  @Column({ type: 'timestamp', nullable: true }) deletedAt!: Date | null;
}

@Entity('template_versions')
@Index('idx_versions_template', ['templateId'])
export class TemplateVersion {
  @PrimaryGeneratedColumn('uuid') id!: string;
    @Column({ type: 'text' }) templateId!: string;
  @Column({ type: 'integer', default: 1 }) version!: number;
  @Column('json', { default: '{}' }) questionnaireSchema!: QuestionField[];
  @Column('text') documentHtml!: string;
  @Column({ type: 'text', nullable: true }) createdBy!: string | null;
  @CreateDateColumn() createdAt!: Date;
}
