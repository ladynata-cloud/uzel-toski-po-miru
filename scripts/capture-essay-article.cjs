'use strict';

// Authentic UI captures for the article. All writing below is an invented
// editorial exercise. The quotation example is the site's labelled demo;
// it must never be described as an answer from a live model.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {execFileSync} = require('node:child_process');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

const repo = process.cwd();
const base = new URL((process.env.READER_BASE_URL || 'http://127.0.0.1:8074').replace(/\/?$/, '/'));
const relative = 'k-sochineniyu/itogovoe/pomoshchnik/';
const workshop = new URL(relative, base).href;
const artifactRoot = path.resolve(process.env.READER_ARTIFACT_DIR || 'artifacts/reader-browser');
const output = path.join(artifactRoot, 'article-images');
const viewport = {width:960, height:1000};
const topic = 'Когда верность своему слову требует смелости?';
const position = 'Верность слову требует смелости, когда честный ответ может навредить самому человеку.';
const detail = 'В «Капитанской дочке» Гринёв отказывается служить Пугачёву и напоминает о данной присяге. Он не обещает даже того, что не станет выступать против него: если получит такой приказ, ему придётся подчиниться. Гринёв не знает заранее, чем закончится разговор. Поэтому его верность слову видна в конкретном рискованном ответе.';
const conclusion = 'Этот эпизод показывает: смелость нужна, чтобы сохранить верность слову даже перед человеком, от которого зависит твоя судьба.';
const draft = [position, detail, conclusion].join('\n\n');
const revision = 'Гринёв отказывается служить Пугачёву, хотя не знает, как тот ответит на отказ. Верность присяге требует смелости именно потому, что честный ответ опасен для него самого.';
const manifest = {
  generatedAt:new Date().toISOString(), status:'running', baseURL:base.href,
  viewport, deviceScaleFactor:2, syntheticExample:true, liveModelCalls:false,
  limitations:['Снимки сделаны на локальном сервере собранного сайта.',
    'Тексты придуманы для статьи; реальных ученических данных нет.',
    'Кадр 04 показывает встроенную демонстрацию, а не ответ действующего ИИ.',
    'Совпадение цитаты проверяется с отправленным черновиком, не с книгой.'],
  files:[], checks:[], blockedRequests:[], pageErrors:[],
};
let browser, context, offlineContext, page, temporary;

async function saveManifest() {
  await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2)+'\n');
}
function registerPage(p) {
  page = p;
  p.setDefaultTimeout(20000);
  p.setDefaultNavigationTimeout(45000);
  p.on('pageerror', error => manifest.pageErrors.push({url:p.url(), message:error.message}));
  return p;
}
async function guard(c) {
  await c.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!['http:', 'https:'].includes(url.protocol)) return route.continue();
    if (url.origin === base.origin && ['GET', 'HEAD'].includes(request.method())) return route.continue();
    manifest.blockedRequests.push({method:request.method(), url:url.origin+url.pathname});
    return route.abort('blockedbyclient');
  });
}
async function capture(p, selector, name, caption, extra = {}) {
  const block = p.locator(selector);
  await block.waitFor({state:'visible'});
  await p.evaluate(() => document.fonts ? document.fonts.ready : Promise.resolve());
  await block.scrollIntoViewIfNeeded();
  // locator.screenshot captures the real rendered block at native font sizes.
  await block.screenshot({path:path.join(output, name), animations:'disabled', caret:'hide'});
  const box = await block.boundingBox();
  assert.ok(box && box.width > 300 && box.height > 100, 'Capture must contain a readable UI block: '+name);
  manifest.files.push({name, caption, selector, bounds:box, url:p.url(), ...extra});
  await saveManifest();
}
async function entry(p, id) {
  const more = p.locator('#ew-situations [data-entry-more]');
  const card = p.locator('#ew-situations [data-entry-situation="'+id+'"]');
  if (!(await card.isVisible())) {
    if (!(await more.evaluate(el => el.open))) await more.locator('summary').click();
  }
  await card.click();
}
async function shortExercise(p, compare) {
  await entry(p, 'quick');
  await p.locator('#wp-response').waitFor();
  await p.locator('#wp-skill').selectOption('topic');
  await p.locator('#wp-exercise').selectOption('T04');
  assert.equal((await p.locator('#wp-topic').innerText()).trim(), topic);
  const hint = p.locator('#wp-hint');
  if (!(await hint.evaluate(el => el.open))) await hint.locator('summary').click();
  assert.match(await p.locator('#wp-question').innerText(), /деталь разговора с Пугачёвым/u);
  await p.locator('#wp-response').fill(revision);
  if (compare) {
    await p.locator('#wp-compare').click();
    await p.locator('#wp-review').waitFor({state:'visible'});
    assert.equal(await p.locator('#wp-after').innerText(), revision);
  }
}
async function mark(p, kind, text) {
  const source = p.locator('#ew-evidence-draft');
  const actual = await source.inputValue();
  const start = actual.indexOf(text);
  assert.ok(start >= 0, 'The marked words must be present in the current draft');
  await p.locator('#ew-evidence-kind').selectOption(kind);
  // Native textarea selection; the application's normal mark button persists it.
  await source.evaluate((el, range) => {el.focus(); el.setSelectionRange(range[0], range[1]);}, [start, start+text.length]);
  await p.locator('#ew-current [data-act="evidence-mark"]').click();
  assert.equal(await p.locator('[data-comparison-quote="'+kind+'"]').textContent(), '«'+text+'»');
}

