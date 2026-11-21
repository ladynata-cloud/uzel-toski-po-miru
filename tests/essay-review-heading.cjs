'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

const file = process.argv[2] || path.join(__dirname,
  '../dist/k-sochineniyu/itogovoe/pomoshchnik/proverka-sochineniya.html');
const url = pathToFileURL(path.resolve(file)).href;
const theme = 'Почему важно слушать?';
const body = 'Слушать ' + 'слово '.repeat(248).trimEnd() + '.';
const headed = theme + '\n\n' + body;

async function check() {
  const browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  try {
    const page = await browser.newPage({offline:true, viewport:{width:390,height:844}});
    await page.goto(url);
    await page.locator('#topic').fill(theme);
    await page.locator('#essay').fill(headed);
    const mark=page.locator('#exclude-heading'), count=page.locator('#count');
    assert.ok(await page.locator('#heading-match').isVisible());
    assert.ok(!(await mark.isChecked()));
    assert.match(await count.innerText(), /252/u);
    await mark.check();
    assert.match(await count.innerText(), /249/u);
    await page.locator('#local-check').click();
    const result=page.locator('#local-result');
    assert.match(await result.innerText(), /249 сл\./u);
    assert.ok(!(await result.innerText()).includes('Первое предложение повторяет тему'));
    assert.ok((await result.locator('blockquote').first().innerText()).startsWith('Слушать слово'));
    const packet={topic:theme,essay:headed,mode:'secular'};
    assert.deepEqual(JSON.parse(await page.locator('#preview').textContent()), packet);
    await page.locator('#online > summary').click();
    assert.equal(await page.locator('#manual-text').textContent(), '');
    await page.locator('#consent').check();
    assert.equal(await page.locator('#manual-actions').isVisible(), false);
    await page.locator('#consent-privacy').check();
    assert.ok((await page.locator('#manual-text').textContent()).endsWith(JSON.stringify(packet,null,2)));
    await page.reload();
    assert.ok(await mark.isChecked());
    assert.equal(await page.locator('#consent').isChecked(), false);
    assert.equal(await page.locator('#consent-privacy').isChecked(), false);
    assert.equal(await page.locator('#essay').inputValue(),headed);
    await page.locator('#draft-transfer > summary').click();
    const saving=page.waitForEvent('download');
    await page.locator('#transfer-save').click();
    const download=await saving;
    const transferred=await fs.readFile(await download.path(),'utf8');
    assert.deepEqual(JSON.parse(transferred), {format:'uzel-essay-review.1',...packet,draftHeading:theme});

    const other=await browser.newPage({offline:true});
    await other.goto(url);
    await other.locator('#transfer-file').setInputFiles({name:'работа.json',mimeType:'application/json',buffer:Buffer.from(transferred)});
    await other.waitForFunction(() => document.getElementById('exclude-heading').checked);
    assert.equal(await other.locator('#essay').inputValue(),headed);
    assert.match(await other.locator('#count').innerText(), /249/u);
    // Replacing the first line with an introductory paragraph makes every word count.
    await other.locator('#essay').fill(theme+' '+body);
    assert.ok(!(await other.locator('#exclude-heading').isChecked()));
    assert.ok(!(await other.locator('#heading-options').isVisible()));
    assert.match(await other.locator('#count').innerText(), /252/u);
    // Old files carry no mark. An opening question on its own line still belongs to the essay
    // when the author chooses to leave it there.
    const legacy=await browser.newPage({offline:true});
    await legacy.goto(url);
    const old={format:'uzel-essay-review.1',...packet};
    await legacy.locator('#transfer-file').setInputFiles({name:'старая-работа.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))});
    await legacy.waitForFunction(value=>document.getElementById('essay').value===value, headed);
    assert.ok(!(await legacy.locator('#exclude-heading').isChecked()));
    assert.match(await legacy.locator('#count').innerText(), /252/u);
    await legacy.locator('#exclude-heading').check();
    await legacy.locator('#essay').fill(headed+' раз');
    assert.match(await legacy.locator('#count').innerText(), /250/u);
    console.log('Heading checked across the 249/250 boundary, opening paragraphs, reload, raw submission and portable files.');
  } finally {
    await browser.close();
  }
}
check().catch(error=>{console.error(error);process.exitCode=1;});
