'use strict';

const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const fixture = require('./fixtures/essay-review-reading-cases.json');

const route = 'k-sochineniyu/itogovoe/pomoshchnik';
const dist = path.join(__dirname, '..', 'dist', route);
const base = (process.env.READER_BASE_URL || 'http://127.0.0.1:8074').replace(/\/?$/, '/');

// Check the kind of help a student sees. Keep all draft text and card choices in the original fixture.
const expected = {
  'notes-without-inference': {passage:/девочк|рецепт|фамилию/iu, question:[/деталь|поступок|событи|действи|измен/iu]},
  'fact-or-motive': {passage:/слав[ауы]|боялся/iu, question:[/деталь|слов|жест|поступок|текст/iu, /мотив|догад|предполож|причин|объяснен|объясня|поддерж|подтверж|верси/iu]},
  'unusual-supported-reading': {passage:/Мерцалов|имя|отца/iu, question:[/деталь|толкован|прочтен|трактов|мысл|объясн|понима|смысл/iu]},
  'chosen-book-outside-shelf': {passage:/счёт дней|рубаху/iu, question:[/запис|источник|дневник|деталь|сч[её]т/iu]},
  'one-line-draft': {question:[/сцен|эпизод|поступок/iu]},
  'citation-to-verify': {passage:/«[^»]+»/u, question:[/цитат|реплик|слова героя/iu, /свер|прове|перечита|сравн/iu]},
  'card-does-not-finish-essay': {question:[/сцен|эпизод|поступок/iu]}
};

async function checkCase(page, url, entry) {
  const {id, topic, essay, cardIds} = entry;
  await page.goto(url);
  const transfer = {format:'uzel-essay-review.1', topic, essay, cardIds};
  await page.locator('#transfer-file').setInputFiles({
    name:'draft.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(transfer))
  });
  await page.waitForFunction(text => document.getElementById('essay').value === text, essay);
  const preview = JSON.parse(await page.locator('#preview').textContent());
  assert.deepEqual((preview.cards || []).map(card => card.id), cardIds);

  await page.locator('#local-check').click();
  const result = page.locator('#local-result');
  const picker = result.locator('#local-passage');
  const question = result.locator('#local-question');
  const evidence = result.locator('#local-evidence');
  const originalQuestion = await question.innerText();
  const originalPassage = await picker.inputValue();
  assert.match(originalQuestion, /\?/u);
  for (const pattern of expected[id].question) assert.match(originalQuestion, pattern, id);
  const visibleResult = await result.innerText();
  assert.doesNotMatch(visibleResult, /незач[её]т|аргумент засчитан|цитата (?:верна|подлинна)|ты списал/iu);
  if (id === 'card-does-not-finish-essay') {
    assert.doesNotMatch(visibleResult, /к этому выводу|готовый вывод|Яков/iu);
  }

  // Every offered passage must remain a continuous, exact quote from the student's own draft.
  if (expected[id].passage) {
    assert.notEqual(originalPassage, '', id);
    assert.match(await evidence.innerText(), expected[id].passage, id);
  } else {
    assert.equal(originalPassage, '', id);
    assert.equal(await evidence.textContent(), '');
  }
  const choices = await picker.locator('option').evaluateAll(nodes => nodes.map(n => n.value).filter(Boolean));
  assert.ok(choices.length, id);
  const seen = [];
  for (const choice of choices) {
    await picker.selectOption(choice);
    const excerpt = await evidence.textContent();
    assert.ok(excerpt && essay.includes(excerpt), id + ': ' + excerpt);
    assert.ok(!seen.includes(excerpt), id + ': changing the selection must change the quoted passage');
    seen.push(excerpt);
    if (id === 'citation-to-verify' && choice !== originalPassage) {
      assert.notEqual(await question.innerText(), originalQuestion, 'Re-selecting a passage must refresh its question');
    }
  }
  assert.equal(seen.join(' '), essay.replace(/\s+/gu, ' ').trim(), id + ': every full sentence must be selectable');
  assert.equal(await page.locator('#essay').inputValue(), essay);
  if (cardIds.length) {
    await page.locator('#book-shelf > summary').click();
    await page.locator('#shelf-clear').click();
    await page.locator('#local-check').click();
    assert.equal(await picker.inputValue(), originalPassage, id);
    assert.equal(await question.innerText(), originalQuestion, id + ': shelf selection is not student evidence');
  }
}

async function checkLocalReadingCases(browser) {
  assert.deepEqual(fixture.cases.map(c => c.id).sort(), Object.keys(expected).sort());
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'uzel-essay-review-'));
  try {
    const archive = path.join(dist, 'proverka-gigachat.zip');
    execFileSync('python3', ['-c', 'import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extract("essay-check.html", sys.argv[2])', archive, temp]);
    const versions = [
      ['site', new URL(route + '/proverka-sochineniya.html', base)],
      ['family ZIP', pathToFileURL(path.join(temp, 'essay-check.html'))]
    ];
    for (const [label, url] of versions) {
      for (const entry of fixture.cases) {
        const page = await browser.newPage();
        const unexpected = [];
        page.setDefaultTimeout(5000);
        await page.route(/^https?:/, route => {
          const request = route.request();
          const target = new URL(request.url());
          if (url.origin === target.origin && request.method() === 'GET') {
            if (target.pathname === '/api/status') return route.fulfill({status:404, body:''});
            return route.continue();
          }
          unexpected.push(request.method() + ' ' + target.pathname);
          return route.abort();
        });
        try {
          await checkCase(page, url.href, entry);
          assert.deepEqual(unexpected, [], 'Unexpected network access');
        } catch (error) {
          throw new Error(label + ' / ' + entry.id + ': ' + error.message, {cause:error});
        } finally {
          await page.close();
        }
      }
    }
    console.log('All seven original reading cases passed on the site and in the offline family ZIP.');
  } finally {
    await fs.rm(temp, {recursive:true, force:true});
  }
}

module.exports = {checkLocalReadingCases};
