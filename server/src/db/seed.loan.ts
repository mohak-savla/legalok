import { SeedTemplate } from './seed.types';

export const TPL_LOAN: SeedTemplate = {
  name: 'Personal Loan Agreement', slug: 'personal-loan-agreement',
  audience: 'personal', category: 'Finance', description: 'Money-lending agreement between two parties with interest and repayment terms.',
  estimatedTimeMinutes: 9, isPaid: true, price: 499,
  questionnaireSchema: [
    { key: 'lenderName', label: 'Lender full name', type: 'text', required: true, sensitive: true, youtubeUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', sample: 'Vikram Malhotra' },
    { key: 'borrowerName', label: 'Borrower full name', type: 'text', required: true, sensitive: true, sample: 'Neha Gupta' },
    { key: 'loanAmount', label: 'Loan principal (₹)', type: 'number', required: true, sensitive: true, sample: 200000 },
    { key: 'interestRate', label: 'Interest rate (% per annum)', type: 'number', required: true, sensitive: false, helpText: 'Enter 0 for interest-free.', sample: 10 },
    { key: 'tenureMonths', label: 'Repayment tenure (months)', type: 'number', required: true, sensitive: false, sample: 24 },
    { key: 'startDate', label: 'Loan disbursement date', type: 'date', required: true, sensitive: true, sample: '2026-09-10' },
    { key: 'witnessName', label: 'Witness full name (optional)', type: 'text', sensitive: true, sample: 'Arjun Rao' },
  ],
  documentHtml: `<h1>LOAN AGREEMENT</h1>
<p>Made on {{today}} between <strong>{{lenderName}}</strong> ("the Lender") and <strong>{{borrowerName}}</strong> ("the Borrower").</p>
<h2>1. Loan Amount</h2>
<p>The Lender lends the Borrower {{money loanAmount}}, disbursed on {{date startDate}}.</p>
<h2>2. Interest</h2>
{{#if (eq interestRate "0")}}<p>The loan is interest-free.</p>{{else}}<p>Interest accrues at {{interestRate}}% per annum on the outstanding principal.</p>{{/if}}
<h2>3. Repayment</h2>
<p>Repayable with accrued interest within {{tenureMonths}} month(s), in equated monthly instalments unless agreed otherwise in writing.</p>
<h2>4. Default</h2>
<p>Default of two consecutive instalments makes the entire outstanding amount immediately due.</p>
<div class="sig-block"><p>Lender: ______________________ ({{lenderName}})</p><p>Borrower: ______________________ ({{borrowerName}})</p>{{#if witnessName}}<p>Witness: ______________________ ({{witnessName}})</p>{{/if}}<p>Date: {{today}}</p></div>`,
};
