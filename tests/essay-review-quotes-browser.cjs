'use strict';

const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

const base = (process.env.READER_BASE_URL || 'http://127.0.0.1:8074').replace(/\/?$/, '/');
const releaseDir = path.resolve(__dirname, '../dist/k-sochineniyu/itogovoe/pomoshchnik');
const publicUrl = new URL('k-sochineniyu/itogovoe/pomoshchnik/proverka-sochineniya.html', base).href;
const artifacts = process.env.READER_ARTIFACT_DIR;
const draftKey = 'uzel.essay-review.draft.v1';
const reportKey = 'uzel.essay-review.report.v1';
const repeat = 'Герой помог соседу.';
const literal = '<img src=x onerror="globalThis.__quotePayloadExecuted=true">';
const original = 'Первая запись.\n  ' + repeat + '\nСохраняю деталь: ' + literal + '\n\n' + repeat + '  Эта фраза встречается снова.\nМой вывод.';
const sent = {topic: 'Как проявляется внимание к другому человеку?', essay: original, mode: 'secular'};
const edited = 'Моя новая первая фраза.\n' + original + '\nЭту правку я сделал после проверки.';
const newTopic = 'Почему бывает трудно принять помощь?';
const badQuote = 'Этих слов никогда не было в работе.';
const forbiddenFeedback = ['BAD_QUOTE_COMMENT', 'BAD_QUOTE_ACTION', 'BAD_PRIORITY'];
const results = [];
let release;

function makeReport(kind = 'valid') {
  const quotes = ['Первая запись.', repeat, literal, '\n  ' + repeat + '\nСохраняю деталь: ' + literal, ''];
  const review = {
    methodVersion: release.method.version,
    books: [],
    unverified: [],
    priority: 'Перечитай свою первую фразу.',
    criteria: ['K1', 'K2', 'K3', 'K4', 'K5'].map((id, index) => ({
      id, quote: quotes[index],
      comment: id === 'K3' ? 'Это буквальная запись: ' + literal : 'Это учебное замечание к своей записи.',
      action: id === 'K1' ? 'Сформулируй свой ответ на вопрос темы.' : 'Уточни одну деталь.'
    }))
  };
  if (kind === 'missing') {
    Object.assign(review.criteria[1], {quote: badQuote, comment: forbiddenFeedback[0], action: forbiddenFeedback[1]});
    review.priority = forbiddenFeedback[2];
  }
  if (kind === 'duplicate') review.criteria[1].id = 'K1';
  if (kind === 'malformed') review.criteria = 'Это не массив критериев';
  return {draft: {...sent}, review};
}

async function seed(page, report, blockStorage = false) {
  await page.addInitScript(({draftKey, reportKey, sent, serialized, blockStorage}) => {
    if (blockStorage) {
      Object.defineProperty(window, 'localStorage', {get() {throw new DOMException('Storage blocked for this test', 'SecurityError');}});
      return;
    }
    const marker = 'uzel.quote-acceptance.seeded';
    if (sessionStorage.getItem(marker)) return;
    localStorage.setItem(draftKey, JSON.stringify(sent));
    localStorage.setItem('uzel-reading-lens-v1', sent.mode);
    if (serialized !== null) localStorage.setItem(reportKey, serialized);
    sessionStorage.setItem(marker, '1');
  }, {draftKey, reportKey, sent, serialized: report === null ? null : typeof report === 'string' ? report : JSON.stringify(report), blockStorage});
}

async function fits(page) {
  const overflow = await page.locator('main').evaluate(root => [...root.querySelectorAll('button,a,input,select,textarea,summary,blockquote,#reviewed-text')].filter(node => {
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
  }).map(node => node.id || node.textContent.trim()));
  assert.deepEqual(overflow, [], 'Visible quote navigation and writing controls fit the viewport');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'The page must not require horizontal scrolling');
}

function locate(page, criterion) {
  return page.locator('#result [data-criterion="' + criterion + '"] button[aria-controls="quote-location"]');
}

async function highlighted(page, quote, index) {
  const text = page.locator('#reviewed-text');
  assert.equal(await text.textContent(), original, 'The reader shows the complete, unmodified sent snapshot');
  assert.equal(await text.locator('mark').count(), 1, 'Only the selected occurrence is highlighted');
  assert.equal(await text.locator('mark').textContent(), quote);
  const actualStart = await text.locator('mark').evaluate(mark => {
    const range = document.createRange();
    range.setStart(mark.parentNode, 0);
    range.setEndBefore(mark);
    return range.toString().length;
  });
  assert.equal(actualStart, index, 'The mark starts at the requested occurrence, including original spaces and newlines');
  assert.ok((await page.locator('#quote-topic').textContent()).includes(sent.topic));
  assert.equal(await page.locator('#reviewed-text img, #result img').count(), 0, 'Quotation markup stays literal text');
  assert.equal(await page.evaluate(() => globalThis.__quotePayloadExecuted), undefined, 'No markup payload executes');
}

