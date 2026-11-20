'use strict';

const assert = require('node:assert/strict');
const {chromium} = require('playwright');

const base = (process.env.READER_BASE_URL || 'http://127.0.0.1:8074').replace(/\/?$/, '/');
const url = new URL('k-sochineniyu/itogovoe/pomoshchnik/', base).href;
const phrase = 'Доктор был добрым человеком.';
const replacement = 'Мерцалов нашёл деньги после ухода доктора.';
const draft = phrase + ' Первая запись.\n' + phrase + ' Моя личная заметка для себя.';
const key = 'uzel.essay-workshop.v1';

function controls(page) {
  const button = action => page.locator('#ew-current [data-act="' + action + '"]');
  const nav = step => page.locator('#ew-steps [data-act="page-' + step + '"]').click();
  const field = name => page.locator('#ew-current [data-field="' + name + '"]');
  const original = page.locator('#ew-revision-original');
  const candidate = page.locator('#ew-revision-text');
  const question = page.locator('#ew-revision-question');
  const status = page.locator('#ew-revision-status');
  async function selectSecond() {
    await field('draft').evaluate((el, value) => {
      const index = el.value.lastIndexOf(value);
      if (index < 0) throw new Error('Test passage is absent from draft');
      el.focus();
      el.setSelectionRange(index, index + value.length);
    }, phrase);
    await button('rev-open').click();
    await original.waitFor();
    assert.ok((await original.textContent()).includes(phrase), 'The original passage matches the highlight');
  }
  return {button,nav,field,candidate,original,question,status,selectSecond};
}

async function localRevision(page) {
  // A draft saved by the original workshop contains no per-passage revision state.
  await page.addInitScript(({key, draft}) => {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, JSON.stringify({
      version:1, mode:'secular', page:'draft', route:'edit', active:'dignity',
      custom:[], exercises:{}, notes:{dignity:{
        work:'doctor', own:'', thesis:'Помощь бывает деликатной.', draft, before:null,
        args:{doctor:{episode:'Под блюдцем остались деньги.',link:'Семье не пришлось просить.'}},
        checks:{}, turns:{}
      }}
    }));
  }, {key, draft});
  await page.goto(url);
  const {button,nav,field,candidate,question,status,selectSecond} = controls(page);
  assert.equal(await field('draft').inputValue(), draft, 'A draft written in the first version still opens');
  await selectSecond();
  const secular = (await question.textContent()).trim();
  assert.ok(secular.length > 15, 'A passage should receive a substantive question');
  await candidate.fill(replacement);
  assert.equal(await field('draft').inputValue(), draft, 'Typing a revision preserves the original');
  await page.locator('#ew-mode').selectOption('orthodox');
  assert.notEqual((await question.textContent()).trim(), secular, 'Changing perspective updates the question');
  assert.equal(await candidate.inputValue(), replacement, 'Changing perspective preserves the student’s edit');
  await button('rev-apply').click();
  const revised = phrase + ' Первая запись.\n' + replacement + ' Моя личная заметка для себя.';
  assert.equal(await field('draft').inputValue(), revised, 'Only the selected occurrence is replaced');
  await nav('review');
  const versions = page.locator('details').filter({has:page.getByText('Сравнить версии', {exact:true})});
  await versions.locator('summary').click();
  assert.deepEqual(await versions.locator('.ew-note').allTextContents(), [draft,revised],
    'The first applied edit retains an independently accessible copy of the draft');
  await nav('draft');
  await button('rev-undo').click();
  assert.equal(await field('draft').inputValue(), draft, 'Undo restores the original range');

  await selectSecond();
  await candidate.fill(replacement);
  const concurrent = 'Самостоятельная правка. ' + draft;
  await field('draft').fill(concurrent);
  assert.equal(await button('rev-apply').isEnabled(), false, 'A changed source invalidates an open revision');
  assert.ok((await status.textContent()).trim(), 'The invalidation is explained to the writer');
  assert.equal(await field('draft').inputValue(), concurrent, 'The stale revision cannot overwrite manual input');
  await selectSecond();
  await candidate.fill(replacement);
  await button('rev-apply').click();
  const latest = (await field('draft').inputValue()) + ' Теперь здесь мой новый вывод.';
  await field('draft').fill(latest);
  assert.ok(!await button('rev-undo').isVisible() || !await button('rev-undo').isEnabled(),
    'Undo cannot overwrite a subsequent manual edit');
  await page.reload();
  assert.equal(await field('draft').inputValue(), latest);

  await nav('episode');
  await page.locator('#ew-work').selectOption('own');
  await field('own').fill('Моя книга');
  await button('rev-open').click();
  assert.ok((await status.textContent()).trim(), 'An empty editor offers a next step');
  assert.equal(await field('episode').evaluate(el => document.activeElement === el), true);
  await field('episode').fill('Герой протянул соседу руку.');
  await button('rev-open').click();
  assert.ok((await question.textContent()).trim(), 'The student’s own book is supported');
  assert.doesNotMatch(await question.textContent(), /Мерцал|Пирогов|блюдц/u, 'A previous book must not leak into the exercise');

  const overflow = await page.locator('#essay-workshop').evaluate(root =>
    [...root.querySelectorAll('textarea, button, select, input, summary')].filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width && (rect.left < -1 || rect.right > innerWidth + 1);
    }).map(el => el.id || el.textContent));
  assert.deepEqual(overflow, [], 'Every visible revision control fits the screen');
}

