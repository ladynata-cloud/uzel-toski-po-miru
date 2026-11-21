'use strict';

// Real Chromium smoke for GitHub CI only. This file must not launch a local browser.
// The workflow builds SITE_URL=http://127.0.0.1:8074 and
// SITE_ASSISTANT_ORIGIN=https://assistant.invalid, then starts the static server.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const artifactDir = path.resolve(process.env.READER_ARTIFACT_DIR || path.join(root, 'artifacts/reader-browser'));
let base;
let searchUrl;
const works = ['work-student', 'work-vorona-i-lisitsa', 'work-chudesnyy-doktor', 'work-shinel'];
const modes = ['before', 'during', 'after'];
const widths = [320, 390, 1280];
const report = {
  schema_version: 1,
  started_at_utc: new Date().toISOString(),
  status: 'not_run',
  engine: 'chromium',
  target: process.env.READER_BASE_URL || 'http://127.0.0.1:8074/',
  widths,
  assertions: [],
  completed_cases: [],
  requests: [],
  external_http_attempts: [],
  page_errors: [],
  screenshots: [],
  limitations: ['Static test data only; no real reader data or model calls.', 'No deployment or live external-source availability test.'],
};
let browser;
let activeCase = 'startup';

function check(condition, name, details) {
  report.assertions.push({case:activeCase, name, status:condition ? 'pass' : 'fail', ...(details === undefined ? {} : {details})});
  if (!condition) throw new Error(name + (details === undefined ? '' : ': ' + JSON.stringify(details)));
}

function expected(work, mode) {
  return JSON.parse(fs.readFileSync(path.join(root, 'dist/assistant/v1/workshop', work, mode + '.json'), 'utf8'));
}

function packetRequests(from) {
  return report.requests.slice(from).filter(request => /\.json$/u.test(new URL(request.url).pathname));
}

function networkIsLocal() {
  check(report.external_http_attempts.length === 0, 'No external HTTP or model endpoint was requested', report.external_http_attempts);
  const writes = report.requests.filter(request => !['GET', 'HEAD'].includes(request.method));
  check(writes.length === 0, 'No request transmits a reader message or note', writes);
  check(report.page_errors.length === 0, 'No uncaught browser exception', report.page_errors);
}

async function createContext(width, {blockedStorage = false} = {}) {
  const context = await browser.newContext({viewport:{width, height:900}, serviceWorkers:'block'});
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== base.origin) {
      report.external_http_attempts.push({case:activeCase, url:url.href, method:request.method()});
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
  await context.addInitScript(() => {window.__readerSmokeXss = 0;});
  if (blockedStorage) {
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {configurable:true, get() {
        throw new DOMException('Storage blocked for the smoke test', 'SecurityError');
      }});
    });
  }
  context.on('request', request => {
    report.requests.push({case:activeCase, url:request.url(), method:request.method(), resource_type:request.resourceType()});
  });
  context.on('page', page => {
    page.on('pageerror', error => report.page_errors.push({case:activeCase, message:error.message}));
  });
  return context;
}

async function visit(page, reload = false) {
  const start = report.requests.length;
  const response = reload
    ? await page.reload({waitUntil:'networkidle', timeout:20000})
    : await page.goto(searchUrl, {waitUntil:'networkidle', timeout:20000});
  check(response?.ok(), 'Reader page loads successfully', {status:response?.status()});
  await page.locator('#memory-form').waitFor({state:'visible'});
  check((await page.locator('#memory-form').getAttribute('data-assistant-origin')) === 'https://assistant.invalid',
    'A configured assistant origin is present during the no-network test');
  check(!(await page.locator('#memory-server-consent').isChecked()), 'Server consent starts unchecked');
  check((await page.locator('#memory-results .memory-practice:visible').count()) === 4, 'All four books expose the integrated reading action');
  check(packetRequests(start).length === 0, 'No JSON is loaded on initial navigation', packetRequests(start));
  check((await page.locator('script[src="https://assistant.invalid/client.js"]').count()) === 0,
    'Optional external client is not inserted without consent');
  networkIsLocal();
  return start;
}

