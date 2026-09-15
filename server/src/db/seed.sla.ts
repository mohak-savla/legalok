import { SeedTemplate } from './seed.types';

export const TPL_SLA: SeedTemplate = {
  name: 'Service Level Agreement (SLA)', slug: 'service-level-agreement',
  audience: 'business', category: 'Business', description: 'Uptime, support response and penalty clauses for ongoing IT/services contracts.',
  estimatedTimeMinutes: 12, isPaid: true, price: 999,
  questionnaireSchema: [
    { key: 'providerName', label: 'Service provider name', type: 'text', required: true, sensitive: true, youtubeUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', sample: 'CloudPeak Services Pvt Ltd' },
    { key: 'clientName', label: 'Client name', type: 'text', required: true, sensitive: true, sample: 'Fintrust Capital' },
    { key: 'serviceName', label: 'Service covered', type: 'textarea', required: true, sensitive: true, sample: 'Managed hosting and application support for the client portal' },
    { key: 'uptimeTarget', label: 'Uptime commitment', type: 'dropdown', required: true, sensitive: false, options: ['99.9%', '99.95%', '99.99%'], sample: '99.95%' },
    { key: 'responseHours', label: 'Support response time (hours)', type: 'number', required: true, sensitive: false, helpText: 'For priority-1 incidents.', sample: 2 },
    { key: 'monthlyFee', label: 'Monthly fee (₹)', type: 'number', required: true, sensitive: true, sample: 45000 },
    { key: 'startDate', label: 'Agreement start date', type: 'date', required: true, sensitive: true, sample: '2026-10-01' },
  ],
  documentHtml: `<h1>SERVICE LEVEL AGREEMENT</h1>
<p>This SLA is made on {{today}} between <strong>{{providerName}}</strong> ("the Provider") and <strong>{{clientName}}</strong> ("the Client").</p>
<h2>1. Services</h2>
<p>The Provider shall deliver: {{serviceName}}.</p>
<h2>2. Service Levels</h2>
<ul><li>Minimum monthly uptime: <strong>{{uptimeTarget}}</strong>;</li><li>Priority-1 incident response within <strong>{{responseHours}} hour(s)</strong>;</li><li>Monthly service reports delivered within 5 business days of month-end.</li></ul>
<h2>3. Service Credits</h2>
<p>For each month the uptime falls below the commitment, the Client receives a credit of 10% of the monthly fee, up to 50% in a calendar month.</p>
<h2>4. Fees & Term</h2>
<p>Monthly fee: {{money monthlyFee}}, invoiced monthly in advance, commencing {{date startDate}}. Minimum term: 12 months, renewing automatically.</p>
<div class="sig-block"><p>Provider: ______________________ ({{providerName}})</p><p>Client: ______________________ ({{clientName}})</p><p>Date: {{today}}</p></div>`,
};
