/**
 * Document-lifecycle entities (part 2) + barrel re-export of all entities.
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  Index, Unique,
} from 'typeorm';
import { DocStatus, QuestionField } from './entities.base';

export * from './entities.base';
export {
  User, UserSession, Template, TemplateVersion,
} from './entities.base';

@Entity('user_documents')
@Index('idx_docs_user_status', ['userId', 'status'])
export class UserDocument {
  @PrimaryGeneratedColumn('uuid') id!: string;
     @Column({ type: 'text' }) userId!: string;
  @Column({ type: 'text' }) templateId!: string;
  @Column({ type: 'text' }) title!: string;
  @Column({ type: 'text', unique: true, nullable: true }) documentNumber!: string | null;
  @Column({ type: 'text', default: 'draft' }) status!: DocStatus;
  @Column('json', { default: '{}' }) userAnswers!: Record<string, unknown>;
  @Column({ type: 'integer', default: 0 }) currentStep!: number;
  @Column({ type: 'text', nullable: true }) generatedHtmlKey!: string | null;
  /** 'pending' | 'paid' | 'failed' | 'refunded' | 'free' */
  @Column({ type: 'text', default: 'pending' }) paymentStatus!: string;
  @Column({ type: 'text', nullable: true }) paymentTransactionId!: string | null;
  @Column({ type: 'real', nullable: true }) paymentAmount!: number | null;
  @Column({ type: 'timestamp', nullable: true }) paidAt!: Date | null;
  @Column({ type: 'timestamp', nullable: true }) expiresAt!: Date | null;
  @Column({ type: 'timestamp', nullable: true }) signedAt!: Date | null;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
  @Column({ type: 'timestamp', nullable: true }) deletedAt!: Date | null;
}

@Entity('document_signatures')
@Index('idx_sigs_doc', ['documentId'])
@Index('idx_sigs_token', ['signingToken'])
export class DocumentSignature {
  @PrimaryGeneratedColumn('uuid') id!: string;
     @Column({ type: 'text' }) documentId!: string;
  @Column({ type: 'text', nullable: true }) userId!: string | null;
  @Column({ type: 'text' }) signerEmail!: string;
  @Column({ type: 'text' }) signerName!: string;
  /** 'aadhaar' | 'click' */
  @Column({ type: 'text', default: 'click' }) signatureType!: string;
  @Column({ type: 'text', default: 'pending' }) signatureStatus!: string;
  @Column({ type: 'text', nullable: true }) signingToken!: string;
  @Column({ type: 'timestamp', nullable: true }) tokenExpiresAt!: Date | null;
  /** Drawn dataURL or typed name */
  @Column({ type: 'text', nullable: true }) signatureData!: string | null;
    @Column({ type: 'boolean', default: false }) isOwner!: boolean;
  @Column({ type: 'text', nullable: true }) aadhaarReference!: string | null;
  @Column({ type: 'timestamp', nullable: true }) signedAt!: Date | null;
  @Column({ type: 'timestamp', nullable: true }) viewedAt!: Date | null;
  @Column({ type: 'text', nullable: true }) message!: string | null;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}

@Entity('audit_logs')
@Index('idx_audit_user', ['userId'])
@Index('idx_audit_doc', ['resourceId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'text', nullable: true }) userId!: string | null;
  @Column({ type: 'text', nullable: true }) userEmail!: string | null;
     @Column({ type: 'text' }) action!: string;
  /** 'auth'|'document'|'payment'|'signature'|'template'|'admin'|'system' */
  @Column({ type: 'text' }) actionCategory!: string;
  @Column({ type: 'text' }) resourceType!: string;
  @Column({ type: 'text', nullable: true }) resourceId!: string | null;
  @Column('json', { nullable: true }) details!: Record<string, unknown> | null;
  @Column({ type: 'text', nullable: true }) ipAddress!: string | null;
  @Column({ type: 'text', nullable: true }) userAgent!: string | null;
  @CreateDateColumn() createdAt!: Date;
}

@Entity('user_favorites')
@Unique('uq_fav', ['userId', 'templateId'])
export class UserFavorite {
  @PrimaryGeneratedColumn('uuid') id!: string;
     @Column({ type: 'text' }) userId!: string;
  @Column({ type: 'text' }) templateId!: string;
  @CreateDateColumn() createdAt!: Date;
}

@Entity('payment_transactions')
@Index('idx_pay_order', ['gatewayOrderId'])
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid') id!: string;
     @Column({ type: 'text' }) userId!: string;
  @Column({ type: 'text', nullable: true }) documentId!: string | null;
  @Column({ type: 'text', default: 'razorpay' }) gateway!: string;
  @Column({ type: 'text' }) gatewayOrderId!: string;
  @Column({ type: 'text', nullable: true }) gatewayPaymentId!: string | null;
     @Column({ type: 'real' }) amount!: number;
  @Column({ type: 'text', default: 'INR' }) currency!: string;
  /** 'created' | 'captured' | 'failed' */
  @Column({ type: 'text', default: 'created' }) status!: string;
  @Column({ type: 'text', nullable: true }) method!: string | null;
  @Column('json', { nullable: true }) webhookPayload!: Record<string, unknown> | null;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
  @Column({ type: 'timestamp', nullable: true }) completedAt!: Date | null;
}

@Entity('email_logs')
@Index('idx_email_doc', ['documentId'])
export class EmailLog {
  @PrimaryGeneratedColumn('uuid') id!: string;
     @Column({ type: 'text' }) toEmail!: string;
  @Column({ type: 'text', nullable: true }) toName!: string | null;
  @Column({ type: 'text' }) template!: string;
  @Column({ type: 'text' }) subject!: string;
  @Column({ type: 'text', nullable: true }) body!: string | null;
  @Column({ type: 'text', nullable: true }) documentId!: string | null;
  @Column({ type: 'text', nullable: true }) signatureId!: string | null;
  /** 'sent' | 'failed' â€” swap-in point for Amazon SES */
     @Column({ type: 'text', default: 'sent' }) status!: string;
  @CreateDateColumn() createdAt!: Date;
}

export type { QuestionField };
