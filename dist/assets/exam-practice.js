(() => {
  'use strict';
  const select = document.querySelector('.practice select');
  const area = document.querySelector('.practice textarea');
  if (new URLSearchParams(window.location.search).get('practice') === 'external') {
    const externalOption = select?.querySelector('[data-external-practice]');
    if (externalOption) {
      select.value = externalOption.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  document.querySelectorAll('[data-exam-open]').forEach(button => {
    button.addEventListener('click', () => {
      const value = button.dataset.examOpen;
      if (!select || !area || !Array.from(select.options).some(option => option.value === value)) return;
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      document.querySelector('#practice').scrollIntoView({ behavior: 'smooth', block: 'start' });
      area.focus({ preventScroll: true });
    });
  });

  const timer = document.querySelector('[data-exam-timer]');
  if (!timer) return;
  const mode = timer.querySelector('select');
  const clock = timer.querySelector('.exam-clock');
  const toggle = timer.querySelector('[data-timer-toggle]');
  const reset = timer.querySelector('[data-timer-reset]');
  const status = timer.querySelector('[data-timer-status]');
  let remaining = Number(mode.value) * 1000;
  let deadline = 0;
  let interval = null;
  const draw = () => {
    const seconds = Math.max(0, Math.ceil(remaining / 1000));
    clock.textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  };
  const stop = () => {
    if (interval !== null) clearInterval(interval);
    interval = null;
  };
  const tick = () => {
    remaining = Math.max(0, deadline - performance.now());
    draw();
    if (remaining === 0) {
      stop();
      toggle.textContent = 'Ещё раз';
      status.textContent = 'Время этапа закончилось. Отметьте, что удалось и что стоит повторить.';
    }
  };
  const restart = () => {
    stop();
    remaining = Number(mode.value) * 1000;
    draw();
    toggle.textContent = 'Начать';
    status.textContent = 'Таймер готов. Начинайте, когда будете готовы.';
  };
  toggle.addEventListener('click', () => {
    if (interval !== null) {
      tick();
      stop();
      if (remaining > 0) {
        toggle.textContent = 'Продолжить';
        status.textContent = 'Пауза. На экзамене время подготовки не приостанавливается.';
      }
      return;
    }
    if (remaining <= 0) remaining = Number(mode.value) * 1000;
    deadline = performance.now() + remaining;
    toggle.textContent = 'Пауза';
    status.textContent = 'Отсчёт идёт.';
    interval = setInterval(tick, 200);
    tick();
  });
  reset.addEventListener('click', restart);
  mode.addEventListener('change', restart);
  window.addEventListener('pagehide', () => {
    if (interval === null) return;
    tick();
    stop();
    if (remaining > 0) {
      toggle.textContent = 'Продолжить';
      status.textContent = 'Пауза после ухода со страницы. Продолжите, когда будете готовы.';
    }
  });
  draw();
})();
