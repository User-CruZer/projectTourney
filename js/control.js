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
  // let: becomes 'admin' for everyone (without ?team=) when the server has open access (testing).
  let role = adminKey ? 'admin' : team ? 'team' : 'viewer';
  const local = params.get('local') === '1';
  // Hologram uses this same control page (hologram.html); js/holo-admin.js adds bosses + points.
  const HOLO = cfg.MODE === 'hologram';

  // Top navigation: the current page's link keeps this URL (key included); the other tournament
  // opens without a key (each has its own), but stays in demo mode when this page is in demo mode.
  document.querySelectorAll('#topnav a').forEach((a) => {
    if (a.classList.contains('here')) a.href = location.pathname.split('/').pop() + location.search;
    else if (local && !a.classList.contains('home')) a.href += '?local=1';
    // The other tournament: ask for its organizer code (or guest), like the start page.
    if (!a.classList.contains('here') && !a.classList.contains('home')) a.addEventListener('click', (e) => {
      if (window.HWGate && HWGate.open(a.getAttribute('href').split('?')[0])) e.preventDefault();
    });
  });

  let state = null;
  let clockOffset = 0;
  let selected = null;
  let elementFilter = 'All';
  let query = '';
  let busy = false;
  let permaDraft = null;          // Set while editing perma bans, else null

  HW.brand($('brand'));
  document.title = (HOLO ? 'Hologram' : 'Whimpering Wastes') + ' — Control — ' + (cfg.TITLE || 'Pick & Ban');
  // Overlay preview: switch between the draft overlay and the screen-share overlay.
  const pre = HOLO ? 'holo-' : '';
  const previewSrc = {
    overlay: pre + 'overlay.html?bg=1',
    screens: pre + 'screens.html?bg=1&guides=1',     // guides mark where the screen shares go
    bracket: pre + 'bracket.html?bg=1',
  };
  function showPreview(view) {
    // Unique URL each time so the browser never shows a stale cached copy of the page.
    $('preview').src = previewSrc[view] + (local ? '&local=1' : '') + '&r=' + Date.now();
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
      tl.textContent = step.type === 'ban'
        ? `${s.teams[step.team]} bans`
        : `${s.teams[step.team]} picks` + (HOLO ? '' : ` · Stage ${step.stage}`);
    }
    $('turn-step').textContent = step ? `Step ${s.actions.length + 1} / ${s.sequence.length}` : '';
    $('coin-info').innerHTML = s.firstTeam ? `Coin toss: <b>${esc(s.teams[s.firstTeam])}</b> goes first` : '';
    document.documentElement.style.setProperty('--active', step && step.team === 'B' ? 'var(--b)' : 'var(--a)');

    renderRoster();
    renderLockBar();
    renderAdmin();
    tick();
    window.dispatchEvent(new CustomEvent('hw-state', { detail: s }));   // js/holo-admin.js listens
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
          // Ban tag names the player who can't use it (the opponent of whoever banned it).
          tags += uses.map((u) => u.type === 'ban'
            ? `<span class="tag ban" title="${esc(s.teams[u.team === 'A' ? 'B' : 'A'])} can't use this">✕ ${esc(s.teams[u.team === 'A' ? 'B' : 'A'])}</span>`
            : `<span class="tag ${u.team}" title="Picked by ${esc(s.teams[u.team])}">${esc(s.teams[u.team])}</span>`).join('');
        }
        return `<div class="${cls}" style="--el:${elColor(c.name)}" data-name="${esc(c.name)}" title="${esc(c.name)} · ${esc(c.element)}">${HW.portrait(c.name) ? `<img class="av" src="${esc(HW.portrait(c.name))}" alt="">` : ''}<span class="nm">${esc(c.name)}</span>${tags}</div>`;
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
    // Plain wording, e.g. "JAYNX bans Carlotta → KARLENKA can't use it".
    // Captains see "You" instead of their own name.
    const me = role === 'admin' ? `<b>${esc(state.teams[acting])}</b>` : 'You';
    const opp = `<b>${esc(state.teams[acting === 'A' ? 'B' : 'A'])}</b>`;
    const bans = role === 'admin' ? 'bans' : 'ban';
    const picks = role === 'admin' ? 'picks' : 'pick';
    $('lock-info').innerHTML = verb === 'ban'
      ? (selected
        ? `${me} ${bans} <b>${esc(selected)}</b> → ${opp} can't use it<span class="tap-hint">or double-tap it to lock</span>`
        : `${me} ${bans} next: choose a resonator ${opp} can't use`)
      : (selected
        ? `${me} ${picks} <b>${esc(selected)}</b> ${HOLO ? 'for the team' : `for Stage ${step.stage}`}<span class="tap-hint">or double-tap it to lock</span>`
        : `${me} ${picks} next: choose a resonator ${HOLO ? 'for the team' : `for Stage ${step.stage}`}`);
  }

  const fillIfIdle = (el, v) => { if (document.activeElement !== el && !el.dataset.dirty) el.value = v; };

  function renderAdmin() {
    if (role !== 'admin') return;
    const s = state;
    $('admin').hidden = false;
    $('bracket-card').hidden = false;
    fillIfIdle($('name-a'), s.teams.A);
    fillIfIdle($('name-b'), s.teams.B);
    if (!HOLO) {   // Whimpering Wastes stage scores (Hologram points: js/holo-admin.js)
      $('score-label-A').textContent = s.teams.A;
      $('score-label-B').textContent = s.teams.B;
      [['A', 0, 's-A1'], ['A', 1, 's-A2'], ['B', 0, 's-B1'], ['B', 1, 's-B2']].forEach(([t, i, id]) => fillIfIdle($(id), s.scores[t][i]));
    }

    const flip = $('flip-btn');
    const needBosses = HOLO && (!s.bosses || s.bosses.length !== 3);   // Hologram: roll the bosses before the toss
    flip.disabled = s.actions.length > 0 || busy || needBosses;
    if (!flip.dataset.armed) flip.textContent = s.firstTeam ? 'Flip again' : 'Flip coin';
    $('flip-hint').textContent = needBosses ? 'Roll the bosses first'
      : s.actions.length
      ? 'Locked — draft has started (reset to flip again)'
      : s.firstTeam ? `${s.teams[s.firstTeam]} won the toss` : 'Decides who bans & picks first';
    $('undo-btn').disabled = !s.actions.length || busy;
    $('perma-count').textContent = s.permaBans.length ? `${s.permaBans.length} banned: ${s.permaBans.join(', ')}` : 'None';
    $('perma-edit').disabled = !!permaDraft;
    renderBracketAdmin();
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
    if (role === 'admin') renderBreak();
  }

  // ---------- break timer (countdown on the bracket overlay)
  const breakLeft = () => (state && state.breakUntil ? Math.max(0, state.breakUntil - (Date.now() + clockOffset)) : 0);
  function renderBreak() {
    const on = !!(state && state.breakUntil), left = breakLeft();
    const st = $('break-status');
    st.classList.toggle('on', on);
    st.textContent = !on ? 'Custom: minutes (7) or minutes:seconds (4:30 · 0:45 = 45 sec). Shows a countdown on the bracket overlay.'
      : left > 0 ? `Running${state.breakLabel ? ' · ' + state.breakLabel : ''} · ${HW.clock(left)} left`
      : 'Time is up: the overlay shows "Starting soon" for a minute, then hides the timer. Press Stop to hide it now.';
    $('break-add').disabled = !on || busy;
    $('break-stop').disabled = !on || busy;
    document.querySelectorAll('[data-break], #break-start').forEach((b) => (b.disabled = busy));
    fillIfIdle($('break-label'), state ? state.breakLabel || '' : '');
  }
  /** "7" → 420, "2.5" → 150, "4:30" → 270 (minutes, or m:ss). NaN if it can't be read. */
  function parseDuration(v) {
    v = String(v).trim();
    const m = /^(\d{1,3}):([0-5]?\d)$/.exec(v);
    if (m) return +m[1] * 60 + +m[2];
    const n = Number(v.replace(',', '.'));
    return v && isFinite(n) && n > 0 ? Math.round(n * 60) : NaN;
  }
  const startBreak = async (secs) => {
    if (await send({ op: 'setBreak', seconds: secs, label: $('break-label').value.trim() }, `Break timer started: ${HW.clock(secs * 1000)}`)) clean('break-label');
  };
  document.querySelectorAll('[data-break]').forEach((b) => b.addEventListener('click', () => startBreak(+b.dataset.break)));
  $('break-start').addEventListener('click', () => {
    const secs = parseDuration($('break-time').value);
    if (!(secs > 0) || secs > 3 * 3600) return toast('Enter minutes (7, 2.5) or minutes:seconds (4:30, 0:45). Max 3 hours.');
    startBreak(secs);
  });
  $('break-time').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('break-start').click(); });
  $('break-add').addEventListener('click', () => {
    send({ op: 'setBreak', seconds: Math.ceil(breakLeft() / 1000) + 60, label: $('break-label').value.trim() }, 'Added 1 minute');
  });
  $('break-stop').addEventListener('click', () => send({ op: 'setBreak', seconds: 0, label: '' }, 'Break timer stopped'));

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
    if (next.openAccess && role === 'viewer') { role = 'admin'; updateBadge(); buildAdminLinks(); }
    if (next.now) clockOffset = next.now - Date.now();
    if (next.actions.length !== prevLen) selected = null;
    render();
  }

  // ---------- events
  // Tap a resonator to select it; tap the same one again quickly (double-click / double-tap) to lock it in.
  // Timed by hand: the first tap redraws the list, so the browser's own dblclick often never fires,
  // and phones don't send dblclick at all.
  const DOUBLE_TAP_MS = 450;
  let lastTap = { name: null, at: 0 };
  $('roster').addEventListener('click', (e) => {
    const el = e.target.closest('.res');
    if (!el) return;
    const name = el.dataset.name;
    if (permaDraft) {
      permaDraft.has(name) ? permaDraft.delete(name) : permaDraft.add(name);
      return renderRoster();
    }
    if (el.classList.contains('used') || el.classList.contains('locked')) return;
    const now = Date.now();
    const double = lastTap.name === name && now - lastTap.at < DOUBLE_TAP_MS;
    lastTap = double ? { name: null, at: 0 } : { name, at: now };
    if (double) {                                   // second tap: lock in (the Lock button does the checks)
      if (selected !== name) { selected = name; renderRoster(); renderLockBar(); }
      $('lock-btn').click();
      return;
    }
    selected = name === selected ? null : name;
    renderRoster(); renderLockBar();
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
    const typing = ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(document.activeElement.tagName);
    if (e.key === 'Enter' && !typing && !$('lock-btn').disabled && !$('lock-bar').hidden) $('lock-btn').click();
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
  if (!HOLO) $('save-scores').addEventListener('click', async () => {
    const v = (id) => $(id).value.trim();
    const bad = ['s-A1', 's-A2', 's-B1', 's-B2'].filter((id) => v(id) !== '' && !isFinite(Number(v(id).replace(/[,\s]/g, ''))));
    if (bad.length) return toast('Scores must be numbers, e.g. 12500 or 12,500.');
    if (await send({ op: 'setScores', A1: v('s-A1'), A2: v('s-A2'), B1: v('s-B1'), B2: v('s-B2') }, 'Scores saved')) clean('s-A1', 's-A2', 's-B1', 's-B2');
  });
  // Enter in the score boxes, one stage at a time: player 1's box ⏎ → player 2's box (same stage) ⏎ → saved.
  // Enter on an empty box also saves.
  const SCORE_NEXT = { 's-A1': 's-B1', 's-B1': null, 's-A2': 's-B2', 's-B2': null };
  if (!HOLO) Object.keys(SCORE_NEXT).forEach((id) => $(id).addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    e.stopPropagation();   // this Enter is for the scores, never the page-wide "Enter = lock in" shortcut
    const next = SCORE_NEXT[id];
    if (!$(id).value.trim() || !next) { $(id).blur(); $('save-scores').click(); return; }
    $(next).focus();
    $(next).select();
  }));
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
    const base = location.origin + location.pathname.replace(/[^/]*$/, '');   // folder of this page
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
    const cap = (t) => `${base}${HOLO ? 'hologram' : 'wastes'}.html?team=${t}${keys[t] ? '&key=' + encodeURIComponent(keys[t]) : ''}${extra}`;
    const q = (s) => (s || local) ? '?' + [s, local && 'local=1'].filter(Boolean).join('&') : '';
    const rows = [
      ...(HOLO ? [
        ['Overlay', base + 'holo-overlay.html' + q()],
        ['Screens', base + 'holo-screens.html' + q()],
        ['Bracket', base + 'holo-bracket.html' + q()],
      ] : [
        ['Overlay', base + 'overlay.html' + q()],
        ['Screens', base + 'screens.html' + q()],
        ['Screens S1', base + 'screens.html' + q('stage=1')],
        ['Screens S2', base + 'screens.html' + q('stage=2')],
        ['Bracket', base + 'bracket.html' + q()],
      ]),
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

  function updateBadge() {
    const badge = $('role-badge');
    badge.className = 'badge ' + (role === 'admin' ? 'admin' : team || '');
    badge.textContent = role === 'admin' ? (adminKey ? 'Admin' : 'Admin · open access') : role === 'team' ? `Captain · ${team}` : 'View only';
  }
  updateBadge();

  // ---------- bracket (admin)
  const BK = BracketCore;
  const ROUND_NAMES = cfg.ROUND_NAMES || ['Round of 16', 'Quarterfinal', 'Semifinal', 'Final', 'Champion'];
  let bkSelected = null;            // match id chosen in the "Any match" dropdown

  const bracketOf = () => (state && state.bracket) || BK.emptyBracket();
  const matchName = (r, i) => `${ROUND_NAMES[r]} · M${i + 1}`;
  const fmt = (n) => (n === null || n === undefined || n === '' ? '–' : Number(n).toLocaleString('en-US'));

  function allMatches() {
    const out = [];
    for (let r = 0; r < BK.ROUNDS; r++) for (let i = 0; i < BK.count(r); i++) out.push({ r, i, id: BK.mid(r, i) });
    return out;
  }

  function renderBracketAdmin() {
    if (role !== 'admin') return;
    const b = bracketOf();
    const s = state;

    // --- current match + confirm
    const cur = BK.parse(b.current);
    const confirm = $('bk-confirm');
    if (!cur) {
      $('bk-now').innerHTML = '<span class="muted">No bracket match loaded. Pick one below and press <b>Load into draft</b>.</span>';
      confirm.disabled = true;
      $('bk-confirm-hint').textContent = '';
    } else {
      const pp = BK.participants(b, cur.r, cur.i);
      const res = b.results[b.current];
      $('bk-now').innerHTML = `Now playing · <span class="muted">${esc(matchName(cur.r, cur.i))}</span><br><b>${esc(pp[0])}</b> vs <b>${esc(pp[1])}</b>` +
        (res ? ` <span class="muted">— result saved: ${esc(pp[res.w === 'A' ? 0 : 1])} won</span>` : '');
      const ta = BK.total(s.scores.A), tb = BK.total(s.scores.B);
      let hint = '', ok = false;
      if (ta === null || tb === null) hint = 'Enter and save both stage scores for both players first.';
      else if (HOLO && ta === 0 && tb === 0) hint = 'Tick the boss points first (Points, further down).';
      else if (ta === tb) hint = `Tied ${fmt(ta)} – ${fmt(tb)}: pick the winner with "${pp[0]} wins" or "${pp[1]} wins" below.`;
      else { ok = true; hint = `${fmt(ta)} – ${fmt(tb)} → ${ta > tb ? s.teams.A : s.teams.B} advances`; }
      confirm.disabled = !ok || busy;
      if (!confirm.dataset.armed) confirm.textContent = ok ? `Confirm: ${ta > tb ? s.teams.A : s.teams.B} wins` : 'Confirm winner';
      $('bk-confirm-hint').textContent = hint;
    }

    // --- match dropdown (keep the user's selection)
    const matches = allMatches();
    if (!bkSelected || !BK.parse(bkSelected)) {
      // Default: the loaded match while it's undecided, otherwise the next playable undecided match.
      const next = matches.find((m) => { const p = BK.participants(b, m.r, m.i); return p[0] && p[1] && !b.results[m.id]; });
      bkSelected = (b.current && !b.results[b.current] && b.current) || (next && next.id) || b.current || '0-0';
    }
    const sel = $('bk-match');
    if (document.activeElement !== sel) {
      let html = '';
      for (let r = 0; r < BK.ROUNDS; r++) {
        html += `<optgroup label="${esc(ROUND_NAMES[r])}">`;
        matches.filter((m) => m.r === r).forEach((m) => {
          const p = BK.participants(b, m.r, m.i);
          const res = b.results[m.id];
          const label = `M${m.i + 1}: ${p[0] || '?'} vs ${p[1] || '?'}` +
            (res ? ` ✓ ${p[res.w === 'A' ? 0 : 1]}` : '') + (b.current === m.id ? ' (loaded)' : '');
          html += `<option value="${m.id}"${m.id === bkSelected ? ' selected' : ''}>${esc(label)}</option>`;
        });
        html += '</optgroup>';
      }
      sel.innerHTML = html;
    }

    // --- actions for the selected match
    const sp = BK.parse(bkSelected);
    const pp = BK.participants(b, sp.r, sp.i);
    const ready = !!(pp[0] && pp[1]);
    const hasRes = !!b.results[bkSelected];
    $('bk-load').disabled = !ready || busy;
    [['A', 0], ['B', 1]].forEach(([w, k]) => {
      const btn = $('bk-win-' + w);
      btn.disabled = !ready || busy;
      if (!btn.dataset.armed) btn.textContent = ready ? `${pp[k]} wins` : (k ? 'Bottom wins' : 'Top wins');
    });
    $('bk-clear').disabled = !hasRes || busy;

    // --- players (don't overwrite while typing)
    const box = $('bk-players');
    if (!box.children.length) {
      let html = '';
      for (let k = 0; k < 16; k += 2) {
        html += `<span class="n">${k + 1}</span><input data-k="${k}" maxlength="40" placeholder="Player ${k + 1}" />` +
                `<span class="n">${k + 2}</span><input data-k="${k + 1}" maxlength="40" placeholder="Player ${k + 2}" />`;
      }
      box.innerHTML = html;
      box.querySelectorAll('input').forEach((el) => el.addEventListener('input', () => (el.dataset.dirty = '1')));
    }
    box.querySelectorAll('input').forEach((el) => fillIfIdle(el, b.players[+el.dataset.k] || ''));

    $('bk-undo').disabled = !s.bracketLog || busy;
    $('bk-last').textContent = s.bracketLog ? `Last change: ${s.bracketLog}` : 'No bracket changes to undo.';
  }

  $('bk-match').addEventListener('change', (e) => { bkSelected = e.target.value; renderBracketAdmin(); });
  $('bk-confirm').addEventListener('click', (e) => {
    if (!armed(e.currentTarget, 'Tap again to confirm')) return;
    send({ op: 'confirmWinner' }, 'Winner confirmed — bracket updated').then((ok) => { if (ok) { bkSelected = null; renderBracketAdmin(); } });
  });
  $('bk-load').addEventListener('click', (e) => {
    const inProgress = state.actions.length || state.firstTeam || ['A', 'B'].some((t) => state.scores[t].some((v) => v !== '' && v !== '0'));
    // Loading replaces the current draft, so ask for a second tap if one is in progress.
    if (inProgress && !armed(e.currentTarget, 'Tap again — replaces current draft')) return;
    send({ op: 'loadMatch', id: bkSelected }, 'Match loaded — ready for the coin toss');
  });
  ['A', 'B'].forEach((w) => $('bk-win-' + w).addEventListener('click', (e) => {
    if (!armed(e.currentTarget, 'Tap again to set winner')) return;
    send({ op: 'setWinner', id: bkSelected, w }, 'Winner set — bracket updated').then((ok) => { if (ok) { bkSelected = null; renderBracketAdmin(); } });
  }));
  $('bk-clear').addEventListener('click', (e) => {
    if (armed(e.currentTarget, 'Tap again to clear')) send({ op: 'clearResult', id: bkSelected }, 'Result cleared');
  });
  $('bk-save-players').addEventListener('click', async () => {
    const inputs = [...$('bk-players').querySelectorAll('input')];
    const list = inputs.sort((a, b) => a.dataset.k - b.dataset.k).map((el) => el.value.trim());
    if (await send({ op: 'setPlayers', list }, 'Players saved')) inputs.forEach((el) => delete el.dataset.dirty);
  });
  $('bk-undo').addEventListener('click', (e) => {
    if (armed(e.currentTarget, 'Tap again to undo')) send({ op: 'undoBracket' }, 'Last bracket change undone').then((ok) => { if (ok) { bkSelected = null; renderBracketAdmin(); } });
  });
  $('bk-reset').addEventListener('click', (e) => {
    if (armed(e.currentTarget, 'Tap again to reset bracket')) send({ op: 'resetBracket' }, 'Bracket reset').then((ok) => { if (ok) { bkSelected = null; renderBracketAdmin(); } });
  });
  // For js/holo-admin.js (Hologram bosses + points).
  window.HWControl = { send, toast, armed, isAdmin: () => role === 'admin', isBusy: () => busy, getState: () => state };

  renderFilters();
  HW.imagesReady.then(() => state && renderRoster());   // show portraits once found
  backend.subscribe(setState);
  buildAdminLinks();
  setInterval(() => state && tick(), 250);
})();
