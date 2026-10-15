const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const assert = require('assert');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const articles = [
    {
      id: 1,
      slug: 'restore-with-confidence',
      number: 'BRIEF 015',
      title: 'A backup is only a promise. Test the restore.',
      dek: 'What recovery rehearsals reveal about your infrastructure before an incident does.',
      date: '09 SEP 2026',
      read: '08 MIN READ',
      systems: ['PostgreSQL', 'Recovery'],
      severity: 'Material',
      finding: 'Test recovery against the actual service requirements.',
      body: ['A successful backup job does not prove recovery.'],
      published: true,
      sortOrder: 1,
      language: 'en',
      targetMarkets: ['com', 'eu'],
    },
  ];
  const leads = [
    {
      id: 1,
      name: 'Alex Morgan',
      company: 'Northstar Labs',
      email: 'alex@example.invalid',
      role: 'CTO',
      context:
        'We need an independent review of our cloud infrastructure and backup process.',
      originMarket: 'com',
      originDomain: 'zenthracore.com',
      status: 'new',
      briefToken: 'fixture-1',
      createdAt: '2026-09-09T10:00:00Z',
    },
    {
      id: 2,
      name: 'Sofia Weber',
      company: 'Forma Studio',
      email: 'sofia@example.invalid',
      role: 'Engineering lead',
      context: 'Review our release process.',
      originMarket: 'eu',
      originDomain: 'zenthracore.eu',
      status: 'brief_completed',
      briefToken: 'fixture-2',
      createdAt: '2026-09-08T10:00:00Z',
      briefData: { infrastructure: 'AWS', backupFrequency: 'Daily' },
    },
    {
      id: 3,
      name: 'Olena Kovalenko',
      company: 'Orbit Systems',
      email: 'olena@example.invalid',
      originMarket: 'com.ua',
      originDomain: 'zenthracore.com.ua',
      status: 'brief_sent',
      briefToken: 'fixture-3',
      createdAt: '2026-09-07T10:00:00Z',
    },
  ];
  let writes = [],
    reject = false;
  await page.route('**/api/**', async (route) => {
    const r = route.request(),
      url = new URL(r.url());
    let data = {};
    if (reject)
      return route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
    if (url.pathname.endsWith('/auth/login')) {
      assert.equal(r.postDataJSON().token, 'fixture-only');
      return route.fulfill({ json: { authenticated: true } });
    }
    assert.equal(r.headers()['x-admin-token'], undefined);
    if (r.method() !== 'GET') {
      writes.push({ path: url.pathname, body: r.postDataJSON() });
      if (r.method() === 'POST' && url.pathname.endsWith('/journal'))
        articles.push({ ...r.postDataJSON(), id: 2 });
      return route.fulfill({ json: { ok: true } });
    }
    if (url.pathname.endsWith('/journal')) data = articles;
    else if (url.pathname.endsWith('/leads')) data = leads;
    else data = { authenticated: true };
    await route.fulfill({ json: data });
  });
  await page.goto('http://127.0.0.1:3001');
  await page.screenshot({ path: 'qa/login.png' });
  await page.getByLabel('Access token').fill('fixture-only');
  await page.getByRole('button', { name: 'Open workspace' }).click();
  await page.getByText('Northstar Labs', { exact: true }).waitFor();
  await page.screenshot({ path: 'qa/overview-desktop.png', fullPage: true });
  assert.equal(
    await page.evaluate(() => localStorage.getItem('zc_admin_token')),
    null,
  );
  await page.getByRole('button', { name: 'Leads & briefs' }).click();
  await page.getByLabel('Market', { exact: true }).selectOption('eu');
  assert.equal(await page.locator('tbody tr').count(), 1);
  await page.getByLabel('Market', { exact: true }).selectOption('all');
  await page.getByLabel('Search', { exact: true }).fill('Orbit');
  assert.equal(await page.locator('tbody tr').count(), 1);
  await page.getByLabel('Search', { exact: true }).fill('');
  await page.getByText('Northstar Labs', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Send brief email', exact: true })
    .click();
  assert.equal(writes.length, 0);
  await page
    .getByRole('dialog', { name: 'Send brief email?' })
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Journal', exact: true }).click();
  await page.getByRole('button', { name: 'New article' }).click();
  await page.getByLabel('Title', { exact: true }).fill('Fixture draft');
  await page.getByLabel('URL slug').fill('fixture-draft');
  await page.getByLabel('Executive summary').fill('Fixture summary');
  await page.getByLabel('Key finding').fill('Fixture finding');
  await page
    .getByLabel('Article body', { exact: false })
    .fill('First paragraph.\n\nSecond paragraph.');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await page.getByText('Fixture draft', { exact: true }).waitFor();
  assert.equal(writes[0].body.published, false);
  assert.deepEqual(writes[0].body.targetMarkets, ['com', 'eu', 'com.ua']);
  assert.equal(writes[0].body.body.length, 2);
  await page.screenshot({ path: 'qa/journal-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.screenshot({ path: 'qa/overview-mobile.png', fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.getByRole('button', { name: 'Journal', exact: true }).click();
  await page.getByRole('button', { name: 'New article' }).click();
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector('dialog').scrollWidth >
        document.querySelector('dialog').clientWidth,
    ),
    false,
  );
  await page.screenshot({ path: 'qa/editor-mobile.png', fullPage: true });
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Close dialog' }).click();
  reject = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('button', { name: 'Open workspace' }).waitFor();
  assert.equal(errors.length, 0, errors.join('\n'));
  fs.writeFileSync(
    'qa/results.json',
    JSON.stringify(
      {
        passed: true,
        checks: [
          'login',
          'no persisted credential',
          'market filter',
          'search',
          'email confirmation cancellation sends nothing',
          'draft save payload',
          'mobile overflow',
          'mobile editor',
          '401 logout',
          'no runtime errors',
        ],
        mode: 'local mocked API only; no production writes',
      },
      null,
      2,
    ),
  );
  await browser.close();
  console.log('All browser checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
