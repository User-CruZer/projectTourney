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

  // ---------- resonator portraits ----------
  // Put pictures in img/resonator-img/ named by the resonator's slug, e.g.
  // "Rover (Spectro)" → rover-spectro.png, "Yangyang: Xuanling" → yangyang-xuanling.webp.
  // Each name is probed once at load (webp, png, jpg); missing ones keep their initials.
  const IMG_DIR = cfg.IMG_DIR || 'img/resonator-img';
  const IMG_EXTS = ['webp', 'png', 'jpg'];
  const slug = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const portraits = {};                                   // name -> url (only found ones)
  const probe = (url) => new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(url);
    im.onerror = () => resolve(null);
    im.src = url;
  });
  const imagesReady = Promise.all(cfg.ROSTER.map(async (c) => {
    if (c.img) { portraits[c.name] = c.img; return; }      // explicit img in config wins
    for (const ext of IMG_EXTS) {
      const url = `${IMG_DIR}/${slug(c.name)}.${ext}`;
      if (await probe(url)) { portraits[c.name] = url; return; }
    }
  }));
  const portrait = (name) => portraits[name] || null;

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

  /** Puts the tournament logo (cfg.LOGO) in el, or the TITLE text when there is no logo. */
  function brand(el) {
    if (!el) return;
    const title = cfg.TITLE || 'Pick & Ban';
    if (cfg.LOGO) {
      el.innerHTML = `<img class="brand-logo" src="${esc(cfg.LOGO)}" alt="${esc(title)}">`;
      el.classList.add('has-logo');
      document.documentElement.classList.add('with-logo');   // page-level hook for layout tweaks (no CSS :has, which older OBS lacks)
    } else {
      el.textContent = title;
    }
  }

  /** Milliseconds → "m:ss" (or "h:mm:ss"), rounded up so it never shows 0:00 while time is left. */
  function clock(ms) {
    const t = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = String(t % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
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

  /**
   * Coin-toss animation shared by the overlays (draft and screens). Uses #coin-layer
   * inside #stage, adding it if the page doesn't have one. Returns update(state, clockOffset),
   * to be called on every state update: it plays each new flip once.
   */
  function coinToss() {
    const $ = (id) => document.getElementById(id);
    if (!$('coin-layer')) {
      $('stage').insertAdjacentHTML('beforeend',
        '<div class="coin-layer" id="coin-layer" hidden><div class="coin" id="coin">' +
        '<div class="face A"><span id="coin-A"></span></div><div class="face B"><span id="coin-B"></span></div>' +
        '</div><div class="coin-caption" id="coin-caption"></div></div>');
    }
    const layer = $('coin-layer'), coin = $('coin'), cap = $('coin-caption');
    let timers = [];
    let seen = null;

    function play(s) {
      timers.forEach(clearTimeout);
      $('coin-A').textContent = s.teams.A;
      $('coin-B').textContent = s.teams.B;
      cap.classList.remove('show');
      cap.innerHTML = `<div class="win" style="color:var(--${s.firstTeam.toLowerCase()})">${esc(s.teams[s.firstTeam])} wins the toss</div><div class="sub">Picks &amp; bans first</div>`;
      layer.hidden = false;
      layer.classList.remove('out');
      coin.classList.remove('spin');
      void coin.offsetWidth;                                    // restart animation
      coin.style.setProperty('--end', (360 * 6 + (s.firstTeam === 'B' ? 180 : 0)) + 'deg');
      coin.classList.add('spin');
      fitText($('coin-A'), 42, 16, 3);
      fitText($('coin-B'), 42, 16, 3);
      fitText(cap.querySelector('.win'), 60, 28);
      timers.push(setTimeout(() => cap.classList.add('show'), 2600));
      timers.push(setTimeout(() => layer.classList.add('out'), 6200));
      timers.push(setTimeout(() => { layer.hidden = true; }, 6700));
    }

    return function update(next, clockOffset) {
      const serverNow = Date.now() + (clockOffset || 0);
      // Play each flip once per browser tab: reloading the page (e.g. switching the
      // control-page preview) must not replay a toss that was already shown.
      let played = null;
      try { played = sessionStorage.getItem('hw.coinPlayed'); } catch (_) {}
      if (next.flipAt && next.flipAt !== seen && String(next.flipAt) !== played && serverNow - next.flipAt < 8000) {
        play(next);
        try { sessionStorage.setItem('hw.coinPlayed', String(next.flipAt)); } catch (_) {}
      }
      if (!next.flipAt) layer.hidden = true;
      seen = next.flipAt;
    };
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

  /**
   * Background of the 1920x1080 canvas: grey in the middle fading to black at the edges.
   * holes = [[x, y, w, h], …] are left see-through (the screen-share windows).
   * ?bg=0 turns it off (fully transparent overlay, as before).
   */
  function backdrop(stage, holes = []) {
    if (new URLSearchParams(location.search).get('bg') === '0') return;
    const r = (x, y, w, h) => `M${x} ${y}h${w}v${h}h${-w}Z`;
    stage.insertAdjacentHTML('afterbegin',
      '<svg class="backdrop" width="1920" height="1080" viewBox="0 0 1920 1080" aria-hidden="true">' +
      '<defs><radialGradient id="bd-grad" cx="50%" cy="50%" r="75%">' +
      '<stop offset="0" stop-color="#3a3a3a"/><stop offset=".45" stop-color="#1c1c1c"/><stop offset="1" stop-color="#030303"/>' +
      '</radialGradient></defs>' +
      `<path fill="url(#bd-grad)" fill-rule="evenodd" d="${r(0, 0, 1920, 1080)}${holes.map((h) => r(...h)).join('')}"/></svg>`);
  }

  // Demo mode (?local=1) keeps data only in this browser — make that impossible to miss,
  // so nobody runs the real match (or an OBS source) on practice data by accident.
  if (!cfg.API_URL && global.self === global.top) {   // not inside the control page's preview
    // Same page without demo mode. Drop the demo placeholder admin=1 too (it isn't a real key).
    const lp = new URLSearchParams(location.search);
    lp.delete('local');
    if (lp.get('admin') === '1') lp.delete('admin');
    const live = location.pathname + (lp.toString() ? '?' + lp : '');
    const bar = document.createElement('div');
    bar.className = 'demo-banner';
    bar.innerHTML = 'DEMO MODE: practice data saved only in this browser, NOT the Google Sheet. ' +
      'For the real match use the link without <b>local=1</b>. ' +
      `<a href="${esc(live)}">Open without demo mode</a>`;
    bar.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:999;padding:8px 14px;text-align:center;' +
      'background:#e5484d;color:#fff;font:700 15px/1.3 Inter,system-ui,sans-serif;letter-spacing:.02em';
    bar.querySelector('a').style.cssText = 'color:#fff;margin-left:10px;text-decoration:underline';
    document.body.appendChild(bar);
    if (document.body.classList.contains('control')) document.body.style.paddingTop = '38px';
  }

  global.HW = { cfg, byName, esc, initials, element, elColor, scoreTotal, timerText, clock, fitText, fitCanvas, backdrop, brand, coinToss, slug, portrait, imagesReady, IMG_DIR };
})(window);
