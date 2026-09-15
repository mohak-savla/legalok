import { createContext } from 'react';
import type { QuestionField } from '../../../types';

/** Form-builder fields available to node views (set by DocBuilder) */
export const FieldsContext = createContext<QuestionField[]>([]);
/** The field key chosen on the parent conditional block (for branch value options) */
export const CondFieldContext = createContext<string>('');
