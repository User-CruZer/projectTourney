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

  function render(state) {
    const b = state.bracket || B.emptyBracket();
    let html = ROUND_NAMES.map((n, c) => `<div class="col-head" style="left:${colX(c)}px">${esc(n)}</div>`).join('');
    let paths = '';

    for (let c = 0; c <= 4; c++) {
      centers[c].forEach((cy, j) => {
        const info = boxInfo(b, c, j);
        const h = c === 4 ? CHAMP_H : H;
        html += `<div class="box ${info.cls}" style="left:${colX(c)}px;top:${cy - h / 2}px">` +
          (c === 4 && info.name ? '<span class="trophy">🏆</span>' : '') +
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
    el.className = 'win-banner' + (final ? ' champion' : '');
    el.innerHTML = `
      <div class="wb-kicker">${esc(ROUND_NAMES[p.r])} · M${p.i + 1}</div>
      ${final ? '<div class="wb-trophy">🏆</div>' : ''}
      <div class="wb-name">${esc(name)}</div>
      <div class="wb-sub">${final ? 'Champion' : 'Wins · advances to ' + esc(ROUND_NAMES[p.r + 1])}</div>`;
    fitText(el.querySelector('.wb-name'), final ? 110 : 84, 36);
    if (final) {
      let conf = '';
      for (let k = 0; k < 90; k++) {
        const hue = ['var(--gold)', '#fff6d6', '#f2f2f2', '#c9a227', 'var(--b)'][k % 5];
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
        <div class="lp-next"><span class="nm">${esc(nm.p[0])}</span><em>vs</em><span class="nm">${esc(nm.p[1])}</span></div>` : ''}`;
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
          <div class="lp-p A${won('A')}"><span class="nm">${esc(pp[0])}</span><b data-sk="TA">${esc(tot('A'))}</b></div>
          <div class="lp-p B${won('B')}"><span class="nm">${esc(pp[1])}</span><b data-sk="TB">${esc(tot('B'))}</b></div>
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
        `<div class="np-row"><span class="np-round">${esc(ROUND_NAMES[m.r])} M${m.i + 1}</span><span class="np-vs">${esc(m.p[0])} <em>vs</em> ${esc(m.p[1])}</span></div>`).join('')
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
  backend.subscribe((s) => {
    last = s;
    if (s.now) clockOffset = s.now - Date.now();
    lastBreak = breakPhase(s);
    const b = s.bracket || B.emptyBracket();
    fresh = newResults(b);
    render(s); renderLive(s);
    scoreAnim.play(scoreAnim.changes(s.scores));   // a score / point just entered: count up + pop (live panel)
    if (fresh.length) celebrate(b, fresh[fresh.length - 1]);   // usually one; on several, the latest
    fresh = [];   // re-draws later (fonts) don't replay it
  });
  // Tick the break countdown; redraw the panel when it starts, ends or hides.
  setInterval(() => {
    if (!last) return;
    const bp = breakPhase(last);
    if (bp !== lastBreak) { lastBreak = bp; renderLive(last); return; }
    if (bp === 'run' && $('lp-clock')) $('lp-clock').textContent = HW.clock(last.breakUntil - (Date.now() + clockOffset));
  }, 250);
  if (document.fonts) {
    // Re-fit text once web fonts arrive (also later ones, e.g. the Noir theme font).
    document.fonts.ready.then(() => last && (render(last), renderLive(last)));
    document.fonts.addEventListener("loadingdone", () => last && (render(last), renderLive(last)));
  }
})();
