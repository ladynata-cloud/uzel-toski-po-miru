'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

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
  assert.deepEqual(json, {format:'uzel-essay-review.1', topic, essay, mode:'secular', cardIds:selected});
  return json;
}

async function topicAtlas(page) {
  await page.goto(workshop.href + '#temy-sochineniya');
  const catalog = JSON.parse(await page.locator('#ew-catalog').textContent());
  const source = page.locator('#ta-source');
  const cards = page.locator('#ta-list [data-ta-card]');
  const fullCatalog = page.locator('#ta-catalog');
  assert.equal(await fullCatalog.evaluate(node=>node.open), false);
  const route = page.locator('.ew-topic-route');
  const interests = route.locator('[data-ta-interest]');
  assert.equal(await interests.count(), 4);
  for(const interest of await interests.all()){
    await interest.click();
    const picks = route.locator('[data-ta-pick]');
    assert.equal(await picks.count(), 2);
    assert.equal(await route.locator('.ew-route-topic p strong').count(), 2);
  }
  const pick = route.locator('[data-ta-pick]').first();
  const selected = await route.locator('.ew-route-topic h4').first().innerText();
  await pick.click();
  assert.equal(await page.locator('.ew-topic').innerText(), selected);
  const field=page.locator('[data-field="thesis"]');
  await field.fill('О своём выборе можно судить по поступку.');
  await page.locator('#ew-steps [data-act="page-themeAtlas"]').click();
  assert.equal(await route.locator('[data-ta-interest="culture"]').getAttribute('aria-pressed'),'true');
  await pick.click();
  assert.equal(await field.inputValue(),'О своём выборе можно судить по поступку.');
  await page.locator('#ew-steps [data-act="page-themeAtlas"]').click();
  await fullCatalog.locator('summary').first().click();
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

async function topicToArgument(page) {
  await page.goto(workshop.href + '#temy-sochineniya');
  const catalog = JSON.parse(await page.locator('#ew-catalog').textContent());
  const panel = page.locator('#ew-current');
  const action = id => panel.locator('[data-act="' + id + '"]');
  const step = id => page.locator('#ew-steps [data-act="page-' + id + '"]');
  const publicRecords = catalog.publicTopics.topics;
  const books = new Map(catalog.works.map(w => [w.id, w]));
  const primary = publicRecords.find(t => t.id === 'pub-fipi-sample-2026-2');
  const historical = publicRecords.find(t => t.id === 'pub-fipi-sample-2026-4');
  async function checkSelection(record) {
    const suggestions = record.bookRoutes.map(k => catalog.bookRoutes[k]);
    assert.ok(suggestions.length >= 1 && suggestions.length <= 3);
    const cards = panel.locator('[data-topic-work]');
    await cards.first().waitFor();
    assert.deepEqual(await cards.evaluateAll(nodes => nodes.map(n => n.dataset.topicWork)),
      suggestions.map(r => r.work));
    for (const {work, why, scene, url} of suggestions) {
      const card = panel.locator('[data-topic-work="' + work + '"]');
      const book = books.get(work);
      assert.ok((await card.innerText()).includes(why), 'Shows the reason this scene fits this topic');
      assert.ok((await card.innerText()).includes(scene || book.fact), 'Shows an identifiable scene');
      assert.equal(await card.locator('a').getAttribute('href'), url || book.url);
    }
    assert.equal(await panel.locator('[data-library-work]').count(), 0);
    return suggestions.map(r => r.work);
  }
  const fullCatalog = panel.locator('#ta-catalog');
  if (!await fullCatalog.evaluate(node=>node.open)) await fullCatalog.locator('summary').first().click();
  const link = panel.locator('[data-ta-card="p:' + primary.id + '"] a[data-ta-act="books"]').first();
  assert.equal(await link.getAttribute('href'), '#tema-' + primary.id);
  await link.click();
  const candidates = await checkSelection(primary);
  const chosen = candidates[0];
  const storedWork = () => page.evaluate(() => {
    const notebook = JSON.parse(localStorage.getItem('uzel.essay-workshop.v1'));
    return notebook.notes[notebook.active].work;
  });
  assert.equal(await storedWork(), '', 'Viewing a theme does not select a book');
  await action('library-use-' + chosen).click();
  assert.equal(await panel.locator('#ew-work').inputValue(), chosen);
  assert.equal(await panel.locator('#ew-work option').count(), candidates.length + 2);
  const observation = 'Эту деталь я отметил самостоятельно.';
  await panel.locator('[data-field="episode"]').fill(observation);
  await step('draft').click();
  await panel.locator('[data-field="draft"]').fill(essay);

  await page.goto(workshop.href + '#tema-' + historical.id);
  const historyBooks = await checkSelection(historical);
  assert.notDeepEqual(historyBooks, candidates, 'History and doing good have different selections');
  assert.equal(await storedWork(), '', 'A new topic starts without the previous choice');
  await page.reload();
  await checkSelection(historical);
  await action('library-all').click();
  await panel.locator('#ew-library-search').fill(books.get(chosen).title);
  assert.ok(await panel.locator('[data-library-work="' + chosen + '"]').isVisible());
  await action('topic-books').click();
  await checkSelection(historical);

  await page.goto(workshop.href + '#tema-' + primary.id);
  assert.equal(await storedWork(), chosen);
  await action('library-use-' + chosen).click();
  assert.equal(await panel.locator('[data-field="episode"]').inputValue(), observation);
  await step('draft').click();
  assert.equal(await panel.locator('[data-field="draft"]').inputValue(), essay);

  await step('topic').click();
  const authored = catalog.topics[1];
  await panel.locator('#ew-topic').selectOption(authored.id);
  await checkSelection(authored);
  assert.equal(await panel.locator('#ew-from-book option').count(), 0,
    'The reverse lookup loads the whole catalogue only when requested');
  await panel.locator('#ew-browse-by-book summary').click();
  await panel.locator('#ew-from-book option').nth(1).waitFor({state:'attached'});
  assert.equal(await panel.locator('#ew-from-book option').count(), catalog.works.length + 1);

  await page.goto(workshop.href + '#temy-sochineniya');
  await panel.locator('#ta-own summary').click();
  await panel.locator('#ta-own-title').fill('Мой новый вопрос о герое книги');
  await panel.locator('[data-ta-own-form] button').click();
  assert.equal(await panel.locator('[data-topic-work]').count(), 0);
  assert.match(await panel.locator('[data-topic-picks]').innerText(), /нет готовой подборки/u);
  await action('choose-own-book').click();
  assert.equal(await panel.locator('#ew-work').inputValue(), 'own');
  await panel.locator('#ew-own').fill('Моё произведение');
  const alternateTopic = publicRecords.find(t => t.bookRoutes.some(k => catalog.bookRoutes[k].card));
  assert.ok(alternateTopic, 'A question has a specific fragment beyond the standard shelf card');
  const alternate = alternateTopic.bookRoutes.map(k => catalog.bookRoutes[k]).find(r => r.card);
  await page.goto(workshop.href + '#tema-' + alternateTopic.id);
  await checkSelection(alternateTopic);
  await action('library-use-' + alternate.work).click();
  const scene = panel.locator('.ew-text-card').first();
  assert.ok((await scene.textContent()).includes(alternate.scene));
  assert.equal(await scene.locator('a').getAttribute('href'), alternate.url);
  await panel.locator('[data-field="episode"]').fill(observation);
  await step('draft').click();
  await panel.locator('[data-field="draft"]').fill(essay);
  await action('open-full-review').click();
  const review = JSON.parse(await page.locator('#preview').textContent());
  assert.equal(review.topic, alternateTopic.title);
  assert.equal(review.essay, essay);
  assert.equal(review.cards[0].fact, alternate.scene);
  assert.equal(review.cards[0].url, alternate.url);

  await page.goto(workshop.href + '#tema-' + alternateTopic.id);
  await action('library-use-' + alternate.work).click();
  await action('shelf-capture').click();
  await action('page-shelf').click();
  const saved = panel.locator('[data-shelf-card]').first();
  await saved.locator('[data-shelf-action="choose"]').click();
  await saved.locator('select[name="topic"]').selectOption('!new');
  const secondTopic = 'Что я замечаю в этом разговоре при повторном чтении?';
  await saved.locator('input[name="newTopic"]').fill(secondTopic);
  await saved.locator('[data-shelf-action="apply"]').click();
  await step('draft').click();
  await panel.locator('[data-field="draft"]').fill(essay);
  await action('open-full-review').click();
  await page.locator('#import-apply').click();
  const reused = JSON.parse(await page.locator('#preview').textContent());
  assert.equal(reused.topic, secondTopic);
  assert.deepEqual(reused.cards, review.cards, 'The personal shelf preserves the particular scene on a new topic');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(overflow <= 1, 'Book selection fits the viewport');
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
  assert.deepEqual(await preview(), {topic, essay, mode:'secular'});
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
  assert.equal(await page.locator('#manual-actions').isVisible(), false);
  assert.equal(await page.locator('#manual-text').textContent(), '');
  await page.locator('#consent').check();
  assert.equal(await page.locator('#send').isEnabled(), false);
  assert.equal(await page.locator('#manual-actions').isVisible(), false);
  await page.locator('#consent-privacy').check();
  const manual = await page.locator('#manual-text').textContent();
  assert.ok(manual.endsWith(JSON.stringify(material, null, 2)));
  assert.ok(!manual.includes(key));
  const transferred = await collectTransfer(page);
  await page.locator('#send').click();
  await page.locator('#review-panel').waitFor({state:'visible'});
  assert.deepEqual(requests, [{key,topic,essay,mode:'secular',cardIds:selected}]);
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
    assert.deepEqual(JSON.parse(await offline.locator('#preview').textContent()), {topic,essay,mode:'secular'});
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
    for (const width of [1100, 360]) {
      const scoped = await browser.newPage({viewport:{width, height:800}});
      try { await topicToArgument(scoped); } finally { await scoped.close(); }
    }
    const pageHtml = await fs.readFile(path.join(dist, 'proverka-sochineniya.html'), 'utf8');
    const release = JSON.parse(pageHtml.match(/const reviewBundle\s*=\s*(\{[^\n]*\});/)[1]);
    await family(page,browser,release);
    console.log('Topic selections, mobile navigation, shelf filters, per-book notes and family transfer passed.');
  } finally {await browser.close();}
})().catch(error => { console.error(error); process.exitCode=1; });
