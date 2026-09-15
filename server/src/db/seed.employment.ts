import { SeedTemplate } from './seed.types';

export const TPL_EMPLOYMENT: SeedTemplate = {
  name: 'Employment Contract', slug: 'employment-contract',
  audience: 'business', category: 'Employment', description: 'Offer-cum-employment contract with salary, probation and notice terms.',
  estimatedTimeMinutes: 10, isPaid: false, price: 0,
  questionnaireSchema: [
    { key: 'employerName', label: 'Employer / company name', type: 'text', required: true, sensitive: true, youtubeUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', sample: 'Nimbus Solutions Pvt Ltd' },
    { key: 'employeeName', label: 'Employee full name', type: 'text', required: true, sensitive: true, sample: 'Karthik Iyer' },
    { key: 'jobTitle', label: 'Job title / designation', type: 'text', required: true, sensitive: true, sample: 'Senior Software Engineer' },
    { key: 'workLocation', label: 'Work location', type: 'text', required: true, sensitive: true, sample: 'Pune, Maharashtra' },
    { key: 'annualSalary', label: 'Annual CTC (₹)', type: 'number', required: true, sensitive: true, helpText: 'Total cost to company per annum.', sample: 1200000 },
    { key: 'startDate', label: 'Employment start date', type: 'date', required: true, sensitive: true, sample: '2026-10-01' },
    { key: 'probationMonths', label: 'Probation period (months)', type: 'number', required: true, sensitive: false, helpText: 'Typically 3–6.', sample: 6 },
    { key: 'noticePeriodDays', label: 'Notice period (days)', type: 'number', required: true, sensitive: false, sample: 60 },
  ],
  documentHtml: `<h1>EMPLOYMENT CONTRACT</h1>
<p>This Employment Contract is entered into on {{today}} between <strong>{{employerName}}</strong> ("the Company") and <strong>{{employeeName}}</strong> ("the Employee").</p>
<h2>1. Position & Location</h2>
<p>The Employee is appointed as <strong>{{jobTitle}}</strong>, stationed at {{workLocation}}, starting {{date startDate}}.</p>
<h2>2. Remuneration</h2>
<p>Annual CTC of {{money annualSalary}}, subject to statutory deductions, paid monthly.</p>
<h2>3. Probation</h2>
<p>The first {{probationMonths}} month(s) constitute probation, during which either party may terminate with 7 days' notice.</p>
<h2>4. Confidentiality & IP</h2>
<p>All business information and work product created during employment vests exclusively in the Company.</p>
<h2>5. Termination</h2>
<p>Post-confirmation, either party may terminate by serving {{noticePeriodDays}} days' written notice or salary in lieu.</p>
<div class="sig-block"><p>For the Company: ______________________</p><p>Employee: ______________________ ({{employeeName}})</p><p>Date: {{today}}</p></div>`,
};
