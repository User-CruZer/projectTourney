(function () {
  const { cfg, esc, initials, elColor, byName, scoreTotal, fitText } = HW;
  const backend = createBackend(cfg);
  const $ = (id) => document.getElementById(id);

  const params = new URLSearchParams(location.search);
  const only = ['1', '2'].includes(params.get('stage')) ? Number(params.get('stage')) : 0;
  if (params.get('bg') === '1') document.body.classList.add('bg');
  if (params.get('guides') === '1') document.body.classList.add('guides');
  document.title = 'Screens — ' + (cfg.TITLE || 'Pick & Ban');
  $('title').textContent = cfg.TITLE || 'Pick & Ban';
  $('stage-tag').textContent = only ? `Stage ${only}` : 'VS';
  HW.fitCanvas($('stage'));

  let state = null;
  let clockOffset = 0;
  let lastCount = null;   // number of actions at the previous update
  let freshIdx = -1;      // index of a just-locked action (gets the lock-in animation)
  const coin = HW.coinToss();   // same coin toss animation as the draft overlay

  // Portrait from img/resonator-img (see js/common.js), or coloured initials if there is none.
  const mono = (name) => {
    const url = HW.portrait(name);
    return url ? `<img src="${esc(url)}" alt="">` : esc(initials(name));
  };

  /** Sequence indexes of a player's picks in a stage (always 3 slots). */
  function slotsFor(s, team, stage) {
    const out = [];
    s.sequence.forEach((x, i) => { if (x.team === team && x.stage === stage) out.push(i); });
    while (out.length < 3) out.push(-1);
    return out;
  }

  function render() {
    const s = state;
    const idx = s.actions.length;

    // perma bans (same chips as the draft overlay)
    $('perma').innerHTML = s.permaBans.length
      ? s.permaBans.map((n) => `<span class="chip" style="--el:${elColor(n)}"><i></i>${esc(n)}</span>`).join('')
      : '<span class="none">None</span>';

    ['A', 'B'].forEach((t) => {
      $('name-' + t).textContent = s.teams[t];
      $('total-' + t).textContent = scoreTotal(s.scores[t]) || '–';
      $('guide-' + t).innerHTML = `<div>${esc(s.teams[t])} screen<small>924 × 520 · x ${t === 'A' ? 24 : 972} · y 128</small></div>`;

      const { index: banI, action: ban } = DraftCore.banAgainst(s, t);   // banned against this player
      const banning = !ban && banI >= 0 && banI === idx;
      const stages = only ? [only] : [1, 2];

      $('team-' + t).className = `panel team ${t}` + (only ? ' single' : '');
      $('team-' + t).innerHTML = `
        <div class="team-head">
          <span class="label">${only ? 'Team' : 'Teams'}</span>
          <span class="ban-chip${ban ? '' : ' empty'}${banning ? ' active' : ''}${ban && banI === freshIdx ? ' fresh' : ''}"><span class="tag">Banned</span><span class="nm">${ban ? esc(ban.char) : banning ? 'Banning…' : '—'}</span></span>
        </div>
        <div class="stage-rows">${stages.map((stage) => {
          const score = s.scores[t][stage - 1];
          const picks = slotsFor(s, t, stage).map((i) => {
            const a = i >= 0 ? s.actions[i] : null;
            if (a) return `<div class="pick filled${i === freshIdx ? ' fresh' : ''}" style="--el:${elColor(a.char)}"><div class="mono">${mono(a.char)}</div><div class="nm">${esc(a.char)}</div></div>`;
            return `<div class="pick${i >= 0 && i === idx ? ' active' : ''}"><span class="wait">${i >= 0 && i === idx ? 'Picking…' : '—'}</span></div>`;
          }).join('');
          return `<div class="stage-row">
            <div class="row-label">Stage<b>${stage}</b></div>
            <div class="row-picks">${picks}</div>
            <div class="row-score"><span>Score</span><b>${score !== '' ? esc(scoreTotal([score]) || score) : '–'}</b></div>
          </div>`;
        }).join('')}</div>`;
    });

    fitText($('name-A'), 52, 20, 2);
    fitText($('name-B'), 52, 20, 2);
    document.querySelectorAll('.pick .nm').forEach((el) => fitText(el, only ? 38 : 18, only ? 16 : 11, only ? 2 : 1));
  }

  backend.subscribe((next) => {
    state = next;
    if (next.now) clockOffset = next.now - Date.now();
    coin(next, clockOffset);
    // Animate only an action that was just locked in (not old picks on page load).
    freshIdx = lastCount !== null && next.actions.length === lastCount + 1 ? next.actions.length - 1 : -1;
    lastCount = next.actions.length;
    render();
    freshIdx = -1;
  });
  HW.imagesReady.then(() => state && render());   // redraw once portraits are found
  if (document.fonts) {
    // Re-fit text once web fonts arrive (also later ones, e.g. the Noir theme font).
    document.fonts.ready.then(() => state && render());
    document.fonts.addEventListener("loadingdone", () => state && render());
  }
})();
