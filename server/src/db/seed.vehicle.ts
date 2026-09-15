import { SeedTemplate } from './seed.types';

export const TPL_VEHICLE: SeedTemplate = {
  name: 'Vehicle Sale Deed', slug: 'vehicle-sale-deed',
  audience: 'personal', category: 'Personal', description: 'Sale/transfer letter for a used vehicle between private parties.',
  estimatedTimeMinutes: 8, isPaid: false, price: 0,
  questionnaireSchema: [
    { key: 'sellerName', label: 'Seller full name', type: 'text', required: true, sensitive: true, youtubeUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', sample: 'Deepak Chawla' },
    { key: 'buyerName', label: 'Buyer full name', type: 'text', required: true, sensitive: true, sample: 'Farhan Khan' },
    { key: 'vehicleMake', label: 'Vehicle make', type: 'text', required: true, sensitive: false, sample: 'Maruti Suzuki' },
    { key: 'vehicleModel', label: 'Vehicle model & variant', type: 'text', required: true, sensitive: false, sample: 'Baleno Zeta CVT' },
    { key: 'vehicleYear', label: 'Year of manufacture', type: 'number', required: true, sensitive: false, sample: 2021 },
    { key: 'registrationNo', label: 'Registration number', type: 'text', required: true, sensitive: true, sample: 'MH12 AB 4321' },
    { key: 'saleAmount', label: 'Sale consideration (₹)', type: 'number', required: true, sensitive: true, sample: 650000 },
    { key: 'saleDate', label: 'Date of sale', type: 'date', required: true, sensitive: true, sample: '2026-09-20' },
  ],
  documentHtml: `<h1>VEHICLE SALE DEED</h1>
<p>Sold on {{today}} by <strong>{{sellerName}}</strong> ("the Seller") to <strong>{{buyerName}}</strong> ("the Buyer").</p>
<h2>1. Vehicle Details</h2>
<p>{{vehicleMake}} {{vehicleModel}}, manufactured {{vehicleYear}}, bearing registration number <strong>{{registrationNo}}</strong> (the "Vehicle"), together with all its parts, tools and documents (RC, insurance, PUC).</p>
<h2>2. Sale Consideration</h2>
<p>The Buyer has paid the Seller {{money saleAmount}} as full and final consideration, receipt whereof the Seller hereby acknowledges.</p>
<h2>3. Transfer of Ownership</h2>
<p>Ownership transfers to the Buyer from {{date saleDate}}. The Seller shall co-operate in transferring the registration to the Buyer's name and shall remain liable for any challans/dues arising before this date.</p>
<h2>4. Condition</h2>
<p>The Vehicle is sold on an "as-is, where-is" basis. The Buyer has inspected the Vehicle and satisfied himself about its condition.</p>
<div class="sig-block"><p>Seller: ______________________ ({{sellerName}})</p><p>Buyer: ______________________ ({{buyerName}})</p><p>Witness: ______________________ · Date: {{today}}</p></div>`,
};
