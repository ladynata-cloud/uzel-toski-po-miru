'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const {checkLocalReadingCases} = require('./essay-local-reading-cases.cjs');

const base = (process.env.READER_BASE_URL || 'http://127.0.0.1:8074').replace(/\/?$/, '/');
const workshop = new URL('k-sochineniyu/itogovoe/pomoshchnik/', base);
const reviewer = new URL('proverka-sochineniya.html', workshop);
const dist = path.resolve(__dirname, '../dist/k-sochineniyu/itogovoe/pomoshchnik');
const selected = ['doctor', 'student'];
const topic = 'Почему одному слову веришь?';
const essay = '  У меня своё чтение. Ёлки стояли у дороги.\nА это ещё один абзац.  ';
const key = 'dummy-local-auth-for-regression';

async function library(page) {
  await page.goto(workshop.href + '#knizhnaya-polka');
  const catalog = JSON.parse(await page.locator('#ew-catalog').textContent());
  const cards = page.locator('[data-library-work]');
  const section = page.locator('#ew-library-section');
  const query = page.locator('#ew-library-search');
  for (const filter of ['1', '2', '3']) {
    await section.selectOption(filter);
    const more = page.locator('[data-act="library-more"]');
    while (await more.isVisible()) await more.click();
    const expected = catalog.works.filter(w => w.sections.includes(Number(filter))).map(w => w.id);
    assert.ok(expected.length > 0);
    assert.deepEqual(await cards.evaluateAll(nodes => nodes.map(n => n.dataset.libraryWork)), expected);
    await query.fill('КУПРИН');
    const subset = expected.filter(id => catalog.works.find(w => w.id === id).title.toUpperCase().includes('КУПРИН'));
    assert.deepEqual(await cards.evaluateAll(nodes => nodes.map(n => n.dataset.libraryWork)), subset);
    await query.fill('');
  }
  await section.selectOption('');
  await query.fill('КуПрИн');
  await page.locator('[data-act="library-use-doctor"]').click();
  const episode = page.locator('[data-field="episode"]');
  await episode.fill('Под блюдцем лежал рецепт.');
  await page.goto(workshop.href + '#knizhnaya-polka');
  await query.fill('Чехов');
  await page.locator('[data-act="library-use-student"]').click();
  assert.equal(await episode.inputValue(), '');
  await episode.fill('Я запомнил разговор у костра.');
  await page.goto(workshop.href + '#knizhnaya-polka');
  await query.fill('Куприн');
  await page.locator('[data-act="library-use-doctor"]').click();
  assert.equal(await episode.inputValue(), 'Под блюдцем лежал рецепт.');

  for (const kind of ['scene', 'excerpt']) {
    const reading = catalog.readings.find(r => kind === 'scene' ? r.kind === 'scene' : r.quote);
    assert.ok(reading, 'The catalogue should provide an example of ' + kind);
    const w = catalog.works.find(book => book.id === reading.id);
    await page.goto(workshop.href + '#knizhnaya-polka');
    await query.fill(w.title);
    await page.locator('[data-act="library-read-' + w.id + '"]').click();
    const lesson = page.locator('[data-reading-kind="' + kind + '"]');
    await lesson.waitFor();
    if (kind === 'excerpt') {
      const printed = await lesson.locator('[data-reading-quote]').textContent();
      assert.ok(printed.includes(reading.quote));
    } else {
      assert.equal(await lesson.locator('[data-reading-quote]:visible').count(), 0);
    }
  }
}

async function collectTransfer(page) {
  const transfer = page.locator('#draft-transfer');
  if (!(await transfer.evaluate(el => el.open))) await transfer.locator('summary').click();
  const downloading = page.waitForEvent('download');
  await page.locator('#transfer-save').click();
  const download = await downloading;
  const json = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
  assert.deepEqual(json, {format:'uzel-essay-review.1', topic, essay, cardIds:selected});
  return json;
}

