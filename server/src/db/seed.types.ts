import { QuestionField } from '../db/entities';

export interface SeedTemplate {
  name: string; slug: string; audience: string; category: string; description: string;
  estimatedTimeMinutes: number; isPaid: boolean; price: number;
  questionnaireSchema: QuestionField[]; documentHtml: string;
}

export const YT = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