async function capture(page, source, width, suffix) {
  if (!artifacts) return;
  await fs.mkdir(artifacts, {recursive: true});
  await page.locator('#quote-location').screenshot({path: path.join(artifacts, 'review-quotes-' + source.name + '-' + width + '-' + suffix + '.png')});
}

async function withPage(browser, source, width, report, name, exercise, options = {}) {
  const context = await browser.newContext({viewport: {width, height: 900}, acceptDownloads: true});
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  const errors = [], outgoing = [], reviewRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (/^https?:\/\//u.test(request.url()) && (source.offline || new URL(request.url()).origin !== new URL(base).origin)) outgoing.push(request.url());
  });
  await context.route(/^https?:\/\//u, async route => {
    const request = route.request();
    if (source.offline || new URL(request.url()).origin !== new URL(base).origin) {
      await route.abort();
      return;
    }
    await route.continue();
  });
  if (!source.offline) {
    await page.route('**/api/status', route => route.fulfill({status: 404, body: 'No real service in this test'}));
    await page.route('**/api/review', async route => {
      reviewRequests.push(route.request().postDataJSON());
      await route.fulfill({status: 503, body: 'Unexpected request'});
    });
  }
  if (source.offline) await context.setOffline(true);
  await seed(page, report, options.blockStorage);
  try {
    if (options.beforeOpen) await options.beforeOpen(page, reviewRequests);
    const response = await page.goto(source.url);
    if (!source.offline) assert.ok(response?.ok(), 'The built reviewer returns HTTP 200');
    await page.locator('#essay').waitFor();
    await exercise(page);
    await fits(page);
    assert.deepEqual(errors, [], 'The reviewer must not throw JavaScript errors');
    assert.deepEqual(outgoing, [], 'No request leaves the test origin; the ZIP stays fully offline');
    if (!options.expectReview) assert.deepEqual(reviewRequests, [], 'Restoration and quotation navigation do not request a new model review');
    results.push({source: source.name, width, scenario: name, pageErrors: errors.length, externalRequests: outgoing.length});
  } catch (error) {
    if (artifacts) {
      await fs.mkdir(artifacts, {recursive: true});
      await page.screenshot({path: path.join(artifacts, 'review-quotes-failure-' + source.name + '-' + width + '-' + name + '.png'), fullPage: true}).catch(() => {});
    }
    throw error;
  } finally {
    await context.close();
  }
}