async function topicAtlas(page) {
  await page.goto(workshop.href + '#temy-sochineniya');
  const catalog = JSON.parse(await page.locator('#ew-catalog').textContent());
  const source = page.locator('#ta-source');
  const cards = page.locator('#ta-list [data-ta-card]');
  assert.equal(await source.inputValue(), '@public');
  const publicTopic = catalog.publicTopics.topics[0];
  const publicSource = catalog.publicTopics.sources.find(s => s.id === publicTopic.source);
  await source.selectOption(publicSource.id);
  await page.locator('#ta-search').fill(publicTopic.title);
  const found = cards.filter({has:page.getByRole('heading', {name:publicTopic.title, exact:true})}).first();
  assert.equal(await found.getAttribute('data-ta-source'), publicSource.id);
  assert.equal(await found.locator('a').first().getAttribute('href'), publicSource.url);
  await page.locator('#ta-search').fill('');
  await source.selectOption('@workshop');
  for (const subdivision of catalog.publicTopics.sections) {
    const code = subdivision.id;
    await page.locator('#ta-section').selectOption(code.split('.')[0]);
    await page.locator('#ta-subsection').selectOption(code);
    const more = page.locator('[data-ta-act="more"]');
    while (await more.isVisible()) await more.click();
    const expected = catalog.topics.filter(t => t.subsection === code).map(t => 'w:' + t.id);
    assert.ok(expected.length > 0);
    assert.deepEqual(await cards.evaluateAll(nodes => nodes.map(n => n.dataset.taCard)), expected);
  }
}

const historicalPrompts = [
  ['Какого исторического деятеля Вы бы назвали подлинно выдающимся?'],
  ['Согласны ли Вы с утверждением М.В. Ломоносова: «Народ, не знающий своего прошлого, не имеет будущего»?'],
  ['Произведение искусства, хранящее память о великом подвиге.'],
  ['Событие отечественной истории, запечатленное в искусстве.'],
  ['Какие уроки может преподать отечественная история?', 'shelf-senior-043'],
  ['Какое достижение отечественной культуры XIX века представляется Вам наиболее значимым и почему?', 'classic-onegin'],
  ['Как Вы думаете, почему в числе первых произведений отечественной письменной литературы были летописи?', 'own', 'Повесть временных лет'],
  ['Какие события отечественной истории демонстрируют сплоченность общества?', 'classic-war-and-peace'],
  ['Историк В.О. Ключевский утверждал: «Чтобы быть сознательно и добросовестно действующим гражданином, каждый из нас должен быть хоть немного историком». Как Вы понимаете это утверждение?', 'own', 'Курс русской истории'],
];

