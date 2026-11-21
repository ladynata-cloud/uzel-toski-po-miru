'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

const storageKey = 'uzel.essay-workshop.v1';
const topic = 'Почему важно сообщать о своих действиях?';
const oldThesis = 'Старый тезис из отдельного поля.';
const position = 'Хорошего намерения не всегда достаточно.';
const detail = 'Сосед переставил коробку, но хозяин искал её на прежнем месте.';
const conclusion = 'Помощь становится полезнее, когда человек понимает, что изменилось.';
const draft = '\n' + position + '\n\n' + detail + ' ' + conclusion + ' ' + detail +
  '\n\nПоэтому о перемещённой вещи стоит сказать.';
const positionStart = draft.indexOf(position);
const conclusionStart = draft.indexOf(conclusion);
const secondDetail = draft.lastIndexOf(detail);

function controls(page) {
  const panel = page.locator('#ew-current');
  const source = panel.locator('#ew-evidence-draft');
  const editor = panel.locator('#ew-write-draft');
  const role = panel.locator('#ew-evidence-kind');
  const comparison = panel.locator('[data-evidence-comparison]');
  const button = name => panel.locator('[data-act="' + name + '"]');
  const quote = key => comparison.locator('[data-comparison-quote="' + key + '"]');
  const state = key => comparison.locator('[data-comparison-state="' + key + '"]');
  async function mark(key, start, end) {
    await role.selectOption(key);
    await source.evaluate((el, range) => { el.focus(); el.setSelectionRange(...range); }, [start, end]);
    await button('evidence-mark').click();
  }
  async function continued() {
    await button('evidence-compare-continue').focus();
    await page.keyboard.press('Enter');
    assert.ok(await panel.locator('[data-check]').first().evaluate(el => el === document.activeElement),
      'Continue focuses the existing checklist without requiring either mark or a written explanation');
    assert.ok(await source.isVisible(), 'Continue must stay on the self-check page');
  }
  const selection = element => element.evaluate(el => [el === document.activeElement, el.selectionStart, el.selectionEnd]);
  return {panel, source, editor, role, comparison, button, quote, state, mark, continued, selection};
}