async function normalNavigation(page, source, width) {
  await page.locator('#review-panel').waitFor({state: 'visible'});
  assert.equal(await page.locator('#essay').inputValue(), original);
  assert.ok(await page.locator('#stale').isHidden());
  assert.equal(await locate(page, 'K5').count(), 0, 'A criterion without a quotation has no invented location');
  await page.locator('#review-lens').selectOption('orthodox');
  assert.ok(await page.locator('#stale').isVisible(), 'Changing only the reading view makes the report stale');
  await page.locator('#review-lens').selectOption('secular');
  assert.ok(await page.locator('#stale').isHidden());
  await page.locator('#topic').fill(newTopic);
  assert.ok(await page.locator('#stale').isVisible(), 'Changing only the topic makes the report stale');
  await page.locator('#topic').fill(sent.topic);
  assert.ok(await page.locator('#stale').isHidden());
  await page.locator('#book-shelf > summary').click();
  await page.locator('#book-search').fill('Куприн');
  const book = page.locator('#book-list [data-card-id="doctor"]');
  await book.check();
  assert.ok(await page.locator('#stale').isVisible(), 'Changing only the selected material makes the report stale');
  await book.uncheck();
  assert.ok(await page.locator('#stale').isHidden());
  await page.locator('#book-shelf > summary').click();

  const single = locate(page, 'K1');
  await single.focus();
  await page.keyboard.press('Enter');
  await highlighted(page, 'Первая запись.', 0);
  assert.match(await page.locator('#quote-status').textContent(), /Совпадение 1 из 1/u);
  assert.ok(await page.locator('#quote-matches').isHidden());
  assert.ok(await page.locator('#quote-location-title').evaluate(node => node === document.activeElement), 'Opening a quotation focuses its heading');
  await page.locator('#quote-back').click();
  assert.ok(await single.evaluate(node => node === document.activeElement), 'Back returns focus to the originating remark');

  const repeated = locate(page, 'K2');
  await repeated.focus();
  await page.keyboard.press('Enter');
  await highlighted(page, repeat, original.indexOf(repeat));
  assert.match(await page.locator('#quote-status').textContent(), /Совпадение 1 из 2/u);
  await page.keyboard.press('Tab');
  assert.ok(await page.locator('#quote-next').evaluate(node => node === document.activeElement), 'Tab reaches the available next match');
  await page.keyboard.press('Enter');
  await highlighted(page, repeat, original.lastIndexOf(repeat));
  assert.match(await page.locator('#quote-status').textContent(), /Совпадение 2 из 2/u);
  assert.ok(await page.evaluate(() => Boolean(document.activeElement?.closest('#quote-location'))), 'Reaching the last occurrence must not lose keyboard focus outside the quotation reader');
  await page.locator('#quote-previous').click();
  await highlighted(page, repeat, original.indexOf(repeat));
  await fits(page);
  if (source.name === 'web' || width === 390) await capture(page, source, width, 'repeated');

  await locate(page, 'K3').click();
  await highlighted(page, literal, original.indexOf(literal));
  const multiline = '\n  ' + repeat + '\nСохраняю деталь: ' + literal;
  await locate(page, 'K4').click();
  await highlighted(page, multiline, original.indexOf(multiline));
  await page.locator('#quote-edit').click();
  assert.ok(await page.locator('#essay').evaluate(node => node === document.activeElement));
  assert.equal(await page.locator('#essay').inputValue(), original, 'Returning to editing does not replace the draft');
  await page.locator('#essay').fill(edited);
  await page.locator('#topic').fill(newTopic);
  await page.locator('#review-lens').selectOption('orthodox');
  await repeated.click();
  await highlighted(page, repeat, original.indexOf(repeat));
  assert.match(await page.locator('#quote-version-note').textContent(), /прежняя отправленная версия/u);
  assert.ok(await page.locator('#stale').isVisible());
  await page.locator('#quote-edit').click();
  assert.equal(await page.locator('#essay').inputValue(), edited);
  assert.equal(await page.locator('#topic').inputValue(), newTopic);
  assert.equal(await page.locator('#review-lens').inputValue(), 'orthodox');
  await repeated.click();
  await page.locator('#quote-back').click();
  assert.ok(await repeated.evaluate(node => node === document.activeElement));
  assert.equal(await page.locator('#essay').inputValue(), edited, 'Neither opening nor closing the snapshot rolls back a newer draft');
  await page.reload();
  await page.locator('#review-panel').waitFor({state: 'visible'});
  assert.equal(await page.locator('#essay').inputValue(), edited, 'Reload preserves the current edit and restores its older report separately');
  assert.equal(await page.locator('#topic').inputValue(), newTopic);
  assert.equal(await page.locator('#review-lens').inputValue(), 'orthodox');
  assert.ok(await page.locator('#stale').isVisible());
  await locate(page, 'K2').click();
  await highlighted(page, repeat, original.indexOf(repeat));
}

async function missingEvidence(page) {
  await page.locator('#review-panel').waitFor({state: 'visible'});
  const rejected = page.locator('#result [data-criterion="K2"]');
  assert.equal(await rejected.locator('blockquote,button').count(), 0, 'An unmatched quotation has neither content nor a location button');
  assert.match(await rejected.innerText(), /Замечание снято/u);
  const visible = await page.locator('#result').innerText();
  for (const value of [...forbiddenFeedback, badQuote]) assert.ok(!visible.includes(value), 'Unverified quotations and their dependent feedback are removed');
  assert.match(await page.locator('#result .priority').innerText(), /Сформулируй свой ответ на вопрос темы/u);
  const [file] = await Promise.all([page.waitForEvent('download'), page.locator('#review-download').click()]);
  const text = await fs.readFile(await file.path(), 'utf8');
  for (const value of [...forbiddenFeedback, badQuote]) assert.ok(!text.includes(value), 'The exported review cannot recover discarded feedback');
  assert.ok(text.includes(original));
  assert.equal(await page.locator('#essay').inputValue(), original);
}

async function rejectedReport(page) {
  assert.ok(await page.locator('#review-panel').isHidden(), 'An invalid report is rejected as a whole');
  assert.equal(await page.locator('#essay').inputValue(), original, 'A corrupt report does not destroy a valid draft');
  await page.locator('#essay').fill(edited);
  assert.equal(await page.locator('#essay').inputValue(), edited, 'The editor remains usable');
}

