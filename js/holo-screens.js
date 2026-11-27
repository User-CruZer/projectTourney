/* Hologram screen-share overlay: two windows, points on the plates, each player's team + boss points below. */
(function () {
  const { cfg, esc, elColor, fitText } = HW;
  const { pointBoxes, gainedPoints, mono, pickSlots } = HoloView;
  const backend = createBackend(cfg);
  const $ = (id) => document.getElementById(id);

  const params = new URLSearchParams(location.search);
  if (params.get('bg') === '1') document.body.classList.add('bg');
  if (params.get('guides') === '1') document.body.classList.add('guides');
  document.title = 'Hologram Screens — ' + (cfg.TITLE || 'Pick & Ban');
  $('title').textContent = cfg.TITLE || 'Pick & Ban';   // text title here, like the Whimpering Wastes screens overlay
  HW.fitCanvas($('stage'));
  HW.backdrop($('stage'), [[24, 180, 924, 520], [972, 180, 924, 520]]);   // the two screen-share windows stay clear

  let state = null;
  let clockOffset = 0;
  let lastCount = null;
  let freshIdx = -1;
  let lastScores = null;               // scores at the previous update
  let gained = { A: [], B: [] };       // points just given (animated once)
  const coin = HW.coinToss();
  const draftDone = HW.draftComplete();   // DRAFT COMPLETE moment after the last lock-in
  const versus = HW.matchIntro();         // VS intro when a new match-up appears
  // casino reels when the bosses are rolled
  const spin = HW.bossSpinner({ cards: () => document.querySelectorAll('#bosses .hboss'), nameSel: '.bn', fit: (el) => fitText(el, 26, 14, 2) });

  function render() {
    const s = state;
    const idx = s.actions.length;
    const bosses = s.bosses || [];

    $('perma').innerHTML = s.permaBans.length
      ? s.permaBans.map((n) => `<span class="chip" style="--el:${elColor(n)}"><i></i>${esc(n)}</span>`).join('')
      : '<span class="none">None</span>';

    ['A', 'B'].forEach((t) => {
      $('name-' + t).textContent = s.teams[t];
      $('pts-' + t).innerHTML = pointBoxes(s, t, gained[t]);
      $('guide-' + t).innerHTML = `<div>${esc(s.teams[t])} screen<small>924 × 520 · x ${t === 'A' ? 24 : 972} · y 180</small></div>`;

      const { index: banI, action: ban } = DraftCore.banAgainst(s, t);
      const banning = !ban && banI >= 0 && banI === idx;
      const picks = pickSlots(s, t).map((i) => {
        const a = i >= 0 ? s.actions[i] : null;
        if (a) return `<div class="pick filled${i === freshIdx ? ' fresh' : ''}" style="--el:${elColor(a.char)}"><div class="mono">${mono(a.char)}</div><div class="nm">${esc(a.char)}</div></div>`;
        return `<div class="pick${i >= 0 && i === idx ? ' active' : ''}"><span class="wait">${i >= 0 && i === idx ? 'Picking…' : '—'}</span></div>`;
      }).join('');
      $('team-' + t).className = `panel team ${t} single`;
      $('team-' + t).innerHTML = `
        <div class="team-head">
          <span class="label">Team</span>
          <span class="ban-chip${ban ? '' : ' empty'}${banning ? ' active' : ''}${ban && banI === freshIdx ? ' fresh' : ''}"><span class="tag">Banned</span><span class="nm">${ban ? esc(ban.char) : banning ? 'Banning…' : '—'}</span></span>
        </div>
        <div class="hrow-picks">${picks}</div>`;
    });

    // one row of the 3 bosses: player A's colour, player B's colour, both (split) or neither (grey)
    const got = (t, i) => String(((s.scores || {})[t] || [])[i]) === '1';
    $('bosses').innerHTML = [0, 1, 2].map((i) => {
      const who = (got('A', i) ? 'A' : '') + (got('B', i) ? 'B' : '');
      const b = spin.name(i, bosses[i]);
      const scored = ['A', 'B'].filter((t) => gained[t].indexOf(i) >= 0).join('');   // just given here: flash
      return `<div class="hboss${who ? ' got-' + who : ''}${spin.cls(i)}${scored ? ' scored-' + scored : ''}"><span class="n">${i + 1}</span>${HW.bossImg(b)}<span class="bn">${esc(b || 'Boss ' + (i + 1))}</span></div>`;
    }).join('');

    fitText($('name-A'), 52, 20, 2);
    fitText($('name-B'), 52, 20, 2);
    document.querySelectorAll('.pick .nm').forEach((el) => fitText(el, 26, 14, 2));
    document.querySelectorAll('.hboss .bn').forEach((el) => fitText(el, 26, 14, 2));
  }

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
})();
