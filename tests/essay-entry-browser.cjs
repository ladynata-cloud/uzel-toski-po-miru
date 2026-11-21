'use strict';

const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const {checkComparison, checkStorageFailure} = require('./essay-conclusion-check.cjs');

const base = (process.env.READER_BASE_URL || 'http://127.0.0.1:8074').replace(/\/?$/, '/');
const workshop = new URL('k-sochineniyu/itogovoe/pomoshchnik/', base).href;
const release = path.resolve(__dirname, '../dist/k-sochineniyu/itogovoe/pomoshchnik');
const actions = ['empty', 'topic', 'scene', 'paragraph', 'essay', 'rehearsal', 'quick'];
const targets = {
  empty:'#ew-write-reading', topic:'#ew-custom', scene:'#ew-library-search', paragraph:'#dr-source',
  essay:'#ew-write-draft', rehearsal:'[data-rehearsal-body]', quick:'#wp-response',
};
const myTopic = 'В чём бывает трудно признаться другу?';
const myEssay = 'Мой старый черновик.\nЯ вспомнила один поступок и хочу его объяснить.';
const myParagraph = 'Доктор положил рецепт на стол. Эту деталь я хочу обдумать.';
const myObservation = 'Я запомнил, как доктор слушал рассказ о семье.';
const situation = 'Сцена у меня уже есть, но я не уверена, почему она подходит к теме.';

function card(page, id) {
  return page.locator('#ew-situations [data-entry-situation="' + id + '"]');
}

async function enter(page, id) {
  await card(page, id).click();
  await page.locator(targets[id]).waitFor();
}

async function back(page) {
  await page.locator('#ew-back-start').click();
  await page.locator('#ew-situations').waitFor();
}

async function fits(page) {
  const out = await page.locator('#essay-workshop').evaluate(root => {
    return [...root.querySelectorAll('button,input,select,textarea,a,summary')].filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width && (rect.left < -1 || rect.right > innerWidth + 1);
    }).map(el => el.id || el.textContent.trim());
  });
  assert.deepEqual(out, [], 'Visible controls must fit the viewport');
}

async function routes(page, url) {
  await page.goto(url);
  const ids = await page.locator('#ew-situations [data-entry-situation]').evaluateAll(nodes =>
    nodes.map(n => n.dataset.entrySituation));
  assert.deepEqual(ids, actions);
  await fits(page);

  for (const id of actions) {
    await enter(page, id);
    await fits(page);
    await back(page);
  }

  await enter(page, 'topic');
  assert.ok(await page.locator('#ew-custom').evaluate(el => el === document.activeElement));
  await page.locator('#ew-custom').fill(myTopic);
  await page.reload();
  assert.equal(await page.locator('#ew-custom').inputValue(), myTopic);
  await page.locator('#ew-custom-form button').click();
  await page.locator('#ew-write-thesis').fill('Иногда признание даётся труднее, чем помощь.');
  await page.locator('#ew-current [data-act="page-episode"]').click();
  await page.locator('#ew-write-episode').fill('Моя запись об одном поступке.');
  await page.locator('#ew-current [data-act="page-link"]').click();
  await page.locator('#ew-write-link').fill('В этом поступке видна забота.');
  await back(page);

  await enter(page, 'empty');
  await page.locator('#ew-write-reading').fill(myObservation);
  await back(page);
  await enter(page, 'paragraph');
  await page.locator('#dr-source').fill(myParagraph);
  await back(page);
  await enter(page, 'essay');
  await page.locator('#ew-finished-topic').fill(myTopic);
  await page.locator('#ew-write-draft').fill(myEssay);
  const mode = page.locator('#ew-mode');
  const question = page.locator('[data-ew-lens-question="draft"] p');
  const literary = await question.textContent();
  await mode.selectOption('orthodox');
  assert.notEqual(await question.textContent(), literary, 'Switching views changes the question about the draft');
  assert.equal(await page.locator('#ew-write-draft').inputValue(), myEssay);
  await page.reload();
  assert.equal(await mode.inputValue(), 'orthodox');
  assert.equal(await page.locator('#ew-write-draft').inputValue(), myEssay);
  await mode.selectOption('secular');
  await page.locator('#ew-current [data-act="page-review"]').click();
  assert.equal(await page.locator('#ew-evidence-draft').inputValue(), myEssay);
  await back(page);
  await enter(page, 'rehearsal');
  await page.locator('#ew-r-time').selectOption('none');
  await page.locator('[data-r-form="start"] button[type="submit"]').click();
  await page.locator('[name="rehearsalTopic"]').first().check();
  const exam = 'Моя независимая попытка.';
  await page.locator('#ew-r-draft').fill(exam);
  await back(page);
  await enter(page, 'rehearsal');
  assert.equal(await page.locator('#ew-r-draft').inputValue(), exam);
  await back(page);
  for (const [id, saved] of [['paragraph', myParagraph], ['empty', myObservation], ['essay', myEssay]]) {
    await enter(page, id);
    assert.equal(await page.locator(targets[id]).inputValue(), saved);
    await back(page);
  }
}