async function openWorkshop(page, work, requestStart, keyboard = false) {
  const button = page.locator('#' + work + ' .memory-practice');
  if (keyboard) {
    await button.focus();
    await page.keyboard.press('Enter');
  } else await button.click();
  await page.locator('#reader-workshop').waitFor({state:'visible'});
  check(await page.locator('#memory-form').isHidden(), 'Existing search form yields to the local reading panel');
  check(await page.locator('#reading-content').isHidden(), 'Opening a book does not restore a previously read fragment automatically');
  check((await page.locator('#reading-source-text').textContent()) === '', 'No previous source text remains before mode selection');
  check((await page.locator('#reading-note').inputValue()) === '', 'No saved note is exposed before selecting its mode');
  check(packetRequests(requestStart).length === 0, 'Opening the integrated action makes no JSON request', packetRequests(requestStart));
  if (keyboard) {
    check(await page.locator('#reading-title').evaluate(element => element === document.activeElement),
      'Keyboard activation moves focus to the reading heading');
    await page.keyboard.press('Tab');
    check(await page.locator('#reading-modes button[data-mode="before"]').evaluate(element => element === document.activeElement),
      'Tab reaches the first reading mode from the heading');
  }
}

async function chooseMode(page, work, mode, {keyboard = false} = {}) {
  const p = expected(work, mode);
  const button = page.locator('#reading-modes button[data-mode="' + mode + '"]');
  if (keyboard) {
    await button.focus();
    await page.keyboard.press('Space');
  } else await button.click();
  await page.locator('#reading-content').waitFor({state:'visible'});
  check((await page.locator('#reading-source-text').textContent()) === p.source.text, 'Selected mode displays exactly its bounded source text');
  check((await page.locator('#reading-scope').textContent()) === p.source.scope, 'The selected source boundary is visible');
  check((await page.locator('#reading-source-credit').textContent()).includes('Текст произведения.'), 'Source words are labelled separately from helper commentary');
  check((await page.locator('#reading-source-link').getAttribute('href')) === p.source.url, 'Source link is the packet’s verified recorded address');
  check((await button.getAttribute('aria-pressed')) === 'true', 'Mode selection has an accessible pressed state');
  check((await page.locator('#reading-modes button[aria-pressed="true"]').count()) === 1, 'Only one reading mode is active');
  check((await page.locator('#reading-branches button').count()) === p.task.branches.length, 'The selected packet’s situations are available');
  return p;
}

async function traverseSteps(page, p, keyboard = false) {
  const branch = p.task.branches[0];
  const button = page.locator('#reading-branches button').first();
  if (keyboard) {await button.focus(); await page.keyboard.press('Enter');}
  else await button.click();
  await page.locator('#reading-step').waitFor({state:'visible'});
  check((await page.locator('#reading-prompt').textContent()) === branch.steps[0], 'The first branch step is displayed alone');
  check(await page.locator('#reading-goal').isHidden(), 'The general task is hidden while a concrete step is active');
  check(await page.locator('#reading-previous').isDisabled(), 'There is no step before the first one');
  check((await page.locator('#reading-branches button[aria-pressed="true"]').count()) === 1, 'The chosen situation is marked accessibly');
  if (keyboard) {
    check(await page.locator('#reading-step-title').evaluate(element => element === document.activeElement), 'The step heading receives keyboard focus');
    await page.keyboard.press('Tab');
    check(await page.locator('#reading-why summary').evaluate(element => element === document.activeElement), 'Tab reaches the optional explanation');
    await page.keyboard.press('Space');
    check(await page.locator('#reading-explanation').isVisible(), 'Space opens the optional explanation');
    await page.keyboard.press('Space');
    check(await page.locator('#reading-explanation').isHidden(), 'Space closes the optional explanation');
    await page.keyboard.press('Tab');
    check(await page.locator('#reading-next').evaluate(element => element === document.activeElement), 'Tab skips the disabled previous button and reaches next');
    await page.keyboard.press('Enter');
  } else await page.locator('#reading-next').click();
  check((await page.locator('#reading-prompt').textContent()) === branch.steps[1], 'One activation advances by one step');
  for (let index=2; index<4; index++) {
    await page.locator('#reading-next').click();
    check((await page.locator('#reading-prompt').textContent()) === branch.steps[index], 'Step ' + (index + 1) + ' preserves the approved prompt');
  }
  await page.locator('#reading-next').click();
  check((await page.locator('#reading-prompt').textContent()) === branch.check, 'The final check asks the reader to support their own thought');
  check(await page.locator('#reading-next').isDisabled(), 'The route cannot advance past its final check');
  check((await page.locator('#reading-prompt:visible').count()) === 1 && await page.locator('#reading-goal').isHidden(),
    'There is a single visible current prompt');
}