async function historicalRoutes(page, url) {
  await page.goto(url + '#temy-sochineniya');
  const catalog = JSON.parse(await page.locator('#ew-catalog').textContent());
  const sample = 'fipi-sample-2026';
  const history = 'fipi-history-2026';
  const sources = new Map(catalog.publicTopics.sources.map(s => [s.id, s.url]));
  const cases = historicalPrompts.map(([title, book, ownTitle], i) => ({
    id: 'pub-' + history + '-' + (i + 1), source: history, title, book, ownTitle,
  }));
  cases.push({id: 'pub-' + sample + '-4', source: sample, book: 'classic-quiet-dawns',
    title: 'Память о Великой Отечественной войне – ответственность перед прошлым и будущим.'});
  const atlas = page.locator('#ew-steps [data-act="page-themeAtlas"]');
  await page.locator('#ta-section').selectOption('');
  await page.locator('#ta-search').fill('');

  for (const {id, source, title, book, ownTitle} of cases) {
    await atlas.click();
    await page.locator('#ta-source').selectOption(source);
    const row = page.locator('[data-ta-card="p:' + id + '"]');
    assert.equal(await row.locator('h3').textContent(), title);
    assert.equal(await row.locator('a').first().getAttribute('href'), sources.get(source));
    if (source === sample) assert.match(await row.innerText(), /№ 407/u);
    await row.locator('[data-ta-act="books"]').click();
    const route = row.locator('[data-ta-route]');
    const choice = row.locator('[data-ta-book-choice]');
    const confirm = row.locator('[data-ta-act="book-choice"]');
    assert.equal(await choice.inputValue(), '', title);
    assert.equal(await confirm.isEnabled(), false, title);
    assert.equal(await route.count(), book ? 1 : 0, title);
    if (book) {
      const expected = catalog.publicTopics.topics.find(t => t.id === id).editorialReading;
      for (const part of [expected.passage, expected.observation, expected.question]) {
        assert.ok(part && (await route.innerText()).includes(part), id);
      }
      assert.equal(await route.locator('a').getAttribute('href'), expected.url);
      assert.notEqual(expected.url, sources.get(source));
      await row.locator('[data-ta-act="use-route"]').click();
      assert.equal(await page.locator('#ew-current .ew-topic').textContent(), title);
      assert.equal(await page.locator('#ew-work').inputValue(), book);
      if (ownTitle) assert.ok((await page.locator('#ew-own').inputValue()).includes(ownTitle));
      const prompt = page.locator('[data-editorial-reading]');
      assert.ok((await prompt.innerText()).includes(expected.question));
      assert.equal(await prompt.locator('a').getAttribute('href'), expected.url);
      assert.equal(await page.locator('[data-field="episode"]').inputValue(), '');
      await atlas.click();
      await page.locator('#ta-source').selectOption(source);
      await row.locator('[data-ta-act="books"]').click();
    }

    // A deliberate choice can match the recommended book without inheriting its provenance.
    const manualBook = book && book !== 'own' ? book : 'doctor';
    const manualTitle = catalog.works.find(w => w.id === manualBook).title;
    await row.locator('[data-ta-book-search]').fill(manualTitle);
    assert.equal(await choice.inputValue(), '', 'Filtering to one title must not select it');
    assert.equal(await confirm.isEnabled(), false);
    await choice.selectOption(manualBook);
    await confirm.click();
    assert.deepEqual(await page.locator('[data-library-work]').evaluateAll(nodes => nodes.map(n => n.dataset.libraryWork)), [manualBook]);
    assert.ok((await page.locator('[data-library]').innerText()).includes('Книга, которую ты выбрал для этой темы.'));
    assert.doesNotMatch(await page.locator('[data-library]').innerText(), /Подборка мастерской для этой темы/u);
    await page.locator('[data-act="library-use-' + manualBook + '"]').click();
    assert.equal(await page.locator('#ew-current .ew-topic').textContent(), title);
    assert.equal(await page.locator('#ew-work').inputValue(), manualBook);
    assert.equal(await page.locator('[data-editorial-reading]').count(), 0);
  }
}

async function downloadedHistoricalRoutes(browser) {
  const page = await browser.newPage({offline:true});
  try {
    // The release parity test compares this file byte-for-byte to practice.html in the ZIP.
    await historicalRoutes(page, pathToFileURL(path.join(dist, 'masterskaya.html')).href);
  } finally {
    await page.close();
  }
}

async function topicPicker(page) {
  const open = page.locator('#topic-picker > summary');
  const pick = page.locator('#topic-results [data-topic-index]').first();
  await open.click();
  await page.locator('#topic-kind').selectOption('public');
  assert.ok(await page.locator('#topic-results a').first().getAttribute('href'));
  await pick.click();
  await page.locator('#topic-keep').click();
  assert.equal(await page.locator('#topic').inputValue(), topic);
  await open.click();
  await page.locator('#topic-kind').selectOption('author');
  const title = await pick.textContent();
  await page.locator('#topic-search').fill(title.toLocaleUpperCase('ru'));
  assert.equal(await pick.textContent(), title);
  assert.equal(await page.locator('#topic-results a').count(), 0);
  await pick.click();
  await page.locator('#topic-replace').click();
  assert.equal(await page.locator('#topic').inputValue(), title);
  assert.equal(await page.locator('#essay').inputValue(), essay);
  await page.locator('#topic').fill(topic);
}

