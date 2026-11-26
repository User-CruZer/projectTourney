/*
 * Hologram-only admin parts of the control page (hologram.html):
 *  - Bosses: roll 3 random different bosses from HOLO_BOSSES, or pick them by hand
 *    (only before the draft starts).
 *  - Points: one tick box per boss for each player; ticking saves right away.
 * Works on top of js/control.js through window.HWControl and the 'hw-state' event.
 */
(function () {
  const { cfg, esc } = HW;
  const C = window.HWControl;
  const $ = (id) => document.getElementById(id);
  const POOL = cfg.HOLO_BOSSES || [];
  let state = null;
  let manual = false;   // the "pick by hand" dropdowns are open
  const spin = HW.bossSpinner({ cards: () => document.querySelectorAll('#boss-list .boss-item'), nameSel: 'b' });   // same reels as the overlays

  function renderBossList() {
    const bosses = state.bosses || [];
    $('boss-list').innerHTML = bosses.length === 3
      ? bosses.map((real, i) => { const b = spin.name(i, real); return `<div class="boss-item${spin.cls(i)}">${HW.bossImg(b)}<span>Boss ${i + 1}</span><b>${esc(b)}</b></div>`; }).join('')
      : '<div class="hint">No bosses yet — roll them before the coin toss.</div>';
  }

  /** 3 different random bosses from the pool. */
  function rollBosses() {
    const pool = POOL.slice();
    for (let i = pool.length - 1; i > 0; i--) {   // Fisher–Yates shuffle
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 3);
  }

  function render() {
    if (!state || !C.isAdmin()) return;
    const bosses = state.bosses || [];
    const started = state.actions.length > 0;
    const busy = C.isBusy();

    // ----- bosses
    renderBossList();
    const roll = $('boss-roll');
    if (!roll.dataset.armed) roll.textContent = bosses.length === 3 ? 'Re-roll' : 'Roll bosses';
    roll.disabled = started || busy || POOL.length < 3;
    $('boss-manual').disabled = started || busy;
    $('boss-hint').textContent = started ? 'Locked — the draft has started (reset the match to change them).'
      : POOL.length < 3 ? 'Add at least 3 bosses to HOLO_BOSSES in js/config.js.' : '';
    if (started && manual) { manual = false; }
    $('boss-manual-box').hidden = !manual;

    // ----- points: 3 bosses x 2 players
    const pts = (t) => (state.scores[t] || []).filter((v) => String(v) === '1').length;
    const head = [0, 1, 2].map((i) => `<span class="col">${esc(bosses[i] || 'Boss ' + (i + 1))}</span>`).join('');
    const row = (t) => `<span class="who ${t}">${esc(state.teams[t])}</span>` +
      [0, 1, 2].map((i) => `<label class="pt"><input type="checkbox" data-t="${t}" data-i="${i}"` +
        `${String((state.scores[t] || [])[i]) === '1' ? ' checked' : ''}${busy ? ' disabled' : ''}><i></i></label>`).join('') +
      `<b class="total">${pts(t)}</b>`;
    $('points-grid').innerHTML = `<span></span>${head}<span class="col">Pts</span>${row('A')}${row('B')}`;
  }

  // ----- events
  $('boss-roll').addEventListener('click', (e) => {
    // Re-rolling replaces bosses everyone has already seen: ask for a second tap.
    if ((state.bosses || []).length === 3 && !C.armed(e.currentTarget, 'Tap again to re-roll')) return;
    C.send({ op: 'setBosses', list: rollBosses() }, 'Bosses rolled');
  });
  $('boss-manual').addEventListener('click', () => {
    manual = true;
    const cur = state.bosses || [];
    [1, 2, 3].forEach((k) => {
      $('boss-' + k).innerHTML = POOL.map((b) => `<option${b === cur[k - 1] ? ' selected' : ''}>${esc(b)}</option>`).join('');
      if (!cur[k - 1]) $('boss-' + k).selectedIndex = Math.min(k - 1, POOL.length - 1);
    });
    render();
  });
  $('boss-cancel').addEventListener('click', () => { manual = false; render(); });
  $('boss-save').addEventListener('click', async () => {
    const list = [1, 2, 3].map((k) => $('boss-' + k).value);
    if (new Set(list).size !== 3) return C.toast('Pick 3 different bosses.');
    if (await C.send({ op: 'setBosses', list }, 'Bosses saved')) { manual = false; render(); }
  });
  $('points-grid').addEventListener('change', (e) => {
    const box = e.target.closest('input[type=checkbox]');
    if (!box) return;
    const next = { A: (state.scores.A || ['0', '0', '0']).slice(), B: (state.scores.B || ['0', '0', '0']).slice() };
    next[box.dataset.t][+box.dataset.i] = box.checked ? '1' : '0';
    C.send({ op: 'setScores', A: next.A, B: next.B }, box.checked ? 'Point given' : 'Point removed');
  });

  window.addEventListener('hw-state', (e) => { state = e.detail; spin.update(state.bosses); render(); });
  if (C.getState()) { state = C.getState(); spin.update(state.bosses); render(); }
})();