async function checkComparison(page, url, {extended = false} = {}) {
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  try {
    await page.goto(url);
    // A pre-feature save has a manually marked answer, but no conclusion property.
    await page.evaluate(({storageKey, topic, oldThesis, draft, position, positionStart}) => {
      localStorage.setItem(storageKey, JSON.stringify({
        version:1, mode:'secular', page:'review', route:'edit', active:'finished-essay',
        custom:[{id:'finished-essay', title:topic, ownEssayTopic:topic, work:'own'}], exercises:{},
        notes:{'finished-essay':{
          work:'', own:'', thesis:oldThesis, args:{}, draft, checks:{}, turns:{}, before:null,
          evidence:{position:{start:positionStart, end:positionStart + position.length, quote:position}},
        }},
      }));
    }, {storageKey, topic, oldThesis, draft, position, positionStart});
    await page.reload();
    const c = controls(page);
    const assertQuote = async (key, text) => assert.equal(await c.quote(key).textContent(), '«' + text + '»');
    await c.comparison.waitFor();
    assert.equal(await c.comparison.getByRole('heading', {name:'Мой ответ на тему и мой вывод'}).count(), 1);
    assert.ok((await c.comparison.innerText()).includes(topic));
    assert.ok(!(await c.comparison.innerText()).includes(oldThesis), 'Only the pupil’s selected answer is compared');
    await assertQuote('position', position);
    assert.equal(await c.quote('conclusion').count(), 0);
    assert.match(await c.state('conclusion').textContent(), /пока не отмечена/u);
    await c.continued();
    await c.button('evidence-compare-edit').click();
    assert.deepEqual(await c.selection(c.editor), [true, positionStart, positionStart + position.length],
      'With no conclusion, edit opens the current answer');
    await c.button('page-review').click();

    // The conclusion is deliberately in the middle, with text after it in the same paragraph.
    await c.mark('conclusion', conclusionStart, conclusionStart + conclusion.length);
    await assertQuote('conclusion', conclusion);
    assert.match(await c.comparison.innerText(), /Что в твоём рассуждении привело к этому выводу\? Как он связан с ответом на тему\?/u);
    assert.equal(await c.comparison.locator('textarea,input,[data-score],[data-verdict]').count(), 0);
    for (const mode of ['orthodox', 'secular']) {
      await page.locator('#ew-mode').selectOption(mode);
      await assertQuote('position', position);
      await assertQuote('conclusion', conclusion);
      assert.equal(await c.source.inputValue(), draft);
    }
    await page.reload();
    await assertQuote('conclusion', conclusion);

    const neutralCopy = () => c.comparison.evaluate(el => {
      const copy = el.cloneNode(true);
      copy.querySelectorAll('[data-comparison-quote]').forEach(quote => quote.remove());
      return copy.textContent.replace(/\s+/g, ' ').trim();
    });
    const expectedCopy = await neutralCopy();
    if (extended) {
      const trace = async phase => {
        const state = await c.source.evaluate(el => ({
          focus:document.activeElement?.id || document.activeElement?.dataset.act || '',
          start:el.selectionStart, end:el.selectionEnd,
          status:document.querySelector('#ew-evidence-status')?.textContent || '',
        }));
        console.log('Essay conclusion keyboard probe', JSON.stringify({phase, ...state}));
        return state;
      };
      const extend = async phase => {
        for (let i = 0; i < position.length; i++) await page.keyboard.press('Shift+ArrowRight');
        const selected = await trace(phase);
        await page.keyboard.press('Tab');
        await trace(phase + ':tab-to-mark');
        const markFocused = await c.button('evidence-mark').evaluate(el => el === document.activeElement);
        if (selected.start === positionStart && selected.end === positionStart + position.length && markFocused) {
          await page.keyboard.press('Enter');
          console.log('Essay conclusion keyboard probe', JSON.stringify({
            phase:phase + ':marked', matches:(await c.quote('conclusion').textContent()) === '«' + position + '»',
            status:await c.panel.locator('#ew-evidence-status').textContent(),
          }));
          await c.mark('conclusion', conclusionStart, conclusionStart + conclusion.length);
        } else {
          await page.keyboard.press('Shift+Tab');
        }
        return selected;
      };
      const fromHome = async phase => {
        await page.keyboard.press('ControlOrMeta+Home');
        await trace(phase + ':home');
        await page.keyboard.press('ArrowRight');
        await trace(phase + ':right');
        return extend(phase + ':extended');
      };
      await c.role.focus();
      await page.keyboard.press('End');
      await page.keyboard.press('Tab');
      await trace('tab:focused');
      const first = await fromHome('tab');
      if (first.start !== positionStart || first.end !== positionStart + position.length) {
        await page.keyboard.press('ControlOrMeta+A');
        await trace('all:selected');
        await page.keyboard.press('ArrowLeft');
        await trace('all:left');
        await page.keyboard.press('ArrowRight');
        await trace('all:right');
        await extend('all:extended');
      }
      await c.button('evidence-reselect-conclusion').focus();
      await page.keyboard.press('Enter');
      await trace('reselect:focused');
      await fromHome('reselect');
      assert.equal(await c.source.inputValue(), draft, 'The keyboard probe must preserve the draft');
      await c.role.focus();
      await page.keyboard.press('End');
      await page.keyboard.press('Tab');
      await page.keyboard.press('ControlOrMeta+A');
      await trace('restored:all');
    }
    // Verify native select-all and preserve the range while tabbing to the mark button.
    // This covers keyboard marking, not arbitrary substring selection with arrow keys.
    await c.role.focus();
    await page.keyboard.press('End');
    assert.equal(await c.role.inputValue(), 'conclusion');
    await page.keyboard.press('Tab');
    await page.keyboard.press('ControlOrMeta+A');
    assert.deepEqual(await c.selection(c.source), [true, 0, draft.length]);
    await page.keyboard.press('Tab');
    assert.ok(await c.button('evidence-mark').evaluate(el => el === document.activeElement));
    assert.deepEqual(await c.selection(c.source), [false, 0, draft.length],
      'The keyboard-selected range must survive focus moving to the mark button');
    await page.keyboard.press('Enter');
    assert.match(await c.panel.locator('#ew-evidence-status').textContent(), /Отметка «Мой вывод из рассуждения» добавлена/u);
    await assertQuote('conclusion', draft.trim());
    assert.equal(await neutralCopy(), expectedCopy, 'A keyboard-selected range must not produce a quality verdict');
    // Both roles may also refer to the exact same phrase.
    await c.mark('conclusion', positionStart, positionStart + position.length);
    await assertQuote('conclusion', position);
    assert.equal(await neutralCopy(), expectedCopy, 'Identical words must not produce a quality verdict');
    for (const [start, end] of [
      [positionStart + 2, positionStart + position.length], // Overlap is not an error.
      [draft.indexOf(detail), draft.indexOf(detail) + position.length], // Different words, equal length.
    ]) {
      await c.mark('conclusion', start, end);
      await assertQuote('conclusion', draft.slice(start, end).trim());
      assert.equal(await neutralCopy(), expectedCopy, 'Overlap, length and word differences must not grade an essay');
    }
    await c.mark('conclusion', secondDetail, secondDetail + detail.length);
    await c.button('evidence-reselect-conclusion').click();
    assert.deepEqual(await c.selection(c.source), [true, secondDetail, secondDetail + detail.length]);
    await c.button('evidence-compare-edit').click();
    assert.deepEqual(await c.selection(c.editor), [true, secondDetail, secondDetail + detail.length],
      'Edit must use the selected second occurrence, not the first matching string');
    assert.equal(await c.editor.inputValue(), draft, 'Comparison must not rewrite the essay');
    const revised = draft + '\nЕщё одна мысль за пределами обеих отметок.';
    await c.editor.fill(revised);
    await c.button('page-review').click();
    for (const key of ['position', 'conclusion']) {
      assert.equal(await c.quote(key).count(), 0);
      assert.match(await c.state(key).textContent(), /Отметь фразу заново/u,
        'Every draft edit invalidates old marks, even if both quoted strings still exist');
    }
    await c.button('evidence-reselect-conclusion').click();
    assert.equal(await c.role.inputValue(), 'conclusion');
    assert.deepEqual(await c.selection(c.source), [true, 0, 0], 'Stale marks must not relocate automatically');
    await c.mark('conclusion', secondDetail, secondDetail + detail.length);
    await c.button('evidence-remove-conclusion').click();
    assert.equal(await c.quote('conclusion').count(), 0);
    assert.ok(await c.button('evidence-reselect-conclusion').evaluate(el => el === document.activeElement),
      'Removing a mark keeps keyboard focus on its replacement action');
    await c.role.selectOption('conclusion');
    await c.button('evidence-missing').click();
    assert.match(await c.state('conclusion').textContent(), /Пока не нашёл/u);
    await c.continued();
    assert.equal(await c.source.inputValue(), revised);

    if (extended) {
      await c.mark('position', positionStart, positionStart + position.length);
      await c.mark('conclusion', secondDetail, secondDetail + detail.length);
      await c.button('evidence-compare-edit').click();
      const changed = revised.slice(0, secondDetail) + 'Сосед изменил своё решение.' + revised.slice(secondDetail + detail.length);
      await c.editor.fill(changed);
      const newTopic = 'Как учитывать чужую точку зрения?';
      await page.locator('#ew-finished-topic').fill(newTopic);
      await c.button('page-review').click();
      assert.ok((await c.comparison.innerText()).includes(newTopic));
      assert.ok(!(await c.comparison.innerText()).includes(oldThesis));
      assert.equal(await c.quote('conclusion').count(), 0,
        'Editing the selected occurrence must not reuse the untouched first occurrence');
      await c.button('evidence-reselect-conclusion').click();
      assert.deepEqual(await c.selection(c.source), [true, 0, 0]);
      const firstDetail = changed.indexOf(detail);
      await c.mark('conclusion', firstDetail, firstDetail + detail.length);
      await c.button('evidence-compare-edit').click();
      assert.deepEqual(await c.selection(c.editor), [true, firstDetail, firstDetail + detail.length]);
      await c.button('page-review').click();
      for (const key of ['position', 'conclusion']) await c.button('evidence-remove-' + key).click();
      await c.continued();
      await c.button('evidence-compare-edit').click();
      assert.deepEqual(await c.selection(c.editor), [true, changed.length, changed.length],
        'With neither mark, edit still opens the pupil’s unchanged draft');
      assert.equal(await c.editor.inputValue(), changed);
      await c.button('page-review').click();
    }
    const overflow = await c.comparison.evaluate(root => [...root.querySelectorAll('button,summary')].filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width && (rect.left < -1 || rect.right > innerWidth + 1);
    }).map(el => el.textContent.trim()));
    assert.deepEqual(overflow, [], 'Comparison controls must fit the viewport');
    assert.deepEqual(errors, []);
  } finally { page.off('pageerror', onError); }
}

