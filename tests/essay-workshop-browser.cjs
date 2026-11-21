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
  const feedback = panel.locator('[data-answer-result]');
  const observationText = () => feedback.locator('[data-answer-observation]').innerText();
  const assertFeedback = async () => {
    assert.ok((await observationText()).trim(), 'The check must give an observation about this answer');
    assert.ok((await feedback.locator('[data-answer-next]').innerText()).trim(), 'The check must give a next revision step');
  };
  const start = () => page.locator('#ew-steps [data-act="page-start"]').click();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  const [response] = await Promise.all([
    page.waitForResponse(result => result.url() === url && result.request().isNavigationRequest()),
    page.locator('a[href$="/k-sochineniyu/itogovoe/pomoshchnik/"]').first().click(),
  ]);
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
  await page.getByRole('link',{name:'Начать с одной фразы'}).click();
  const skill = page.locator('#wp-skill'), exercise = page.locator('#wp-exercise');
  const writing = page.locator('#wp-response'), hint = page.locator('#wp-self-check');
  await skill.selectOption('motive');
  await exercise.selectOption('U02');
  const motive = 'Доктор наверняка боялся огласки.';
  const personalRevision = 'Доктор не назвал себя в коридоре. Я могу лишь предположить, почему он так ответил.';
  await writing.fill(motive);
  await page.locator('#wp-compare').click();
  assert.match(await hint.innerText(), /основание написать «наверняка»/u);
  await page.locator('#wp-revise').click();
  await writing.fill(personalRevision);
  await page.locator('#wp-compare').click();
  assert.equal(await page.locator('#wp-before').textContent(), motive);
  assert.equal(await page.locator('#wp-after').textContent(), personalRevision);
  assert.match(await hint.innerText(), /предположение о его мотиве/u);
  for (const qualified of ['Он точно не хотел огласки.', 'Я не думаю, что он наверняка боялся огласки.']) {
    await writing.fill(qualified);
    await page.locator('#wp-compare').click();
    assert.doesNotMatch(await hint.innerText(), /основание написать/u);
  }
  await skill.selectOption('quote');
  await exercise.selectOption('U03');
  await writing.fill('По памяти я записал «Я вас поблагодарю».');
  await page.locator('#wp-compare').click();
  assert.match(await hint.innerText(), /ты можешь подтвердить по книге/u);
  await writing.fill('Я передаю содержание реплики своими словами.');
  await page.locator('#wp-compare').click();
  assert.match(await page.locator('#wp-before').textContent(), /По памяти/u);
  assert.doesNotMatch(await hint.innerText(), /подтвердить по книге/u);
  await skill.selectOption('retell');
  await exercise.selectOption('U01');
  await writing.fill('Сначала доктор пришёл, потом осмотрел девочку и ушёл.');
  await page.locator('#wp-compare').click();
  assert.match(await hint.innerText(), /достоинства Мерцалова/u);
  await start();
  await action('route-read');
  await action('reading-apply');
  assert.ok((await panel.locator('#ew-reading-status').textContent()).trim(), 'An empty reading note needs guidance');
  const reading = panel.locator('#ew-reading');
  const selectedReading = await reading.inputValue();
  const observation = 'Мне запомнился жест героя.';
  await field('reading').fill(observation);
  await action('answer-check');
  await assertFeedback();
  await reading.selectOption({index:1});
  assert.equal(await field('reading').inputValue(), '');
  assert.ok(!(await feedback.innerText()).includes(observation), 'Another reading must not show this answer');
  await reading.selectOption(selectedReading);
  assert.equal(await field('reading').inputValue(), observation);
  const catalog = JSON.parse(await page.locator('#ew-catalog').textContent());
  const lesson = catalog.readings.find(r => r.id === selectedReading);
  const work = catalog.works.find(w => w.id === selectedReading);
  const passage = panel.locator('[data-reading-kind="excerpt"]');
  const sourceLink = passage.getByRole('link',{name:'К источнику',exact:true});
  assert.equal(await sourceLink.getAttribute('href'), work.url);
  assert.equal(await passage.locator('[data-reading-quote]').textContent(), '«'+lesson.quote+'»');
  const readCard = await passage.textContent();
  assert.ok(await panel.getByText(lesson.secular, {exact:true}).isVisible());
  await page.locator('#ew-mode').selectOption('orthodox');
  assert.ok(await panel.getByText(lesson.orthodox, {exact:true}).isVisible());
  assert.equal(await panel.getByText(lesson.secular, {exact:true}).count(), 0, 'The reading question changes with the perspective');
  assert.equal(await passage.textContent(), readCard, 'Both perspectives use the same passage');
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
  const guidance=panel.getByText('Тренажёр подсказывает, что можно уточнить. Смысл ответа и факты сверяй с произведением.',{exact:true});
  assert.ok(await guidance.isVisible(), 'Explain the scope before the first check');
  const outgoing = [];
  const recordRequest = request => outgoing.push(request.url());
  page.on('request', recordRequest);
  await action('answer-check');
  assert.ok(await field('thesis').evaluate(el=>el===document.activeElement), 'An empty answer returns focus to the writer');
  await field('thesis').fill(topic);
  await action('answer-check');
  await assertFeedback();
  const firstObservation = await observationText();
  await action('answer-check');
  assert.equal(await feedback.locator('[data-answer-before]:visible').count(), 0, 'Rechecking unchanged text must not simulate a revision');
  await field('thesis').fill(thesis);
  assert.ok(await feedback.locator('[data-answer-stale]').isVisible(), 'Writing a revision invalidates the earlier feedback');
  await action('answer-check');
  await assertFeedback();
  assert.notEqual(await observationText(), firstObservation, 'A copied question and a proposed thesis need different observations');
  assert.ok((await feedback.locator('[data-answer-before]').textContent()).includes(topic));
  assert.ok((await feedback.locator('[data-answer-after]').textContent()).includes(thesis));
  assert.ok(await guidance.isVisible(), 'Keep the same guidance next to the comparison');
  page.off('request', recordRequest);
  assert.deepEqual(outgoing, [], 'Checking and revising the thesis works without an outgoing request');
  const step = name => page.locator('#ew-steps [data-act="page-'+name+'"]').click();
  const topics = panel.locator('#ew-topic');
  await step('topic');
  await topics.selectOption({index:0});
  await action('forward-topic');
  assert.ok(!(await panel.innerText()).includes(thesis), 'The previous topic’s words must not appear on a different thesis screen');
  await step('topic');
  await topics.selectOption({label:topic});
  await action('forward-topic');
  assert.equal(await field('thesis').inputValue(), thesis);
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
  await action('answer-check');
  await assertFeedback();
  await action('page-link');
  await field('link').fill(link);
  await action('answer-check');
  await assertFeedback();
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
  const privateQuestion = 'Мой личный вопрос: почему этот момент важен для меня?';
  await field('draft').fill(original);
  await action('answer-check');
  await assertFeedback();
  await fits();
  assert.match(await panel.locator('#ew-count').textContent(), /\b3 сл\./u, 'Draft word count follows live input');
  await action('page-review');
  assert.equal(await panel.locator('[data-check]').count(), 6, 'Full review offers its checklist');

  await start();
  await action('route-edit');
  await action('forward-topic');
  assert.equal(await field('draft').inputValue(), original, 'Edit route must reopen the same draft');
  await panel.getByText('Мой вопрос к эпизоду',{exact:true}).click();
  await field('readerQuestion').fill(privateQuestion);
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
  for (const value of [topic, book, thesis, episode, link, revised, 'До правки\n'+original, privateQuestion, 'православный']) {
    assert.ok(saved.includes(value), 'Export is missing ' + value);
  }
  await panel.getByText('Продолжить с диалоговым ИИ-помощником', {exact:true}).click();
  const preview = panel.locator('#ew-packet-preview');
  const includeBefore = panel.locator('#ew-share-before');
  assert.equal(await includeBefore.isChecked(), false, 'First version is opt-in');
  const currentOnly = await preview.inputValue();
  const packet = await download('download-prompt', 'zadanie-pomoshchniku.txt');
  assert.equal(packet, currentOnly, 'The exported UTF-8 text matches the complete preview');
  for (const value of [topic, book, thesis, episode, link, revised]) assert.ok(packet.includes(value));
  assert.ok(!packet.includes('До правки\n'+original) && !packet.includes(privateQuestion));
  await includeBefore.check();
  const bothVersions = await preview.inputValue();
  assert.ok(bothVersions.includes('До правки\n'+original) && !bothVersions.includes(privateQuestion));
  assert.equal(await download('download-prompt','zadanie-pomoshchniku.txt'), bothVersions);
  assert.equal(await includeBefore.isChecked(), false, 'Opting into a previous version applies to one download');
  assert.equal(await preview.inputValue(), currentOnly);

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
  const drill = panel.locator('#ew-drill');
  const contrast = panel.locator('#ew-contrast-feedback');
  await drill.selectOption('thesis');
  await action('drill-contrast-0');
  assert.equal(await contrast.getAttribute('data-correct'), 'false', 'An unsuitable choice gets specific feedback');
  const explanation = await contrast.innerText();
  assert.ok(explanation.trim());
  await action('drill-contrast-1');
  assert.equal(await contrast.getAttribute('data-correct'), 'true');
  assert.notEqual(await contrast.innerText(), explanation, 'The two choices need distinct explanations');
  assert.equal(await field('exercise').inputValue(), '', 'The comparison must leave the student to write their own answer');
  await field('exercise').fill('Моя редакция учебного фрагмента.');
  await action('drill-check');
  await assertFeedback();
  await drill.selectOption('observation');
  assert.equal(await field('exercise').inputValue(), '');
  assert.equal(await contrast.getAttribute('data-correct'), null, 'A fresh exercise must not inherit another choice');
  await drill.selectOption('thesis');
  assert.equal(await field('exercise').inputValue(), 'Моя редакция учебного фрагмента.');
  assert.equal(await contrast.getAttribute('data-correct'), 'true');

  await page.locator('#ew-steps [data-act="page-draft"]').click();
  await field('draft').fill('  ');
  await action('page-review');
  assert.equal(await panel.locator('[data-check], #ew-evidence-draft').count(), 0, 'An empty draft has no review controls');
  await panel.getByRole('button',{name:'Открыть мой черновик'}).click();
  assert.ok(await field('draft').evaluate(el=>el===document.activeElement));

  const position = 'Помощь требует времени.';
  const detail = 'Он вернулся.';
  const draft = '\n'+position+'\n'+detail+' '+detail+' Его поступок говорит о заботе.';
  const second = draft.lastIndexOf(detail);
  await field('draft').fill(draft);
  await action('page-review');
  const source = panel.locator('#ew-evidence-draft');
  const role = panel.locator('#ew-evidence-kind');
  const finding = key => panel.locator('[data-evidence-result="'+key+'"]');
  const select = (from,to) => source.evaluate((el,[a,b])=>{el.focus();el.setSelectionRange(a,b);},[from,to]);
  assert.equal(await source.inputValue(), draft, 'Review preserves leading newlines and selections');
  await action('evidence-mark');
  assert.equal(await panel.locator('[data-evidence-result]').count(), 0);
  assert.match(await panel.locator('#ew-evidence-status').textContent(), /выдели фразу/u);
  await select(0,position.length+2);
  await action('evidence-mark');
  assert.equal(await finding('position').locator('.ew-note').textContent(),'«'+position+'»');
  assert.equal(await role.inputValue(),'detail');
  await select(second,second+detail.length);
  await action('evidence-mark');
  assert.equal(await role.inputValue(),'reasoning');
  await action('evidence-missing');
  await page.reload();
  assert.equal(await finding('detail').locator('.ew-note').textContent(),'«'+detail+'»');
  assert.match(await finding('reasoning').textContent(),/Пока не нашёл/u);
  await fits();
  await action('evidence-edit-reasoning');
  const caret = () => field('draft').evaluate(el=>[el===document.activeElement,el.selectionStart,el.selectionEnd]);
  assert.deepEqual(await caret(),[true,second+detail.length,second+detail.length]);
  assert.match(await panel.locator('#ew-evidence-edit-hint').textContent(),/Свяжи/u);
  await action('page-review');
  await action('evidence-edit-detail');
  assert.deepEqual(await caret(),[true,second,second+detail.length], 'Edit the selected occurrence, even if the phrase is repeated');
  await field('draft').fill(draft+' Ещё одна мысль.');
  await action('page-review');
  assert.match(await finding('detail').textContent(),/Отметь фразу заново/u);
  assert.equal(await finding('detail').locator('.ew-note').count(),0, 'Previous selections need review after an edit');
  await role.selectOption('detail');
  await select(draft.indexOf(detail),draft.indexOf(detail)+detail.length);
  await action('evidence-mark');
  assert.equal(await finding('detail').locator('.ew-note').textContent(),'«'+detail+'»');

  const previousDraft = await source.inputValue();
  const rehearsal = name => panel.locator('[data-rehearsal="'+name+'"]').click();
  await start();
  await action('route-rehearsal');
  await panel.locator('#ew-r-time').selectOption('none');
  await panel.locator('[data-r-form="start"] button').click();
  const choices = panel.getByRole('radio');
  assert.equal(await choices.count(), 6);
  await choices.nth(1).click();
  const examTopic = await panel.locator('[data-r-title]').textContent();
  const examDraft = '\nГерой мог пройти мимо, но остановился и выслушал незнакомого человека.';
  await panel.locator('#ew-r-draft').fill(examDraft);
  assert.equal(await panel.locator('[data-act="answer-check"], [data-answer-result], [data-drill-contrast]').count(), 0, 'Independent writing must stay free of coaching');
  await fits();
  await page.reload();
  assert.equal(await panel.locator('#ew-r-draft').inputValue(), examDraft, 'Reload restores the exact independent draft');
  await rehearsal('finish');
  await rehearsal('confirm');
  await rehearsal('review');
  assert.equal(await panel.locator('#ew-title').textContent(), 'Самопроверка');
  assert.equal(await panel.locator('.ew-topic').textContent(), examTopic, 'Review shows the selected topic');
  assert.equal(await source.inputValue(), examDraft, 'First review opens a working copy of the submission');
  await action('page-draft');
  const editedCopy = examDraft+' Именно этот выбор я считаю проявлением заботы.';
  await field('draft').fill(editedCopy);
  await step('rehearsal');
  assert.equal(await panel.locator('.ew-note').textContent(), examDraft, 'The submitted version is still available');
  await rehearsal('review');
  assert.equal(await source.inputValue(), editedCopy, 'Returning to review retains edits to the copy');
  await step('topic');
  await panel.locator('#ew-topic').selectOption({label:topic});
  await step('draft');
  assert.equal(await field('draft').inputValue(), previousDraft, 'The earlier training draft is independent of the rehearsal');
  await page.goto(base);
  await page.goto(url+'#uprazhnenie-observation');
  assert.equal(await drill.inputValue(),'observation', 'The link shared with a pupil must open the named exercise');
  assert.ok(await panel.locator('[data-drill-contrast]').isVisible());
  await fits();

  const labField = key => panel.locator('[data-tl="'+key+'"]');
  const labButton = key => panel.locator('[data-tl-action="'+key+'"]');
  await step('topic');
  await topics.selectOption({index:0});
  await start();
  await action('route-thesisLab');
  await labButton('sample').click();
  assert.match(await labField('phrase').inputValue(),/добрым/u);
  outgoing.length = 0;
  page.on('request', recordRequest);
  await labField('word').fill('добрым');
  await labButton('next').click();
  const deed = 'Мерцалов находит деньги под блюдцем уже после ухода врача.';
  await labField('deed').fill(deed);
  await labButton('next').click();
  const meaning = 'Деньги остались под блюдцем.';
  await labField('meaning').fill(meaning);
  await labButton('compare').click();
  assert.equal(await labField('revision').inputValue(), meaning, 'Revision starts with the learner’s own explanation');
  const improved = 'Герои смогут принять помощь, сохранив достоинство. Благодарить при постороннем им не приходится.';
  await labField('revision').fill(improved);
  await labButton('next').click();
  assert.equal(await labField('transfer').inputValue(), '');
  assert.equal(await panel.locator('[data-tl-step="transfer"] details, [data-tl-step="transfer"] ol').count(), 0,
    'Model interpretations and the post-attempt rubric must not reveal answers in advance');
  assert.equal(await panel.locator('[data-tl-original-transfer], [data-tl-action="revise"], [data-answer-result], [data-act="answer-check"]').count(), 0,
    'The first independent response must precede revision and coaching');
  await fits();
  const independent = 'Лена села ближе. Сначала новичок молчал, а потом заговорил.';
  await labField('transfer').fill(independent);
  page.off('request', recordRequest);
  assert.deepEqual(outgoing, [], 'The lesson and first transfer writing work on the device');
  await page.reload();
  assert.equal(await labField('transfer').inputValue(), independent, 'An unfinished independent attempt can be resumed');
  await labButton('submit').click();
  assert.equal(await panel.locator('[data-tl-step="review"] ol li').count(), 3, 'The review distinguishes detail, meaning and their connection');
  const firstTransfer = panel.locator('[data-tl-original-transfer] .ew-note');
  assert.equal(await firstTransfer.textContent(), independent);
  await labButton('revise').click();
  assert.equal(await labField('after').inputValue(), independent);
  const alternativeReading = 'Лена могла хотеть лишь сесть поближе. То, что мальчик потом заговорил, ещё не раскрывает её намерения.';
  await labField('after').fill(alternativeReading);
  await fits();
  await step('topic');
  await topics.selectOption({label:topic});
  await page.goto(base);
  await page.goto(url+'#utochnit-tezis');
  assert.equal(await labField('phrase').inputValue(), thesis, 'A different topic starts from its own thesis');
  assert.equal(await firstTransfer.count(), 0, 'Earlier independent work stays with the original topic');
  await step('draft');
  assert.equal(await field('draft').inputValue(), previousDraft, 'The exercise must not change the pupil’s essay');
  await step('topic');
  await topics.selectOption({index:0});
  await start();
  await action('route-thesisLab');
  assert.equal(await firstTransfer.textContent(), independent, 'Revising an interpretation preserves the unaided first attempt');
  assert.equal(await labField('after').inputValue(), alternativeReading);

  await start();
  assert.equal(await panel.locator('.ew-entry-choices button').count(), 3);
  await page.locator('#ew-start-offer .ew-launch').click();
  await page.locator('#ot-temy-do-vyvoda').waitFor({state:'visible'});
  await page.locator('#ew-back-start').click();
  assert.ok(await panel.locator('.ew-entry-choices').isVisible());
  await action('route-read');
  await reading.selectOption(selectedReading);
  await action('shelf-capture');
  await action('page-shelf');
  const savedScene = panel.locator('[data-shelf-card]');
  assert.equal(await savedScene.locator('p.ew-note').textContent(), observation);
  await savedScene.getByText('Перечитать отрывок', {exact:true}).click();
  assert.ok((await savedScene.locator('blockquote').innerText()).trim());
  await action('page-paragraphTrial');
  const trial = panel.locator('[data-paragraph-trial]');
  const firstParagraph = 'Миша просит напечатать поправку. Он хочет, чтобы её увидели читатели газеты.';
  assert.equal(await trial.locator('details, [data-pt-first]').count(), 0);
  await trial.locator('[data-pt="draft"]').fill(firstParagraph);
  await trial.locator('[data-pt-action="submit"]').click();
  await trial.locator('[data-pt="notes"]').fill('Устной поправки у стенда было бы мало.');
  await page.reload();
  assert.equal(await trial.locator('[data-pt-first]').textContent(), firstParagraph);
  assert.equal(await trial.locator('[data-pt="draft"]').count(), 0);
  assert.ok(await trial.locator('summary').isVisible());

  await start();
  await action('route-draftReader');
  const markButton = key => panel.locator('[data-dr-action="'+key+'"]');
  const withConjunction = 'Герой вернулся, потому что забыл ключи.';
  await panel.locator('[data-dr-field="source"]').fill(withConjunction);
  await markButton('next').click();
  await markButton('missing-deed').click();
  await markButton('missing-idea').click();
  await markButton('next').click();
  const branches = panel.locator('[data-dr-field="branch"]');
  assert.equal(await branches.count(), 4);
  assert.equal(await panel.locator('[data-dr-field="branch"]:checked').count(), 0, 'A conjunction must not select the pupil’s revision task');
  await panel.locator('[data-dr-field="branch"][value="guess"]').check();
  await markButton('next').click();
  await panel.locator('[data-dr-field="revision"]').fill(withConjunction+' В тексте причина прямо не указана.');
  await markButton('finish').click();
  await markButton('trial').click();
  assert.equal(await trial.locator('[data-pt-first]').textContent(), firstParagraph, 'Both entries return to the same independent writing');
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
