/* Hologram draft overlay: bosses, one team of 3 per player, points per boss. */
(function () {
  const { cfg, esc, elColor, timerText, fitText } = HW;
  const { pointBoxes, gainedPoints, mono, pickSlots } = HoloView;
  const backend = createBackend(cfg);
  const $ = (id) => document.getElementById(id);

  if (new URLSearchParams(location.search).get('bg') === '1') document.body.classList.add('bg');
  HW.brand($('title'));
  document.title = 'Hologram Overlay — ' + (cfg.TITLE || 'Pick & Ban');
  HW.fitCanvas($('stage'));
  HW.backdrop($('stage'));

  let state = null;
  let clockOffset = 0;
  let lastCount = null;   // number of actions at the previous update
  let freshIdx = -1;      // index of a just-locked action (gets the lock-in animation)
  let lastScores = null;               // scores at the previous update
  let gained = { A: [], B: [] };       // points just given (animated once)
  // casino reels when the bosses are rolled
  const spin = HW.bossSpinner({ cards: () => document.querySelectorAll('#bosses .boss'), nameSel: '.bname', fit: (el) => fitText(el, 30, 16, 2) });

  function fitNames() {
    fitText($('name-A'), 54, 22, 2);
    fitText($('name-B'), 54, 22, 2);
    fitText($('s-team'), 40, 18, 2);
    document.querySelectorAll('.ban-name').forEach((el) => fitText(el, 40, 20));
    document.querySelectorAll('.boss .bname').forEach((el) => fitText(el, 30, 16, 2));
    document.querySelectorAll('.boss .who').forEach((el) => fitText(el, 18, 11));
    document.querySelectorAll('.slot .nm').forEach((el) => fitText(el, 34, 16, 2));
  }

  function render() {
    const s = state;
    const step = DraftCore.currentStep(s);
    const idx = s.actions.length;

    ['A', 'B'].forEach((t) => {
      $('name-' + t).textContent = s.teams[t];
      $('pts-' + t).innerHTML = pointBoxes(s, t, gained[t]);
    });

    $('perma').innerHTML = s.permaBans.length
      ? s.permaBans.map((n) => `<span class="chip" style="--el:${elColor(n)}"><i></i>${esc(n)}</span>`).join('')
      : '<span class="none">None</span>';

    // bosses: name + whose point it is
    const bosses = s.bosses || [];
    $('bosses').innerHTML = [0, 1, 2].map((i) => {
      const b = spin.name(i, bosses[i]);
      const got = (t) => String(((s.scores || {})[t] || [])[i]) === '1';
      const scored = ['A', 'B'].filter((t) => gained[t].indexOf(i) >= 0).join('');   // just given here: flash
      return `<div class="panel boss${b ? '' : ' empty'}${spin.cls(i)}${scored ? ' scored-' + scored : ''}">
        <div class="bpic">${HW.bossImg(b)}</div>
        <div class="binfo">
          <div class="bhead"><span>Boss ${i + 1}</span></div>
          <div class="bname">${b ? esc(b) : 'Rolling…'}</div>
          <div class="bwho">${['A', 'B'].map((t) => `<span class="who ${t}${got(t) ? ' got' : ''}${gained[t].indexOf(i) >= 0 ? ' new' : ''}">${got(t) ? '✓ ' : ''}${esc(s.teams[t])}</span>`).join('')}</div>
        </div>
      </div>`;
    }).join('');

    // bans + one team per player
    ['A', 'B'].forEach((t) => {
      const { index: banI, action: ban } = DraftCore.banAgainst(s, t);
      const banBox = $('ban-' + t);
      banBox.className = `panel ban ${t}` + (ban ? ' filled' : '') + (banI === idx && banI >= 0 ? ' active' : '') + (ban && banI === freshIdx ? ' fresh' : '');
      banBox.innerHTML = `<div class="ban-label">Banned</div><div class="ban-name">${
        ban ? esc(ban.char) : banI === idx && banI >= 0 ? 'Banning…' : '—'}</div>`;

      $('team-' + t).innerHTML = `
        <div class="stage-head"><span class="stage-name">Team</span></div>
        <div class="slots">${pickSlots(s, t).map((i) => {
          const a = i >= 0 ? s.actions[i] : null;
          if (a) return `<div class="slot filled${i === freshIdx ? ' fresh' : ''}" style="--el:${elColor(a.char)}"><div class="mono">${mono(a.char)}</div><div class="nm">${esc(a.char)}</div></div>`;
          const active = i >= 0 && i === idx;
          return `<div class="slot${active ? ' active' : ''}"><span class="wait">${active ? 'Picking…' : '—'}</span></div>`;
        }).join('')}</div>`;
    });

    // centre status
    const team = $('s-team'), action = $('s-action');
    if (bosses.length < 3) {
      team.className = 's-team'; team.textContent = 'Bosses';
      action.textContent = 'Rolling…';
    } else if (!s.firstTeam) {
      team.className = 's-team'; team.textContent = 'Coin toss';
      action.textContent = 'Waiting…';
    } else if (!step) {
      team.className = 's-team'; team.textContent = 'Draft';
      action.textContent = 'Complete';
    } else {
      team.className = 's-team ' + step.team;
      team.textContent = s.teams[step.team];
      action.textContent = step.type === 'ban' ? 'Bans' : 'Picks';
    }
    fitNames();
    tick();
  }

  function tick() {
    const t = timerText(state, clockOffset);
    $('s-timer').textContent = t.text;
    $('s-timer').classList.toggle('low', t.low);
  }

  const coin = HW.coinToss();
  const draftDone = HW.draftComplete();   // DRAFT COMPLETE moment after the last lock-in
  const versus = HW.matchIntro();         // VS intro when a new match-up appears
  backend.subscribe((next) => {
    state = next;
    if (next.now) clockOffset = next.now - Date.now();
    coin(next, clockOffset);
    draftDone(next);
    versus(next);
    spin.update(next.bosses);
    gained = gainedPoints(lastScores, next.scores);
    lastScores = next.scores;
    freshIdx = lastCount !== null && next.actions.length === lastCount + 1 ? next.actions.length - 1 : -1;
    lastCount = next.actions.length;
    render();
    freshIdx = -1;
    gained = { A: [], B: [] };   // later re-draws (fonts, pictures) don't replay it
  });
  HW.imagesReady.then(() => state && render());
  if (document.fonts) {
    document.fonts.ready.then(() => state && render());
    document.fonts.addEventListener('loadingdone', () => state && render());
  }
  setInterval(() => state && tick(), 250);
})();
