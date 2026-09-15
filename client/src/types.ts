/** Shared client-side types (mirrors server entities) */
export type FieldType =
  | 'text' | 'textarea' | 'number' | 'date' | 'email' | 'phone'
  | 'dropdown' | 'radio' | 'checkbox' | 'file' | 'signature' | 'heading';

export interface QuestionField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
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

export interface AuthUser { id: string; email: string; role: string; fullName: string; }

export interface TemplateListItem {
  id: string; name: string; slug: string; audience: string; category: string;
  description: string | null; estimatedTimeMinutes: number; isPaid: boolean; price: number;
  questionCount: number; usageCount: number; isFavorite?: boolean; status?: string;
}

export interface TemplateFull extends TemplateListItem {
  questionnaireSchema: QuestionField[];
  documentHtml: string;
  isActive?: boolean; version?: number; createdAt?: string; publishedAt?: string | null;
}

export interface SignatureRow {
  id: string; signerEmail: string; signerName: string; signatureType: string;
  signatureStatus: string; isOwner: boolean; signedAt: string | null;
  tokenExpiresAt: string | null; aadhaarReference: string | null;
  signatureData?: string | null;
}

export interface DocumentRow {
  id: string; title: string; status: DocStatus; documentNumber: string | null;
  paymentStatus: string; templateName: string; createdAt: string; updatedAt: string;
  expiresAt?: string | null; signedAt?: string | null;
}

export interface DocumentFull {
  id: string; title: string; status: DocStatus; documentNumber: string | null;
  userAnswers: Record<string, unknown>; currentStep: number; paymentStatus: string;
  paymentAmount: number | null; paidAt: string | null; expiresAt: string | null;
  signedAt: string | null; createdAt: string; updatedAt: string; templateId: string;
  template: { id: string; name: string; category: string; audience: string; isPaid: boolean; price: number; questionnaireSchema: QuestionField[]; documentHtml: string };
  signatures: SignatureRow[];
}

export interface AuditRow {
  id: string; action: string; actionCategory: string; resourceType: string;
  resourceId: string | null; createdAt: string; userEmail: string | null;
  details?: Record<string, unknown> | null;
}