async function openManual(page) {
  await page.locator('#ew-ai-entry > summary').click();
  await page.locator('#ew-ai-situation').fill('Спасибо');
  await page.locator('#ew-ai-local').click();
  assert.equal(await page.locator('#ew-ai-choice').inputValue(), '');
  assert.equal(await page.locator('#ew-ai-go').isEnabled(), false);
  assert.match(await page.locator('#ew-ai-status').textContent(), /\?/u);
  await page.locator('#ew-ai-situation').fill('У меня уже есть абзац, хочу его исправить');
  await page.locator('#ew-ai-local').click();
  assert.equal(await page.locator('#ew-ai-choice').inputValue(), '4');
  assert.ok(await page.locator('#ew-ai-go').isEnabled());
  await page.locator('#ew-ai-situation').fill(situation);
  await page.locator('#ew-ai-optional > summary').click();
  const prompt = await page.locator('#ew-ai-prompt').inputValue();
  assert.ok(prompt.includes(situation));
  const lensName = await page.locator('#ew-mode option:checked').innerText();
  // The prompt names the chosen view directly, even across minor UI wording changes.
  assert.match(prompt, /Мой ракурс/u);
  assert.ok(lensName.includes('равослав') ? prompt.includes('равослав') : !prompt.includes('равослав'));
  assert.ok(!prompt.includes(myEssay), 'A private essay is never appended to a navigation request');
  assert.equal(await page.locator('#ew-ai-chat').getAttribute('href'), 'https://giga.chat/');
}

async function deepLinks(page, url) {
  for (const [hash, select] of [
    ['#pervoe-chtenie',targets.empty], ['#razmetka-chernovika',targets.paragraph],
    ['#ot-temy-do-vyvoda',targets.quick], ['#tema-pub-fipi-sample-2026-2','[data-topic-work]'],
  ]) {
    await page.goto(url + hash);
    await page.locator(select).first().waitFor();
    await back(page);
  }
}

async function capture(page, name) {
  const directory = process.env.READER_ARTIFACT_DIR;
  if (!directory) return;
  await fs.mkdir(directory, {recursive:true});
  await page.screenshot({path:path.join(directory, name + '-' + page.viewportSize().width + '.png')});
}

