/** E2E smoke test in the running app — verifies conditionals + signature injection */
const BASE = 'http://localhost:4000/api';

async function req(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
       const json = (await res.json().catch(() => ({}))) as any;
  return { status: res.status, json };
}

let failures = 0;
const check = (name: string, cond: boolean, detail = ''): void => {
  console.log(`${cond ? '✅' : '❌'} ${name}${cond ? '' : ` — ${detail}`}`);
  if (!cond) failures += 1;
};

async function fillAnswers(fields: { key: string; label: string; type: string; options?: string[] }[]): Promise<Record<string, unknown>> {
  const answers: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.type === 'dropdown' || f.type === 'radio') answers[f.key] = f.options?.[0] ?? 'Option 1';
    else if (f.type === 'number') answers[f.key] = 1000;
    else if (f.type === 'date') answers[f.key] = '2026-08-28';
    else if (f.type === 'checkbox') answers[f.key] = [f.options?.[0] ?? 'A'];
    else if (f.type === 'email') answers[f.key] = 'demo@legalok.in';
    else if (f.type === 'signature') answers[f.key] = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    else answers[f.key] = `Sample ${f.label}`;
  }
  return answers;
}
async function main(): Promise<void> {
  const login = await req('POST', '/auth/login', { email: 'demo@legalok.in', password: 'Demo@123' });
  check('login', login.status === 200 && !!login.json.accessToken, JSON.stringify(login.json).slice(0, 120));
  const token = login.json.accessToken as string;

  const tl = await req('GET', '/templates', undefined, token);
  const tpls = tl.json.templates as { id: string; name: string; slug: string; isPaid: boolean }[];
  check('templates list', tpls.length > 0, `count=${tpls.length}`);

  const tplsWithCond: string[] = [];
  for (const t of tpls.slice(0, 8)) {
    try {
      const full = await req('GET', `/templates/${t.id}`, undefined, token);
      const docHtml = full.json.template?.documentHtml ?? '';
      if (docHtml.includes('cond-block')) tplsWithCond.push(t.name);
    } catch { /* skip */ }
  }
  console.log(`   templates with IF/ELSE blocks: ${tplsWithCond.join(', ') || '(none found)'}`);

  let chosen: { id: string; name: string; isPaid: boolean } | null = null;
  let chosenFields: { key: string; label: string; type: string; options?: string[] }[] = [];
  for (const t of tpls) {
    const full = await req('GET', `/templates/${t.id}`, undefined, token);
    const tpl = full.json.template;
    if (!tpl) continue;
    const opts = (tpl.questionnaireSchema ?? []).filter((f: { type: string }) => ['dropdown', 'radio'].includes(f.type));
    if (opts.length > 0) { chosen = t; chosenFields = tpl.questionnaireSchema; break; }
  }
  check('template with dropdown found', !!chosen);
  if (!chosen) return;
  console.log(`   using template: ${chosen.name} (paid=${chosen.isPaid})`);

  const created = await req('POST', '/documents', { templateId: chosen.id }, token);
  check('doc created', created.status === 201 || created.status === 200, JSON.stringify(created.json).slice(0, 120));
  const docId = (created.json.document ?? created.json).id as string;

  const answers = await fillAnswers(chosenFields);
  const saved = await req('PUT', `/documents/${docId}/answers`, { answers, currentStep: chosenFields.length }, token);
  check('answers saved', saved.status === 200, JSON.stringify(saved.json).slice(0, 120));

  const done = await req('POST', `/documents/${docId}/complete`, {}, token);
  check('complete', done.status === 200, JSON.stringify(done.json).slice(0, 160));
  const docStatus = done.json.document?.status ?? 'unknown';

  if (docStatus === 'awaiting_payment') {
    const pay = await req('POST', '/payments/create-order', { documentId: docId }, token);
    check('payment create-order', pay.status === 201, JSON.stringify(pay.json).slice(0, 160));
    const orderId = pay.json.orderId as string;
    const checkout = await req('POST', `/payments/mock-checkout/${orderId}`, {}, token);
    check('mock-checkout', checkout.status === 200, JSON.stringify(checkout.json).slice(0, 160));
    const verify = await req('POST', '/payments/verify', checkout.json, token);
    check('payment verify', verify.status === 200, JSON.stringify(verify.json).slice(0, 160));
  }

  const file = await req('GET', `/documents/${docId}/file`, undefined, token);
  const html = file.json.html ?? '';
  check('file served', file.status === 200 && html.length > 0, JSON.stringify(file.json).slice(0, 160));
  check('no cond-block in rendered', !html.includes('cond-block'), 'cond-block present');
  check('no cond-branch-head logic', !html.includes('cond-branch-head'), 'branch head present');

  const sign = await req('POST', `/documents/${docId}/self-sign`, { signatureType: 'click', signatureData: 'Demo User' }, token);
  check('self-sign', sign.status === 200, JSON.stringify(sign.json).slice(0, 160));
  const file2 = await req('GET', `/documents/${docId}/file`, undefined, token);
  const html2 = file2.json.html ?? '';
  check('signature block injected', html2.includes('sig-block') || html2.includes('sig-execution'));
  check('typed signature visible', html2.includes('sig-typed') && html2.includes('Demo User'));
  check('clean after sign', !html2.includes('cond-branch-head'));

  // Real DOCX & PDF export endpoints
  const docxRes = await fetch(`${BASE}/documents/${docId}/docx`, { headers: { Authorization: `Bearer ${token}` } });
  const docxBuf = Buffer.from(await docxRes.arrayBuffer());
  check('docx export (real OOXML)', docxRes.status === 200 && docxBuf.subarray(0, 2).toString('latin1') === 'PK', `status=${docxRes.status} bytes=${docxBuf.length}`);
  const pdfRes = await fetch(`${BASE}/documents/${docId}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
  check('pdf export (server-rendered)', pdfRes.status === 200 && pdfBuf.subarray(0, 4).toString('latin1') === '%PDF', `status=${pdfRes.status} bytes=${pdfBuf.length}`);

  const adminLogin = await req('POST', '/auth/login', { email: 'admin@legalok.in', password: 'Admin@123' });
  check('admin login', adminLogin.status === 200, JSON.stringify(adminLogin.json).slice(0, 120));
  const adminToken = adminLogin.json.accessToken as string;

  // Save a template with a VISUAL cond-block (the structure the TipTap Studio emits)
  const visualHtml = `
<h1>Visual IF-ELSE Contract</h1>
<p>This Agreement is between {{party_name}} and {{other_name}}.</p>
<div class="cond-block" data-field="party_type">
  <div class="cond-head" contenteditable="false">⚡ party_type: = "Company" / ELSE</div>
  <div class="cond-branches">
    <div class="cond-body" data-value="Company" data-op="equals">
      <div class="cond-branch-head" contenteditable="false">= "Company"</div>
      <div class="cond-branch-inner"><p>COMPANY SPECIFIC CLAUSE.</p><ol><li>Clause A</li><li>Clause B</li></ol></div>
    </div>
    <div class="cond-body" data-else="true" data-op="equals">
      <div class="cond-branch-head" contenteditable="false">ELSE</div>
      <div class="cond-branch-inner"><p>INDIVIDUAL FALLBACK CLAUSE.</p></div>
    </div>
  </div>
</div>
<table><tbody><tr><th>Fee item</th></tr><tr data-when="{&quot;type&quot;:&quot;rule&quot;,&quot;field&quot;:&quot;party_type&quot;,&quot;operator&quot;:&quot;equals&quot;,&quot;value&quot;:&quot;Company&quot;}"><td>Registration fee row</td></tr></tbody></table>
<div class="repeat-block" data-collection="additional_vehicles" data-item="veh"><div class="repeat-head" contenteditable="false">FOR EACH veh IN additional_vehicles</div><div class="repeat-body"><p>Extra vehicle: {{veh}}</p></div></div>
<div class="sig-slot"></div>`;
  const visualFields = [
    { key: 'party_name', label: 'Party name', type: 'text', required: true },
    { key: 'other_name', label: 'Other party name', type: 'text', required: true },
    { key: 'party_type', label: 'Party type', type: 'dropdown', required: true, options: ['Company', 'Individual'] },
    { key: 'additional_vehicles', label: 'Additional vehicles', type: 'checkbox', options: ['Bike', 'Scooter'] },
  ];
  const createTpl = await req('POST', '/admin/templates', {
    name: 'Visual IF ELSE Test', category: 'Test', audience: 'business',
    isPaid: false, price: 0, questionnaireSchema: visualFields, documentHtml: visualHtml,
  }, adminToken);
  check('admin create template', createTpl.status === 201 || createTpl.status === 200, JSON.stringify(createTpl.json).slice(0, 160));
  const vtpl = createTpl.json.template ?? createTpl.json;
  const vtplId = vtpl.id;
  const pub = await req('POST', `/admin/templates/${vtplId}/publish`, {}, adminToken);
  check('admin publish template', pub.status === 200, JSON.stringify(pub.json).slice(0, 160));

  const vcreated = await req('POST', '/documents', { templateId: vtplId }, token);
  const vdocId = (vcreated.json.document ?? vcreated.json).id as string;
  await req('PUT', `/documents/${vdocId}/answers`, {
    answers: { party_name: 'Acme Corp', other_name: 'Jane Smith', party_type: 'Company', additional_vehicles: ['Bike', 'Scooter'] }, currentStep: 3,
  }, token);
  const vdone = await req('POST', `/documents/${vdocId}/complete`, {}, token);
  check('visual template doc complete', vdone.status === 200, JSON.stringify(vdone.json).slice(0, 160));
  const vfile = await req('GET', `/documents/${vdocId}/file`, undefined, token);
  const vhtml = vfile.json.html ?? '';
  check('visual: company clause rendered', vhtml.includes('COMPANY SPECIFIC CLAUSE'), vhtml.slice(0, 300));
  check('visual: no fallback for Company', !vhtml.includes('INDIVIDUAL FALLBACK CLAUSE'));
  check('visual: no editing chrome', !vhtml.includes('cond-branch-head') && !vhtml.includes('cond-block'));
  check('visual: sig-slot hidden', !vhtml.includes('sig-slot'));
  check('visual: merged answers injected', vhtml.includes('Acme Corp') && vhtml.includes('Jane Smith'));
  check('visual: ordered list auto-numbered', vhtml.includes('<ol>'));
  check('visual: conditional table row kept for Company', vhtml.includes('Registration fee row'));
  check('visual: repeat iterates the list — both rows produced', vhtml.includes('Extra vehicle: Bike') && vhtml.includes('Extra vehicle: Scooter'));
  check('visual: repeat chrome stripped', !vhtml.includes('repeat-block'));

  // Phase 11: the same conditional row must DROP for an Individual
  const vcreated2 = await req('POST', '/documents', { templateId: vtplId }, token);
  const vdocId2 = (vcreated2.json.document ?? vcreated2.json).id as string;
  await req('PUT', `/documents/${vdocId2}/answers`, {
    answers: { party_name: 'John Doe', other_name: 'Ria Sharma', party_type: 'Individual' }, currentStep: 3,
  }, token);
  const vdone2 = await req('POST', `/documents/${vdocId2}/complete`, {}, token);
  check('visual: second doc complete', vdone2.status === 200, JSON.stringify(vdone2.json).slice(0, 120));
  const vfile2 = await req('GET', `/documents/${vdocId2}/file`, undefined, token);
  const vhtml2 = vfile2.json.html ?? '';
  check('visual: conditional table row dropped for Individual', !vhtml2.includes('Registration fee row'));
  check('visual: repeat absent for Individual (no collection)', !vhtml2.includes('Extra vehicle'));
  check('visual: second doc shows Individual fallback', vhtml2.includes('INDIVIDUAL FALLBACK CLAUSE'));

  console.log(failures === 0 ? '\n=== E2E ALL PASSED ===' : `\n=== ${failures} FAILURES ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('E2E crashed:', e); process.exit(1); });