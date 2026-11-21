'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

async function exercise(browser, url, offline) {
  const context = await browser.newContext({viewport:{width:360,height:800}, offline});
  const page = await context.newPage();
  try {
    const errors = [];
    const external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const dest = new URL(request.url());
      if (['http:', 'https:'].includes(dest.protocol) && dest.origin !== new URL(url).origin) external.push(dest.href);
    });
    await page.goto(url + '#mysl');
    const lens = page.locator('#homeReadingLens');
    const hint = page.locator('#readingHint');
    const step = n => page.locator('[data-home-step="'+n+'"]').click();
    assert.equal(await lens.inputValue(), 'secular');
    const initialHint = await hint.textContent();
    await page.locator('#thought').fill('Забота видна в поступке.');
    await lens.selectOption('orthodox');
    assert.notEqual(await hint.textContent(), initialHint);
    assert.equal(await page.locator('#thought').inputValue(), 'Забота видна в поступке.');
    await step(2);
    await page.locator('#episode').fill('Доктор приходит к больному ребёнку.');
    await step(3);
    assert.match(await hint.textContent(), /Доктор|доктора/u);
    assert.match(await hint.textContent(), /милосерди/u);
    await lens.selectOption('secular');
    const literaryHint = await hint.textContent();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('uzel-reading-lens', {detail:{mode:'orthodox'}})));
    assert.equal(await lens.inputValue(), 'orthodox');
    assert.notEqual(await hint.textContent(), literaryHint);
    await page.locator('#modePaste').click();
    await page.locator('#customTopic').fill('Как проявляется забота?');
    const essay = 'Доктор сам идёт к больной девочке.';
    await page.locator('#essay').fill(essay);
    await page.locator('[data-ai-transfer] summary').click();
    const message = page.locator('[data-ai-prompt]');
    await message.focus();
    assert.match(await message.inputValue(), /Ракурс чтения — православный/);
    assert.ok((await message.inputValue()).endsWith(essay));
    await lens.selectOption('secular');
    assert.match(await message.inputValue(), /Ракурс чтения — общелитературный/);
    assert.equal(await page.locator('#essay').inputValue(), essay);
    await lens.selectOption('orthodox');
    await page.reload();
    assert.equal(await lens.inputValue(), 'orthodox');
    assert.equal(await page.locator('#essay').inputValue(), essay);
    const guide = page.locator('#homeGuide');
    await guide.locator('summary').click();
    await page.locator('#homeSituation').fill('Помню сцену, хочу объяснить свой выбор.');
    const navMessage = page.locator('#homeNavMessage');
    const text = await navMessage.inputValue();
    assert.match(text, /Выбранный ракурс — православный/);
    assert.match(text, /3\. Объяснить связь эпизода/);
    assert.match(text, /Помню сцену/);
    assert.ok(!text.includes(essay), 'The navigation message must contain only the pupil’s situation, available steps and lens.');
    await lens.selectOption('secular');
    assert.match(await navMessage.inputValue(), /Выбранный ракурс — общелитературный/);
    await page.locator('#homeDestination').selectOption('3');
    await page.locator('#openHomeDestination').click();
    await page.locator('#linkText').waitFor();
    assert.equal(await guide.evaluate(node => node.open), false);
    await page.goto(url+'#redaktor');
    await page.getByRole('heading', {name:'Прочитай сочинение целиком'}).waitFor();
    assert.match(await page.locator('#essay').inputValue(), /Забота видна/);
    await page.goto(url+'#proverka');
    await page.getByRole('heading', {name:'Проверить своё сочинение'}).waitFor();
    assert.equal(await page.locator('#essay').inputValue(), essay);
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}

module.exports = async function checkHomeLens(browser, base) {
  const relative = 'k-sochineniyu/itogovoe/pomoshchnik/domashniy-trenazher.html';
  await exercise(browser, new URL(relative, base).href, false);
  await exercise(browser, pathToFileURL(path.join(__dirname, '..', 'dist', relative)).href, true);
};
