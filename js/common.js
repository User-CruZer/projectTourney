/* Small helpers shared by the overlay and the control page. */
(function (global) {
  const cfg = global.TOURNEY_CONFIG;

  // Theme colours from config.js override the defaults in css/theme.css.
  const T = cfg.THEME || {};
  [['playerA', '--a'], ['playerB', '--b'], ['ban', '--ban'], ['champion', '--gold']].forEach(([k, v]) => {
    if (T[k]) document.documentElement.style.setProperty(v, T[k]);
  });
  const byName = Object.fromEntries(cfg.ROSTER.map((c) => [c.name, c]));

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const initials = (name) => String(name).replace(/\(.*?\)/g, '').trim()
    .split(/\s+/).map((w) => w[0] || '').join('').slice(0, 2).toUpperCase();

  const element = (name) => (byName[name] || {}).element || '';
  const elColor = (name) => cfg.ELEMENTS[element(name)] || '#8a93ad';

  /** Sum of numeric stage scores, or '' if any entered score isn't a number. */
  function scoreTotal(arr) {
    const vals = (arr || []).filter((v) => String(v).trim() !== '');
    if (!vals.length) return '';
    let sum = 0;
    for (const v of vals) {
      const n = Number(String(v).replace(/[,\s]/g, ''));
      if (!isFinite(n)) return '';
      sum += n;
    }
    return sum.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  /** Remaining turn time as "m:ss", or '' when the timer is off / not running. */
  function timerText(state, clockOffset) {
    if (!state || !cfg.TURN_SECONDS || !state.firstTeam || !DraftCore.currentStep(state)) return { text: '', low: false };
    const elapsed = (Date.now() + clockOffset - state.turnStartedAt) / 1000;
    const left = Math.max(0, Math.ceil(cfg.TURN_SECONDS - elapsed));
    return { text: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, low: left <= 10 };
  }

  /**
   * Shrinks an element's font until its text fits its box. With lines > 1 it
   * then lets the text wrap (starting a bit bigger again) before shrinking further.
   */
  function fitText(el, max, min, lines = 1) {
    // Start from the theme's CSS font size (themes use different fonts/sizes), capped at max.
    el.style.fontSize = '';
    const cssSize = parseFloat(getComputedStyle(el).fontSize);
    if (isFinite(cssSize) && cssSize > 0) max = Math.min(max, Math.round(cssSize));
    min = Math.min(min, max);
    const mh = parseFloat(getComputedStyle(el).maxHeight);
    const maxH = isFinite(mh) ? mh : Infinity;     // boxes without max-height only care about width
    const over = () => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > maxH + 1;
    el.style.overflowWrap = 'normal';              // prefer shrinking over breaking words
    const shrink = (from, floor) => {
      let size = from;
      el.style.fontSize = size + 'px';
      while (size > floor && over()) el.style.fontSize = (size -= 2) + 'px';
    };
    el.style.whiteSpace = 'nowrap';
    // One line, but don't go much smaller than ~70% before trying to wrap instead.
    shrink(max, lines > 1 ? Math.max(min, Math.round(max * 0.7)) : min);
    if (lines > 1 && over()) {
      el.style.whiteSpace = 'normal';
      shrink(Math.round(max * 0.8), min);
      // Last resort for one giant word: allow breaking inside it.
      if (over()) { el.style.overflowWrap = 'anywhere'; shrink(Math.round(max * 0.8), min); }
    }
  }

  /** Keeps a fixed 1920x1080 .stage element scaled to fit the window (letterboxed). */
  function fitCanvas(stage) {
    let warn = null;
    const fit = () => {
      stage.style.setProperty('--s', Math.min(innerWidth / 1920, innerHeight / 1080));
      // Inside OBS (window.obsstudio exists) a non-16:9 Browser source leaves empty
      // bars — OBS defaults new Browser sources to 800x600. Say how to fix it.
      const wrong = global.obsstudio && Math.abs(innerWidth / innerHeight - 16 / 9) > 0.02;
      if (wrong && !warn) {
        warn = document.createElement('div');
        warn.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99;padding:10px 14px;' +
          'background:#b3122e;color:#fff;font:600 16px/1.3 sans-serif;text-align:center';
        document.body.appendChild(warn);
      }
      if (warn) {
        warn.hidden = !wrong;
        warn.textContent = `This Browser source is ${innerWidth}×${innerHeight}. ` +
          'Open its Properties and set Width 1920 and Height 1080 so the overlay fills the screen.';
      }
    };
    addEventListener('resize', fit);
    fit();
  }

  // Demo mode (?local=1) keeps data only in this browser — make that impossible to miss,
  // so nobody runs the real match (or an OBS source) on practice data by accident.
  if (!cfg.API_URL && global.self === global.top) {   // not inside the control page's preview
    const live = location.pathname + location.search.replace(/([?&])local=1(&|$)/, (m, a, b) => (b ? a : '')).replace(/\?$/, '');
    const bar = document.createElement('div');
    bar.className = 'demo-banner';
    bar.innerHTML = 'DEMO MODE: practice data saved only in this browser, NOT the Google Sheet. ' +
      'For the real match use the link without <b>local=1</b> (admins: <b>?admin=</b> your ADMIN_KEY). ' +
      `<a href="${esc(live)}">Open without demo mode</a>`;
    bar.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:999;padding:8px 14px;text-align:center;' +
      'background:#e5484d;color:#fff;font:700 15px/1.3 Inter,system-ui,sans-serif;letter-spacing:.02em';
    bar.querySelector('a').style.cssText = 'color:#fff;margin-left:10px;text-decoration:underline';
    document.body.appendChild(bar);
    if (document.body.classList.contains('control')) document.body.style.paddingTop = '38px';
  }

  global.HW = { cfg, byName, esc, initials, element, elColor, scoreTotal, timerText, fitText, fitCanvas };
})(window);