async function onlineRevision(page) {
  const {button,nav,field,selectSecond} = controls(page);
  const help = page.locator('#ew-model-help');
  const form = help.locator('.ew-model-form');
  const input = form.locator('.ew-model-question');
  const submit = form.locator('button[type=submit]');
  const sent = [];
  let finishLate;
  let finishRequest;
  let intercepted;
  let behavior = 'success';
  const allowedOrigin = new URL(base).origin;
  const endpoint = 'https://essay-assistant.invalid/v1/essay/turn';
  const headers = {
    'access-control-allow-origin':allowedOrigin,
    'access-control-allow-methods':'POST, OPTIONS',
    'access-control-allow-headers':'content-type'
  };
  await page.route(endpoint, async route => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({status:204, headers});
      return;
    }
    assert.equal(route.request().method(), 'POST');
    const data = route.request().postDataJSON();
    sent.push(data);
    const late = behavior === 'late' || behavior === 'timeout';
    if (late) {
      await new Promise(resolve => { finishLate = resolve; intercepted(); });
    }
    const status = behavior === 'failure' ? 503 : 200;
    const reply = late ? 'Ответ из уже закрытого диалога.' : 'Что меняет для семьи момент, когда найдены деньги?';
    try {
      await route.fulfill({status, headers, contentType:'application/json', json:{version:1, reply}});
    } catch (error) {
      // Leaving the page or reaching the deadline can abort an intercepted request.
      if (!late) throw error;
    } finally {
      if (late) finishRequest();
    }
  });
  await page.goto(url);
  await nav('draft');
  await field('draft').fill(draft);
  await selectSecond();
  await help.locator('summary').click();
  const message = 'Какая здесь деталь существенна?';
  await input.fill(message);
  assert.equal(sent.length, 0, 'Opening the panel and typing must not transmit the draft');
  await submit.click();
  await page.waitForFunction(() => document.querySelector('.ew-model-answer')?.textContent.includes('момент'));
  assert.equal(sent.length, 1);
  const payload = sent[0];
  assert.deepEqual(Object.keys(payload).sort(),
    ['version','stage','mode','topic','workId','workTitle','passage','message'].sort(),
    'The model receives only the agreed context and the user’s question');
  assert.equal(payload.version, 1);
  assert.equal(payload.passage, phrase);
  assert.equal(payload.message, message);
  assert.equal(payload.stage, 'draft');
  assert.equal(payload.mode, 'secular');
  assert.equal(payload.workId, 'doctor');
  assert.ok(payload.workTitle.includes('Куприн'));
  assert.ok(payload.topic.trim());
  assert.ok(!JSON.stringify(payload).includes('Моя личная заметка'));
  assert.equal(await field('draft').inputValue(), draft, 'A model answer cannot replace the draft');

  behavior = 'failure';
  await input.fill('Как уточнить мысль?');
  await submit.click();
  await page.waitForFunction(() => {
    const text = document.querySelector('.ew-model-answer')?.textContent.trim();
    return text && /локальн|встроенн|устройств|недоступ|связаться|повтори|попробу/i.test(text);
  });
  assert.ok((await page.locator('#ew-revision-question').textContent()).trim(),
    'When the model is unavailable the local question remains usable');
  assert.equal(await field('draft').inputValue(), draft);

  behavior = 'late';
  await input.fill('Уточни эту деталь.');
  const pending = new Promise(resolve => {intercepted = resolve;});
  const delivered = new Promise(resolve => {finishRequest = resolve;});
  await submit.click();
  await pending;
  await nav('thesis');
  await field('thesis').fill('Мой собственный тезис о книге.');
  await button('rev-open').click();
  await page.waitForFunction(() => document.querySelector('#ew-model-help summary'));
  finishLate();
  await delivered;
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  assert.doesNotMatch(await page.locator('#ew-current').innerText(), /Ответ из уже закрытого диалога/);
  await nav('draft');
  await selectSecond();
  assert.doesNotMatch(await page.locator('#ew-current').innerText(), /Ответ из уже закрытого диалога/);
  assert.equal(await field('draft').inputValue(), draft);

  await help.locator('summary').click();
  behavior = 'timeout';
  await page.clock.install();
  const stalled = new Promise(resolve => {intercepted = resolve;});
  const cleared = new Promise(resolve => {finishRequest = resolve;});
  await input.fill('Попробовать ещё раз.');
  await submit.click();
  await stalled;
  await page.clock.fastForward(11000);
  await page.waitForFunction(() => {
    const text = document.querySelector('.ew-model-answer')?.textContent.trim();
    return text && /локальн|встроенн|устройств|недоступ|время|связаться|повтори|попробу/i.test(text);
  });
  finishLate();
  await cleared;
  assert.ok(await submit.isEnabled(), 'After timeout another attempt is available');
  assert.ok((await page.locator('#ew-revision-question').textContent()).trim());
  assert.equal(await field('draft').inputValue(), draft);
}