async function family(page, browser, release) {
  const requests = [];
  await page.route('**/api/status', route => route.fulfill({json:{
    service:'uzel-essay-full-review', version:1, methodVersion:release.method.version, materialsId:release.materialsId, maxCards:2
  }}));
  await page.route('**/api/review', async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({json:{methodVersion:release.method.version, materialsId:release.materialsId, unverifiedQuotes:[], review:{
      priority:'Перечитай вторую фразу.', criteria:['K1','K2','K3','K4','K5'].map(id => ({
        id, quote:'У меня своё чтение.', comment:'Вижу твою запись.', action:'Объясни одну деталь.'
      }))
    }}});
  });
  await page.goto(reviewer.href);
  await page.locator('#topic').fill(topic);
  await page.locator('#essay').fill(essay);
  await topicPicker(page);
  await page.locator('#book-shelf > summary').click();
  const preview = async () => JSON.parse(await page.locator('#preview').textContent());
  assert.deepEqual(await preview(), {topic, essay});
  await page.locator('#local-check').click();
  const withoutCards = await page.locator('#local-result').textContent();
  const query = page.locator('#book-search');
  await query.fill('КуПрИн');
  await page.locator('[data-card-id="doctor"]').check();
  assert.deepEqual((await preview()).cards.map(c => c.id), ['doctor']);
  await query.fill('ЧЕХОВ');
  await page.locator('[data-card-id="student"]').check();
  await query.fill('');
  const third = page.locator('[data-card-id]:not(:checked)').first();
  assert.equal(await third.isEnabled(), false);
  await page.locator('#local-check').click();
  assert.equal(await page.locator('#local-result').textContent(), withoutCards);
  const material = await preview();
  assert.deepEqual(material.cards.map(c => c.id), selected);
  for (const c of material.cards) assert.deepEqual(Object.keys(c).sort(), ['fact','id','title','url']);
  await page.locator('#online > summary').click();
  await page.locator('#gigakey').fill(key);
  const manual = await page.locator('#manual-text').textContent();
  assert.ok(manual.endsWith(JSON.stringify(material, null, 2)));
  assert.ok(!manual.includes(key));
  const transferred = await collectTransfer(page);
  await page.locator('#consent').check();
  await page.locator('#send').click();
  await page.locator('#review-panel').waitFor({state:'visible'});
  assert.deepEqual(requests, [{key,topic,essay,cardIds:selected}]);
  assert.equal(await page.locator('#gigakey').inputValue(), '');
  assert.equal(await page.locator('#essay').inputValue(), essay);
  const persistent = await page.evaluate(() => JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)]));
  assert.ok(!persistent.includes(key));
  await page.reload();
  assert.deepEqual(await preview(), material);
  await page.unroute('**/api/status');
  await page.route('**/api/status', route => route.fulfill({json:{
    service:'uzel-essay-full-review', version:1, methodVersion:release.method.version,
    materialsId:'different-release', maxCards:2
  }}));
  await page.reload();
  await page.locator('#online > summary').click();
  await page.locator('#version-warning').waitFor({state:'visible'});
  assert.equal(await page.locator('#api-controls').isVisible(), false);
  assert.equal(await page.locator('#essay').inputValue(), essay);
  const offline = await browser.newPage();
  const outgoing = [];
  await offline.route(/^https?:/, async route => {outgoing.push(route.request().url()); await route.abort();});
  try {
    await offline.goto(pathToFileURL(path.join(dist, 'proverka-sochineniya.html')).href);
    await offline.locator('#transfer-file').setInputFiles({
      name:'работа.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(transferred))
    });
    await offline.waitForFunction(text => document.getElementById('essay').value === text, essay);
    assert.deepEqual(JSON.parse(await offline.locator('#preview').textContent()), material);
    await offline.locator('#book-shelf > summary').click();
    await offline.locator('#shelf-clear').click();
    assert.deepEqual(JSON.parse(await offline.locator('#preview').textContent()), {topic,essay});
    assert.deepEqual(outgoing, [], 'Opening and importing a file does not contact a provider');
  } finally {await offline.close();}
}

(async () => {
  const browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(6000);
    await library(page);
    await topicAtlas(page);
    await historicalRoutes(page, workshop.href);
    await downloadedHistoricalRoutes(browser);
    const pageHtml = await fs.readFile(path.join(dist, 'proverka-sochineniya.html'), 'utf8');
    const release = JSON.parse(pageHtml.match(/const reviewBundle\s*=\s*(\{[^\n]*\});/)[1]);
    await family(page,browser,release);
    await checkLocalReadingCases(browser);
    console.log('Shelf filters, historical routes on site and offline, per-book notes, optional cards and family transfer passed.');
  } finally {await browser.close();}
})().catch(error => { console.error(error); process.exitCode=1; });
