(function () {
  const { cfg, esc, initials, elColor, byName, scoreTotal, timerText, fitText } = HW;
  const backend = createBackend(cfg);
  const $ = (id) => document.getElementById(id);

  if (new URLSearchParams(location.search).get('bg') === '1') document.body.classList.add('bg');
  HW.brand($('title'));
  document.title = 'Overlay — ' + (cfg.TITLE || 'Pick & Ban');

  HW.fitCanvas($('stage'));
  HW.backdrop($('stage'));

  let state = null;
  let clockOffset = 0;
  let lastCount = null;   // number of actions at the previous update
  let freshIdx = -1;      // index of a just-locked action (gets the lock-in animation)

  function fitNames() {
    fitText($('name-A'), 54, 22, 2);
    fitText($('name-B'), 54, 22, 2);
    fitText($('s-team'), 40, 18, 2);
    document.querySelectorAll('.ban-name').forEach((el) => fitText(el, 40, 20));
    document.querySelectorAll('.slot .nm').forEach((el) => fitText(el, 40, 16, 2));
  }

  // Portrait from img/resonator-img (see js/common.js), or coloured initials if there is none.
  const mono = (name) => {
    const url = HW.portrait(name);
    return url ? `<img src="${esc(url)}" alt="">` : esc(initials(name));
  };

  function render() {
    const s = state;
    const step = DraftCore.currentStep(s);
    const idx = s.actions.length;

    $('name-A').textContent = s.teams.A;
    $('name-B').textContent = s.teams.B;
    $('total-A').textContent = scoreTotal(s.scores.A) || '–';
    $('total-B').textContent = scoreTotal(s.scores.B) || '–';

    // perma bans
    $('perma').innerHTML = s.permaBans.length
      ? s.permaBans.map((n) => `<span class="chip" style="--el:${elColor(n)}"><i></i>${esc(n)}</span>`).join('')
      : '<span class="none">None</span>';

    // bans + stage slots, laid out from the sequence
    ['A', 'B'].forEach((t) => {
      // Ban box on a player's side = the resonator banned AGAINST them (by the opponent).
      const { index: banI, action: ban } = DraftCore.banAgainst(s, t);
      const banBox = $('ban-' + t);
      banBox.className = `panel ban ${t}` + (ban ? ' filled' : '') + (banI === idx && banI >= 0 ? ' active' : '') + (ban && banI === freshIdx ? ' fresh' : '');
      banBox.innerHTML = `<div class="ban-label">Banned</div><div class="ban-name">${
        ban ? esc(ban.char) : banI === idx && banI >= 0 ? 'Banning…' : '—'}</div>`;

      [1, 2].forEach((stage) => {
        const box = $(`stage-${t}-${stage}`);
        const steps = [];
        s.sequence.forEach((x, i) => { if (x.team === t && x.stage === stage) steps.push(i); });
        while (steps.length < 3) steps.push(-1);            // before the coin toss
        const score = s.scores[t][stage - 1];
        box.innerHTML = `
          <div class="stage-head">
            <span class="stage-name">Stage ${stage}</span>
            <span class="stage-score"><small>Score</small>${score !== '' ? esc(scoreTotal([score]) || score) : '–'}</span>
          </div>
          <div class="slots">${steps.map((i) => {
            const a = i >= 0 ? s.actions[i] : null;
            if (a) return `<div class="slot filled${i === freshIdx ? ' fresh' : ''}" style="--el:${elColor(a.char)}"><div class="mono">${mono(a.char)}</div><div class="nm">${esc(a.char)}</div></div>`;
            const active = i >= 0 && i === idx;
            return `<div class="slot${active ? ' active' : ''}"><span class="wait">${active ? 'Picking…' : '—'}</span></div>`;
          }).join('')}</div>`;
      });
    });

    // center status
    const team = $('s-team'), action = $('s-action');
    if (!s.firstTeam) {
      team.className = 's-team'; team.textContent = 'Coin toss';
      action.textContent = 'Waiting…';
    } else if (!step) {
      team.className = 's-team'; team.textContent = 'Draft';
      action.textContent = 'Complete';
    } else {
      team.className = 's-team ' + step.team;
      team.textContent = s.teams[step.team];
      action.textContent = step.type === 'ban' ? 'Bans' : `Pick · Stage ${step.stage}`;
    }
    fitNames();
    tick();
  }

  function tick() {
    const t = timerText(state, clockOffset);
    const el = $('s-timer');
    el.textContent = t.text;
    el.classList.toggle('low', t.low);
  }

  // Coin toss animation (shared with the screens overlay)
  const coin = HW.coinToss();

  function onState(next) {
    state = next;
    if (next.now) clockOffset = next.now - Date.now();
    coin(next, clockOffset);
    // Animate only an action that was just locked in (not old picks on page load).
    freshIdx = lastCount !== null && next.actions.length === lastCount + 1 ? next.actions.length - 1 : -1;
    lastCount = next.actions.length;
    render();
    freshIdx = -1;
  }

  backend.subscribe(onState);
  // Re-fit once the web fonts have loaded (sizes differ from the fallback font).
  HW.imagesReady.then(() => state && render());   // redraw once portraits are found
  if (document.fonts) {
    // Re-fit text once web fonts arrive (also later ones, e.g. the Noir theme font).
    document.fonts.ready.then(() => state && render());
    document.fonts.addEventListener("loadingdone", () => state && render());
  }
  setInterval(() => state && tick(), 250);
})();
