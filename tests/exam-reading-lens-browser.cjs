'use strict';
const assert = require('node:assert/strict');
const {chromium} = require('playwright');

(async () => {
  const browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  try {
    const page = await browser.newPage();
    const base = process.env.READER_BASE_URL || 'http://127.0.0.1:8074';
    const routes = ['sobesedovanie','oge-russkiy','oge-literatura','itogovoe','ege-russkiy','ege-literatura'];
    for (const slug of routes) {
      const url = new URL('/k-sochineniyu/'+slug+'/',base);
      await page.goto(url.href);
      const picker = page.locator('[data-reading-lens-picker]');
      const choice = page.locator('#writing-mode');
      const question = page.locator('#practice [data-exam-lens-task]:visible [data-reading-lens-only]:visible');
      await picker.selectOption('secular');
      assert.equal(await page.locator('#lens h2:visible').textContent(),'Как обосновать своё прочтение');
      const draft = 'Свой пример для '+slug;
      await page.locator('#draft').fill(draft);
      if (slug === 'sobesedovanie') await page.locator('[data-timer-toggle]').click();
      for (let index=0; index<8; index++) {
        await choice.selectOption(String(index));
        const literal = await question.textContent();
        await picker.selectOption('orthodox');
        assert.notEqual(await question.textContent(),literal);
        assert.equal(await question.getAttribute('data-reading-lens-only'),'orthodox');
        if (index < 7) {
          const task = index === 6 ? '#final-training' : '#lesson-'+(index+1)+' .prompt-box';
          assert.equal(await question.textContent(),await page.locator(task+' [data-reading-lens-only="orthodox"]').textContent());
        }
        assert.equal(await page.locator('#draft').inputValue(),draft);
        await picker.selectOption('secular');
      }
      if (slug === 'sobesedovanie') assert.equal(await page.locator('[data-timer-toggle]').textContent(),'Пауза');
      await page.locator('[data-save-draft]').click();
      await page.reload();
      assert.equal(await choice.inputValue(),'7');
      assert.equal(await page.locator('#draft').inputValue(),draft);
      assert.equal(await question.getAttribute('data-reading-lens-only'),'secular');
      await page.locator('#lesson-1 [data-exam-open]').click();
      assert.equal(await choice.inputValue(),'0');
      assert.equal(await question.textContent(),await page.locator('#lesson-1 .prompt-box [data-reading-lens-only="secular"]').textContent());
    }
    console.log('All six exam routes passed both lenses on eight tasks, draft restore, lesson navigation and the oral timer.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
