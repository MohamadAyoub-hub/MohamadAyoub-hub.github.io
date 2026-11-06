(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const press = (element,on) => element.setAttribute('aria-pressed',String(on));
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = motion.matches;
  const canObserve = 'IntersectionObserver' in window;
  const dialog = $('#screenshot-viewer');
  const call = $('#cta-pill');
  const hero = $('.hero');
  const techSection = $('#tech');
  const motionToggle = $('#motion-toggle');
  let manualPause = false;
  let heroPassed = false, contactVisible = false, footerVisible = false, progressFrame = 0;
  function updateCall() {
    if (!call) return;
    const show = heroPassed && !contactVisible && !footerVisible && !dialog?.open && !document.activeElement?.matches('input,textarea,select');
    call.classList.toggle('show', show);
    call.setAttribute('aria-hidden', String(!show));
    call.tabIndex = show ? 0 : -1;
    call.inert = !show;
  }
  function updateProgress() {
    progressFrame = 0;
    const root = document.documentElement;
    const range = root.scrollHeight - root.clientHeight;
    const ratio = range > 0 ? Math.max(0, Math.min(1, root.scrollTop / range)) : 0;
    const bar = $('#progress');
    if (bar) bar.style.transform = `scaleX(${ratio})`;
    if (!canObserve && hero) {
      heroPassed = hero.getBoundingClientRect().bottom <= 0;
      const rect = $('#contact')?.getBoundingClientRect();
      contactVisible = !!rect && rect.top < innerHeight && rect.bottom > 0;
      const footer = $('.site-footer')?.getBoundingClientRect();
      footerVisible = !!footer && footer.top < innerHeight && footer.bottom > 0;
      updateCall();
    }
  }
  function queueProgress() {
    if (!progressFrame) progressFrame = requestAnimationFrame(updateProgress);
  }
  addEventListener('scroll', queueProgress, {passive:true});
  addEventListener('resize', queueProgress, {passive:true});
  addEventListener('load', queueProgress, {once:true});
  document.addEventListener('toggle', queueProgress, true);
  queueProgress();
  if (canObserve) {
    const callObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.target === hero) {
          heroPassed = entry.boundingClientRect.bottom <= 0;
          hero.classList.toggle('is-visible', entry.isIntersecting);
        } else if (entry.target === $('#contact')) {
          contactVisible = entry.isIntersecting;
          entry.target.classList.toggle('is-visible', entry.isIntersecting);
        }
        else footerVisible = entry.isIntersecting;
      });
      updateCall();
    });
    if (hero) callObserver.observe(hero);
    if ($('#contact')) callObserver.observe($('#contact'));
    if ($('.site-footer')) callObserver.observe($('.site-footer'));
  }

  $$('[aria-expanded][aria-controls]').forEach(button => {
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    if (!panel) return;
    button.setAttribute('aria-expanded', 'false');
    panel.hidden = true;
    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(expanded));
      panel.hidden = !expanded;
      queueProgress();
    });
  });
  const menu = $('.mobile-menu');
  if (menu) {
    menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { menu.open = false; }));
    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape') { menu.open = false; menu.querySelector('summary').focus(); }
    });
  }
  const demo = $('#demo');
  if (demo) {
    const button = demo.querySelector('button[aria-pressed]');
    const raw = $('#demo-raw'), clean = $('#demo-clean');
    const label = $('#demo-toggle-label'), state = $('#demo-state');
    function showClean(on) {
      press(button,on);
      demo.classList.toggle('is-clean', on);
      raw.hidden = on;
      clean.hidden = !on;
      label.textContent = on ? 'Show source CSV' : 'Show cleaned view';
      state.textContent = on ? 'Cleaned view · 3 rows ready, 3 held for review.' : 'Source CSV · 6 sample rows.';
      queueProgress();
    }
    showClean(false);
    button.hidden = false;
    button.addEventListener('click', () => showClean(button.getAttribute('aria-pressed') !== 'true'));
  }

  const pricing = $('#pricing'), plans = $$('.package-select');
  if (plans.length) $('#package-choice').hidden = false;
  const fits = $$('.fit-option');
  if (fits.length) $('#workflow-fit').hidden = false;
  function selectPlan(button) {
    plans.forEach(item => {
      const on = item === button;
      press(item,on);
      item.textContent = on ? 'Selected' : 'Select package';
      item.closest('.tier').classList.toggle('is-selected', on);
    });
    $('#package-summary').textContent = `Selected: ${button.dataset.plan} · ${button.dataset.range}`;
    $('#package-inquiry').href = 'mailto:mhmd4work.1@gmail.com?subject=' + encodeURIComponent('Discovery call — ' + button.dataset.plan);
    replayNumbers(button.closest('.tier'));
  }
  plans.forEach(button => {
    button.hidden = false;
    button.addEventListener('click', () => {
      fits.forEach(fit => press(fit,false));
      if ($('#fit-result')) $('#fit-result').textContent = 'Choose the closest workflow to see a suggested starting point.';
      selectPlan(button);
    });
  });
  fits.forEach(button => button.addEventListener('click', () => {
    fits.forEach(fit => press(fit,fit === button));
    selectPlan(plans[Number(button.dataset.fit)]);
    $('#fit-result').textContent = button.dataset.note;
  }));

  const path = $('#pipe-path'), dot = $('#pipe-dot');
  const pipeSection = path?.closest('.pipeline-map');
  const pathLength = path?.getTotalLength() || 0;
  const log = $('#sample-log-lines');
  const logRows = log ? [...log.querySelectorAll('.log-row')] : [];
  const revealTargets = $$('[data-reveal]:not(.log-row):not(#progress):not(#cta-pill):not(#pipe-dot)');
  const counters = new Map(), counted = new WeakSet();
  let frame = 0, last = null, pipeVisible = false, phase = 0;
  let logVisible = false, logElapsed = 0, logIndex = 0;
  let logDone = reduce || !canObserve;
  const numberFormat = new Intl.NumberFormat('en-US');
  const fmt = (element, value) => element.dataset.format === 'pct'
    ? value.toFixed(1) + '%' : numberFormat.format(Math.round(value));
  const staticMode = () => reduce || manualPause;
  const allowed = () => !staticMode() && !document.hidden && !dialog?.open;
  function active() {
    return allowed() && ((pipeVisible && pathLength > 0) || (logVisible && !logDone) || [...counters.values()].some(task => task.visible));
  }
  function schedule() {
    document.documentElement.classList.toggle('motion-on', allowed() && canObserve);
    document.documentElement.classList.toggle('interaction-on', !staticMode() && !document.hidden);
    if (dot) dot.style.opacity = allowed() && pipeVisible ? '1' : '0';
    if (!active()) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0; last = null;
    } else if (!frame) frame = requestAnimationFrame(tick);
  }
  function tick(time) {
    frame = 0;
    if (!active()) { last = null; return; }
    const delta = last === null ? 0 : Math.min(time - last, 64);
    last = time;
    if (pipeVisible && pathLength > 0 && dot) {
      phase = (phase + delta) % 4000;
      const point = path.getPointAtLength(phase / 4000 * pathLength);
      dot.style.transform = `translate(${point.x}px,${point.y}px)`;
    }
    counters.forEach((task, element) => {
      if (!task.visible) return;
      task.elapsed = Math.min(task.duration, task.elapsed + delta);
      const progress = task.elapsed / task.duration;
      element.textContent = fmt(element, task.end * (1 - Math.pow(1 - progress, 3)));
      if (progress === 1) {
        counters.delete(element);
        if (![...counters.values()].some(other => other.target === task.target)) animationObserver?.unobserve(task.target);
      }
    });
    if (logVisible && !logDone) {
      logElapsed += delta;
      while (logIndex < logRows.length && logElapsed >= logIndex * 220) logRows[logIndex++].classList.add('in');
      if (logIndex === logRows.length) logDone = true;
    }
    schedule();
  }
  let animationObserver = null, revealObserver = null;
  function count(element) {
    if (counted.has(element)) return;
    counted.add(element);
    const end = Number.parseFloat(element.dataset.to);
    if (!Number.isFinite(end)) return;
    if (staticMode() || !canObserve) { element.textContent = fmt(element, end); return; }
    const target = element.closest('[data-count-group]') || element;
    element.textContent = fmt(element, 0);
    counters.set(element, {end,elapsed:0,visible:false,target,duration:Number(element.dataset.duration)||900});
    animationObserver.observe(target);
  }
  function reveal(element) {
    element.classList.add('in');
    element.querySelectorAll('[data-to]').forEach(count);
    revealObserver?.unobserve(element);
  }
  if (dot) { dot.setAttribute('cx','0'); dot.setAttribute('cy','0'); }
  if (canObserve) {
    animationObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.target === pipeSection) {
          pipeVisible = entry.isIntersecting;
          pipeSection.classList.toggle('is-visible', pipeVisible);
        }
        else if (entry.target === techSection) techSection.classList.toggle('is-visible', entry.isIntersecting);
        else if (entry.target === pricing) pricing.classList.toggle('is-visible', entry.isIntersecting);
        else if (entry.target === log) logVisible = entry.isIntersecting;
        else if ((entry.target.classList.contains('tech-choice') || entry.target.classList.contains('motion-panel'))) entry.target.classList.toggle('is-visible', entry.isIntersecting);
        else counters.forEach(task => { if (task.target === entry.target) task.visible = entry.isIntersecting; });
      });
      schedule();
    }, {threshold:0.01});
    if (pipeSection) animationObserver.observe(pipeSection);
    if (pricing) animationObserver.observe(pricing);
    if (techSection) animationObserver.observe(techSection);
    if (log) animationObserver.observe(log);
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) reveal(entry.target); });
    }, {threshold:0.12,rootMargin:'0px 0px -8% 0px'});
  }
  if (log && !logDone) log.classList.add('is-playing');
  else logRows.forEach(row => row.classList.add('in'));
  revealTargets.forEach(element => {
    if (reduce || !canObserve) reveal(element);
    else revealObserver.observe(element);
  });
  document.addEventListener('focusin', event => {
    let target = event.target.closest('[data-reveal]');
    while (target) { reveal(target); target = target.parentElement?.closest('[data-reveal]'); }
    updateCall();
  });
  function syncMotion() {
    reduce = motion.matches;
    document.documentElement.classList.toggle('motion-paused', staticMode());
    if (motionToggle) {
      motionToggle.disabled = reduce;
      press(motionToggle,staticMode());
      motionToggle.setAttribute('aria-label', reduce ? 'Reduced motion is enabled' : manualPause ? 'Play animations' : 'Pause animations');
    }
    if (staticMode()) {
      revealTargets.forEach(reveal);
      $$('[data-to]').forEach(element => {
        const end = Number.parseFloat(element.dataset.to);
        if (Number.isFinite(end)) element.textContent = fmt(element, end);
        counters.delete(element);
        animationObserver?.unobserve(element.closest('[data-count-group]') || element);
      });
      logRows.forEach(row => row.classList.add('in'));
      logDone = true;
    }
    schedule();
  }
  if (motion.addEventListener) motion.addEventListener('change', syncMotion);
  else motion.addListener(syncMotion);
  document.addEventListener('visibilitychange', schedule);
  document.addEventListener('focusout', () => requestAnimationFrame(updateCall));
  if (motionToggle) {
    motionToggle.hidden = false;
    motionToggle.addEventListener('click', () => { manualPause = !manualPause; syncMotion(); });
  }
  syncMotion();
  const figures = $$('.vc-view');
  if (dialog && typeof dialog.showModal === 'function' && figures.length) {
    const image = $('#viewer-image'), title = $('#viewer-title');
    const description = $('#viewer-description'), position = $('#viewer-position');
    let index = 0, trigger = null, previousOverflow = '', startTouch = null, activeFigures = figures;
    const touch = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;
    const hint = touch ? 'Swipe to browse. Use Close to return.' : 'Use the arrow keys to browse. Escape closes.';
    $('#viewer-hint').textContent = hint;
    const galleryHint = $('.vc-hint');
    if (galleryHint) galleryHint.textContent = 'Open a screenshot for an enlarged view. ' + hint;
    function render(next) {
      index = (next + activeFigures.length) % activeFigures.length;
      const figure = activeFigures[index], source = figure.querySelector('img');
      const link = figure.querySelector('.vc-preview');
      image.src = link.getAttribute('href');
      feedback(image);
      image.alt = source.alt;
      image.setAttribute('width', source.getAttribute('width'));
      image.setAttribute('height', source.getAttribute('height'));
      title.textContent = figure.querySelector('h4').textContent;
      description.textContent = figure.querySelector('figcaption p').textContent;
      position.textContent = `${index + 1} of ${activeFigures.length}`;
      $('#viewer-original').href = link.getAttribute('href');
    }
    figures.forEach(figure => {
      const link = figure.querySelector('.vc-preview');
      link.setAttribute('aria-haspopup','dialog');
      link.setAttribute('aria-controls','screenshot-viewer');
      link.addEventListener('click', event => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        trigger = link;
        const gallery = figure.getAttribute('data-gallery');
        activeFigures = figures.filter(item => item.getAttribute('data-gallery') === gallery);
        render(activeFigures.indexOf(figure));
        previousOverflow = document.body.style.overflow;
        dialog.showModal();
        document.body.style.overflow = 'hidden';
        updateCall(); schedule();
      });
    });
    $('#viewer-close').addEventListener('click', () => dialog.close());
    $('#viewer-prev').addEventListener('click', () => render(index - 1));
    $('#viewer-next').addEventListener('click', () => render(index + 1));
    dialog.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); render(index + (event.key === 'ArrowRight' ? 1 : -1));
      }
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    const stage = $('#viewer-stage');
    stage.addEventListener('touchstart', event => {
      startTouch = event.touches.length === 1 ? {x:event.touches[0].clientX,y:event.touches[0].clientY} : null;
    }, {passive:true});
    stage.addEventListener('touchend', event => {
      if (!startTouch || !event.changedTouches.length) return;
      const point = event.changedTouches[0], dx = point.clientX - startTouch.x, dy = point.clientY - startTouch.y;
      startTouch = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) render(index + (dx < 0 ? 1 : -1));
    }, {passive:true});
    stage.addEventListener('touchcancel', () => { startTouch = null; }, {passive:true});
    dialog.addEventListener('close', () => {
      document.body.style.overflow = previousOverflow;
      startTouch = null;
      updateCall(); schedule();
      if (trigger?.isConnected) trigger.focus({preventScroll:true});
    });
  }
  function replayNumbers(container) {
    container?.querySelectorAll('[data-to]').forEach(element => {
      counted.delete(element);
      counters.delete(element);
      animationObserver?.unobserve(element.closest('[data-count-group]') || element);
      count(element);
    });
  }
  const replayPrices = $('#replay-prices');
  if (replayPrices) {
    replayPrices.hidden = false;
    replayPrices.addEventListener('click', () => replayNumbers(pricing));
  }
  const replayLog = $('#replay-log'), copyLog = $('#copy-log');
  if (replayLog && log) {
    replayLog.hidden = false;
    replayLog.addEventListener('click', () => {
      logElapsed = 0; logIndex = 0; phase = 0;
      logDone = staticMode() || !canObserve;
      log.classList.add('is-playing');
      logRows.forEach(row => row.classList.toggle('in',logDone));
      $('#sample-action-status').textContent = logDone ? 'Sample log shown. Motion is paused.' : 'Replaying the illustrative sample log.';
      schedule();
    });
  }
  if (copyLog && log) {
    copyLog.hidden = false;
    copyLog.addEventListener('click', async () => {
      const message = $('#sample-action-status');
      try {
        await navigator.clipboard.writeText(logRows.map(row => row.textContent.trim()).join('\n'));
        message.textContent = 'Sample log copied.';
      } catch {
        const range = document.createRange(), selection = getSelection();
        if (selection) { range.selectNodeContents(log); selection.removeAllRanges(); selection.addRange(range); }
        message.textContent = selection ? 'Sample log selected. Use Copy on your device.' : 'Select the sample log text to copy.';
      }
    });
  }

  const techChoices = $$('.tech-choice');
  techChoices.forEach(button => {
    button.disabled = false;
    animationObserver?.observe(button);
    button.addEventListener('click', () => {
      techChoices.forEach(item => press(item,item === button));
      $('#tech-detail').textContent = button.dataset.tech + ' — ' + button.dataset.note;
    });
  });
  const valueForm = $('#value-form');
  if (valueForm) {
    const fields = ['value-before','value-after','value-rate','value-running'].map(id => document.getElementById(id));
    const outputs = ['value-hours','value-gross','value-net'].map(id => document.getElementById(id));
    const summary = $('#value-summary'), mode = $('#value-mode'), bars = $('#value-bars');
    const cash = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
    function clearValue() {
      outputs.forEach(output => { output.textContent = '—'; });
      summary.textContent = 'Enter your assumptions to explore a scenario.';
      mode.textContent = 'Enter assumptions';
      if (bars) bars.hidden = true;
      queueProgress();
    }
    function calculate(example = false) {
      const values = fields.map(input => input.value.trim() === '' ? null : Number(input.value));
      const [before,after,rate,running] = values;
      if (before === null || after === null || values.some(value => value !== null && (!Number.isFinite(value) || value < 0))) {
        clearValue(); summary.textContent = 'Enter nonnegative hours and costs. Current and expected weekly hours are required.'; return;
      }
      const weekly = before - after, monthly = weekly * 52 / 12;
      if (!Number.isFinite(monthly) || (rate !== null && !Number.isFinite(monthly * rate - (running || 0)))) {
        clearValue(); summary.textContent = 'These values are too large to model. Use smaller hours or costs.'; return;
      }
      if (bars) {
        bars.hidden = false;
        const maximum = Math.max(before,after,1);
        $('#value-before-bar').style.transform = `scaleX(${before / maximum})`;
        $('#value-after-bar').style.transform = `scaleX(${after / maximum})`;
        $('#value-before-label').textContent = numberFormat.format(before) + ' h';
        $('#value-after-label').textContent = numberFormat.format(after) + ' h';
      }
      outputs[0].textContent = numberFormat.format(Math.round(monthly * 10) / 10) + ' h';
      outputs[1].textContent = rate === null ? '—' : cash.format(monthly * rate);
      outputs[2].textContent = rate === null ? '—' : cash.format(monthly * rate - (running || 0));
      mode.textContent = example ? 'Hypothetical example' : 'Your assumptions';
      const change = weekly > 0 ? numberFormat.format(weekly) + ' hours/week freed' : weekly < 0 ? numberFormat.format(-weekly) + ' additional hours/week' : 'No time freed';
      summary.textContent = (example ? 'Hypothetical example: ' : 'Your assumptions: ') + change + '. ' + (rate === null ? 'Add an hourly cost to model capacity value.' : 'Monthly capacity value is ' + outputs[1].textContent + ', or ' + outputs[2].textContent + ' after the running costs you entered.');
      queueProgress();
    }
    valueForm.hidden = false;
    valueForm.addEventListener('submit', event => { event.preventDefault(); calculate(); });
    valueForm.addEventListener('reset', clearValue);
    fields.forEach(input => input.addEventListener('input', clearValue));
    $('#value-example').addEventListener('click', () => {
      [8,2,25,50].forEach((value,index) => { fields[index].value = String(value); }); calculate(true);
    });
    const disclosure = $('#value-calculator');
    if (disclosure && matchMedia('(max-width:719px)').matches) disclosure.open = false;
  }

  const themes = $$('.theme-choice');
  if (themes.length) {
    themes.forEach(button => { button.disabled = false; button.addEventListener('click', () => {
      document.documentElement.dataset.theme = button.dataset.theme;
      themes.forEach(item => press(item,item === button));
      $('#theme-status').textContent = button.textContent.trim() + ' theme selected.';
    }); });
  }
  const qualityChoices = $$('.quality-choice'), qualityRows = $$('.artifact-table tbody tr');
  if (qualityChoices.length) {
    qualityChoices.forEach(button => { button.disabled = false; button.addEventListener('click', () => {
      const review = button.dataset.quality === 'review';
      qualityChoices.forEach(item => press(item,item === button));
      qualityRows.forEach(row => { row.hidden = review && !row.classList.contains('held'); });
      $('#quality-state').textContent = review ? 'Showing 2 sample checks that need review.' : 'Showing all 4 sample checks.';
      queueProgress();
    }); });
  }
  const stages = $$('.stage-button');
  stages.forEach(button => {
    button.disabled = false;
    button.addEventListener('click', () => {
      stages.forEach(item => press(item,item === button));
      ['title','tool','check','output','code'].forEach(key => { $('#stage-' + key).textContent = button.dataset[key]; });
      $('#stage-announcement').textContent = button.dataset.title + ' selected. ' + button.dataset.output;
      const panel = $('#pipeline-inspector');
      panel.classList.remove('is-updated');
      requestAnimationFrame(() => panel.classList.add('is-updated'));
      queueProgress();
    });
    button.addEventListener('keydown', event => {
      const index = stages.indexOf(button);
      const next = event.key === 'ArrowRight' ? (index + 1) % stages.length : event.key === 'ArrowLeft' ? (index + stages.length - 1) % stages.length : event.key === 'Home' ? 0 : event.key === 'End' ? stages.length - 1 : -1;
      if (next >= 0) { event.preventDefault(); stages[next].focus(); stages[next].click(); }
    });
  });
  $$('.motion-panel').forEach(panel => animationObserver?.observe(panel));

  function feedback(element) {
    if (!element || staticMode() || document.hidden) return;
    element.classList.remove('choice-feedback');
    requestAnimationFrame(() => element.classList.add('choice-feedback'));
  }
  $$('.tech-choice,.theme-choice,.quality-choice,.stage-button,.fit-option,.package-select').forEach(button => button.addEventListener('click', () => {
    feedback(button);
    if (button.classList.contains('tech-choice')) feedback($('#tech-detail'));
  }));
  document.addEventListener('animationend', event => event.target.classList.remove('choice-feedback'));

  // Active location follows the reading position; native anchor scrolling stays intact.
  const navLinks = $$('.navigation a[href^="#"]');
  function markLocation(hash) {
    navLinks.forEach(link => link.setAttribute('aria-current',link.getAttribute('href') === hash ? 'location' : 'false'));
  }
  navLinks.forEach(link => link.addEventListener('click', () => markLocation(link.getAttribute('href'))));
  if (canObserve && navLinks.length) {
    const locationObserver = new IntersectionObserver(entries => {
      const current = entries.filter(entry => entry.isIntersecting).sort((a,b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top))[0];
      if (current) markLocation(current.target === hero ? '#top' : '#' + current.target.id);
    }, {rootMargin:'-18% 0px -65% 0px'});
    [...new Set(navLinks.map(link => link.getAttribute('href')))].forEach(hash => {
      const target = hash === '#top' ? hero : $(hash);
      if (target) locationObserver.observe(target);
    });
  }
  // One event-driven frame reads geometry before writing bounded transform variables.
  const finePointer = matchMedia('(hover:hover) and (pointer:fine)');
  let pointerFrame = 0, pointerPoint = null;
  function paintPointer() {
    pointerFrame = 0;
    const point = pointerPoint; pointerPoint = null;
    if (!point || !finePointer.matches || !allowed()) return;
    const element = point.element, rect = element.getBoundingClientRect();
    const width = Math.max(rect.width || rect.right - rect.left,1), height = Math.max(rect.height || rect.bottom - rect.top,1);
    const x = Math.max(0,Math.min(width,point.x - rect.left)), y = Math.max(0,Math.min(height,point.y - rect.top));
    if (element.getAttribute('data-reflect') !== null) {
      element.style.setProperty('--px',x + 'px'); element.style.setProperty('--py',y + 'px');
    }
    if (element.getAttribute('data-pull') !== null) {
      element.style.setProperty('--mx',((x / width - .5) * 8) + 'px');
      element.style.setProperty('--my',((y / height - .5) * 6) + 'px');
    }
  }
  $$('[data-reflect],[data-pull]').forEach(element => {
    element.addEventListener('pointermove', event => {
      if (!finePointer.matches || !allowed()) return;
      pointerPoint = {element,x:event.clientX,y:event.clientY};
      if (!pointerFrame) pointerFrame = requestAnimationFrame(paintPointer);
    }, {passive:true});
    element.addEventListener('pointerleave', () => {
      if (pointerPoint?.element === element) pointerPoint = null;
      element.style.setProperty('--mx','0px'); element.style.setProperty('--my','0px');
    });
  });

  // The selected sample remains readable when the WebGL room is unavailable.
  const traceButtons = $$('[data-trace-order]');
  if(traceButtons.length) {
    const traceResult = $('#room-trace-result');
    const displayTrace = $('#room-display-trace');
    const root = document.documentElement;
    traceResult.hidden = false;
    traceButtons.forEach(button => {
      button.disabled = false;
      button.addEventListener('click', () => {
        const order = button.dataset.traceOrder;
        const selected = root.dataset.roomTrace !== order;
        if(selected) root.dataset.roomTrace = order;
        else delete root.dataset.roomTrace;
        traceButtons.forEach(candidate => press(candidate,selected && candidate === button));
        traceResult.textContent = selected
          ? button.dataset.traceName + '. ' + button.dataset.traceOutcome
          : 'Select an order to trace it through the room.';
        displayTrace.textContent = selected ? 'Trace ' + button.dataset.traceName : '';
        displayTrace.hidden = !selected;
        document.dispatchEvent(new Event('room-trace-change'));
      });
    });
  }
  document.documentElement.classList.add('js','ready');
})();