async function assertFits(page, width) {
  const metrics = await page.evaluate(() => ({
    viewport:window.innerWidth, client:document.documentElement.clientWidth,
    page:document.documentElement.scrollWidth, body:document.body.scrollWidth,
    panel:document.getElementById('reader-workshop').getBoundingClientRect().toJSON(),
    overflowing:Array.from(document.querySelectorAll('#reader-workshop *')).filter(element => {
      const rect=element.getBoundingClientRect();
      return element.getClientRects().length && (rect.right>window.innerWidth+1 || rect.left < -1);
    }).slice(0,10).map(element => ({tag:element.tagName,id:element.id})),
  }));
  check(metrics.viewport === width, 'The requested viewport width is active', metrics);
  check(metrics.page <= metrics.client+1 && metrics.body <= metrics.client+1 && metrics.overflowing.length === 0,
    'Reader controls, long prompts and notes do not overflow horizontally at ' + width + 'px', metrics);
}

async function screenshot(page, name) {
  const file = name + '.png';
  await page.screenshot({path:path.join(artifactDir,file), fullPage:true, animations:'disabled'});
  report.screenshots.push({case:activeCase,file});
}

async function persistence(page, work, mode, p) {
  const note = '<img src="https://assistant.invalid/x" onerror="window.__readerSmokeXss=1"> Моя версия: текст допускает другое прочтение.';
  const key = 'uzel-reading-v1:' + work + ':' + mode;
  const start = report.requests.length;
  await page.locator('#reading-note').fill(note);
  check((await page.locator('#reading-note').inputValue()) === note, 'Markup is kept literally in the reader’s note');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  check(saved.note === note && saved.step === 4 && saved.branchId === p.task.branches[0].id,
    'Note and current step are stored under the selected work and mode');
  check(report.requests.length === start, 'Writing a note makes no network request');
  check(await page.evaluate(() => window.__readerSmokeXss) === 0, 'Note markup does not execute');
  const otherMode = mode === 'before' ? 'after' : 'before';
  await chooseMode(page, work, otherMode);
  check((await page.locator('#reading-note').inputValue()) === '', 'A note is not copied into a different reading mode');
  await chooseMode(page, work, mode);
  check((await page.locator('#reading-note').inputValue()) === note, 'Returning to the selected mode restores its own note');

  const reloadStart = await visit(page, true);
  await openWorkshop(page, work, reloadStart);
  await chooseMode(page, work, mode);
  check((await page.locator('#reading-note').inputValue()) === note, 'Reload restores the note only after explicit mode selection');
  check((await page.locator('#reading-prompt').textContent()) === p.task.branches[0].check, 'Reload restores the correct route step');
  check(await page.evaluate(() => window.__readerSmokeXss) === 0, 'Restored markup still does not execute');
  await page.locator('#reading-forget').click();
  check((await page.locator('#reading-note').inputValue()) === '', 'Delete clears the visible note');
  check(await page.locator('#reading-step').isHidden(), 'Delete clears the selected route');
  check(await page.evaluate(key => localStorage.getItem(key), key) === null, 'Delete removes the stored entry');
  check(await page.locator('#reading-note').evaluate(element => element === document.activeElement), 'Delete returns keyboard focus to the note');
  const deletedReload = await visit(page, true);
  await openWorkshop(page, work, deletedReload);
  await chooseMode(page, work, mode);
  check((await page.locator('#reading-note').inputValue()) === '' && await page.locator('#reading-step').isHidden(),
    'A deleted note and route do not return after another reload');
}

