(function () {
  const { cfg, esc, scoreTotal, fitText } = HW;
  const B = BracketCore;
  const backend = createBackend(cfg);
  const $ = (id) => document.getElementById(id);

  if (new URLSearchParams(location.search).get('bg') === '1') document.body.classList.add('bg');
  HW.brand($('title'));
  document.title = (cfg.MODE === 'hologram' ? 'Hologram Bracket — ' : 'Bracket — ') + (cfg.TITLE || 'Pick & Ban');
  HW.fitCanvas($('stage'));
  HW.backdrop($('stage'));

  const ROUND_NAMES = cfg.ROUND_NAMES || ['Round of 16', 'Quarterfinal', 'Semifinal', 'Final', 'Champion'];

  // ----- geometry on the 1920x1080 canvas (5 columns: 16, 8, 4, 2, 1 boxes)
  // With the logo (bigger header) the bracket starts lower and its rows are a little tighter.
  const withLogo = document.documentElement.classList.contains('with-logo');
  const LEFT = 64, W = 280, GAP = 98, H = 42, CHAMP_H = 76;
  const TOP = withLogo ? 214 : 160, STEP = withLogo ? 48 : 50, PAIR_GAP = withLogo ? 10 : 12;
  const colX = (c) => LEFT + c * (W + GAP);
  const centers = [[]];
  for (let j = 0; j < 16; j++) centers[0].push(TOP + j * STEP + Math.floor(j / 2) * PAIR_GAP + H / 2);
  for (let c = 1; c <= 4; c++) {
    centers[c] = [];
    for (let j = 0; j < centers[c - 1].length / 2; j++) centers[c].push((centers[c - 1][2 * j] + centers[c - 1][2 * j + 1]) / 2);
  }

  // Matches whose winner was just set (animated once; not on page load, not for undo/clear).
  let prevResults = null;
  let fresh = [];
  function newResults(b) {
    const res = b.results || {};
    const out = prevResults ? Object.keys(res).filter((id) => !prevResults[id] || prevResults[id].w !== res[id].w) : [];
    prevResults = JSON.parse(JSON.stringify(res));
    return out;
  }

  /** Display info for box j in column c (c = 4 is the champion). */
  function boxInfo(b, c, j) {
    if (c === 4) {
      const champ = B.champion(b);
      return { name: champ, cls: 'champ' + (champ ? ' win' : ' empty') + (champ && fresh.indexOf(B.mid(3, 0)) >= 0 ? ' crowned' : '') };
    }
    const name = c === 0 ? (b.players[j] || '') : B.winner(b, c - 1, j);
    const matchId = B.mid(c, Math.floor(j / 2));
    const side = j % 2 === 0 ? 'A' : 'B';
    const res = b.results[matchId];
    let cls = name ? '' : 'empty';
    let score = '';
    if (c > 0 && name && fresh.indexOf(B.mid(c - 1, j)) >= 0) cls += ' arrive';   // the winner moving up into this slot
    if (res) {
      cls += res.w === side ? ' win' : ' lose';
      if (fresh.indexOf(matchId) >= 0) cls += res.w === side ? ' just-won' : ' just-lost';
      const sc = side === 'A' ? res.sa : res.sb;
      if (sc !== null && sc !== undefined && sc !== '') score = scoreTotal([sc]) || String(sc);
    } else if (b.current === matchId && name) {
      cls += ' live';
    }
    return { name, cls, score, live: !res && b.current === matchId && name && side === 'A' };
  }

  /** A few soft sparkles (same look as the name plate ones in css/overlay.css). */
  function sparkles(n) {
    let html = '';
    for (let k = 0; k < n; k++) {
      html += `<i style="left:${(6 + Math.random() * 88).toFixed(0)}%;top:${(10 + Math.random() * 65).toFixed(0)}%;` +
        `font-size:${(7 + Math.random() * 6).toFixed(0)}px;animation-delay:${(Math.random() * 4).toFixed(2)}s;` +
        `animation-duration:${(3.2 + Math.random() * 2.2).toFixed(2)}s">✦</i>`;
    }
    return `<span class="plate-sparkles">${html}</span>`;
  }

  /** Players who lost a match: they're out, so a highlighted (glowing) player goes dark everywhere. */
  function knockedOutSet(b) {
    const out = new Set();
    Object.keys(b.results || {}).forEach((id) => {
      const p = B.parse(id), res = b.results[id];
      const loser = p && res ? B.participants(b, p.r, p.i)[res.w === 'A' ? 1 : 0] : '';
      if (loser) out.add(String(loser).trim().toUpperCase());
    });
    return out;
  }
  /** Name for the side panels: glowing if highlighted and still in the tournament. */
  const panelName = (b, name) => knockedOutSet(b).has(String(name || '').trim().toUpperCase()) ? esc(name) : HW.glowName(name);

  function render(state) {
    const b = state.bracket || B.emptyBracket();
    let html = ROUND_NAMES.map((n, c) => `<div class="col-head" style="left:${colX(c)}px">${esc(n)}</div>`).join('');
    let paths = '';

    const knockedOut = knockedOutSet(b);
    for (let c = 0; c <= 4; c++) {
      centers[c].forEach((cy, j) => {
        const info = boxInfo(b, c, j);
        const h = c === 4 ? CHAMP_H : H;
        // highlighted player (cfg.PLAYER_GLOW): their boxes glow in their colour until they're knocked out (then all go dark)
        const out = knockedOut.has(String(info.name || '').trim().toUpperCase());
        const glow = info.name && !out ? HW.glowOf(info.name) : '';
        // a highlighted player was just knocked out here: a soft goodbye ("GG ♡", their GIF fades to grey) before going dark
        const softOut = info.name && (' ' + info.cls + ' ').includes(' just-lost ') ? HW.glowOf(info.name) : '';
        const tint = glow || softOut;
        html += `<div class="box ${info.cls}${glow ? ' glow' : ''}${softOut ? ' soft-out' : ''}" style="left:${colX(c)}px;top:${cy - h / 2}px${tint ? ';--glow-c:' + esc(tint) : ''}">` +
          (c === 4 && info.name ? '<span class="trophy">🏆</span>' : '') +
          (info.name && (!out || softOut) ? HW.gifImg(info.name, 'box-gif') : '') +   // their picture/GIF (cfg.PLAYER_GIF) while still in
          (softOut ? '<span class="gg-tag">GG ♡</span>' : '') +
          (glow ? sparkles(c === 4 ? 8 : 5) : '') +   // soft sparkles, like on their name plate
          `<span class="nm">${esc(info.name || (c === 4 ? '?' : '—'))}</span>` +
          (info.score ? `<span class="sc">${esc(info.score)}</span>` : '') +
          (info.live ? '<span class="live-tag">LIVE</span>' : '') + '</div>';
      });
    }

    // connectors: each pair of boxes in column c joins into one box in column c+1
    for (let c = 0; c < 4; c++) {
      for (let m = 0; m < centers[c].length / 2; m++) {
        const x1 = colX(c) + W, xm = x1 + GAP / 2, x2 = colX(c + 1);
        const yA = centers[c][2 * m], yB = centers[c][2 * m + 1], yT = centers[c + 1][m];
        const res = b.results[B.mid(c, m)];
        const draw = res && fresh.indexOf(B.mid(c, m)) >= 0;   // just won: the line draws itself to the next round
        const cls = (side) => (res && res.w === side ? 'won' + (draw ? ' draw' : '') : '') + (c === 3 ? ' final' : '');
        const pathA = `<path class="${cls('A')}" pathLength="1" d="M${x1} ${yA} H${xm} V${yT} H${x2}"/>`;
        const pathB = `<path class="${cls('B')}" pathLength="1" d="M${x1} ${yB} H${xm} V${yT} H${x2}"/>`;
        paths += res && res.w === 'A' ? pathB + pathA : pathA + pathB;   // winner's line drawn on top
      }
    }

    $('cols').innerHTML = html;
    $('links').innerHTML = paths;
    document.querySelectorAll('.box .nm').forEach((el) => fitText(el, el.closest('.champ') ? 40 : 26, 14));
  }

  // ----- big "X wins" banner over the bracket; the final gets a champion banner + confetti
  let bannerTimer = null;
  function celebrate(b, id) {
    const p = B.parse(id), res = b.results[id];
    if (!p || !res) return;
    const name = B.participants(b, p.r, p.i)[res.w === 'A' ? 0 : 1];
    if (!name) return;
    const final = p.r === B.ROUNDS - 1;
    let el = $('win-banner');
    if (!el) { el = document.createElement('div'); el.id = 'win-banner'; $('stage').appendChild(el); }
    const glowC = HW.glowOf(name);   // highlighted player: the banner is in their colour, with their GIF and hearts
    const brk = $('break-banner'); if (brk) brk.classList.remove('show');   // one banner at a time: the result wins
    el.className = 'win-banner' + (final ? ' champion' : '') + (glowC ? ' glow-win' : '');
    if (glowC) el.style.setProperty('--glow-c', glowC); else el.style.removeProperty('--glow-c');
    el.innerHTML = `
      <div class="wb-kicker">${esc(ROUND_NAMES[p.r])} · M${p.i + 1}</div>
      ${final ? '<div class="wb-trophy">🏆</div>' : ''}
      ${glowC ? HW.gifImg(name, 'wb-gif') : ''}
      <div class="wb-name${glowC ? ' roomy' : ''}">${HW.glowName(name)}</div>
      <div class="wb-sub">${final ? 'Champion' : 'Wins · advances to ' + esc(ROUND_NAMES[p.r + 1])}</div>`;
    fitText(el.querySelector('.wb-name'), final ? 110 : 84, 36);
    if (glowC) {
      // hearts falling in their colour (more for the title)
      let hearts = '';
      for (let k = 0; k < (final ? 60 : 36); k++) {
        hearts += `<b style="left:${Math.random() * 100}%;font-size:${Math.round(18 + Math.random() * 30)}px;animation-delay:${(Math.random() * 1.4).toFixed(2)}s;` +
          `animation-duration:${(2.8 + Math.random() * 2).toFixed(2)}s;--rot:${Math.round(Math.random() * 120 - 60)}deg;--dx:${Math.round(Math.random() * 160 - 80)}px">♥</b>`;
      }
      el.insertAdjacentHTML('beforeend', `<div class="confetti hearts">${hearts}</div>`);
    }
    if (final) {
      let conf = '';
      for (let k = 0; k < 90; k++) {
        const hue = (glowC ? ['var(--glow-c)', '#fff0f7', '#ffd1e6', 'var(--gold)', '#f2f2f2'] : ['var(--gold)', '#fff6d6', '#f2f2f2', '#c9a227', 'var(--b)'])[k % 5];
        conf += `<i style="left:${Math.random() * 100}%;background:${hue};animation-delay:${(Math.random() * 1.2).toFixed(2)}s;` +
          `animation-duration:${(2.6 + Math.random() * 2).toFixed(2)}s;--rot:${Math.round(Math.random() * 720 - 360)}deg;--dx:${Math.round(Math.random() * 160 - 80)}px"></i>`;
      }
      el.insertAdjacentHTML('beforeend', `<div class="confetti">${conf}</div>`);
    }
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.remove('show'), final ? 7000 : 3600);
  }

  // ----- "Live now" panel + "Up next" list (?live=0 hides them)
  const showLive = new URLSearchParams(location.search).get('live') !== '0';
  let lastStatusKey = null;     // to flash the panel only when something new happens

  /** What's happening in the loaded match right now: { key, text, sub, progress }. */
  function phase(s, b, cur) {
    const res = b.results[b.current];
    const pp = B.participants(b, cur.r, cur.i);
    if (res) {
      const w = pp[res.w === 'A' ? 0 : 1];
      return cur.r === B.ROUNDS - 1
        ? { key: 'res', text: `${w} is the champion!`, sub: 'Final result', progress: 1, result: true }
        : { key: 'res', text: `${w} wins`, sub: `Advances to ${ROUND_NAMES[cur.r + 1]}`, progress: 1, result: true };
    }
    // Hologram: the 3 bosses are rolled before the coin toss.
    if (Array.isArray(s.bosses) && s.bosses.length < 3 && !s.firstTeam) return { key: 'bosses', text: 'Rolling bosses', sub: 'Getting ready', progress: 0 };
    if (!s.firstTeam) return { key: 'toss', text: 'Coin toss', sub: 'Getting ready', progress: 0 };
    const step = DraftCore.currentStep(s);
    const n = s.actions.length, total = s.sequence.length;
    if (step) {
      const who = s.teams[step.team];
      return step.type === 'ban'
        ? { key: 'step' + n, text: `${who} is banning`, sub: `Draft · step ${n + 1} of ${total}`, progress: n / total, side: step.team }
        : { key: 'step' + n, text: `${who} is picking`, sub: `Stage ${step.stage} pick · step ${n + 1} of ${total}`, progress: n / total, side: step.team };
    }
    const ta = B.total(s.scores.A), tb = B.total(s.scores.B);
    if (ta !== null && tb !== null) {
      return ta === tb
        ? { key: 'tie', text: 'Scores tied', sub: 'Waiting for the result', progress: 1 }
        : { key: 'lead', text: `${ta > tb ? s.teams.A : s.teams.B} leads`, sub: 'Waiting for the result', progress: 1 };
    }
    return { key: 'play', text: 'Match in progress', sub: 'Draft complete', progress: 1 };
  }

  // ----- break timer: replaces the live panel while it runs (+1 minute of "Starting soon")
  let clockOffset = 0;
  const AFTER_MS = 60000;
  function breakPhase(s) {
    if (!s.breakUntil) return '';
    const left = s.breakUntil - (Date.now() + clockOffset);
    return left > 0 ? 'run' : left > -AFTER_MS ? 'end' : '';
  }
  /** The match people are waiting for: the loaded one if undecided, else the next playable one. */
  function nextMatch(b) {
    const cur = B.parse(b.current);
    if (cur && !b.results[b.current]) return { r: cur.r, i: cur.i, p: B.participants(b, cur.r, cur.i) };
    for (let r = 0; r < B.ROUNDS; r++) for (let i = 0; i < B.count(r); i++) {
      const p = B.participants(b, r, i);
      if (p[0] && p[1] && !b.results[B.mid(r, i)]) return { r, i, p };
    }
    return null;
  }

  function renderLive(s) {
    const panel = $('live-panel'), next = $('next-panel');
    panel.hidden = next.hidden = !showLive;
    if (!showLive) return;
    const b = s.bracket || B.emptyBracket();
    const cur = B.parse(b.current);

    let key;
    const bp = breakPhase(s);
    if (bp) {
      key = 'break-' + bp + '-' + s.breakUntil;
      const nm = nextMatch(b);
      panel.className = 'live-panel break' + (bp === 'end' ? ' ended' : '');
      panel.innerHTML = `
        <div class="lp-head"><span class="lp-dot"></span><span class="lp-round">${esc(s.breakLabel || 'Break')}</span></div>
        <div class="lp-clock" id="lp-clock">${bp === 'run' ? HW.clock(s.breakUntil - (Date.now() + clockOffset)) : 'Starting soon'}</div>
        ${nm ? `<div class="lp-sub">Next · ${esc(ROUND_NAMES[nm.r])} M${nm.i + 1}</div>
        <div class="lp-next"><span class="nm">${panelName(b, nm.p[0])}</span><em>vs</em><span class="nm">${panelName(b, nm.p[1])}</span></div>` : ''}`;
      panel.querySelectorAll('.lp-next .nm').forEach((el) => fitText(el, 22, 12));
      if (bp === 'end') fitText($('lp-clock'), 64, 28);
    } else if (!cur) {
      key = 'idle';
      panel.className = 'live-panel idle';
      panel.innerHTML = B.champion(b)
        ? '<div class="lp-head"><span class="lp-round">Tournament complete</span></div><div class="lp-text">Congratulations!</div>'
        : '<div class="lp-head"><span class="lp-round">Live now</span></div><div class="lp-text muted">Waiting for the next match</div>';
    } else {
      const pp = B.participants(b, cur.r, cur.i);
      const res = b.results[b.current];
      const ph = phase(s, b, cur);
      key = b.current + '|' + ph.key + '|' + (res ? res.w : '');
      const tot = (t) => scoreTotalOrDash(res ? (t === 'A' ? res.sa : res.sb) : null, s.scores[t]);
      const won = (t) => (res ? (res.w === t ? ' won' : ' lost') : '');
      panel.className = 'live-panel' + (ph.result ? ' result' : '');
      panel.innerHTML = `
        <div class="lp-head"><span class="lp-dot"></span><span class="lp-round">${ph.result ? 'Result' : 'Live now'} · ${esc(ROUND_NAMES[cur.r])} M${cur.i + 1}</span></div>
        <div class="lp-vs">
          <div class="lp-p A${won('A')}"><span class="nm">${panelName(b, pp[0])}</span><b data-sk="TA">${esc(tot('A'))}</b></div>
          <div class="lp-p B${won('B')}"><span class="nm">${panelName(b, pp[1])}</span><b data-sk="TB">${esc(tot('B'))}</b></div>
        </div>
        <div class="lp-text${ph.side ? ' ' + ph.side : ''}">${esc(ph.text)}</div>
        <div class="lp-sub">${esc(ph.sub)}</div>
        <div class="lp-bar"><i style="width:${Math.round(ph.progress * 100)}%"></i></div>`;
      panel.querySelectorAll('.lp-p .nm').forEach((el) => fitText(el, 24, 14));
      fitText(panel.querySelector('.lp-text'), 30, 16, 2);
    }
    // Flash on anything new (not on page load).
    if (lastStatusKey !== null && key !== lastStatusKey) {
      panel.classList.remove('flash'); void panel.offsetWidth; panel.classList.add('flash');
    }
    lastStatusKey = key;

    // Up next: playable matches without a result, in bracket order (max 4).
    const ups = [];
    for (let r = 0; r < B.ROUNDS && ups.length < 4; r++) {
      for (let i = 0; i < B.count(r) && ups.length < 4; i++) {
        const id = B.mid(r, i), p = B.participants(b, r, i);
        if (id !== b.current && p[0] && p[1] && !b.results[id]) ups.push({ r, i, p });
      }
    }
    next.innerHTML = ups.length
      ? '<div class="np-head">Up next</div>' + ups.map((m) =>
        `<div class="np-row"><span class="np-round">${esc(ROUND_NAMES[m.r])} M${m.i + 1}</span><span class="np-vs">${panelName(b, m.p[0])} <em>vs</em> ${panelName(b, m.p[1])}</span></div>`).join('')
      : '';
    next.hidden = !ups.length;
    next.querySelectorAll('.np-vs').forEach((el) => fitText(el, 18, 12));
  }

  /** Total for the live panel: the saved result's score, else the sum of entered stage scores. */
  function scoreTotalOrDash(saved, stages) {
    if (saved !== null && saved !== undefined && saved !== '') return scoreTotal([saved]) || String(saved);
    return scoreTotal(stages) || '–';
  }

  let last = null;
  let lastBreak = '';
  const scoreAnim = HW.scoreWatcher();
  // ----- break started (banner + the countdown drops into the panel) / extended with +1 min ("+1:00" floats up)
  let prevBreakUntil = null;
  let breakBannerTimer = null;
  function breakChange(s) {
    const until = s.breakUntil || 0, before = prevBreakUntil;
    prevBreakUntil = until;
    const now = Date.now() + clockOffset;
    if (before && !until && before > now) {                          // stopped by hand while it was running
      panelAnim('break-stop');
      breakBanner('stopped', esc(s.breakLabel || 'Break'), 'Break over', 'Back to the match');
      return;
    }
    if (before === null || !until || until === before) return;     // page load, stopped after it ran out, or unchanged
    const panel = $('live-panel');
    if (before > now && until > before) {                           // still running: time was added
      const plus = document.createElement('span');
      plus.className = 'lp-plus';
      plus.textContent = '+' + HW.clock(until - before);
      panel.appendChild(plus);
      setTimeout(() => plus.remove(), 1600);
      panel.classList.remove('break-more'); void panel.offsetWidth; panel.classList.add('break-more');
      return;
    }
    if (until <= now) return;
    panelAnim('break-in');
    breakBanner('', esc(s.breakLabel || 'Break'), 'Break', `<b>${HW.clock(until - now)}</b> · Back soon`);
  }

  // ----- running low: last minute red + pulsing ("1 min left"), last 10 seconds pop + shake every second
  const LOW_MS = 60000, FINAL_MS = 10000;
  let wasLow = null;
  function lowTime(left, secondChanged) {
    const panel = $('live-panel');
    const low = left <= LOW_MS, final = left <= FINAL_MS;
    panel.classList.toggle('low', low);
    panel.classList.toggle('final', final);
    if (low && !panel.querySelector('.lp-low-tag')) {
      panel.insertAdjacentHTML('beforeend', `<span class="lp-low-tag">${final ? 'Final seconds' : '1 min left'}</span>`);
    }
    const tag = panel.querySelector('.lp-low-tag');
    if (tag) { if (!low) tag.remove(); else tag.textContent = final ? 'Final seconds' : '1 min left'; }
    if (low && wasLow === false) panelAnim('low-in');               // crossed into the last minute while watching
    if (final && secondChanged) {                                   // every second of the last ten
      const c = $('lp-clock');
      c.classList.remove('beat'); void c.offsetWidth; c.classList.add('beat');
      panelAnim('final-shake');
    }
    wasLow = low;
  }

  /** Big banner over the bracket (same look as the win banner). */
  function breakBanner(cls, kicker, big, sub) {
    const win = $('win-banner'); if (win) { win.classList.remove('show'); clearTimeout(bannerTimer); }   // one banner at a time
    let el = $('break-banner');
    if (!el) { el = document.createElement('div'); el.id = 'break-banner'; $('stage').appendChild(el); }
    el.className = 'win-banner break-banner ' + cls;
    el.innerHTML = `<div class="wb-kicker">${kicker}</div><div class="wb-name">${big}</div><div class="wb-sub">${sub}</div>`;
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(breakBannerTimer);
    breakBannerTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }
  /** Restart an animation class on the live panel (renderLive resets its classes, so call after it). */
  function panelAnim(cls) {
    const panel = $('live-panel');
    panel.classList.remove(cls); void panel.offsetWidth; panel.classList.add(cls);
  }

  backend.subscribe((s) => {
    last = s;
    if (s.now) clockOffset = s.now - Date.now();
    lastBreak = breakPhase(s);
    const b = s.bracket || B.emptyBracket();
    fresh = newResults(b);
    render(s); renderLive(s);
    breakChange(s);
    scoreAnim.play(scoreAnim.changes(s.scores));   // a score / point just entered: count up + pop (live panel)
    if (fresh.length) celebrate(b, fresh[fresh.length - 1]);   // usually one; on several, the latest
    fresh = [];   // re-draws later (fonts) don't replay it
  });
  // Tick the break countdown; redraw the panel when it starts, ends or hides.
  setInterval(() => {
    if (!last) return;
    const bp = breakPhase(last);
    if (bp !== lastBreak) {
      const ranOut = lastBreak === 'run' && bp === 'end';   // seen counting down on this page, now at 0:00
      lastBreak = bp; renderLive(last);
      if (ranOut) {
        panelAnim('break-up');
        breakBanner('timeup', esc(last.breakLabel || 'Break'), "Time's up", 'Starting soon');
      }
      return;
    }
    if (bp === 'run' && $('lp-clock')) {
      const left = last.breakUntil - (Date.now() + clockOffset);
      const clockEl = $('lp-clock'), text = HW.clock(left);
      const changed = clockEl.textContent !== text;
      clockEl.textContent = text;
      lowTime(left, changed);
    }
  }, 250);
  if (document.fonts) {
    // Re-fit text once web fonts arrive (also later ones, e.g. the Noir theme font).
    document.fonts.ready.then(() => last && (render(last), renderLive(last)));
    document.fonts.addEventListener("loadingdone", () => last && (render(last), renderLive(last)));
  }
})();
