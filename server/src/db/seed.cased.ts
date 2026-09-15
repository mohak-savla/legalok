import { SeedTemplate } from './seed.types';

export const TPL_CASED: SeedTemplate = {
  name: 'Cease & Desist Letter (IP)', slug: 'cease-and-desist-letter',
  audience: 'business', category: 'Letters', description: 'Formal demand letter to stop trademark/copyright infringement.',
  estimatedTimeMinutes: 7, isPaid: false, price: 0,
  questionnaireSchema: [
    { key: 'senderName', label: 'Your full name', type: 'text', required: true, sensitive: true, youtubeUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', sample: 'Ishaan Kapoor' },
    { key: 'senderAddress', label: 'Your address', type: 'textarea', required: true, sensitive: true, sample: '301 Business Bay, Andheri East, Mumbai 400069' },
    { key: 'recipientName', label: 'Infringing party name', type: 'text', required: true, sensitive: true, sample: 'QuickKopy Printers' },
    { key: 'recipientAddress', label: 'Infringing party address', type: 'textarea', required: true, sensitive: true, sample: '7 Market Road, Delhi 110006' },
    { key: 'infringementDetails', label: 'What is being infringed & how', type: 'textarea', required: true, sensitive: true, helpText: 'Describe your right and the infringing act.', sample: 'Unauthorised use of my registered logo "Kapoor Kreations" on their signage and social media' },
    { key: 'deadlineDays', label: 'Compliance deadline (days)', type: 'number', required: true, sensitive: false, sample: 15 },
  ],
  documentHtml: `<h1>CEASE AND DESIST NOTICE</h1>
<p>Date: {{today}}</p>
<p>To,<br/><strong>{{recipientName}}</strong><br/>{{recipientAddress}}</p>
<p>From,<br/><strong>{{senderName}}</strong><br/>{{senderAddress}}</p>
<h2>Subject: Cease and desist from infringement of my intellectual property</h2>
<p>Dear Sir/Madam,</p>
<p>I am the lawful owner of the intellectual rights described below. It has come to my notice that you are engaged in: {{infringementDetails}}. This act constitutes infringement of my rights and unauthorised commercial use of my property.</p>
<h2>Demands</h2>
<ol><li>Immediately cease and desist all infringing activities;</li><li>Remove all infringing materials from all media within <strong>{{deadlineDays}} day(s)</strong> of receipt of this notice;</li><li>Provide written confirmation of compliance to my address above.</li></ol>
<p>Failing compliance within the stated period, I shall be constrained to initiate appropriate civil and criminal proceedings at your risk, cost and consequences, including claims for damages and an injunction.</p>
<p>This notice is issued without prejudice to my other rights and remedies.</p>
<div class="sig-block"><p>Yours sincerely,<br/>{{senderName}}</p></div>`,
};
