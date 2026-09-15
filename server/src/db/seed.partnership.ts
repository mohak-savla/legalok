import { SeedTemplate } from './seed.types';

export const TPL_PARTNERSHIP: SeedTemplate = {
  name: 'Partnership Deed', slug: 'partnership-deed',
  audience: 'business', category: 'Business', description: 'Two-partner firm deed with capital, profit-sharing and management clauses.',
  estimatedTimeMinutes: 14, isPaid: true, price: 799,
  questionnaireSchema: [
    { key: 'firmName', label: 'Firm / business name', type: 'text', required: true, sensitive: true, youtubeUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', sample: 'Sunrise Traders' },
    { key: 'businessNature', label: 'Nature of business', type: 'textarea', required: true, sensitive: true, sample: 'Wholesale trading of home appliances' },
    { key: 'partner1Name', label: 'Partner 1 full name', type: 'text', required: true, sensitive: true, sample: 'Amit Joshi' },
    { key: 'partner2Name', label: 'Partner 2 full name', type: 'text', required: true, sensitive: true, sample: 'Sonal Patel' },
    { key: 'ratio', label: 'Profit sharing ratio', type: 'dropdown', required: true, sensitive: false, options: ['50:50', '60:40', 'Custom'], sample: 'Custom' },
    { key: 'customP1Share', label: 'Partner 1 profit share (%)', type: 'number', required: true, sensitive: false, condition: { field: 'ratio', op: 'equals', value: 'Custom' }, helpText: 'Partner 2 gets the remaining %.', sample: 70 },
    { key: 'capitalP1', label: 'Capital contributed by Partner 1 (₹)', type: 'number', required: true, sensitive: true, sample: 500000 },
    { key: 'capitalP2', label: 'Capital contributed by Partner 2 (₹)', type: 'number', required: true, sensitive: true, sample: 300000 },
    { key: 'startDate', label: 'Commencement date', type: 'date', required: true, sensitive: true, sample: '2026-10-01' },
    { key: 'city', label: 'Place of business', type: 'text', required: true, sensitive: true, sample: 'Ahmedabad, Gujarat' },
  ],
  documentHtml: `<h1>PARTNERSHIP DEED</h1>
<p>This Deed of Partnership is made on {{today}} between <strong>{{partner1Name}}</strong> and <strong>{{partner2Name}}</strong>, carrying on business in partnership under the firm name <strong>{{firmName}}</strong> at {{city}}.</p>
<h2>1. Nature of Business</h2>
<p>{{businessNature}}</p>
<h2>2. Capital</h2>
<p>Partner 1 contributes {{money capitalP1}} and Partner 2 contributes {{money capitalP2}} as initial capital.</p>
<h2>3. Profit Sharing</h2>
{{#if (eq ratio "Custom")}}<p>Profits and losses shall be shared with Partner 1 entitled to {{customP1Share}}% and Partner 2 to the remaining share.</p>{{else}}<p>Profits and losses shall be shared in the ratio {{ratio}} between Partner 1 and Partner 2 respectively.</p>{{/if}}
<h2>4. Management</h2>
<p>Both partners shall participate in day-to-day management. Banking operations require the signature of either partner.</p>
<h2>5. Commencement & Term</h2>
<p>The partnership commences on {{date startDate}} and continues until dissolved by mutual consent or per law.</p>
<div class="sig-block"><p>Partner 1: ______________________ ({{partner1Name}})</p><p>Partner 2: ______________________ ({{partner2Name}})</p><p>Witness: ______________________ · Date: {{today}}</p></div>`,
};
