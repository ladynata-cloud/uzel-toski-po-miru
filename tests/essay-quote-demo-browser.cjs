'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('playwright');

const base = (process.env.READER_BASE_URL || 'http://127.0.0.1:8074').replace(/\/?$/, '/');
const url = new URL('k-sochineniyu/itogovoe/pomoshchnik/kak-proveryali/', base).href;
const artifactDir = process.env.READER_ARTIFACT_DIR;
const widths = [320, 390, 1280];
const results = [];

async function storageSnapshot(page) {
  return page.evaluate(() => ({
    local: Object.entries(localStorage).sort(([a], [b]) => a.localeCompare(b)),
    session: Object.entries(sessionStorage).sort(([a], [b]) => a.localeCompare(b))
  }));
}

async function fits(page, root) {
  const overflow = await root.evaluate(section => [...section.querySelectorAll('button,a,p,blockquote')].filter(node => {
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
  }).map(node => node.textContent.trim()));
  assert.deepEqual(overflow, [], 'Demo text and controls must fit the viewport');
  assert.ok(await root.locator('button').evaluateAll(buttons => buttons.every(button =>
    button.getBoundingClientRect().height >= 44)), 'Every example button has a usable touch target');
}

async function capture(root, width, name) {
  if (!artifactDir) return;
  await fs.mkdir(artifactDir, {recursive: true});
  await root.screenshot({path: path.join(artifactDir, 'quote-demo-' + name + '-' + width + '.png')});
}

async function verifyState(root, source, kind) {
  const selected = root.locator('[data-quote-demo-case="' + kind + '"]');
  assert.equal(await selected.getAttribute('aria-pressed'), 'true');
  assert.equal(await root.locator('[aria-pressed="true"]').count(), 1, 'Only the displayed example is selected');
  assert.equal(await root.locator('[data-quote-demo-source]').textContent(), source, 'Highlighting must preserve every original character');
  const quote = await root.locator('[data-quote-demo-quote]').textContent();
  const status = await root.locator('[data-quote-demo-status]').textContent();
  if (kind === 'missing') {
    assert.equal(await root.locator('[data-quote-demo-source] mark').count(), 0);
    assert.match(status, /Таких слов.*нет.*Замечание снято/u);
    assert.ok(await root.locator('[data-quote-demo-feedback]').isHidden());
    assert.ok(await root.locator('[data-quote-demo-removed]').isVisible());
    assert.equal(await root.locator('[data-quote-demo-comment]').textContent(), '');
    assert.equal(await root.locator('[data-quote-demo-question]').textContent(), '');
  } else {
    assert.equal(await root.locator('[data-quote-demo-source] mark').count(), 1);
    assert.equal(await root.locator('[data-quote-demo-source] mark').textContent(), quote);
    assert.match(status, /Эти слова есть в отправленном тексте/u);
    assert.ok(await root.locator('[data-quote-demo-feedback]').isVisible());
    assert.ok(await root.locator('[data-quote-demo-removed]').isHidden());
  }
  const editorial = root.locator('[data-quote-demo-editorial]');
  assert.equal(await editorial.isVisible(), kind === 'interpretation');
  if (kind === 'interpretation') {
    assert.match(await editorial.innerText(), /Программа проверила только совпадение слов/u);
    assert.match(await editorial.innerText(), /программа не оценивала смысл замечания/u);
    assert.match(await root.locator('[data-quote-demo-comment]').textContent(), /окончательно раскаялся/u);
  }
}

async function scenario(browser, width) {
  const context = await browser.newContext({viewport: {width, height: 900}});
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const response = await page.goto(url);
    assert.ok(response?.ok(), 'The generated explanation page must return HTTP 200');
    const root = page.locator('[data-quote-evidence-demo]');
    await page.waitForFunction(() => document.querySelector('[data-quote-evidence-demo]')?.dataset.quoteDemoReady === 'true');
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      localStorage.setItem('quote-demo-test-preserved', 'Учебный черновик остаётся у владельца.');
      sessionStorage.setItem('quote-demo-test-session', 'Не изменять');
    });
    const before = await storageSnapshot(page);
    const source = await root.locator('[data-quote-demo-source]').textContent();
    assert.match(await root.innerText(), /Авторский учебный пример/u);
    assert.match(await root.innerText(), /не работа ученика и не ответы действующего сервиса/u);
    await verifyState(root, source, 'exact');
    await fits(page, root);
    await capture(root, width, 'exact');

    page.on('request', request => requests.push({method: request.method(), url: request.url()}));
    await context.setOffline(true);
    const first = root.locator('[data-quote-demo-case="exact"]');
    const second = root.locator('[data-quote-demo-case="missing"]');
    const third = root.locator('[data-quote-demo-case="interpretation"]');
    await first.focus();
    await page.keyboard.press('Tab');
    assert.ok(await second.evaluate(node => node === document.activeElement), 'Tab reaches the second example');
    assert.ok(await second.evaluate(node => node.matches(':focus-visible') && getComputedStyle(node).outlineStyle !== 'none'), 'Keyboard focus is visible');
    await page.keyboard.press('Enter');
    await verifyState(root, source, 'missing');
    await fits(page, root);
    if (width === 390) await capture(root, width, 'missing');
    await page.keyboard.press('Tab');
    assert.ok(await third.evaluate(node => node === document.activeElement), 'Tab reaches the third example');
    await page.keyboard.press('Space');
    await verifyState(root, source, 'interpretation');
    await fits(page, root);
    if (width === 390) await capture(root, width, 'interpretation');
    await first.click();
    await verifyState(root, source, 'exact');
    assert.deepEqual(await storageSnapshot(page), before, 'Trying the examples must not change stored drafts or session state');
    assert.deepEqual(requests, [], 'The interactive demonstration must work offline without any network requests');
    assert.deepEqual(errors, [], 'The explanation page must not throw JavaScript errors');
    results.push({width, cases: 3, keyboard: 'PASS', networkRequests: requests.length, storage: 'unchanged'});
  } catch (error) {
    if (artifactDir) {
      await fs.mkdir(artifactDir, {recursive: true});
      await page.screenshot({path: path.join(artifactDir, 'quote-demo-failure-' + width + '.png'), fullPage: true}).catch(() => {});
    }
    throw error;
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  });
  try {
    for (const width of widths) await scenario(browser, width);
    const report = {gate: 'QUOTE_EVIDENCE_DEMO_PASS', results};
    if (artifactDir) {
      await fs.mkdir(artifactDir, {recursive: true});
      await fs.writeFile(path.join(artifactDir, 'quote-demo-report.json'), JSON.stringify(report, null, 2) + '\n');
    }
    process.stdout.write(JSON.stringify(report) + '\n');
  } finally {
    await browser.close();
  }
})().catch(error => {
  process.stderr.write(error.stack + '\n');
  process.exitCode = 1;
});
