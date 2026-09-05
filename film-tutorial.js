/* A read-only guide to real game actions. Only its UI progress is persisted. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FilmTutorial = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STEPS = Object.freeze(['resources', 'goals', 'home', 'film', 'production', 'work', 'rest', 'people', 'funding', 'festivals', 'rival', 'cut']);
  const statuses = ['idle', 'active', 'skipped', 'complete'];
  function normalize(value) {
    if (!value || value.version !== 1 || !statuses.includes(value.status) || !STEPS.includes(value.step)) {
      return { version: 1, status: 'idle', step: STEPS[0] };
    }
    return { version: 1, status: value.status, step: value.step };
  }
  const map = place => `[data-location="${place}"]`;
  function view(progress, context = {}) {
    const p = normalize(progress), s = context.state || {}, selected = context.selected;
    const actions = place => typeof context.actions === 'function' ? context.actions(place) : [];
    const info = {
      id: p.step, index: STEPS.indexOf(p.step), total: STEPS.length, title: '', body: '', target: '#status-bar',
      actionRequired: false, blocked: '', nextLabel: p.step === 'cut' ? 'יוצאים לדרך ←' : 'הבא ←'
    };
    const visit = (place, target) => {
      info.target = selected === place ? target : map(place);
      info.actionRequired = selected !== place;
    };
    const action = (place, id) => {
      visit(place, `[data-action="${id}"]`);
      const option = actions(place).find(a => a.id === id);
      info.actionRequired = true;
      if (!option || option.disabled) {
        info.actionRequired = false;
        info.blocked = option?.reason || 'הפעולה אינה זמינה כרגע. אפשר להמשיך בהדרכה ולחזור אליה בהמשך.';
      }
    };
    switch (p.step) {
      case 'resources':
        info.title = 'לפני האקשן: מה עומד לרשותכם';
        info.body = `למעלה נמצאים העו״ש, הזמן והאנרגיה. כרגע יש ${Number(s.hours) || 0} מתוך ${Number(s.maxHours) || 50} שעות. לפני כל פעולה רואים בדיוק מה היא עולה; המדדים נשארים איתכם בגלילה.`;
        break;
      case 'goals':
        info.title = 'הסרט הוא חלק מהסיפור';
        info.target = '#goals';
        info.body = 'כדי לעבור פרק צריך להשלים את משימת הסרט ואת ארבעת היעדים יחד: יציבות כלכלית, מיומנות, מוניטין ואושר. המשימה והמעמד שלכם מופיעים ממש מתחת למדדים.';
        break;
      case 'home':
        info.title = 'פותחים את הדלת לבית';
        info.target = map('home');
        info.actionRequired = true;
        info.body = 'לחצו על הבית במפה. האפשרויות יופיעו מתחתיה. אפשר להציץ בכל מקום בחינם; זמן הנסיעה מצטרף רק לפעולה שמבצעים שם.';
        break;
      case 'film': {
        info.title = s.project ? 'הסרט שלכם כבר בדרך' : 'בוחרים את הסרט הראשון';
        visit('home', s.project ? '.project-card' : '#start-film-choice');
        info.body = s.project
          ? 'כבר יש לכם הפקה פעילה, אז ממשיכים איתה. בכרטיס הסרט רואים את השלב הנוכחי, האיכות והתקציב שהושקע.'
          : 'פתחו את ״הסרט הבא שלך מתחיל כאן״ ובחרו ז׳אנר והיקף. סרט קצר הוא פתיחה נוחה. הבחירה אמיתית: זמן וכסף לפיתוח יורדים לפי המחיר שמופיע בכרטיס.';
        info.actionRequired = !s.project;
        if (!s.project && !actions('home').some(a => a.id.startsWith('home.start_') && !a.disabled)) {
          info.actionRequired = false;
          info.blocked = 'אין כרגע הפקה שאפשר לפתוח במשאבים שלכם. אפשר להמשיך ללמוד, ולעבוד או לנוח לפני הפיתוח.';
        }
        break;
      }
      case 'production':
        info.title = 'מהתסריט ועד הבכורה';
        info.target = s.project ? '.project-card' : '#action-panel';
        info.body = 'מסיימים תסריט בבית, מצלמים בסט ועורכים בחדר העריכה. כל לחיצה משלימה יום אחד; המונים מציגים כמה נשאר. צוות שמתאים לסרט משפר את איכותו, ועלויות ההפקה נוספות למחיר הפיתוח.';
        break;
      case 'work':
        info.title = selected === 'set' ? 'עכשיו מרוויחים במשמרת' : 'הולכים לסט כדי להתפרנס';
        action('set', 'set.work');
        info.body = selected === 'set'
          ? 'לחצו על כרטיס המשמרת אחרי שבדקתם את השעות והאנרגיה. השכר נכנס לעו״ש מיד. זו עבודה עבור אחרים; ימי הצילום של הסרט שלכם הם פעולות נפרדות.'
          : 'לחצו על סט הצילומים במפה. שם אפשר לעבוד בשכר, ובהמשך גם לצלם את הסרט שלכם. ננסה יחד משמרת אחת.';
        break;
      case 'rest':
        info.title = 'גם במאים צריכים לנוח';
        action('home', 'home.rest');
        info.body = selected === 'home'
          ? 'בחרו בשנ״צ. הוא עולה זמן ומחזיר אנרגיה להמשך. בבית יש גם חיים אישיים ובילויים; אושר הוא אחד מיעדי הפרק.'
          : 'חזרו לבית דרך המפה. ננסה מנוחה אחת ונראה את האנרגיה מתאוששת. בבית נמצאים גם החיים האישיים והבילויים.';
        if (s.energy >= 100) {
          info.actionRequired = false;
          info.blocked = '';
          info.body = 'האנרגיה שלכם כבר מלאה, אז אין צורך לבזבז זמן על מנוחה. כשמתעייפים, שנ״צ בבית מחזיר אנרגיה; חיים אישיים ובילויים עוזרים גם לאושר.';
        }
        break;
      case 'people':
        info.title = 'התעשייה מתחילה בשיחה';
        visit('cafe', '.encounter-desk, .location-board, #action-panel');
        info.body = 'בקפה מחכים קשרים, סוכנים והצעות שמתחלפות. בואו להציץ, בלי להתחייב לפגישה. בבית הספר משפרים מיומנות, ובחנות הציוד בודקים מה ההפקה באמת צריכה.';
        break;
      case 'funding':
        info.title = 'כסף לסרט, כסף לחיים';
        visit('bank', '.bank-tabs, .funding-desk, #action-panel');
        info.body = 'בבנק אפשר לבדוק קרנות ומימון המונים. התמיכה מיועדת להוצאות הסרט, והאישור אינו מובטח. הלוואה היא חוב; בהמשך נפתחים גם נכסים, השקעות ומעבר עיר. כרגע רק מציצים.';
        break;
      case 'festivals':
        info.title = 'אחרי הבכורה, עוד דלתות נפתחות';
        visit('festival', '.festival-desk, #action-panel');
        info.body = 'בסינמטק מוציאים סרט למסלול פסטיבלים ומגישים סרטים שכבר הופצו לתחרויות. אפשר לשלוח כמה סרטים במקביל, עד שלוש תחרויות לכל סרט. הפרסים נאספים בארון בבית.';
        break;
      case 'rival':
        info.title = 'ובינתיים, איתי עובד';
        info.target = '#rival';
        info.body = 'כאן רואים מי מוביל מול יעדי הפרק. אפשר לפתוח את הדוח כדי להבין מה איתי מתכנן ומה כבר הספיק. בכל תקופה תקבלו עדכון; הבחירות שלכם יכולות לשנות את הפער.';
        break;
      case 'cut':
        info.title = 'את הקאט אתם מחליטים מתי לעשות';
        info.target = '#hud-cut';
        info.body = '״קאט״ מציג קודם את הזמן שנותר והוצאות המחיה. רק האישור הבא מקדם תקופה, מחייב הוצאות ומחדש שעות ואנרגיה. אז מגיעות גם תשובות ודוח של איתי. נשאר זמן? המשיכו לשחק. ההדרכה זמינה שוב ב״איך משחקים״.';
        break;
    }
    if (s.status && s.status !== 'playing') {
      info.actionRequired = false;
      info.blocked = 'הפרק הסתיים. אפשר לסיים את ההיכרות, ולהמשיך לשחק דרך סיכום הפרק.';
    }
    return info;
  }
  function transition(progress, event = {}, context = {}) {
    const p = normalize(progress), index = STEPS.indexOf(p.step);
    if (event.type === 'start') return { version: 1, status: 'active', step: STEPS[0] };
    if (p.status !== 'active') return p;
    if (event.type === 'skip') return { ...p, status: 'skipped' };
    if (event.type === 'back') return { ...p, step: STEPS[Math.max(0, index - 1)] };
    const performed = event.type === 'action' && event.ok === true && (
      p.step === 'film' && typeof event.id === 'string' && event.id.startsWith('home.start_') && !!context.state?.project ||
      p.step === 'work' && event.id === 'set.work' || p.step === 'rest' && event.id === 'home.rest'
    );
    const advance = event.type === 'skip-step' || event.type === 'next' && !view(p, context).actionRequired ||
      event.type === 'location' && event.id === 'home' && p.step === 'home' || performed;
    if (!advance) return p;
    return index === STEPS.length - 1 ? { ...p, status: 'complete' } : { ...p, step: STEPS[index + 1] };
  }

  function mount({ getContext, onProgress, document: doc = document, window: win = window }) {
    const coach = doc.createElement('aside');
    coach.id = 'game-tutorial';
    coach.className = 'tutorial-coach';
    coach.hidden = true;
    coach.setAttribute('role', 'region');
    coach.setAttribute('aria-labelledby', 'tutorial-title');
    coach.innerHTML = '<div class="tutorial-top"><span class="tutorial-progress"></span><button class="tutorial-close" type="button" aria-label="לסיים את ההדרכה">×</button></div><div aria-live="polite" aria-atomic="true"><h2 id="tutorial-title"></h2><p id="tutorial-copy"></p><p id="tutorial-state" hidden></p></div><div class="tutorial-controls"><button class="tutorial-back" type="button">הקודם</button><button class="tutorial-next" type="button">הבא ←</button><button class="tutorial-step-skip" type="button">לדלג על הצעד</button></div>';
    doc.body.append(coach);
    const find = selector => coach.querySelector(selector);
    let target = null, hint = null, previousKey = '', focusPending = false, suspended = false, frame = 0, resizeFrame = 0, lastHeight = -1;
    function clearTarget() { target?.classList.remove('tutorial-target'); target = null; }
    function revealTarget() {
      if (coach.hidden || !target?.isConnected) return;
      const rect = target.getBoundingClientRect();
      const hud = doc.getElementById('status-bar');
      const top = target.closest('#status-bar') ? 8 : (hud?.getBoundingClientRect().height || 0) + 24;
      const bottom = coach.getBoundingClientRect().top - 18;
      if (rect.top < top || rect.bottom > bottom) {
        target.scrollIntoView({ block: rect.height > bottom - top ? 'start' : 'center', behavior: 'instant' });
      }
    }
    function queueReposition() {
      win.cancelAnimationFrame(resizeFrame);
      resizeFrame = win.requestAnimationFrame(revealTarget);
    }
    function setHeight() {
      const height = coach.hidden ? 0 : Math.ceil(coach.getBoundingClientRect().height);
      doc.documentElement.style.setProperty('--tutorial-height', `${height}px`);
      if (height !== lastHeight) { lastHeight = height; queueReposition(); }
    }
    const observer = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(setHeight) : null;
    observer?.observe(coach);
    function focusTarget() {
      if (!target) return;
      revealTarget();
      if (target.matches('button, input, select, [tabindex]')) target.focus({ preventScroll: true });
    }
    function send(event) {
      const c = getContext(), old = normalize(c.progress), next = transition(old, event, c);
      const returnTarget = target;
      const focusWasOnGuide = coach.contains(doc.activeElement) || hint?.contains(doc.activeElement);
      if (next.status !== old.status || next.step !== old.step || event.type === 'start') {
        onProgress(next);
        focusPending = next.status === 'active';
      }
      sync();
      if (next.status !== 'active' && focusWasOnGuide) {
        const dialog = doc.getElementById('game-dialog');
        const restore = dialog?.open ? dialog.querySelector('[data-close], button:not(:disabled)')
          : returnTarget?.isConnected && returnTarget.matches('button, input, select, [tabindex]') ? returnTarget : doc.getElementById('help-button');
        restore?.focus({ preventScroll: true });
      }
    }
    function sync() {
      const c = getContext(), p = normalize(c.progress), active = c.started && p.status === 'active';
      clearTarget();
      const dialog = doc.getElementById('game-dialog');
      const modal = !!dialog?.open;
      coach.hidden = !active || modal;
      doc.body.classList.toggle('tutorial-active', active && !modal);
      if (!active) {
        hint?.remove(); hint = null; previousKey = ''; focusPending = false; setHeight(); return;
      }
      const step = view(p, c);
      if (modal) {
        suspended = true;
        if (!hint?.isConnected) {
          hint = doc.createElement('div'); hint.className = 'tutorial-dialog-hint';
          hint.innerHTML = '<p></p><button class="tutorial-dialog-skip" type="button">לסיים הדרכה</button>';
          hint.querySelector('button').addEventListener('click', () => send({ type: 'skip' }));
          dialog.querySelector('.dialog-inner')?.prepend(hint);
        }
        hint.querySelector('p').textContent = p.step === 'film' && dialog.querySelector('[data-film]')
          ? 'צעד ההדרכה: בחרו ז׳אנר והיקף לפי העלות שמוצגת. סרט קצר מתאים להתחלה; ההדרכה תמשיך אחרי הבחירה.'
          : 'ההדרכה ממתינה כאן. השלימו את הבחירה בחלון הזה או חזרו ממנו, ונמשיך מאותו צעד.';
        setHeight(); return;
      }
      hint?.remove(); hint = null;
      find('.tutorial-progress').textContent = `צעד ${step.index + 1} מתוך ${step.total} · לומדים יחד`;
      find('#tutorial-title').textContent = step.title;
      find('#tutorial-copy').textContent = step.body;
      find('#tutorial-state').textContent = step.blocked;
      find('#tutorial-state').hidden = !step.blocked;
      find('.tutorial-back').disabled = step.index === 0;
      find('.tutorial-next').textContent = step.actionRequired ? 'לבחירה במשחק ↗' : step.nextLabel;
      find('.tutorial-step-skip').hidden = !step.actionRequired;
      target = step.target.split(',').map(selector => doc.querySelector(selector.trim())).find(Boolean);
      // Retained saves can be at a different location or stage. Never trap the guide on a missing control.
      if (!target) {
        target = doc.getElementById('action-panel');
        find('#tutorial-state').textContent = 'האפשרות הזו אינה מוצגת במצב הנוכחי. אפשר לדלג על הצעד ולהמשיך.';
        find('#tutorial-state').hidden = false;
        find('.tutorial-step-skip').hidden = false;
      }
      target?.classList.add('tutorial-target');
      setHeight();
      const key = `${step.id}:${step.target}`;
      if (key !== previousKey || suspended) {
        previousKey = key; suspended = false;
        win.cancelAnimationFrame(frame);
        frame = win.requestAnimationFrame(() => {
          if (coach.hidden || !target?.isConnected) return;
          revealTarget();
          if (focusPending) { find('.tutorial-next').focus({ preventScroll: true }); focusPending = false; }
        });
      }
    }
    find('.tutorial-close').addEventListener('click', () => send({ type: 'skip' }));
    find('.tutorial-back').addEventListener('click', () => send({ type: 'back' }));
    find('.tutorial-step-skip').addEventListener('click', () => send({ type: 'skip-step' }));
    find('.tutorial-next').addEventListener('click', () => {
      const c = getContext();
      if (view(c.progress, c).actionRequired) focusTarget();
      else send({ type: 'next' });
    });
    function escape(event) {
      if (event.key !== 'Escape' || coach.hidden) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const restore = target;
      send({ type: 'skip' });
      if (restore?.isConnected && restore.matches('button, input, select, [tabindex]')) restore.focus({ preventScroll: true });
    }
    win.addEventListener('keydown', escape, true);
    win.addEventListener('resize', queueReposition);
    // Native Escape/backdrop closing bypasses the UI's closeDialog helper.
    doc.getElementById('game-dialog')?.addEventListener('close', sync);
    return { start: () => send({ type: 'start' }), notify: send, sync };
  }
  return { STEPS, normalize, view, transition, mount };
});
