import { SeedTemplate } from './seed.types';

export const TPL_POA: SeedTemplate = {
  name: 'General Power of Attorney', slug: 'general-power-of-attorney',
  audience: 'personal', category: 'Personal', description: 'Authorise a trusted person to act on your behalf for chosen matters.',
  estimatedTimeMinutes: 12, isPaid: true, price: 599,
  questionnaireSchema: [
    { key: 'principalName', label: 'Principal full name (you)', type: 'text', required: true, sensitive: true, helpText: 'Person granting the authority.', youtubeUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', sample: 'Lakshmi Menon' },
    { key: 'agentName', label: 'Agent / attorney full name', type: 'text', required: true, sensitive: true, helpText: 'Person receiving the authority.', sample: 'Ravi Menon' },
    { key: 'principalAddress', label: 'Principal address', type: 'textarea', required: true, sensitive: true, sample: '12 Rose Villa, Kochi, Kerala 682001' },
    { key: 'agentAddress', label: 'Agent address', type: 'textarea', required: true, sensitive: true, sample: '45 Palm Grove, Kochi, Kerala 682002' },
    { key: 'powers', label: 'Powers granted', type: 'checkbox', required: true, sensitive: false, options: ['Property Matters', 'Financial & Banking', 'Legal Proceedings', 'Tax Matters'], helpText: 'Select all powers to grant.', sample: ['Property Matters', 'Financial & Banking'] },
    { key: 'effectiveDate', label: 'Effective from', type: 'date', required: true, sensitive: true, sample: '2026-09-15' },
    { key: 'executionCity', label: 'City of execution', type: 'text', required: true, sensitive: true, sample: 'Kochi' },
  ],
  documentHtml: `<h1>GENERAL POWER OF ATTORNEY</h1>
<p>I, <strong>{{principalName}}</strong>, resident of {{principalAddress}}, do hereby appoint <strong>{{agentName}}</strong>, resident of {{agentAddress}}, as my lawful attorney (the "Agent") to act on my behalf in respect of the following:</p>
<h2>Powers Granted</h2>
<ul>{{#each powers}}<li>All matters relating to <strong>{{this}}</strong>;</li>{{/each}}</ul>
<h2>Scope</h2>
<p>The Agent may sign, execute, deliver and register documents, make representations, receive payments and issue receipts in relation to the above powers, as fully as I could do in person.</p>
<h2>Effective Date & Duration</h2>
<p>Effective from {{date effectiveDate}}; remains in force until revoked by me in writing.</p>
<h2>Execution</h2>
<p>Signed at {{executionCity}} on {{today}}. May be registered/adjudicated per the Registration Act, 1908 if required.</p>
<div class="sig-block"><p>Principal: ______________________ ({{principalName}})</p><p>Agent: ______________________ ({{agentName}})</p><p>Witness: ______________________</p></div>`,
};