async function offlineOnly(page) {
  await page.route(url, async route => {
    const source = await route.fetch();
    const html = await source.text();
    const configured = 'data-essay-assistant-origin="https://essay-assistant.invalid"';
    assert.ok(html.includes(configured), 'Build this test fixture with ESSAY_ASSISTANT_ORIGIN=https://essay-assistant.invalid');
    await route.fulfill({response:source, body:html.replace(configured, 'data-essay-assistant-origin=""')});
  });
  const {nav,field,selectSecond} = controls(page);
  const calls = [];
  page.on('request', req => {if (req.url().includes('/v1/essay/turn')) calls.push(req.url());});
  await page.goto(url);
  await nav('draft');
  await field('draft').fill(draft);
  await selectSecond();
  assert.equal(await page.locator('#ew-model-help summary:visible').count(), 0,
    'Without a dedicated model origin, the interface offers local coaching only');
  assert.ok((await page.locator('#ew-revision-question').textContent()).trim());
  assert.deepEqual(calls, []);
}

async function run() {
  const browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  try {
    for (const width of [320, 1280]) {
      const page = await browser.newPage({viewport:{width,height:900}});
      page.setDefaultTimeout(7000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await localRevision(page);
      assert.deepEqual(errors, []);
      await page.close();
      console.log('Passage revision passed at ' + width + 'px');
    }
    const page = await browser.newPage();
    page.setDefaultTimeout(7000);
    await onlineRevision(page);
    await page.close();
    const offline = await browser.newPage();
    await offlineOnly(offline);
    await offline.close();
    console.log('Optional model transport and offline fallback passed');
  } finally {
    await browser.close();
  }
}
run().catch(error => {console.error(error); process.exitCode = 1;});
