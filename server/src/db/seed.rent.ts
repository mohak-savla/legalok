import { SeedTemplate } from './seed.types';

export const TPL_RENT: SeedTemplate = {
  name: 'Residential Rent Agreement', slug: 'residential-rent-agreement',
  audience: 'personal', category: 'Property', description: 'Landlord–tenant agreement for residential premises with rent, deposit and furnishing terms.',
  estimatedTimeMinutes: 10, isPaid: true, price: 499,
  questionnaireSchema: [
    { key: 'landlordName', label: 'Landlord full name', type: 'text', required: true, sensitive: true, helpText: 'Owner as per sale deed.', youtubeUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', sample: 'Suresh Kumar' },
    { key: 'tenantName', label: 'Tenant full name', type: 'text', required: true, sensitive: true, sample: 'Anita Desai' },
    { key: 'propertyAddress', label: 'Full property address', type: 'textarea', required: true, sensitive: true, sample: 'Flat 402, Green Residency, Koramangala, Bengaluru 560034' },
    { key: 'monthlyRent', label: 'Monthly rent (₹)', type: 'number', required: true, sensitive: true, sample: 25000 },
    { key: 'securityDeposit', label: 'Security deposit (₹)', type: 'number', required: true, sensitive: true, helpText: 'Usually 2–6 months rent.', sample: 50000 },
    { key: 'startDate', label: 'Agreement start date', type: 'date', required: true, sensitive: true, sample: '2026-09-01' },
    { key: 'durationMonths', label: 'Agreement duration (months)', type: 'dropdown', required: true, sensitive: false, options: ['11', '24', '36'], helpText: '11 months avoids compulsory registration in most states.', sample: '11' },
    { key: 'furnitureIncluded', label: 'Is the property furnished?', type: 'radio', required: true, sensitive: false, options: ['Yes', 'No'], sample: 'Yes' },
    { key: 'maintenanceNote', label: 'Furniture & appliances included', type: 'text', sensitive: true, condition: { field: 'furnitureIncluded', op: 'equals', value: 'Yes' }, helpText: 'e.g. 1 AC, wardrobes, geyser.', sample: '1 AC, 2 wardrobes, geyser, modular kitchen' },
  ],
  documentHtml: `<h1>RESIDENTIAL RENT AGREEMENT</h1>
<p>This Rent Agreement is made on {{today}} between <strong>{{landlordName}}</strong> ("Landlord") and <strong>{{tenantName}}</strong> ("Tenant").</p>
<h2>1. Premises</h2>
<p>The Landlord lets out to the Tenant the residential premises at {{propertyAddress}} (the "Premises").</p>
<h2>2. Rent & Deposit</h2>
<p>Monthly rent: {{money monthlyRent}}, payable by the 5th of each month, with a refundable security deposit of {{money securityDeposit}}.</p>
<h2>3. Term</h2>
<p>Valid for {{durationMonths}} months from {{date startDate}}.</p>
<h2>4. Furnishing</h2>
{{#if (eq furnitureIncluded "Yes")}}<p>The Premises are let out furnished including: {{maintenanceNote}}. The Tenant shall maintain them in good condition, normal wear and tear excepted.</p>{{else}}<p>The Premises are let out unfurnished. No structural alterations without written consent.</p>{{/if}}
<h2>5. General Conditions</h2>
<ol><li>Residential use only;</li><li>No subletting without consent;</li><li>Electricity, water & maintenance borne by the Tenant;</li><li>One month's notice for early termination.</li></ol>
<div class="sig-block"><p>Landlord: ______________________ ({{landlordName}})</p><p>Tenant: ______________________ ({{tenantName}})</p><p>Date: {{today}}</p></div>`,
};
