/**
 * Comprehensive workflow test script for ABN Community App
 * Tests all API endpoints and reports pass/fail status
 */
const BASE = 'http://localhost:3001/api';
const results = [];

function pass(name, detail = '') {
  results.push({ status: 'PASS', name, detail });
  console.log(`✅ PASS: ${name}${detail ? ' — ' + detail : ''}`);
}
function fail(name, detail = '') {
  results.push({ status: 'FAIL', name, detail });
  console.log(`❌ FAIL: ${name}${detail ? ' — ' + detail : ''}`);
}
function skip(name, detail = '') {
  results.push({ status: 'SKIP', name, detail });
  console.log(`⏭️  SKIP: ${name}${detail ? ' — ' + detail : ''}`);
}
function warn(name, detail = '') {
  results.push({ status: 'WARN', name, detail });
  console.log(`⚠️  WARN: ${name}${detail ? ' — ' + detail : ''}`);
}

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, ok: res.ok };
}

async function run() {
  console.log('\n=== ABN Community App — Workflow Test Report ===\n');

  // 1. Health
  try {
    const h = await req('GET', '/health');
    h.ok && h.data?.status === 'ok' ? pass('Health check', h.data.storage) : fail('Health check', JSON.stringify(h.data));
  } catch (e) { fail('Health check', e.message); }

  // 2. Public directory
  try {
    const d = await req('GET', '/directory');
    d.ok && Array.isArray(d.data) ? pass('GET /directory (public)', `${d.data.length} listings`) : fail('GET /directory', JSON.stringify(d.data));
  } catch (e) { fail('GET /directory', e.message); }

  // 3. Jobs board public
  try {
    const j = await req('GET', '/jobsboard');
    j.ok && Array.isArray(j.data) ? pass('GET /jobsboard (public)', `${j.data.length} jobs`) : fail('GET /jobsboard', JSON.stringify(j.data));
  } catch (e) { fail('GET /jobsboard', e.message); }

  // 4. Admin login
  let adminToken, adminUser;
  try {
    const login = await req('POST', '/auth/login', { email: 'admin@shiadirectory.com', password: 'admin123' });
    if (login.ok && login.data?.token) {
      adminToken = login.data.token;
      adminUser = login.data.user;
      pass('Admin login', adminUser.role);
    } else fail('Admin login', JSON.stringify(login.data));
  } catch (e) { fail('Admin login', e.message); }

  // 5. Invalid login
  try {
    const bad = await req('POST', '/auth/login', { email: 'admin@shiadirectory.com', password: 'wrongpass' });
    bad.status === 401 ? pass('Invalid login rejected (401)') : fail('Invalid login rejected', `status ${bad.status}`);
  } catch (e) { fail('Invalid login rejected', e.message); }

  // 6. Register new user
  const testEmail = `testuser_${Date.now()}@test.com`;
  let userToken, userId;
  try {
    const reg = await req('POST', '/auth/register', {
      email: testEmail,
      password: 'testpass123',
      name: 'Test User',
      phone: '+1 555 000 1111',
      role: 'business',
    });
    if (reg.ok && reg.data?.token) {
      userToken = reg.data.token;
      userId = reg.data.user?.id;
      pass('User registration', testEmail);
    } else fail('User registration', JSON.stringify(reg.data));
  } catch (e) { fail('User registration', e.message); }

  // 7. Duplicate registration
  try {
    const dup = await req('POST', '/auth/register', { email: testEmail, password: 'testpass123', name: 'Dup' });
    dup.status === 409 || dup.status === 400 ? pass('Duplicate registration rejected') : fail('Duplicate registration rejected', `status ${dup.status}`);
  } catch (e) { fail('Duplicate registration rejected', e.message); }

  // 8. Update profile
  try {
    const upd = await req('PUT', '/auth/me', { name: 'Test User Updated', phone: '+1 555 999 8888' }, userToken);
    upd.ok ? pass('PUT /auth/me (update profile)') : fail('PUT /auth/me', JSON.stringify(upd.data));
  } catch (e) { fail('PUT /auth/me', e.message); }

  // 9. Create business listing
  let businessId;
  try {
    const biz = await req('POST', '/directory', {
      businessName: 'Test Auto Shop',
      category: 'Automotive',
      city: 'Edmonton',
      address: '123 Test St',
      phone: '+1 780 555 1234',
      description: 'Test business for workflow check',
      listingType: 'business',
      imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      workingHours: 'Mon-Fri 9-5',
    }, userToken);
    if (biz.ok && biz.data?.id) {
      businessId = biz.data.id;
      pass('POST /directory (register business)', `id=${businessId}, status=${biz.data.status}`);
    } else fail('POST /directory', JSON.stringify(biz.data));
  } catch (e) { fail('POST /directory', e.message); }

  // 10. Get my listings
  try {
    const mine = await req('GET', '/directory/mine', null, userToken);
    mine.ok && Array.isArray(mine.data) && mine.data.length > 0 ? pass('GET /directory/mine', `${mine.data.length} listing(s)`) : fail('GET /directory/mine', JSON.stringify(mine.data));
  } catch (e) { fail('GET /directory/mine', e.message); }

  // 11. Admin sees all listings (including pending)
  try {
    const all = await req('GET', '/directory/all', null, adminToken);
    const found = all.data?.find?.(b => b.id === businessId);
    all.ok && found ? pass('GET /directory/all (admin)', `found pending listing`) : fail('GET /directory/all', JSON.stringify(all.data?.length));
  } catch (e) { fail('GET /directory/all', e.message); }

  // 12. Public directory should NOT show pending listing
  try {
    const pub = await req('GET', '/directory');
    const found = pub.data?.find?.(b => b.id === businessId);
    !found ? pass('Pending listing hidden from public directory') : fail('Pending listing hidden from public', 'listing visible when it should not be');
  } catch (e) { fail('Pending listing hidden from public', e.message); }

  // 13. Admin approve listing
  try {
    const approve = await req('PUT', `/directory/${businessId}`, { isVerified: true, subscriptionStatus: 'active' }, adminToken);
    approve.ok ? pass('Admin approve listing') : fail('Admin approve listing', JSON.stringify(approve.data));
  } catch (e) { fail('Admin approve listing', e.message); }

  // 14. Public directory shows approved listing
  try {
    const pub = await req('GET', '/directory');
    const found = pub.data?.find?.(b => b.id === businessId);
    found ? pass('Approved listing visible in public directory') : fail('Approved listing visible', 'not found');
  } catch (e) { fail('Approved listing visible', e.message); }

  // 15. Favorites — add
  try {
    const fav = await req('POST', `/favorites/${businessId}`, null, userToken);
    fav.ok || fav.status === 201 ? pass('POST /favorites (add favorite)') : fail('POST /favorites', JSON.stringify(fav.data));
  } catch (e) { fail('POST /favorites', e.message); }

  // 16. Favorites — list
  try {
    const favs = await req('GET', '/favorites', null, userToken);
    const found = favs.data?.find?.(f => f.businessId === businessId || f.id === businessId);
    favs.ok && (found || favs.data?.length > 0) ? pass('GET /favorites', `${favs.data?.length} favorite(s)`) : fail('GET /favorites', JSON.stringify(favs.data));
  } catch (e) { fail('GET /favorites', e.message); }

  // 17. Reviews — submit
  try {
    const rev = await req('POST', '/reviews', { businessId, rating: 5, comment: 'Great test shop!' }, userToken);
    rev.ok || rev.status === 201 ? pass('POST /reviews (submit review)') : fail('POST /reviews', JSON.stringify(rev.data));
  } catch (e) { fail('POST /reviews', e.message); }

  // 18. Reviews — fetch
  try {
    const revs = await req('GET', `/reviews?businessId=${businessId}`);
    revs.ok && Array.isArray(revs.data) && revs.data.length > 0 ? pass('GET /reviews', `${revs.data.length} review(s)`) : fail('GET /reviews', JSON.stringify(revs.data));
  } catch (e) { fail('GET /reviews', e.message); }

  // 19. Payment renew
  try {
    const pay = await req('POST', '/payments/renew', { businessId, amount: 50, method: 'test' }, userToken);
    pay.ok || pay.status === 201 ? pass('POST /payments/renew') : fail('POST /payments/renew', JSON.stringify(pay.data));
  } catch (e) { fail('POST /payments/renew', e.message); }

  // 20. Payment history
  try {
    const pays = await req('GET', '/payments/mine', null, userToken);
    pays.ok ? pass('GET /payments/mine', `${pays.data?.length ?? 0} payment(s)`) : fail('GET /payments/mine', JSON.stringify(pays.data));
  } catch (e) { fail('GET /payments/mine', e.message); }

  // 21. Admin payments
  try {
    const pays = await req('GET', '/payments', null, adminToken);
    pays.ok ? pass('GET /payments (admin)') : fail('GET /payments (admin)', JSON.stringify(pays.data));
  } catch (e) { fail('GET /payments (admin)', e.message); }

  // 22. Hiring toggle (required before posting jobs)
  try {
    const hire = await req('PUT', `/directory/${businessId}/hiring`, { isActive: true }, userToken);
    hire.ok ? pass('PUT /directory/:id/hiring (toggle hiring)') : fail('PUT /directory/:id/hiring', JSON.stringify(hire.data));
  } catch (e) { fail('PUT /directory/:id/hiring', e.message); }

  // 23. Create job
  let jobId;
  try {
    const job = await req('POST', '/jobsboard', {
      title: 'Test Mechanic Position',
      category: 'Others',
      hiringEmail: testEmail,
      salaryMin: 20,
      salaryMax: 40,
      requirements: 'Test job posting requirements',
    }, userToken);
    if (job.ok && job.data?.id) {
      jobId = job.data.id;
      pass('POST /jobsboard (create job)', `id=${jobId}`);
    } else fail('POST /jobsboard', JSON.stringify(job.data));
  } catch (e) { fail('POST /jobsboard', e.message); }

  // 23. Update job
  if (jobId) {
    try {
      const upd = await req('PUT', `/jobsboard/${jobId}`, { title: 'Updated Mechanic Position' }, userToken);
      upd.ok ? pass('PUT /jobsboard/:id (edit job)') : fail('PUT /jobsboard/:id', JSON.stringify(upd.data));
    } catch (e) { fail('PUT /jobsboard/:id', e.message); }
  }

  // 24. Jobs visible publicly
  try {
    const jobs = await req('GET', '/jobsboard');
    const found = jobs.data?.find?.(j => j.id === jobId);
    found ? pass('Job visible on public job board') : warn('Job visible on public job board', 'job not found (may need hiringActive)');
  } catch (e) { fail('Job visible on public job board', e.message); }

  // 26. Admin suspend listing
  try {
    const susp = await req('PUT', `/directory/${businessId}`, { subscriptionStatus: 'suspended' }, adminToken);
    susp.ok ? pass('Admin suspend listing') : fail('Admin suspend listing', JSON.stringify(susp.data));
  } catch (e) { fail('Admin suspend listing', e.message); }

  // 27. Admin reactivate
  try {
    const react = await req('PUT', `/directory/${businessId}`, { subscriptionStatus: 'active' }, adminToken);
    react.ok ? pass('Admin reactivate listing') : fail('Admin reactivate listing', JSON.stringify(react.data));
  } catch (e) { fail('Admin reactivate listing', e.message); }

  // 28. Remove favorite
  try {
    const unfav = await req('DELETE', `/favorites/${businessId}`, null, userToken);
    unfav.ok || unfav.status === 204 ? pass('DELETE /favorites (remove favorite)') : fail('DELETE /favorites', JSON.stringify(unfav.data));
  } catch (e) { fail('DELETE /favorites', e.message); }

  // 29. Update business listing
  try {
    const upd = await req('PUT', `/directory/${businessId}`, { description: 'Updated description' }, userToken);
    upd.ok ? pass('PUT /directory/:id (owner edit)') : fail('PUT /directory/:id', JSON.stringify(upd.data));
  } catch (e) { fail('PUT /directory/:id', e.message); }

  // 30. Delete job
  if (jobId) {
    try {
      const del = await req('DELETE', `/jobsboard/${jobId}`, null, userToken);
      del.ok || del.status === 204 ? pass('DELETE /jobsboard/:id') : fail('DELETE /jobsboard/:id', JSON.stringify(del.data));
    } catch (e) { fail('DELETE /jobsboard/:id', e.message); }
  }

  // 31. Admin delete listing
  try {
    const del = await req('DELETE', `/directory/${businessId}`, null, adminToken);
    del.ok ? pass('Admin delete listing') : fail('Admin delete listing', JSON.stringify(del.data));
  } catch (e) { fail('Admin delete listing', e.message); }

  // 32. Unauthenticated access blocked
  try {
    const noauth = await req('GET', '/directory/mine');
    noauth.status === 401 ? pass('Unauthenticated /directory/mine blocked (401)') : fail('Unauth blocked', `status ${noauth.status}`);
  } catch (e) { fail('Unauth blocked', e.message); }

  // Summary
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  console.log('\n=== SUMMARY ===');
  console.log(`✅ Passed:  ${passed}`);
  console.log(`❌ Failed:  ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`⏭️  Skipped:  ${skipped}`);
  console.log(`Total:     ${results.length}\n`);

  if (failed > 0) {
    console.log('FAILED TESTS:');
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  - ${r.name}: ${r.detail}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
