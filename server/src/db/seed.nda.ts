import { SeedTemplate } from './seed.types';

export const TPL_NDA: SeedTemplate = {
  name: 'Non-Disclosure Agreement (NDA)', slug: 'non-disclosure-agreement-nda',
  audience: 'business', category: 'Business', description: 'Protect confidential information shared with partners, vendors or investors.',
  estimatedTimeMinutes: 8, isPaid: false, price: 0,
  questionnaireSchema: [
    { key: 'partyType', label: 'Is the receiving party an individual or a company?', type: 'dropdown', required: true, sensitive: false, options: ['Individual', 'Company'], helpText: 'Choose how the other party signs.', youtubeUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', sample: 'Company' },
    { key: 'companyName', label: 'Company name of the receiving party', type: 'text', required: true, sensitive: true, condition: { field: 'partyType', op: 'equals', value: 'Company' }, helpText: 'Registered legal name.', sample: 'Acme Technologies Pvt Ltd' },
    { key: 'discloserName', label: 'Disclosing party full name', type: 'text', required: true, sensitive: true, helpText: 'Party sharing confidential info.', sample: 'Priya Sharma' },
    { key: 'recipientName', label: 'Receiving party representative name', type: 'text', required: true, sensitive: true, helpText: 'Person signing for the receiver.', sample: 'Rahul Verma' },
    { key: 'purpose', label: 'Purpose of disclosure', type: 'textarea', required: true, sensitive: true, helpText: 'e.g. evaluating a partnership.', sample: 'Evaluation of a potential business partnership' },
    { key: 'durationYears', label: 'Confidentiality period (years)', type: 'dropdown', required: true, sensitive: false, options: ['1', '2', '3', '5'], sample: '2' },
    { key: 'jurisdictionCity', label: 'City for legal jurisdiction', type: 'text', required: true, sensitive: true, sample: 'Bengaluru' },
  ],
  documentHtml: `<h1>NON-DISCLOSURE AGREEMENT</h1>
<p>This Non-Disclosure Agreement ("Agreement") is made on {{today}} ("Effective Date") between <strong>{{discloserName}}</strong> (the "Disclosing Party") and <strong>{{recipientName}}</strong>{{#if (eq partyType "Company")}}, representing <strong>{{companyName}}</strong>,{{/if}} (the "Receiving Party").</p>
<h2>1. Purpose</h2>
<p>The Disclosing Party intends to disclose certain confidential information solely for the purpose of {{purpose}} (the "Purpose").</p>
<h2>2. Confidential Information</h2>
<p>"Confidential Information" means any non-public business, technical, financial or customer information disclosed in written, oral, electronic or any other form.</p>
<h2>3. Obligations</h2>
<ol><li>Hold the Confidential Information in strict confidence;</li><li>Not disclose it to third parties without prior written consent;</li><li>Use it solely for the Purpose;</li><li>Protect it with at least reasonable care.</li></ol>
<h2>4. Term</h2>
<p>Obligations survive for {{durationYears}} year(s) from the Effective Date.</p>
<h2>5. Governing Law</h2>
<p>Governed by the laws of India; courts at {{jurisdictionCity}} have exclusive jurisdiction.</p>
<div class="sig-block"><p>Disclosing Party: ______________________ ({{discloserName}})</p><p>Receiving Party: ______________________ ({{recipientName}})</p><p>Date: {{today}}</p></div>`,
};