async function liveMock(browser, source) {
  let responseReady;
  const delivery = new Promise(resolve => {responseReady = resolve;});
  const calls = [];
  const fakeKey = 'QA_FAKE_KEY_NEVER_SENT_TO_A_PROVIDER';
  await withPage(browser, source, 390, null, 'mock-response', async page => {
    try {
      await page.locator('#online > summary').click();
      await page.locator('#api-controls').waitFor({state: 'visible'});
      await page.locator('#gigakey').fill(fakeKey);
      await page.locator('#consent').check();
      await page.locator('#consent-privacy').check();
      await Promise.all([
        page.waitForRequest(request => new URL(request.url()).pathname === '/api/review' && request.method() === 'POST'),
        page.locator('#send').click()
      ]);
      assert.equal(await page.locator('#gigakey').inputValue(), '');
      await page.locator('#essay').fill(edited);
      await page.locator('#topic').fill(newTopic);
      await page.locator('#review-lens').selectOption('orthodox');
      responseReady();
      await page.locator('#review-panel').waitFor({state: 'visible'});
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0], {key: fakeKey, ...sent});
      assert.equal(await page.locator('#essay').inputValue(), edited, 'A late mock reply must not overwrite newer writing');
      assert.ok(await page.locator('#stale').isVisible());
      const visible = await page.locator('#result').innerText();
      for (const value of forbiddenFeedback) assert.ok(!visible.includes(value), 'New API replies use the same quotation guard as saved reports');
      assert.equal(await locate(page, 'K2').count(), 0);
      await locate(page, 'K1').click();
      await highlighted(page, 'Первая запись.', 0);
      const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), reportKey);
      assert.deepEqual(stored.draft, sent);
      assert.deepEqual(stored.review.unverified, ['K2']);
      assert.notEqual(stored.review.priority, forbiddenFeedback[2]);
      assert.ok(!(await page.evaluate(() => JSON.stringify(Object.entries(localStorage)))).includes(fakeKey));
    } finally {
      responseReady();
    }
  }, {
    expectReview: true,
    beforeOpen: async page => {
      await page.unroute('**/api/status');
      await page.unroute('**/api/review');
      await page.route('**/api/status', route => route.fulfill({json: {
        service: 'uzel-essay-full-review', version: 1, methodVersion: release.method.version,
        materialsId: release.materialsId, maxCards: 2
      }}));
      await page.route('**/api/review', async route => {
        calls.push(route.request().postDataJSON());
        await delivery;
        const {review} = makeReport('missing');
        await route.fulfill({json: {review, unverifiedQuotes: [], methodVersion: release.method.version, materialsId: release.materialsId}});
      });
    }
  });
}

(async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'uzel-review-quotes-'));
  let browser;
  try {
    const built = await fs.readFile(path.join(releaseDir, 'proverka-sochineniya.html'), 'utf8');
    const bundle = built.match(/const reviewBundle\s*=\s*(\{[^\n]*\});/u);
    assert.ok(bundle, 'The built reviewer contains its exact catalogue and method version');
    release = JSON.parse(bundle[1]);
    assert.ok(release.cards.some(card => card.id === 'doctor'), 'The fixture uses an existing card from this release');
    const extracted = path.join(temp, 'essay-check.html');
    execFileSync('python3', ['-c', 'from pathlib import Path; from zipfile import ZipFile; import sys; Path(sys.argv[2]).write_bytes(ZipFile(sys.argv[1]).read("essay-check.html"))', path.join(releaseDir, 'proverka-gigachat.zip'), extracted]);
    assert.equal(await fs.readFile(extracted, 'utf8'), built, 'The standalone reviewer and the family ZIP contain identical code');
    const sources = [
      {name: 'web', url: publicUrl, offline: false},
      {name: 'family-file', url: pathToFileURL(extracted).href, offline: true}
    ];
    browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
    for (const source of sources) {
      for (const width of [320, 390, 1280]) {
        await withPage(browser, source, width, makeReport(), 'navigation', page => normalNavigation(page, source, width));
      }
      await withPage(browser, source, 390, makeReport('missing'), 'missing-quote', missingEvidence);
      for (const [name, fixture] of [['broken-json', '{unreadable'], ['duplicate-criterion', makeReport('duplicate')], ['malformed-report', makeReport('malformed')]]) {
        await withPage(browser, source, 390, fixture, name, rejectedReport);
      }
      await withPage(browser, source, 390, null, 'storage-blocked', async page => {
        assert.ok(await page.locator('#review-panel').isHidden());
        await page.locator('#topic').fill(sent.topic);
        await page.locator('#essay').fill(edited);
        assert.equal(await page.locator('#essay').inputValue(), edited);
        assert.match(await page.locator('#saved').textContent(), /не сохранил.*Скачай TXT/u);
      }, {blockStorage: true});
    }
    await liveMock(browser, sources[0]);
    const report = {gate: 'ESSAY_REVIEW_QUOTES_BROWSER_PASS', results};
    if (artifacts) {
      await fs.mkdir(artifacts, {recursive: true});
      await fs.writeFile(path.join(artifacts, 'review-quotes-report.json'), JSON.stringify(report, null, 2) + '\n');
    }
    process.stdout.write(JSON.stringify(report) + '\n');
  } finally {
    if (browser) await browser.close();
    await fs.rm(temp, {recursive: true, force: true});
  }
})().catch(error => {
  process.stderr.write(error.stack + '\n');
  process.exitCode = 1;
});