async function checkStorageFailure(browser, url) {
  const page = await browser.newPage({viewport:{width:390, height:844}, acceptDownloads:true});
  page.setDefaultTimeout(6500);
  try {
    await page.addInitScript(key => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(name, value) {
        if (name === key) throw new DOMException('Storage unavailable', 'QuotaExceededError');
        return setItem.call(this, name, value);
      };
    }, storageKey);
    await page.goto(url);
    await page.locator('#ew-situations [data-entry-situation="essay"]').click();
    await page.locator('#ew-finished-topic').fill(topic);
    const c = controls(page);
    await c.editor.fill(draft);
    await c.button('page-review').click();
    await c.mark('position', positionStart, positionStart + position.length);
    await c.mark('conclusion', conclusionStart, conclusionStart + conclusion.length);
    assert.equal(await c.quote('conclusion').textContent(), '«' + conclusion + '»');
    await c.continued();
    assert.match(await page.locator('#ew-save').textContent(), /только на экране.*Скачай/u,
      'A failed save must not claim that the work was persisted');
    const [download] = await Promise.all([page.waitForEvent('download'), c.button('download').click()]);
    assert.equal(download.suggestedFilename(), 'moe-sochinenie.txt');
    const text = await fs.readFile(await download.path(), 'utf8');
    assert.ok(text.includes(topic));
    assert.ok(text.includes(draft), 'TXT must preserve the complete essay when browser storage is denied');
    assert.equal(await c.source.inputValue(), draft);
  } finally { await page.close(); }
}

module.exports = {checkComparison, checkStorageFailure};