async function run() {
  check(process.env.CI === 'true', 'Browser execution is restricted to CI');
  base = new URL(process.env.READER_BASE_URL || 'http://127.0.0.1:8074/');
  searchUrl = new URL('poisk-po-pamyati/', base.href.endsWith('/') ? base : base.href + '/').href;
  report.target = searchUrl;
  check(['127.0.0.1','localhost','[::1]'].includes(base.hostname), 'Smoke target is a local CI static server');
  const {chromium} = require('playwright');
  browser = await chromium.launch({headless:true});
  report.browser_version = browser.version();
  for (const width of widths) {
    const context = await createContext(width);
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      for (const work of works) {
        for (const mode of modes) {
          activeCase = width + ':' + work + ':' + mode;
          // Start each case with a clean local progress entry. Persistence is tested
          // through the visible delete action below, never simulated by setItem.
          const start = await visit(page);
          const keyboard = width === 390 && work === 'work-student' && mode === 'before';
          await openWorkshop(page, work, start, keyboard);
          const p = await chooseMode(page, work, mode, {keyboard});
          const loaded = packetRequests(start).map(request => new URL(request.url).pathname);
          const expectedPath = new URL('assistant/v1/workshop/' + work + '/' + mode + '.json', base.href.endsWith('/') ? base : base.href+'/').pathname;
          check(loaded.length === 1 && loaded[0] === expectedPath, 'Only the explicitly selected mode packet is fetched', loaded);
          await traverseSteps(page, p, keyboard);
          const picker = page.locator('[data-reading-lens-picker]');
          const stepBeforeLens = await page.locator('#reading-prompt').innerText();
          await page.locator('#reading-note').fill('Я нашёл опору в показанной фразе.');
          await picker.selectOption('orthodox');
          check((await page.locator('#reading-lens-question').innerText()) === p.lenses.orthodox.question,
            'Orthodox reading asks the question for this book and stage');
          check((await page.locator('#reading-prompt').innerText()) === stepBeforeLens &&
            (await page.locator('#reading-note').inputValue()) === 'Я нашёл опору в показанной фразе.',
            'Changing perspective keeps the selected step and note');
          await picker.selectOption('secular');
          check((await page.locator('#reading-lens-question').innerText()) === p.lenses.secular.question,
            'Returning to literary reading restores the question for the same excerpt');
          await assertFits(page, width);
          await screenshot(page, width + '-' + work + '-' + mode);
          if (width === 390) await persistence(page, work, mode, p);
          if (keyboard) {
            await page.locator('#reading-exit').focus();
            await page.keyboard.press('Enter');
            check(await page.locator('#reader-workshop').isHidden(), 'Keyboard exit closes the reading panel');
            check((await page.locator('#reading-source-text').textContent()) === '' &&
              (await page.locator('#reading-note').inputValue()) === '', 'Exit removes old source text and note from the panel');
            check(await page.locator('#memory-query').evaluate(element => element === document.activeElement),
              'Keyboard exit returns focus to the search field');
            check((await page.locator('#memory-results .memory-practice:visible').count()) === 4,
              'Exit restores all four integrated reading entries');
          }
          networkIsLocal();
          report.completed_cases.push({width,work,mode,note_reload_delete:width === 390,keyboard});
        }
      }
    } catch (error) {
      const page = context.pages()[0];
      if (page && !page.isClosed()) {
        try {await screenshot(page, 'failure-' + activeCase.replace(/[^a-z0-9-]/gi,'-'));}
        catch (captureError) {report.failure_screenshot_error = captureError.message;}
      }
      throw error;
    } finally {await context.close();}
  }

  activeCase = '390:blocked-storage';
  const blocked = await createContext(390, {blockedStorage:true});
  try {
    const page = await blocked.newPage();
    const start = await visit(page);
    await openWorkshop(page, 'work-student', start);
    const p = await chooseMode(page, 'work-student', 'before');
    check((await page.locator('#reading-saved').textContent()).includes('сохранение недоступно'), 'Blocked storage is explained without blocking reading');
    await traverseSteps(page, p, true);
    await page.locator('#reading-note').fill('Тестовая заметка без сохранения');
    check((await page.locator('#reading-note').inputValue()) === 'Тестовая заметка без сохранения', 'A note remains editable when storage is blocked');
    check((await page.locator('#reading-saved').textContent()).includes('не разрешил сохранение'), 'A failed save has a visible truthful status');
    await assertFits(page,390);
    await screenshot(page,'390-blocked-storage');
    networkIsLocal();
  } catch (error) {
    const page = blocked.pages()[0];
    if (page && !page.isClosed()) {
      try {await screenshot(page,'failure-blocked-storage');}
      catch (captureError) {report.failure_screenshot_error = captureError.message;}
    }
    throw error;
  } finally {await blocked.close();}
  networkIsLocal();
  check(report.completed_cases.length === 36, 'All four works and all three modes pass at all three widths');
  report.status = 'pass';
}

(async () => {
  fs.mkdirSync(artifactDir,{recursive:true});
  try {await run();}
  catch (error) {
    report.status = 'fail';
    report.error = {case:activeCase,message:error.message,stack:error.stack};
    process.exitCode = 1;
  } finally {
    if (browser) {
      try {await browser.close();}
      catch (error) {report.status='fail'; report.cleanup_error=error.message; process.exitCode=1;}
    }
    report.finished_at_utc = new Date().toISOString();
    report.assertion_count = report.assertions.length;
    report.passed_assertions = report.assertions.filter(item => item.status === 'pass').length;
    fs.writeFileSync(path.join(artifactDir,'report.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({status:report.status,cases:report.completed_cases.length,
      assertions:report.assertion_count,external_requests:report.external_http_attempts.length,
      report:path.join(artifactDir,'report.json')}));
  }
})();