async function online(page) {
  await page.goto(workshop);
  await page.locator('#ew-situations').waitFor();
  await capture(page, 'essay-entry-first-visit');
  await enter(page, 'quick');
  await page.goBack();
  await page.locator('#ew-situations').waitFor();
  const submissions = [];
  page.on('request', r => { if (r.method() === 'POST') submissions.push(r.url()); });
  await routes(page, workshop);
  await openManual(page);
  assert.equal(await page.locator('#ew-ai-ask:visible').count(), 0);
  await page.locator('#ew-ai-choice').selectOption('5');
  await page.locator('#ew-ai-go').click();
  assert.equal(await page.locator('#ew-write-draft').inputValue(), myEssay);
  await page.locator('#ew-current [data-act="open-full-review"]').click();
  await page.locator('#essay').waitFor();
  assert.equal(await page.locator('#topic').inputValue(), myTopic);
  assert.equal(await page.locator('#essay').inputValue(), myEssay);
  await page.locator('#local-check').click();
  const localReview = page.locator('#local-result');
  const ordinaryReview = await localReview.innerText();
  await page.locator('#review-lens').selectOption('orthodox');
  assert.notEqual(await localReview.innerText(), ordinaryReview, 'The full review gives a different reading question');
  const preview = JSON.parse(await page.locator('#preview').textContent());
  assert.deepEqual({topic:preview.topic, essay:preview.essay, mode:preview.mode},
    {topic:myTopic, essay:myEssay, mode:'orthodox'});
  await page.locator('#review-lens').selectOption('secular');
  assert.equal(await localReview.innerText(), ordinaryReview);
  await deepLinks(page, workshop);
  await page.goto(workshop + '#ot-temy-do-vyvoda');
  await page.locator(targets.quick).waitFor();
  await capture(page, 'essay-direct-writing-practice');
  await checkComparison(page, workshop, {extended:page.viewportSize().width === 390});
  assert.deepEqual(submissions, []);
}

async function offline(browser, folder) {
  const files = ['masterskaya.html','proverka-gigachat.zip','trenazher-gigachat.zip'];
  for (const name of files.slice(1)) {
    execFileSync('python3', ['-m','zipfile','-e',path.join(release,name),path.join(folder,name)]);
  }
  for (const filename of [
    path.join(release, files[0]), path.join(folder, files[1], 'practice.html'), path.join(folder, files[2], 'index.html'),
  ]) {
    const context = await browser.newContext({offline:true, viewport:{width:390,height:844}});
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(6000);
      const outgoing = [];
      page.on('request', request => { if (/^https?:/.test(request.url())) outgoing.push(request.url()); });
      const file = pathToFileURL(filename).href;
      await routes(page, file);
      await deepLinks(page, file);
      await openManual(page);
      assert.equal(await page.locator('#ew-ai-ask:visible').count(), 0);
      await page.locator('#ew-ai-choice').selectOption('7');
      await page.locator('#ew-ai-go').click();
      await page.locator(targets.quick).waitFor();
      await back(page);
      if (filename.endsWith('practice.html')) {
        await enter(page, 'essay');
        const review = page.locator('#ew-current a[href="essay-check.html"]').first();
        await review.click();
        assert.equal(page.url(), pathToFileURL(path.join(folder, files[1], 'essay-check.html')).href);
        await page.locator('#essay').fill(myEssay);
        await page.locator('#local-check').click();
        assert.ok((await page.locator('#local-result').innerText()).trim());
      }
      await checkComparison(page, file);
      assert.deepEqual(outgoing, [], 'The extracted or standalone workshop must work without network requests');
    } finally { await context.close(); }
  }
}

