import type { FieldType } from '../../../types';

export const PALETTE: { type: FieldType; label: string; icon: string }[] = [
  { type: 'text', label: 'Single Line', icon: '➖' },
  { type: 'textarea', label: 'Multi Line', icon: '📝' },
  { type: 'number', label: 'Number', icon: '🔢' },
  { type: 'date', label: 'Date', icon: '📅' },
  { type: 'email', label: 'Email', icon: '📧' },
  { type: 'phone', label: 'Phone', icon: '📞' },
  { type: 'dropdown', label: 'Dropdown', icon: '▾' },
  { type: 'radio', label: 'Radio', icon: '◉' },
  { type: 'checkbox', label: 'Checkbox', icon: '☑' },
  { type: 'file', label: 'File Upload', icon: '📎' },
  { type: 'signature', label: 'Signature', icon: '✍️' },
  { type: 'heading', label: 'Heading', icon: '🅷' },
];

export function slugifyKey(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'field';
}

export function uniqueKey(fields: { key: string }[], base: string): string {
  let key = base;
  let n = 2;
  while (fields.some((f) => f.key === key)) key = `${base}_${n++}`;
  return key;
}

export function isChoice(type: FieldType): boolean {
  return type === 'dropdown' || type === 'radio' || type === 'checkbox';
}