'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const {chromium} = require('playwright');

const base = (process.env.READER_BASE_URL || 'http://127.0.0.1:8074').replace(/\/?$/, '/');
const url = new URL('k-sochineniyu/itogovoe/pomoshchnik/', base).href;

async function exercise(page) {
  const panel = page.locator('#ew-current');
  const field = name => panel.locator('[data-field="' + name + '"]');
  const action = name => panel.locator('[data-act="' + name + '"]').click();
  const start = () => page.locator('#ew-steps [data-act="page-start"]').click();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto(url);
  assert.ok(response?.ok(), 'The generated workshop must return HTTP 200');
  async function fits() {
    const overflow = await page.locator('#essay-workshop').evaluate(root =>
      [...root.querySelectorAll('button, select, input, textarea, summary')].filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width && (rect.left < -1 || rect.right > window.innerWidth + 1);
      }).map(el => el.id || el.textContent.trim()));
    assert.deepEqual(overflow, [], 'Visible editing controls must fit the viewport');
  }
  async function download(actionName, expectedName) {
    const [file] = await Promise.all([page.waitForEvent('download'), action(actionName)]);
    assert.equal(file.suggestedFilename(), expectedName, 'The TXT export must use its own filename');
    return fs.readFile(await file.path(), 'utf8');
  }

  await fits();
  await action('route-read');
  await action('reading-apply');
  assert.ok((await panel.locator('#ew-reading-status').textContent()).trim(), 'An empty reading note needs guidance');
  const reading = panel.locator('#ew-reading');
  const selectedReading = await reading.inputValue();
  const observation = 'Мне запомнился жест героя.';
  await field('reading').fill(observation);
  const readCard = await panel.locator('.ew-text-card').textContent();
  const prompt = panel.locator('.ew-text-card + p');
  const secular = await prompt.textContent();
  await page.locator('#ew-mode').selectOption('orthodox');
  assert.notEqual(await prompt.textContent(), secular, 'The reading question changes with the perspective');
  assert.equal(await panel.locator('.ew-text-card').textContent(), readCard, 'Both perspectives use the same passage');
  await fits();
  await action('reading-apply');
  await action('page-episode');
  assert.equal(await panel.locator('#ew-work').inputValue(), selectedReading, 'First reading selects its source');
  assert.equal(await field('episode').inputValue(), observation, 'First reading transfers the student’s observation');

  const topic = 'Что делает помощь бережной?';
  const thesis = 'Бережная помощь оставляет другому право решать.';
  const book = 'А. И. Куприн, «Чудесный доктор»';
  const episode = 'Деньги остаются под блюдцем вместе с рецептом.';
  const link = 'Так семье не приходится просить вслух.';
  await start();
  await action('route-full');
  await panel.getByText('Ввести свою тему', {exact:true}).click();
  await panel.locator('#ew-custom').fill(topic);
  await panel.locator('#ew-custom-form button').click();
  assert.equal(await panel.locator('.ew-topic').textContent(), topic, 'Custom topic must become active');
  await field('thesis').fill(thesis);
  const message = 'Как уйти от пересказа?';
  await panel.locator('#ew-message').fill(message);
  await panel.locator('#ew-chat button').click();
  const chat = panel.locator('#ew-log .ew-turn p');
  assert.equal(await chat.first().textContent(), message, 'The local dialogue must contain the submitted message');
  const reply = await chat.nth(1).textContent();
  assert.ok(reply.trim() && reply !== message, 'The local assistant must answer');
  await page.reload();
  assert.equal(await chat.nth(1).textContent(), reply, 'Reload must preserve the dialogue');
  assert.equal(await field('thesis').inputValue(), thesis, 'Reload must preserve the thesis');
  assert.equal(await page.locator('#ew-mode').inputValue(), 'orthodox', 'Reload must preserve the perspective');
  await action('page-episode');
  await panel.locator('#ew-work').selectOption('own');
  await field('own').fill(book);
  await field('episode').fill(episode);
  await action('page-link');
  await field('link').fill(link);
  await action('page-draft');
  const count = panel.locator('#ew-count');
  for (const [sample, expected] of [
    ['5 лет, пять лет', 3],
    ['«Всё-таки» и «всё же»', 4],
    ['А. С. ПУШКИН и Г.-Х. Андерсен', 3],
    ['Михаил Юрьевич Лермонтов', 3],
    ['В 1945 году ему исполнилось 5 лет.', 5],
    ['Он сказал: «Я всё же вернусь».', 6],
  ]) {
    await field('draft').fill(sample);
    assert.ok((await count.textContent()).includes('подсчёт: ' + expected + ' сл.'), sample);
  }
  const underMinimum = 'слово '.repeat(249).trim();
  const withHeading = topic + '\n' + underMinimum;
  await field('draft').fill(withHeading);
  assert.match(await count.textContent(), /253 сл\./u, 'The opening sentence is counted until the writer marks a heading');
  const headingOption = panel.locator('#ew-draft-heading');
  await panel.getByText('Как считать слова и убрать заголовок из подсчёта', {exact:true}).click();
  await headingOption.check();
  assert.match(await count.textContent(), /249 сл\..*Заголовок исключён/u);
  await action('page-review');
  assert.match(await panel.textContent(), /249 сл\..*Заголовок исключён/u);
  await page.reload();
  await action('page-draft');
  assert.ok(await headingOption.isChecked(), 'The heading choice is saved with its draft');
  await field('draft').fill(withHeading + ' конец');
  assert.match(await count.textContent(), /250 сл\..*Заголовок исключён/u, 'Editing the body keeps its heading');
  await field('draft').fill(underMinimum);
  assert.ok(!await headingOption.isChecked(), 'Deleting the heading must not exclude the new first paragraph');
  assert.match(await count.textContent(), /249 сл\./u);
  const original = 'Доктор помог семье.';
  const revised = original + ' Он сделал это деликатно.';
  await field('draft').fill(original);
  await fits();
  assert.match(await panel.locator('#ew-count').textContent(), /\b3 сл\./u, 'Draft word count follows live input');
  await action('page-review');
  assert.equal(await panel.locator('[data-check]').count(), 6, 'Full review offers its checklist');

  await start();
  await action('route-edit');
  await action('forward-topic');
  assert.equal(await field('draft').inputValue(), original, 'Edit route must reopen the same draft');
  await action('snapshot');
  await field('draft').fill(revised);
  await action('page-review');
  const versions = panel.locator('details').filter({has:page.getByText('Сравнить версии', {exact:true})});
  await versions.locator('summary').click();
  assert.deepEqual(await versions.locator('.ew-note').allTextContents(), [original, revised], 'Edit comparison must retain both versions');
  await panel.locator('[data-check="logic"]').check();
  await page.reload();
  assert.ok(await panel.locator('[data-check="logic"]').isChecked(), 'Review checklist survives reload');
  await fits();
  const saved = await download('download', 'moe-sochinenie.txt');
  for (const value of [topic, book, thesis, episode, link, revised, original, 'православный']) {
    assert.ok(saved.includes(value), 'Export is missing ' + value);
  }
  await panel.getByText('Продолжить с диалоговым ИИ-помощником', {exact:true}).click();
  const packet = await download('download-prompt', 'zadanie-pomoshchniku.txt');
  assert.ok(packet.includes(saved.trim()) && packet.length > saved.length, 'Chat handoff must include the instructions and the student’s work');

  await start();
  await action('route-quick');
  await action('forward-topic');
  await action('page-episode');
  await action('page-link');
  await action('finish-argument');
  assert.equal(await panel.locator('#ew-title').textContent(), 'Мой литературный аргумент', 'Quick review must open even when a full draft exists');
  assert.equal(await panel.locator('[data-check]').count(), 0, 'Quick review should display the argument');
  for (const value of [thesis, episode, link]) assert.ok((await panel.textContent()).includes(value), 'Quick review is missing ' + value);
  await action('page-draft');
  assert.equal(await field('draft').inputValue(), revised, 'Quick argument must preserve the full draft');
  await start();
  await action('route-drills');
  await field('exercise').fill('Моя редакция учебного фрагмента.');
  await action('drill-check');
  assert.ok((await panel.locator('#ew-drill-feedback').textContent()).trim(), 'A submitted revision receives a self-check');
  assert.deepEqual(errors, [], 'The workshop raised an uncaught browser error');
}

(async () => {
  const browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  try {
    for (const width of [320, 1280]) {
      const page = await browser.newPage({viewport:{width, height:900}, acceptDownloads:true});
      page.setDefaultTimeout(7000);
      try { await exercise(page); }
      catch (error) { throw new Error('Essay workshop at ' + width + 'px: ' + error.message, {cause:error}); }
      finally { await page.close(); }
      console.log('Essay workshop passed at ' + width + 'px');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
