import { SeedTemplate } from './seed.types';

export const TPL_FREELANCE: SeedTemplate = {
  name: 'Freelance Service Agreement', slug: 'freelance-service-agreement',
  audience: 'business', category: 'Business', description: 'Freelancer–client contract covering scope, fees, timeline and revisions.',
  estimatedTimeMinutes: 9, isPaid: true, price: 299,
  questionnaireSchema: [
    { key: 'freelancerName', label: 'Freelancer full name', type: 'text', required: true, sensitive: true, youtubeUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', sample: 'Meera Nair' },
    { key: 'clientName', label: 'Client name', type: 'text', required: true, sensitive: true, sample: 'Orbit Media LLP' },
    { key: 'projectTitle', label: 'Project scope summary', type: 'textarea', required: true, sensitive: true, helpText: 'Deliverables in 1–3 lines.', sample: 'Design and development of a 5-page marketing website' },
    { key: 'projectFee', label: 'Project fee (₹)', type: 'number', required: true, sensitive: true, sample: 85000 },
    { key: 'paymentTerms', label: 'Payment terms', type: 'dropdown', required: true, sensitive: false, options: ['50% Advance & 50% on Delivery', '100% on Delivery', 'Milestone Based'], sample: '50% Advance & 50% on Delivery' },
    { key: 'deliveryDate', label: 'Final delivery date', type: 'date', required: true, sensitive: true, sample: '2026-11-15' },
    { key: 'revisionCount', label: 'Included revisions', type: 'number', required: true, sensitive: false, helpText: 'Rounds of changes included.', sample: 2 },
  ],
  documentHtml: `<h1>FREELANCE SERVICE AGREEMENT</h1>
<p>Made on {{today}} between <strong>{{freelancerName}}</strong> ("the Freelancer") and <strong>{{clientName}}</strong> ("the Client").</p>
<h2>1. Scope of Work</h2>
<p>The Freelancer shall provide: {{projectTitle}}.</p>
<h2>2. Fees & Payment</h2>
<p>Total fee: {{money projectFee}}, payable as: {{paymentTerms}}.</p>
<h2>3. Timeline</h2>
<p>Final deliverables on or before {{date deliveryDate}}. Client-caused delays (feedback, materials) extend the timeline.</p>
<h2>4. Revisions</h2>
<p>Includes {{revisionCount}} round(s) of revisions; additional rounds charged separately as agreed in writing.</p>
<h2>5. Ownership & Confidentiality</h2>
<p>On full payment, deliverables become the Client's property. Both parties keep the other's non-public information confidential.</p>
<div class="sig-block"><p>Freelancer: ______________________ ({{freelancerName}})</p><p>Client: ______________________ ({{clientName}})</p><p>Date: {{today}}</p></div>`,
};