async function sharedReadingLens(page) {
  const examPage = new URL('k-sochineniyu/oge-russkiy/', base).href;
  await page.goto(examPage);
  const picker = page.locator('[data-reading-lens-picker]').first();
  const displayed = mode => page.locator('.reading-lens-question[data-reading-lens-only="' + mode + '"]').first();
  assert.equal(await picker.inputValue(), 'secular');
  await page.locator('#writing-mode').selectOption({index:2});
  const task = await page.locator('#writing-mode').inputValue();
  await page.locator('#draft').fill(myParagraph);
  await picker.selectOption('orthodox');
  assert.ok(await displayed('orthodox').isVisible());
  assert.equal(await displayed('secular').isVisible(), false);
  assert.equal(await page.locator('#draft').inputValue(), myParagraph);
  assert.equal(await page.locator('#writing-mode').inputValue(), task);
  await page.goto(new URL('shkola/9/', base).href);
  assert.equal(await picker.inputValue(), 'orthodox');
  const spiritual = await displayed('orthodox').textContent();
  await picker.selectOption('secular');
  assert.ok(await displayed('secular').isVisible());
  assert.notEqual(await displayed('secular').textContent(), spiritual);
  await page.goto(workshop + '#ot-temy-do-vyvoda');
  assert.equal(await page.locator('#ew-mode').inputValue(), 'secular');
  await page.locator('#wp-response').fill(myParagraph);
  const question = page.locator('#wp-lens-question');
  const literary = await question.textContent();
  await page.locator('#ew-mode').selectOption('orthodox');
  assert.notEqual(await question.textContent(), literary);
  assert.equal(await page.locator('#wp-response').inputValue(), myParagraph);
  await page.goto(new URL('poisk-po-pamyati/#work-student', base).href);
  assert.equal(await picker.inputValue(), 'orthodox', 'Choice in the workshop is shared with reading pages');
  await page.locator('#work-student .memory-practice').click();
  await page.locator('#reading-modes [data-mode="before"]').click();
  await page.locator('#reading-content').waitFor();
  await page.locator('#reading-note').fill(myObservation);
  const excerpt = await page.locator('#reading-source-text').innerText();
  const previous = await page.locator('#reading-lens-question').innerText();
  await picker.selectOption('secular');
  assert.notEqual(await page.locator('#reading-lens-question').innerText(), previous);
  assert.equal(await page.locator('#reading-source-text').innerText(), excerpt);
  assert.equal(await page.locator('#reading-note').inputValue(), myObservation);
  assert.equal(await page.locator('#reading-modes [data-mode="before"]').getAttribute('aria-pressed'), 'true');
}

async function personal(browser, folder) {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  try {
    const url = new URL('/', base).href;
    const requests = [];
    const packageHtml = await fs.readFile(path.join(folder,'trenazher-gigachat.zip','index.html'));
    await page.route(url, route => route.fulfill({contentType:'text/html; charset=utf-8', body:packageHtml}));
    const endpoint = new URL('v1/essay/navigate', url).href;
    await page.route(endpoint, async route => {
      requests.push(route.request().postDataJSON());
      if (requests.length === 1) await route.fulfill({status:503, body:'{}'});
      else await route.fulfill({json:{version:1,step:4}});
    });
    await page.goto(url);
    await page.locator('#ew-mode').selectOption('orthodox');
    await openManual(page);
    assert.deepEqual(requests, [], 'Reading and editing the prompt must not send it');
    await Promise.all([
      page.waitForResponse(response => response.url() === endpoint),
      page.locator('#ew-ai-ask').click(),
    ]);
    await page.locator('#ew-ai-ask:enabled').waitFor();
    assert.equal(await page.locator('#ew-ai-situation').inputValue(), situation);
    assert.ok(await page.locator('#ew-ai-choice').isEnabled(), 'Manual navigation survives provider failure');
    await page.locator('#ew-ai-ask').click();
    await page.waitForFunction(() => document.querySelector('#ew-ai-choice').value === '4');
    assert.ok(await page.locator('#ew-situations').isVisible(), 'A suggestion needs the pupil’s choice');
    assert.deepEqual(requests, Array(2).fill({version:1, situation, mode:'orthodox'}));
    await page.locator('#ew-ai-go').click();
    await page.locator(targets.paragraph).waitFor();
  } finally { await page.close(); }
}

(async () => {
  const browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'essay-entry-'));
  try {
    for (const width of [390, 1360]) {
      const page = await browser.newPage({viewport:{width,height:844}});
      page.setDefaultTimeout(6500);
      try { await online(page); } finally { await page.close(); }
    }
    await checkStorageFailure(browser, workshop);
    const shared = await browser.newPage();
    try { await sharedReadingLens(shared); } finally { await shared.close(); }
    await offline(browser, folder);
    await personal(browser, folder);
    await require('./home-essay-lens.cjs')(browser, base);
    console.log('Essay navigator: seven routes, direct links, local drafts, offline HTML/ZIPs and optional model passed.');
  } finally {
    await browser.close();
    await fs.rm(folder, {recursive:true, force:true});
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