/* Lazily enhance the Data Room when both the visitor and the device allow motion. */
(() => {
  'use strict';
  const canvas=document.getElementById('room-world');
  const appURL=document.currentScript?.src;
  if(!canvas||!appURL||!window.IntersectionObserver||!window.ResizeObserver||!window.MutationObserver) return;
  const url=new URL('scene.js',appURL);
  if(url.protocol==='file:') return;
  const root=document.documentElement;
  const compactQuery=matchMedia('(max-width: 859px), (pointer: coarse)');
  const calm=matchMedia('(prefers-reduced-motion: reduce), (prefers-reduced-transparency: reduce), (prefers-contrast: more), (forced-colors: active)');
  const connection=navigator.connection;
  const subscriptions=new AbortController(), signal=subscriptions.signal;
  let controller, api, context, drawing=false, destroyed=false, pending=false, nearby=false, idleFrame=0, pagePaused=false;
  const observed=new Set();

  function canPlay() {
    const compact=compactQuery.matches;
    return !destroyed && !pagePaused && !document.hidden && !calm.matches && !connection?.saveData
      && root.classList.contains('motion-on')
      && (!compact || (innerHeight>=430 && (navigator.hardwareConcurrency||4)>=4 && (navigator.deviceMemory||4)>=3));
  }
  function disable() {
    if(destroyed) return;
    destroyed=true;
    if(idleFrame) cancelAnimationFrame(idleFrame);
    idleFrame=0;
    controller?.dispose();
    subscriptions.abort();
    watcher.disconnect(); intersection.disconnect();
    if(context && !context.isContextLost()) context.getExtension('WEBGL_lose_context')?.loseContext();
  }
  async function boot() {
    idleFrame=0;
    if(!canPlay()||!nearby||pending||controller) return;
    const compact=compactQuery.matches;
    try {
      context ||= canvas.getContext('webgl2',{
        alpha:true, depth:true, stencil:false, antialias:!compact,
        powerPreference:'low-power', failIfMajorPerformanceCaveat:true, preserveDrawingBuffer:true
      });
      if(!context||context.isContextLost()) {disable();return;}
      pending=true;
      api ||= await import(url.href);
      if(!canPlay()) return;
      controller=api.mountRoomScene(canvas,context,{compact,onFailure:disable});
      intersection.disconnect();
      sync();
    } catch {
      disable();
    } finally {
      pending=false;
    }
  }
  function sync() {
    const active=canPlay();
    if(controller) {
      if(active!==drawing) {
        drawing=active;
        controller.setPlaying(active);
      }
    } else if(active&&nearby&&!pending&&!idleFrame) {
      idleFrame=requestAnimationFrame(()=>{
        idleFrame=requestAnimationFrame(boot);
      });
    }
  }

  const watcher=new MutationObserver(sync);
  watcher.observe(root,{attributes:true,attributeFilter:['class']});
  const intersection=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{if(entry.isIntersecting) observed.add(entry.target); else observed.delete(entry.target);});
    nearby=observed.size>0;
    sync();
  },{rootMargin:'120px 0px'});
  document.querySelectorAll('.room-hero,.room-story').forEach(item=>intersection.observe(item));
  for(const query of [compactQuery,calm]) {
    if(query.addEventListener) query.addEventListener('change',sync,{signal});
    else {
      query.addListener?.(sync);
      signal.addEventListener('abort',()=>query.removeListener?.(sync),{once:true});
    }
  }
  connection?.addEventListener?.('change',sync,{signal});
  document.addEventListener('visibilitychange',sync,{signal});
  addEventListener('resize',sync,{passive:true,signal});
  canvas.addEventListener('webglcontextlost',disable,{once:true,signal});
  addEventListener('pagehide',event=>{
    if(event.persisted){pagePaused=true;sync();}
    else disable();
  },{signal});
  addEventListener('pageshow',()=>{pagePaused=false;sync();},{signal});
})();