async function main() {
  await fs.mkdir(output, {recursive:true});
  try { manifest.commit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd:repo, encoding:'utf8'}).trim(); } catch {}
  const launch = {headless:true};
  const executablePath = process.env.READER_CHROMIUM_EXECUTABLE || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (executablePath) launch.executablePath = executablePath;
  browser = await chromium.launch(launch);
  context = await browser.newContext({viewport, deviceScaleFactor:2, locale:'ru-RU', reducedMotion:'reduce'});
  await guard(context);
  const study = registerPage(await context.newPage());
  await study.goto(workshop, {waitUntil:'load'});
  await study.locator('#ew-situations').waitFor();
  assert.deepEqual(await study.locator('#ew-situations [data-entry-situation]:visible').evaluateAll(nodes => nodes.map(n => n.dataset.entrySituation)), ['empty','paragraph']);
  await capture(study, '#ew-situations', '01-start.png', 'Два понятных входа: начать с короткого отрывка или поработать со своим текстом.');

  await shortExercise(study, false);
  await capture(study, '#ot-temy-do-vyvoda', '02-exercise.png', 'Авторский учебный пример: один вопрос помогает уточнить собственную фразу.');

  await study.locator('#ew-back-start').click();
  await entry(study, 'essay');
  await study.locator('#ew-finished-topic').fill(topic);
  await study.locator('#ew-write-draft').fill(draft);
  assert.equal(await study.locator('#ew-write-draft').inputValue(), draft);
  await capture(study, '#ew-current', '03-own-text.png', 'Придуманный для статьи черновик: тема, собственный ответ и литературный довод.');

  const demoPage = registerPage(await context.newPage());
  await demoPage.goto(new URL(relative+'kak-proveryali/', base).href, {waitUntil:'load'});
  await demoPage.waitForFunction(() => document.querySelector('[data-quote-evidence-demo]')?.dataset.quoteDemoReady === 'true');
  const demo = demoPage.locator('[data-quote-evidence-demo]');
  assert.match(await demo.locator('.quote-demo-caption').innerText(), /не ответы действующего сервиса/u);
  const states = {};
  for (const id of ['exact','missing','interpretation']) {
    await demo.locator('[data-quote-demo-case="'+id+'"]').click();
    states[id] = await demo.locator('[data-quote-demo-status]').innerText();
    assert.equal(await demo.locator('[data-quote-demo-case="'+id+'"]').getAttribute('aria-pressed'), 'true');
  }
  assert.match(states.missing, /Замечание снято/u);
  await demo.locator('[data-quote-demo-case="exact"]').click();
  assert.ok(await demo.locator('mark').count() > 0);
  await capture(demoPage, '[data-quote-evidence-demo]', '04-quote.png', 'Встроенная учебная демонстрация: замечание привязано к точным словам отправленного черновика. Это не ответ действующего ИИ.', {demoStates:states});

  page = study;
  await study.locator('#ew-current [data-act="page-review"]').click();
  await study.locator('#ew-evidence-draft').waitFor();
  assert.equal(await study.locator('#ew-evidence-draft').inputValue(), draft);
  await mark(study, 'position', position);
  await mark(study, 'conclusion', conclusion);
  const comparison = study.locator('[data-evidence-comparison]');
  await comparison.locator('summary').click();
  assert.match(await comparison.innerText(), /Совпадение формулировок само по себе не показывает/u);
  assert.equal(await comparison.locator('[data-score],[data-verdict]').count(), 0);
  await capture(study, '[data-evidence-comparison]', '05-conclusion.png', 'Собственный ответ и вывод отмечены вручную. Сходство слов не превращается в автоматический зачёт.');

  const zip = path.join(repo, 'dist', relative, 'proverka-gigachat.zip');
  await fs.access(zip);
  temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'uzel-article-offline-'));
  execFileSync('python3', ['-c', 'import sys,zipfile,pathlib; z=zipfile.ZipFile(sys.argv[1]); pathlib.Path(sys.argv[2],"practice.html").write_bytes(z.read("practice.html"))', zip, temporary]);
  const offlineFile = path.join(temporary, 'practice.html');
  offlineContext = await browser.newContext({viewport, deviceScaleFactor:2, locale:'ru-RU', reducedMotion:'reduce'});
  await offlineContext.setOffline(true);
  const offline = registerPage(await offlineContext.newPage());
  const network = [];
  offline.on('request', request => {if (/^https?:/.test(request.url())) network.push({method:request.method(), url:request.url()});});
  await offline.goto(pathToFileURL(offlineFile).href, {waitUntil:'load'});
  await shortExercise(offline, true);
  assert.deepEqual(network, [], 'The offline exercise must not even attempt an HTTP request');
  await capture(offline, '#ot-temy-do-vyvoda', '06-offline.png', 'Упражнение из скачанного practice.html выполнено с отключённой сетью, без ключа и запросов к ИИ.', {offline:true, networkRequests:network});
  manifest.offline = {browserContextOffline:true, source:'dist/'+relative+'proverka-gigachat.zip', member:'practice.html', exercise:'T04', inputPreserved:true, selfCheckShown:true, httpRequests:network.length};
  assert.equal(manifest.files.length, 6);
  assert.deepEqual(manifest.pageErrors, [], 'No JavaScript errors are permitted during capture');
  assert.deepEqual(manifest.blockedRequests.filter(r => !['GET','HEAD'].includes(r.method)), [], 'No write or model request may be attempted');
  manifest.checks.push('All six images were captured from real rendered UI.', 'Position and conclusion were marked through native selection and the real mark action.', 'All three labelled quotation-demo states were exercised.', 'Offline practice completed with zero HTTP requests.');
  manifest.status = 'passed';
  await saveManifest();
  console.log('Article screenshots ready: '+output);
}

main().catch(async error => {
  manifest.status = 'failed';
  manifest.error = error.stack || String(error);
  try {
    await fs.mkdir(output, {recursive:true});
    if (page && !page.isClosed()) {
      await page.screenshot({path:path.join(output, 'failure-diagnostic.png'), fullPage:true, animations:'disabled'});
      manifest.diagnostic = 'failure-diagnostic.png';
      manifest.failureURL = page.url();
    }
    await saveManifest();
  } catch (diagnosticError) { console.error('Diagnostic capture failed:', diagnosticError.message); }
  console.error(error.stack || error);
  process.exitCode = 1;
}).finally(async () => {
  if (offlineContext) await offlineContext.close().catch(() => {});
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  if (temporary) await fs.rm(temporary, {recursive:true, force:true}).catch(() => {});
});
