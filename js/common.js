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
  // Highlighted players (cfg.PLAYER_GLOW): their name glows in their colour on every overlay.
  const glowOf = (name) => {
    const g = cfg.PLAYER_GLOW || {}, n = String(name || '').trim().toUpperCase();
    const k = n && Object.keys(g).find((x) => x.trim().toUpperCase() === n);
    return k ? g[k] : '';
  };
  /** The name as HTML, wrapped in a glowing span if the player is highlighted. */
  const glowName = (name) => {
    const c = glowOf(name);
    return c ? `<span class="glow-name" style="--glow-c:${esc(c)}">${esc(name)}</span>` : esc(name);
  };
  /** The player's GIF (cfg.PLAYER_GIF), or ''. */
  const gifOf = (name) => {
    const g = cfg.PLAYER_GIF || {}, n = String(name || '').trim().toUpperCase();
    const k = n && Object.keys(g).find((x) => x.trim().toUpperCase() === n);
    return k ? g[k] : '';
  };
  /** <img> for a player's GIF (removes itself if the file is missing), or ''. */
  const gifImg = (name, cls) => {
    const src = gifOf(name);
    const c = glowOf(name);   // frame it in their glow colour
    return src ? `<img class="${cls}" src="${esc(src)}" alt=""${c ? ` style="--glow-c:${esc(c)}"` : ''} onerror="this.remove()">` : '';
  };

  /**
   * A highlighted player just locked in a pick/ban (the elements with .fresh): make that lock-in theirs,
   * in their colour with "LOCKED IN ♡" and a little burst of hearts. Call right after the render.
   */
  function glowLock(s, freshIdx) {
    const a = freshIdx >= 0 ? s.actions[freshIdx] : null;
    const c = a ? glowOf(s.teams[a.team]) : '';
    if (!c) return;
    document.querySelectorAll('#stage .fresh').forEach((el) => {
      el.classList.add('glow-lock');
      el.style.setProperty('--glow-c', c);
      let hearts = '';
      for (let k = 0; k < 10; k++) {
        const ang = (k / 10) * 360 + Math.random() * 20, d = 60 + Math.random() * 70;
        hearts += `<i style="--a:${ang.toFixed(0)}deg;--d:${d.toFixed(0)}px;animation-delay:${(.15 + Math.random() * .2).toFixed(2)}s">♥</i>`;
      }
      el.insertAdjacentHTML('beforeend', `<span class="lock-hearts">${hearts}</span>`);
    });
  }

  /** Turn the glow on/off on an element that shows one player's name. */
  function applyGlow(el, name, off) {
    const c = off ? '' : glowOf(name);
    el.classList.toggle('glow-name', !!c);
    if (c) el.style.setProperty('--glow-c', c); else el.style.removeProperty('--glow-c');
    // the name plate around it glows too (pink border + tint), so it stands out on the white plate
    const plate = el.closest('.player, .plate');
    if (plate) {
      plate.classList.toggle('glow-plate', !!c);
      if (c) plate.style.setProperty('--glow-c', c); else plate.style.removeProperty('--glow-c');
      // a few soft sparkles twinkle and drift on their plate (made once, so re-draws don't restart them)
      let sp = plate.querySelector('.plate-sparkles');
      if (!c) { if (sp) sp.remove(); }
      else if (!sp) {
        let html = '';
        for (let k = 0; k < 9; k++) {
          html += `<i style="left:${(4 + Math.random() * 92).toFixed(0)}%;top:${(12 + Math.random() * 70).toFixed(0)}%;` +
            `font-size:${(9 + Math.random() * 9).toFixed(0)}px;animation-delay:${(Math.random() * 4).toFixed(2)}s;` +
            `animation-duration:${(3.2 + Math.random() * 2.2).toFixed(2)}s">✦</i>`;
        }
        plate.insertAdjacentHTML('afterbegin', `<span class="plate-sparkles">${html}</span>`);
      }
      // their GIF sits on the plate, on the outer side of the name
      const src = off ? '' : gifOf(name);
      let gif = plate.querySelector('.plate-gif');
      if (!src) { if (gif) gif.remove(); }
      else if (!gif || gif.dataset.src !== src) {
        if (gif) gif.remove();
        el.insertAdjacentHTML(plate.classList.contains('B') ? 'afterend' : 'beforebegin', gifImg(name, 'plate-gif'));
        gif = plate.querySelector('.plate-gif');
        if (gif) gif.dataset.src = src;
      }
    }
  }

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

  // Hologram boss pictures: img/boss-img/<slug>.webp, e.g. "The False Sovereign" → the-false-sovereign.webp.
  // A boss without a picture just shows its name (the <img> removes itself when the file is missing).
  const BOSS_DIR = cfg.BOSS_IMG_DIR || 'img/boss-img';
  const bossImg = (name, cls) => name
    ? `<img class="${cls || 'bimg'}" src="${BOSS_DIR}/${slug(name)}.webp" alt="" onerror="this.remove()">`
    : '';

  /**
   * Casino-style reels for the boss roll. Each of the 3 boss cards rolls through the boss pool
   * (fast, then slowing right down), stops with a bounce and a gold glow: boss 1 first, then 2, then 3.
   * The last reel pulses while it is the only one still turning. No spin on page load.
   *   opts.cards()  -> the 3 card elements, in order
   *   opts.nameSel  -> selector of the name element inside a card
   *   opts.fit(el)  -> optional, re-fit the name after it changes
   * The page re-draws as usual with name(i, real) and cls(i); the reels update the cards in place.
   */
  function bossSpinner(opts) {
    const POOL = cfg.HOLO_BOSSES || [];
    const STOPS = [3000, 4300, 5600];   // ms after the roll when each reel stops
    const LANDED = 1200;                // bounce + glow after a reel stops
    POOL.forEach((b) => { new Image().src = `${BOSS_DIR}/${slug(b)}.webp`; });   // preload, so the reels have pictures
    let prev = null, start = 0, run = 0;
    let finals = [];
    const shown = [null, null, null];
    const turning = () => shown.filter(Boolean).length;
    const pick = (i) => { let n; do { n = POOL[Math.floor(Math.random() * POOL.length)]; } while (n === shown[i] && POOL.length > 1); return n; };

    function cls(i) {
      if (shown[i]) return ' spinning' + (turning() === 1 ? ' tension' : '');
      const t = Date.now() - start;
      return start && t >= STOPS[i] && t < STOPS[i] + LANDED ? ' landed' : '';
    }

    // put one name on card i and restart its roll-in motion (lasting `ms`)
    function paint(i, name, ms) {
      const card = (opts.cards() || [])[i];
      if (!card) return;
      const img = card.querySelector('.bimg');
      if (img) img.src = `${BOSS_DIR}/${slug(name)}.webp`;
      const nm = card.querySelector(opts.nameSel);
      if (nm) { nm.textContent = name; if (opts.fit) opts.fit(nm); }
      card.classList.remove('spinning', 'tension', 'landed');
      cls(i).trim().split(' ').filter(Boolean).forEach((c) => card.classList.add(c));
      card.style.setProperty('--reel', Math.round(ms || 0) + 'ms');
      [img, nm].forEach((el) => { if (!el) return; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
    }

    function reel(i, myRun) {
      if (myRun !== run) return;
      const t = Date.now() - start;
      if (t >= STOPS[i]) {
        shown[i] = null;
        paint(i, finals[i], LANDED);
        for (let k = 0; k < 3; k++) if (shown[k]) paint(k, shown[k], 0);   // the last reel starts pulsing
        setTimeout(() => { if (myRun === run) { const c = (opts.cards() || [])[i]; if (c) c.classList.remove('landed'); } }, LANDED);
        return;
      }
      const p = t / STOPS[i];
      const ms = 45 + 330 * p * p * p;   // ease out: quick ticks first, a slow crawl before the stop
      shown[i] = pick(i);
      paint(i, shown[i], ms);
      setTimeout(() => reel(i, myRun), ms);
    }

    return {
      update(bosses) {
        const list = bosses || [];
        const key = JSON.stringify(list);
        if (prev !== null && key !== prev && list.length === 3 && POOL.length > 1) {
          start = Date.now();
          run++;
          finals = list.slice();
          for (let i = 0; i < 3; i++) shown[i] = pick(i);   // the next draw already spins (the result never flashes)
          const myRun = run;
          setTimeout(() => { for (let i = 0; i < 3; i++) reel(i, myRun); }, 0);
        }
        prev = key;
      },
      name: (i, real) => shown[i] || real,
      cls,
    };
  }

  const element = (name) => (byName[name] || {}).element || '';
  const elColor = (name) => cfg.ELEMENTS[element(name)] || '#8a93ad';

  /** Sum of numeric stage scores, or '' if any entered score isn't a number. */
  /**
   * Score animation for the Whimpering Wastes overlays. Score elements carry data-sk="A1" / "A2" / "B1" / "B2"
   * (stage scores) or "TA" / "TB" (totals). watch.changes(scores) says which ones just got a new value
   * (never on page load); play(changed) makes those count up from the old number and pop in gold.
   */
  function scoreWatcher() {
    let prev = null;
    const num = (v) => { const n = Number(String(v == null ? '' : v).replace(/[,\s]/g, '')); return isFinite(n) ? n : null; };
    const fmt = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    const timers = {};
    return {
      changes(scores) {
        const sc = scores || {};
        const cur = {};
        ['A', 'B'].forEach((t) => {
          [0, 1].forEach((i) => { cur[t + (i + 1)] = scoreTotal([(sc[t] || [])[i]]); });
          cur['T' + t] = scoreTotal(sc[t]);
        });
        const out = {};
        // a new non-zero value (not a reset to 0, e.g. when the next Hologram match is loaded)
        if (prev) Object.keys(cur).forEach((k) => { if (cur[k] !== '' && cur[k] !== prev[k] && num(cur[k]) !== 0) out[k] = num(prev[k]) || 0; });
        prev = cur;
        return out;
      },
      play(changed) {
        Object.keys(changed).forEach((k) => {
          document.querySelectorAll(`[data-sk="${k}"]`).forEach((el) => {
            const target = el.textContent, to = num(target), from = changed[k];
            el.classList.remove('sc-pop'); void el.offsetWidth; el.classList.add('sc-pop');
            el.addEventListener('animationend', () => el.classList.remove('sc-pop'), { once: true });
            if (to === null || to === from) return;
            const start = performance.now(), DUR = 1100;
            cancelAnimationFrame(timers[k]);
            const step = (now) => {
              if (!el.isConnected) return;
              const p = Math.min(1, (now - start) / DUR), e = 1 - Math.pow(1 - p, 3);   // ease out
              el.textContent = p < 1 ? fmt(Math.round(from + (to - from) * e)) : target;
              if (p < 1) timers[k] = requestAnimationFrame(step);
            };
            el.textContent = fmt(from);
            timers[k] = requestAnimationFrame(step);
          });
        });
      },
    };
  }

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
  /**
   * "Draft complete" moment on the draft overlays: when the last pick/ban locks in (not on page load),
   * a gold shimmer runs over every pick and a DRAFT COMPLETE band opens across the middle with both names.
   * Returns update(state); call it with every new state.
   */
  function draftComplete() {
    const $ = (id) => document.getElementById(id);
    let last = null;
    let timers = [];
    function play(s) {
      let el = $('done-layer');
      if (!el) { $('stage').insertAdjacentHTML('beforeend', '<div class="done-layer" id="done-layer" hidden></div>'); el = $('done-layer'); }
      const stage = $('stage');
      timers.forEach(clearTimeout);
      timers = [];
      el.innerHTML = `<div class="done-band"><div class="done-line"></div>
        <div class="done-title"><span>Draft</span> <b>Complete</b></div>
        <div class="done-vs"><span class="A${glowOf(s.teams.A) ? ' roomy' : ''}">${glowName(s.teams.A)}</span><em>vs</em><span class="B${glowOf(s.teams.B) ? ' roomy' : ''}">${glowName(s.teams.B)}</span></div>
        <div class="done-line"></div></div>`;
      const WAIT = 1300;                       // let the last lock-in animation play first
      timers.push(setTimeout(() => {
        // The last pick's lock-in has played by now. Drop its .fresh class, or the browser restarts that
        // lock-in when .draft-done is taken off again (it looked like the pick locked in twice).
        stage.querySelectorAll('.fresh').forEach((n) => n.classList.remove('fresh'));
        stage.classList.remove('draft-done'); void stage.offsetWidth; stage.classList.add('draft-done');
        el.hidden = false; el.classList.remove('out'); void el.offsetWidth; el.classList.add('show');
        el.querySelectorAll('.done-vs span').forEach((n) => fitText(n, 44, 20));
      }, WAIT));
      timers.push(setTimeout(() => el.classList.add('out'), WAIT + 3800));
      timers.push(setTimeout(() => { el.hidden = true; el.classList.remove('show', 'out'); stage.classList.remove('draft-done'); }, WAIT + 4400));
    }
    return function update(s) {
      const done = s.sequence.length > 0 && s.actions.length >= s.sequence.length;
      if (last === false && done) play(s);
      if (!done && last) { timers.forEach(clearTimeout); const el = $('done-layer'); if (el) el.hidden = true; $('stage').classList.remove('draft-done'); }   // undo / reset
      last = done;
    };
  }

  /**
   * "Versus" intro on the draft overlays when a new match-up appears: a match loaded from the bracket,
   * or player names saved. Both sides slam in on a diagonal split, VS crashes in the middle. Not on page load.
   * Returns update(state); call it with every new state.
   */
  function matchIntro() {
    const $ = (id) => document.getElementById(id);
    let prev = null;
    let timers = [];
    function roundLabel(s) {
      const b = s.bracket, B = global.BracketCore;
      const p = b && b.current && B ? B.parse(b.current) : null;
      if (!p) return '';
      const pp = B.participants(b, p.r, p.i);
      if (pp[0] !== s.teams.A || pp[1] !== s.teams.B) return '';      // names typed by hand, not the bracket match
      return `${(cfg.ROUND_NAMES || [])[p.r] || 'Round ' + (p.r + 1)} · M${p.i + 1}`;
    }
    function play(s) {
      dismissLayer('mw-layer');   // the previous match's winner banner gives way to the new match-up
      let el = $('vs-layer');
      if (!el) { $('stage').insertAdjacentHTML('beforeend', '<div class="vs-layer" id="vs-layer" hidden></div>'); el = $('vs-layer'); }
      timers.forEach(clearTimeout);
      timers = [];
      let sparks = '';
      for (let k = 0; k < 26; k++) {
        const a = (k / 26) * 360 + Math.random() * 10, d = 200 + Math.random() * 220;
        sparks += `<i style="--a:${a.toFixed(0)}deg;--d:${d.toFixed(0)}px"></i>`;
      }
      const label = roundLabel(s);
      el.innerHTML = `
        <div class="vs-side A"><div class="vs-stack">${gifImg(s.teams.A, 'vs-gif')}<span class="vs-name${glowOf(s.teams.A) ? ' roomy' : ''}">${glowName(s.teams.A)}</span></div></div>
        <div class="vs-side B"><div class="vs-stack">${gifImg(s.teams.B, 'vs-gif')}<span class="vs-name${glowOf(s.teams.B) ? ' roomy' : ''}">${glowName(s.teams.B)}</span></div></div>
        <div class="vs-slash"></div>
        <div class="vs-mid">
          ${label ? `<div class="vs-kicker">${esc(label)}</div>` : ''}
          <div class="vs-core"><div class="vs-ring"></div><div class="vs-sparks">${sparks}</div><div class="vs-badge">VS</div></div>
          <div class="vs-sub">Match up</div>
        </div>`;
      el.hidden = false;
      el.classList.remove('show', 'out');
      void el.offsetWidth;
      el.classList.add('show');
      el.querySelectorAll('.vs-name').forEach((n) => fitText(n, 96, 34, 2));
      timers.push(setTimeout(() => el.classList.add('out'), 3300));
      timers.push(setTimeout(() => { el.hidden = true; el.classList.remove('show', 'out'); }, 3900));
    }
    return function update(s) {
      const key = s.teams.A + '|' + s.teams.B;
      if (prev !== null && key !== prev && s.teams.A && s.teams.B) play(s);
      prev = key;
    };
  }

  /**
   * Winner moment on the draft / screens overlays: when the loaded bracket match gets its result
   * (Confirm winner / "[Name] wins"), a banner with the winner, the score and where they advance to,
   * a burst in their colour, and for the final a trophy + confetti. Not on page load.
   * Returns update(state); call it with every new state.
   */
  /** Hide a full-screen moment layer right away (a newer moment replaces it, so they never cover each other). */
  function dismissLayer(id) {
    const el = document.getElementById(id);
    if (el && !el.hidden) { el.hidden = true; el.classList.remove('show', 'out'); }
  }

  function matchWinner() {
    const $ = (id) => document.getElementById(id);
    let prev = null;
    let timer = null;
    function play(s, b, p, res) {
      const B = global.BracketCore;
      const names = B.participants(b, p.r, p.i);
      const name = names[res.w === 'A' ? 0 : 1];
      if (!name) return;
      const rounds = cfg.ROUND_NAMES || [];
      const final = p.r === B.ROUNDS - 1;
      const glowC = glowOf(name);
      const color = glowC || (res.w === 'A' ? 'var(--a)' : 'var(--b)');
      const fmt = (v) => (v === null || v === undefined || v === '' ? '' : scoreTotal([v]) || String(v));
      const sa = fmt(res.sa), sb = fmt(res.sb);
      dismissLayer('vs-layer');   // a VS intro still showing gives way to the result
      let el = $('mw-layer');
      if (!el) { $('stage').insertAdjacentHTML('beforeend', '<div class="mw-layer" id="mw-layer" hidden></div>'); el = $('mw-layer'); }
      let sparks = '';
      for (let k = 0; k < 28; k++) {
        const a = (k / 28) * 360 + Math.random() * 12, d = 260 + Math.random() * 260;
        sparks += `<i style="--a:${a.toFixed(0)}deg;--d:${d.toFixed(0)}px;animation-delay:${(.45 + Math.random() * .15).toFixed(2)}s"></i>`;
      }
      let rain = '';
      if (final || glowC) {
        for (let k = 0; k < (final ? 90 : 40); k++) {
          const heart = glowC && (!final || k % 3 === 0);
          const hue = glowC ? [glowC, '#fff0f7', 'var(--gold)'][k % 3] : ['var(--gold)', '#fff6d6', '#f2f2f2', '#c9a227', 'var(--b)'][k % 5];
          const common = `left:${Math.random() * 100}%;animation-delay:${(.6 + Math.random() * 1.4).toFixed(2)}s;animation-duration:${(2.8 + Math.random() * 2).toFixed(2)}s;--rot:${Math.round(Math.random() * 720 - 360)}deg;--dx:${Math.round(Math.random() * 160 - 80)}px`;
          rain += heart ? `<b style="${common};color:${hue};font-size:${Math.round(18 + Math.random() * 28)}px">♥</b>` : `<i style="${common};background:${hue}"></i>`;
        }
      }
      el.className = 'mw-layer' + (final ? ' champion' : '') + (glowC ? ' glow-win' : '');
      el.style.setProperty('--wc', color);
      el.innerHTML = `
        ${rain ? `<div class="mw-rain">${rain}</div>` : ''}
        <div class="mw-banner">
          <div class="mw-sparks">${sparks}</div>
          <div class="mw-kicker">${esc(rounds[p.r] || 'Round ' + (p.r + 1))} · M${p.i + 1}</div>
          ${final ? '<div class="mw-trophy">🏆</div>' : ''}
          ${glowC ? gifImg(name, 'mw-gif') : ''}
          <div class="mw-name${glowC ? ' roomy' : ''}">${glowName(name)}</div>
          ${sa !== '' && sb !== '' ? `<div class="mw-score"><span class="${res.w === 'A' ? 'won' : ''}">${esc(sa)}</span><em>–</em><span class="${res.w === 'B' ? 'won' : ''}">${esc(sb)}</span></div>` : ''}
          <div class="mw-sub">${final ? 'Champion' : 'Wins · advances to ' + esc(rounds[p.r + 1] || 'the next round')}</div>
        </div>`;
      el.hidden = false;
      el.classList.remove('show', 'out'); void el.offsetWidth; el.classList.add('show');
      fitText(el.querySelector('.mw-name'), final ? 120 : 96, 40);
      clearTimeout(timer);
      timer = setTimeout(() => {
        el.classList.add('out');
        timer = setTimeout(() => { el.hidden = true; el.classList.remove('show', 'out'); }, 600);
      }, final ? 7500 : 5000);
    }
    return function update(s) {
      const b = s.bracket, B = global.BracketCore;
      const p = b && b.current && B ? B.parse(b.current) : null;
      const res = p ? (b.results || {})[b.current] : null;
      const key = p ? b.current + ':' + (res ? res.w : '') : '';
      if (prev !== null && key !== prev && res && p) play(s, b, p, res);
      prev = key;
    };
  }

  function coinToss() {
    const $ = (id) => document.getElementById(id);
    if ($('coin-layer') && !$('coin-stage')) $('coin-layer').remove();   // an older page's own coin markup: replace it
    if (!$('coin-layer')) {
      $('stage').insertAdjacentHTML('beforeend',
        '<div class="coin-layer" id="coin-layer" hidden><div class="coin-stage" id="coin-stage">' +
        '<div class="coin-rays"></div><div class="coin-ring"></div><div class="coin-sparks" id="coin-sparks"></div>' +
        '<div class="coin" id="coin">' +
        '<div class="face A"><span id="coin-A"></span></div><div class="face B"><span id="coin-B"></span></div>' +
        '</div></div><div class="coin-caption" id="coin-caption"></div></div>');
    }
    const layer = $('coin-layer'), coin = $('coin'), cap = $('coin-caption'), stage = $('coin-stage');
    let timers = [];
    let seen = null;

    function play(s) {
      timers.forEach(clearTimeout);
      // a highlighted player's side of the coin is in their colour, with their GIF above the name
      ['A', 'B'].forEach((t) => {
        const face = $('coin-' + t), c = glowOf(s.teams[t]);
        face.parentElement.classList.toggle('glow-face', !!c);
        if (c) face.parentElement.style.setProperty('--glow-c', c); else face.parentElement.style.removeProperty('--glow-c');
        face.innerHTML = c ? `${gifImg(s.teams[t], 'coin-gif')}<span class="coin-name">${esc(s.teams[t])}</span>` : esc(s.teams[t]);
      });
      cap.classList.remove('show');
      const winGlow = glowOf(s.teams[s.firstTeam]);   // a highlighted winner: their colour for the burst and the result
      cap.innerHTML = `<div class="win" style="color:${winGlow || `var(--${s.firstTeam.toLowerCase()})`}">${winGlow ? glowName(s.teams[s.firstTeam]) : esc(s.teams[s.firstTeam])} wins the toss</div><div class="sub">Picks &amp; bans first</div>`;
      layer.hidden = false;
      layer.classList.remove('out', 'landed');
      layer.style.setProperty('--wc', winGlow || `var(--${s.firstTeam.toLowerCase()})`);   // the winner's colour
      // sparks for the landing: random directions and distances
      let sp = '';
      for (let k = 0; k < 28; k++) {
        const a = (k / 28) * 360 + Math.random() * 12, d = 220 + Math.random() * 200;
        sp += `<i style="--a:${a.toFixed(0)}deg;--d:${d.toFixed(0)}px;animation-delay:${(Math.random() * .12).toFixed(2)}s"></i>`;
      }
      $('coin-sparks').innerHTML = sp;
      coin.classList.remove('spin');
      stage.classList.remove('tossing');
      void coin.offsetWidth;                                    // restart animation
      stage.classList.add('tossing');                           // the coin flies up and comes back down while it spins
      coin.style.setProperty('--end', (360 * 8 + (s.firstTeam === 'B' ? 180 : 0)) + 'deg');   // flips end over end (rotateX), lands on the winner's face
      coin.classList.add('spin');
      ['A', 'B'].forEach((t) => {
        const n = $('coin-' + t).querySelector('.coin-name');
        if (n) fitText(n, 40, 16); else fitText($('coin-' + t), 42, 16, 3);
      });
      fitText(cap.querySelector('.win'), 60, 28);
      timers.push(setTimeout(() => { layer.classList.add('landed'); cap.classList.add('show'); }, 2600));   // impact + result
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

  global.HW = { cfg, byName, esc, initials, element, elColor, scoreTotal, timerText, clock, fitText, fitCanvas, backdrop, brand, coinToss, slug, portrait, imagesReady, IMG_DIR, bossImg, bossSpinner, scoreWatcher, draftComplete, matchIntro, glowOf, glowName, applyGlow, gifOf, gifImg, glowLock, matchWinner };
})(window);
