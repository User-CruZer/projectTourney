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

  const mono = (name) => {
    const c = byName[name];
    return c && c.img ? `<img src="${esc(c.img)}" alt="">` : esc(initials(name));
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

    ['A', 'B'].forEach((t) => {
      $('name-' + t).textContent = s.teams[t];
      $('total-' + t).textContent = scoreTotal(s.scores[t]) || '–';
      $('guide-' + t).innerHTML = `<div>${esc(s.teams[t])} screen<small>924 × 520 · x ${t === 'A' ? 24 : 972} · y 128</small></div>`;

      const banI = s.sequence.findIndex((x) => x.team === t && x.type === 'ban');
      const ban = banI >= 0 ? s.actions[banI] : null;
      const stages = only ? [only] : [1, 2];

      $('team-' + t).className = `panel team ${t}` + (only ? ' single' : '');
      $('team-' + t).innerHTML = `
        <div class="team-head">
          <span class="label">${only ? 'Team' : 'Teams'}</span>
          <span class="ban-chip${ban ? '' : ' empty'}"><span class="tag">Ban</span><span class="nm">${ban ? esc(ban.char) : '—'}</span></span>
        </div>
        <div class="stage-rows">${stages.map((stage) => {
          const score = s.scores[t][stage - 1];
          const picks = slotsFor(s, t, stage).map((i) => {
            const a = i >= 0 ? s.actions[i] : null;
            if (a) return `<div class="pick filled" style="--el:${elColor(a.char)}"><div class="mono">${mono(a.char)}</div><div class="nm">${esc(a.char)}</div></div>`;
            return `<div class="pick${i >= 0 && i === idx ? ' active' : ''}"><span class="wait">${i >= 0 && i === idx ? 'Picking…' : '—'}</span></div>`;
          }).join('');
          return `<div class="stage-row">
            <div class="row-label">Stage<b>${stage}</b></div>
            <div class="row-picks">${picks}</div>
            <div class="row-score"><span>Score</span><b>${score !== '' ? esc(scoreTotal([score]) || score) : '–'}</b></div>
          </div>`;
        }).join('')}</div>`;
    });

    fitText($('name-A'), 42, 18, 2);
    fitText($('name-B'), 42, 18, 2);
    document.querySelectorAll('.pick .nm').forEach((el) => fitText(el, only ? 34 : 28, 16, 2));
  }

  backend.subscribe((next) => { state = next; render(); });
  if (document.fonts) document.fonts.ready.then(() => state && render());
})();
