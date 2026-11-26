(function () {
  const { cfg, esc, initials, elColor, byName, scoreTotal, timerText, fitText } = HW;
  const backend = createBackend(cfg);
  const $ = (id) => document.getElementById(id);

  if (new URLSearchParams(location.search).get('bg') === '1') document.body.classList.add('bg');
  $('title').textContent = cfg.TITLE || 'Pick & Ban';
  document.title = 'Overlay — ' + (cfg.TITLE || 'Pick & Ban');

  HW.fitCanvas($('stage'));

  let state = null;
  let clockOffset = 0;
  let seenFlip = null;
  let lastCount = null;   // number of actions at the previous update
  let freshIdx = -1;      // index of a just-locked action (gets the lock-in animation)

  function fitNames() {
    fitText($('name-A'), 54, 22, 2);
    fitText($('name-B'), 54, 22, 2);
    fitText($('s-team'), 40, 18, 2);
    document.querySelectorAll('.ban-name').forEach((el) => fitText(el, 40, 20));
    document.querySelectorAll('.slot .nm').forEach((el) => fitText(el, 40, 18, 2));
  }

  const mono = (name) => {
    const c = byName[name];
    return c && c.img ? `<img src="${esc(c.img)}" alt="">` : esc(initials(name));
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

  // ----- coin toss animation
  let coinTimers = [];
  function playCoin(s) {
    coinTimers.forEach(clearTimeout);
    const layer = $('coin-layer'), coin = $('coin'), cap = $('coin-caption');
    $('coin-A').textContent = s.teams.A;
    $('coin-B').textContent = s.teams.B;
    cap.classList.remove('show');
    cap.innerHTML = `<div class="win" style="color:var(--${s.firstTeam.toLowerCase()})">${esc(s.teams[s.firstTeam])} wins the toss</div><div class="sub">Bans &amp; picks first</div>`;
    layer.hidden = false;
    layer.classList.remove('out');
    coin.classList.remove('spin');
    void coin.offsetWidth;                                    // restart animation
    coin.style.setProperty('--end', (360 * 6 + (s.firstTeam === 'B' ? 180 : 0)) + 'deg');
    coin.classList.add('spin');
    fitText($('coin-A'), 42, 16, 3);
    fitText($('coin-B'), 42, 16, 3);
    fitText(cap.querySelector('.win'), 60, 28);
    coinTimers.push(setTimeout(() => cap.classList.add('show'), 2600));
    coinTimers.push(setTimeout(() => layer.classList.add('out'), 6200));
    coinTimers.push(setTimeout(() => { layer.hidden = true; }, 6700));
  }

  function onState(next) {
    state = next;
    if (next.now) clockOffset = next.now - Date.now();
    const serverNow = Date.now() + clockOffset;
    // Play each flip once per browser tab — reloading the page (e.g. switching the
    // control-page preview) must not replay a toss that was already shown.
    let played = null;
    try { played = sessionStorage.getItem('hw.coinPlayed'); } catch (_) {}
    if (next.flipAt && next.flipAt !== seenFlip && String(next.flipAt) !== played && serverNow - next.flipAt < 8000) {
      playCoin(next);
      try { sessionStorage.setItem('hw.coinPlayed', String(next.flipAt)); } catch (_) {}
    }
    if (!next.flipAt) $('coin-layer').hidden = true;
    seenFlip = next.flipAt;
    // Animate only an action that was just locked in (not old picks on page load).
    freshIdx = lastCount !== null && next.actions.length === lastCount + 1 ? next.actions.length - 1 : -1;
    lastCount = next.actions.length;
    render();
    freshIdx = -1;
  }

  backend.subscribe(onState);
  // Re-fit once the web fonts have loaded (sizes differ from the fallback font).
  if (document.fonts) {
    // Re-fit text once web fonts arrive (also later ones, e.g. the Noir theme font).
    document.fonts.ready.then(() => state && render());
    document.fonts.addEventListener("loadingdone", () => state && render());
  }
  setInterval(() => state && tick(), 250);
})();
