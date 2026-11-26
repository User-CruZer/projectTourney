(function () {
  const { cfg, esc, elColor, scoreTotal, timerText } = HW;
  const backend = createBackend(cfg);
  const $ = (id) => document.getElementById(id);

  // ----- role from URL: ?team=A&key=XXX | ?admin=XXX | (nothing) = read-only
  const params = new URLSearchParams(location.search);
  const teamParam = (params.get('team') || '').toUpperCase();
  const team = teamParam === 'A' || teamParam === 'B' ? teamParam : null;
  const adminKey = params.get('admin');
  const key = params.get('key') || adminKey || '';
  const role = adminKey ? 'admin' : team ? 'team' : 'viewer';
  const local = params.get('local') === '1';

  let state = null;
  let clockOffset = 0;
  let selected = null;
  let elementFilter = 'All';
  let query = '';
  let busy = false;
  let permaDraft = null;          // Set while editing perma bans, else null

  $('brand').textContent = cfg.TITLE || 'Pick & Ban';
  document.title = 'Control — ' + (cfg.TITLE || 'Pick & Ban');
  // Overlay preview: switch between the draft overlay and the screen-share overlay.
  const previewSrc = {
    overlay: 'overlay.html?bg=1',
    screens: 'screens.html?bg=1&guides=1',     // guides mark where the screen shares go
  };
  function showPreview(view) {
    $('preview').src = previewSrc[view] + (local ? '&local=1' : '');
    document.querySelectorAll('#preview-switch button').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
  }
  $('preview-switch').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-view]');
    if (b && !b.classList.contains('on')) showPreview(b.dataset.view);
  });
  showPreview('overlay');

  function toast(msg, ok) {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast' + (ok === 'info' ? ' info' : ok ? ' ok' : '');
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), 3000);
  }

  /** Team this browser may act for right now (admin acts for whoever is on turn). */
  function actingTeam() {
    const step = state && DraftCore.currentStep(state);
    if (!step || permaDraft) return null;
    if (role === 'admin') return step.team;
    if (role === 'team' && team === step.team) return team;
    return null;
  }

  // ---------- render
  function render() {
    if (!state) return;
    const s = state;
    const step = DraftCore.currentStep(s);

    const tl = $('turn-label');
    if (!s.firstTeam) {
      tl.className = 'turn-label';
      tl.textContent = 'Waiting for coin toss';
    } else if (!step) {
      tl.className = 'turn-label done';
      tl.textContent = 'Draft complete';
    } else {
      tl.className = 'turn-label ' + step.team;
      tl.textContent = `${s.teams[step.team]} — ${step.type === 'ban' ? 'Ban' : 'Pick · Stage ' + step.stage}`;
    }
    $('turn-step').textContent = step ? `Step ${s.actions.length + 1} / ${s.sequence.length}` : '';
    $('coin-info').innerHTML = s.firstTeam ? `Coin toss: <b>${esc(s.teams[s.firstTeam])}</b> goes first` : '';
    document.documentElement.style.setProperty('--active', step && step.team === 'B' ? 'var(--b)' : 'var(--a)');

    renderRoster();
    renderLockBar();
    renderAdmin();
    tick();
  }

  function renderRoster() {
    const s = state;
    const acting = actingTeam();
    const q = query.toLowerCase();
    $('picker-title').textContent = permaDraft ? 'Perma bans' : 'Resonators';
    $('perma-bar').hidden = !permaDraft;

    $('roster').innerHTML = cfg.ROSTER
      .filter((c) => (elementFilter === 'All' || c.element === elementFilter) && c.name.toLowerCase().includes(q))
      .map((c) => {
        const uses = s.actions.filter((a) => a.char === c.name);
        const perma = s.permaBans.includes(c.name);
        let cls = 'res';
        let tags = '';
        if (permaDraft) {
          if (permaDraft.has(c.name)) { cls += ' perma-on'; tags = '<span class="tag perma">Perma</span>'; }
        } else {
          const available = acting ? DraftCore.isAvailable(s, c.name, acting) : !perma && uses.length === 0;
          if (!available) cls += ' used';
          if (!acting) cls += ' locked';
          if (selected === c.name) cls += ' selected';
          if (perma) tags += '<span class="tag perma">Perma</span>';
          tags += uses.map((u) => u.type === 'ban' ? '<span class="tag ban">Ban</span>' : `<span class="tag ${u.team}">${u.team}</span>`).join('');
        }
        return `<div class="${cls}" style="--el:${elColor(c.name)}" data-name="${esc(c.name)}" title="${esc(c.name)} · ${esc(c.element)}"><span class="nm">${esc(c.name)}</span>${tags}</div>`;
      }).join('');
  }

  function renderLockBar() {
    const acting = actingTeam();
    const step = DraftCore.currentStep(state);
    $('lock-bar').hidden = !acting;
    if (!acting) return;
    const btn = $('lock-btn');
    const verb = step.type === 'ban' ? 'ban' : 'pick';
    btn.className = 'lock-btn' + (step.type === 'ban' ? ' ban' : '');
    btn.textContent = busy ? 'Locking…' : `Lock ${verb}`;
    btn.disabled = !selected || busy;
    const who = role === 'admin' ? ` for <b>${esc(state.teams[acting])}</b>` : '';
    $('lock-info').innerHTML = selected
      ? `${verb === 'ban' ? 'Ban' : 'Pick'} <b>${esc(selected)}</b>${who}?`
      : `Select a resonator to ${verb}${who}` + (step.type === 'pick' ? ` (stage ${step.stage})` : '');
  }

  const fillIfIdle = (el, v) => { if (document.activeElement !== el && !el.dataset.dirty) el.value = v; };

  function renderAdmin() {
    if (role !== 'admin') return;
    const s = state;
    $('admin').hidden = false;
    fillIfIdle($('name-a'), s.teams.A);
    fillIfIdle($('name-b'), s.teams.B);
    $('score-label-A').textContent = s.teams.A;
    $('score-label-B').textContent = s.teams.B;
    [['A', 0, 's-A1'], ['A', 1, 's-A2'], ['B', 0, 's-B1'], ['B', 1, 's-B2']].forEach(([t, i, id]) => fillIfIdle($(id), s.scores[t][i]));

    const flip = $('flip-btn');
    flip.disabled = s.actions.length > 0 || busy;
    if (!flip.dataset.armed) flip.textContent = s.firstTeam ? 'Flip again' : 'Flip coin';
    $('flip-hint').textContent = s.actions.length
      ? 'Locked — draft has started (reset to flip again)'
      : s.firstTeam ? `${s.teams[s.firstTeam]} won the toss` : 'Decides who bans & picks first';
    $('undo-btn').disabled = !s.actions.length || busy;
    $('perma-count').textContent = s.permaBans.length ? `${s.permaBans.length} banned: ${s.permaBans.join(', ')}` : 'None';
    $('perma-edit').disabled = !!permaDraft;
  }

  function renderFilters() {
    const els = ['All', ...Object.keys(cfg.ELEMENTS)];
    $('element-filter').innerHTML = els.map((e) =>
      `<button class="chip ${e === elementFilter ? 'on' : ''}" data-el="${e}" style="--el:${cfg.ELEMENTS[e] || ''}">${e}</button>`).join('');
  }

  function tick() {
    const t = timerText(state, clockOffset);
    $('timer').textContent = t.text;
    $('timer').classList.toggle('low', t.low);
  }

  // ---------- actions
  async function send(op, okMsg) {
    busy = true; render();
    // Google Apps Script answers in ~1–3 s; show that something is happening.
    const slow = setTimeout(() => toast('Saving…', 'info'), 250);
    try {
      setState(await backend.send({ ...op, key }));
      clearTimeout(slow);
      toast(okMsg || 'Saved', true);
      return true;
    } catch (e) {
      clearTimeout(slow);
      toast(e.message);
      return false;
    } finally {
      busy = false; render();
    }
  }

  function setState(next) {
    if (!next) return;
    const prevLen = state ? state.actions.length : -1;
    state = next;
    if (next.now) clockOffset = next.now - Date.now();
    if (next.actions.length !== prevLen) selected = null;
    render();
  }

  // ---------- events
  $('roster').addEventListener('click', (e) => {
    const el = e.target.closest('.res');
    if (!el) return;
    const name = el.dataset.name;
    if (permaDraft) {
      permaDraft.has(name) ? permaDraft.delete(name) : permaDraft.add(name);
      return renderRoster();
    }
    if (el.classList.contains('used') || el.classList.contains('locked')) return;
    selected = name === selected ? null : name;
    renderRoster(); renderLockBar();
  });
  $('roster').addEventListener('dblclick', (e) => {
    const el = e.target.closest('.res');
    if (el && !permaDraft && el.dataset.name === selected) $('lock-btn').click();
  });
  $('lock-btn').addEventListener('click', () => {
    const t = actingTeam();
    if (selected && t) send({ op: 'act', team: t, char: selected });
  });
  $('element-filter').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    elementFilter = chip.dataset.el;
    renderFilters(); renderRoster();
  });
  $('search').addEventListener('input', (e) => { query = e.target.value; renderRoster(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.activeElement.tagName !== 'INPUT' && !$('lock-btn').disabled && !$('lock-bar').hidden) $('lock-btn').click();
  });

  // admin
  document.querySelectorAll('.admin input').forEach((el) => el.addEventListener('input', () => (el.dataset.dirty = '1')));
  const clean = (...ids) => ids.forEach((id) => delete $(id).dataset.dirty);

  /**
   * In-page "tap again to confirm" — browser confirm() popups are blocked in some
   * embedded browsers (OBS docks, app webviews), which made buttons do nothing.
   */
  function armed(btn, prompt) {
    if (btn.dataset.armed) {
      clearTimeout(btn._disarm);
      delete btn.dataset.armed;
      btn.textContent = btn.dataset.label;
      btn.classList.remove('armed');
      return true;
    }
    btn.dataset.label = btn.textContent;
    btn.dataset.armed = '1';
    btn.textContent = prompt;
    btn.classList.add('armed');
    btn._disarm = setTimeout(() => {
      delete btn.dataset.armed;
      btn.textContent = btn.dataset.label;
      btn.classList.remove('armed');
    }, 4000);
    return false;
  }

  $('flip-btn').addEventListener('click', (e) => {
    if (state.firstTeam && !armed(e.currentTarget, 'Tap again to re-flip')) return;
    send({ op: 'flip' });
  });
  $('save-names').addEventListener('click', async () => {
    if (await send({ op: 'setTeams', A: $('name-a').value.trim(), B: $('name-b').value.trim() }, 'Names saved')) clean('name-a', 'name-b');
  });
  $('save-scores').addEventListener('click', async () => {
    const v = (id) => $(id).value.trim();
    if (await send({ op: 'setScores', A1: v('s-A1'), A2: v('s-A2'), B1: v('s-B1'), B2: v('s-B2') }, 'Scores saved')) clean('s-A1', 's-A2', 's-B1', 's-B2');
  });
  $('perma-edit').addEventListener('click', () => {
    permaDraft = new Set(state.permaBans);
    selected = null;
    render();
    $('roster').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('perma-cancel').addEventListener('click', () => { permaDraft = null; render(); });
  $('perma-save').addEventListener('click', async () => {
    const list = cfg.ROSTER.map((c) => c.name).filter((n) => permaDraft.has(n));
    if (await send({ op: 'setPermaBans', list }, 'Perma bans saved')) { permaDraft = null; render(); }
  });
  $('undo-btn').addEventListener('click', () => send({ op: 'undo' }));
  $('reset-btn').addEventListener('click', (e) => {
    // Clears the coin toss, all bans/picks and scores (names and perma bans stay).
    if (armed(e.currentTarget, 'Tap again to reset')) send({ op: 'reset' }, 'Match reset');
  });

  async function buildAdminLinks() {
    if (role !== 'admin') return;
    const base = location.origin + location.pathname.replace(/index\.html$/, '');
    const extra = local ? '&local=1' : '';
    let keys = { A: '', B: '' };
    if (backend.mode === 'sheets') {
      try {
        const res = await fetch(cfg.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ op: 'keys', key }) });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        keys = data.keys;
      } catch (e) { toast('Could not load captain links: ' + e.message); return; }
    }
    const cap = (t) => `${base}?team=${t}${keys[t] ? '&key=' + encodeURIComponent(keys[t]) : ''}${extra}`;
    const q = (s) => (s || local) ? '?' + [s, local && 'local=1'].filter(Boolean).join('&') : '';
    const rows = [
      ['Overlay', base + 'overlay.html' + q()],
      ['Screens', base + 'screens.html' + q()],
      ['Screens S1', base + 'screens.html' + q('stage=1')],
      ['Screens S2', base + 'screens.html' + q('stage=2')],
      ['Captain A', cap('A')],
      ['Captain B', cap('B')],
    ];
    $('admin-links').innerHTML = rows.map(([label, url]) =>
      `<div class="lrow"><b>${label}</b><a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a><button data-copy="${esc(url)}">Copy</button></div>`).join('');
  }
  $('admin-links').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-copy]');
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('Link copied', true); }
    catch (_) { toast('Copy failed — select the link instead'); }
  });

  window.addEventListener('backend-status', (e) => {
    const c = $('conn');
    c.className = 'conn ' + e.detail;
    c.querySelector('b').textContent = { live: 'Live · Google Sheets', local: 'Local demo mode', offline: 'Reconnecting…' }[e.detail];
  });

  const badge = $('role-badge');
  badge.className = 'badge ' + (role === 'admin' ? 'admin' : team || '');
  badge.textContent = role === 'admin' ? 'Admin' : role === 'team' ? `Captain · ${team}` : 'View only';

  renderFilters();
  backend.subscribe(setState);
  buildAdminLinks();
  setInterval(() => state && tick(), 250);
})();
