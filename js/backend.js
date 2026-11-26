/*
 * Two interchangeable backends with the same interface:
 *   getState() -> Promise<state>
 *   send(op)   -> Promise<state>   (rejects with Error on invalid op)
 *   subscribe(cb)                  (cb(state) whenever state changes)
 */
(function (global) {
  /* ---------- Google Sheets (Apps Script web app) ---------- */
  function remoteBackend(cfg) {
    let lastVersion = -1;
    let listeners = [];
    let timer = null;

    // Reads use JSONP (a <script> tag) instead of fetch: the OBS browser source
    // blocks fetch to Apps Script with a CORS error, script tags are not subject to CORS.
    function getState() {
      return new Promise((resolve, reject) => {
        const cb = '__hwState' + Date.now() + Math.floor(Math.random() * 1e6);
        const script = document.createElement('script');
        const timer = setTimeout(() => done(new Error('Timed out')), 15000);
        function done(err, data) {
          clearTimeout(timer);
          delete global[cb];
          script.remove();
          err ? reject(err) : resolve(data);
        }
        global[cb] = (data) => done(null, data);
        script.onerror = () => done(new Error('Could not reach Google Sheets'));
        script.src = cfg.API_URL + '?callback=' + cb + '&t=' + Date.now();
        document.head.appendChild(script);
      });
    }

    async function send(op) {
      // text/plain avoids a CORS preflight, which Apps Script can't answer.
      const res = await fetch(cfg.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(op),
      });
      const data = await res.json();
      if (data.state) emit(data.state);
      if (!data.ok) throw new Error(data.error || 'Request failed');
      return data.state;
    }

    // version = "<counter>:<hash>". A poll that started before a save can answer after it
    // with the older state; skip it, or the page would briefly jump back (and replay animations).
    let lastCounter = -1;
    function emit(state) {
      if (state.version === lastVersion) return;
      const counter = parseInt(String(state.version), 10);
      if (isFinite(counter) && counter < lastCounter) return;
      if (isFinite(counter)) lastCounter = counter;
      lastVersion = state.version;
      listeners.forEach((cb) => cb(state));
    }

    async function poll() {
      try {
        emit(await getState());
        global.dispatchEvent(new CustomEvent('backend-status', { detail: 'live' }));
      } catch (e) {
        global.dispatchEvent(new CustomEvent('backend-status', { detail: 'offline' }));
      }
      const delay = document.hidden ? cfg.POLL_MS * 4 : cfg.POLL_MS;
      timer = setTimeout(poll, delay);
    }

    function subscribe(cb) {
      listeners.push(cb);
      if (!timer) {
        poll();
        // Hidden pages (and OBS sources in another scene) poll slowly; catch up as soon as they show.
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) { clearTimeout(timer); poll(); }
        });
      }
    }

    return { mode: 'sheets', getState, send, subscribe };
  }

  /* ---------- Local demo (localStorage, syncs across tabs) ---------- */
  function localBackend() {
    const KEY = 'projectTourney.draft';
    let listeners = [];

    function read() {
      try {
        const raw = localStorage.getItem(KEY);
        const parsed = raw && JSON.parse(raw);
        if (parsed && parsed.schema === 2) {
          if (!parsed.bracket) parsed.bracket = BracketCore.emptyBracket();
          parsed.uniquePicks = DraftCore.UNIQUE_PICKS;   // rule comes from the code, not old saved data
          parsed.bracketLog = undoLog().length ? undoLog()[undoLog().length - 1].log : '';
          return parsed;
        }
      } catch (_) {}
      const s = DraftCore.emptyState();
      localStorage.setItem(KEY, JSON.stringify(s));
      return s;
    }

    // Bracket undo history: [{ time, log, snapshot }] (newest last), like the Sheet's BracketLog tab.
    const LOG_KEY = 'projectTourney.bracketLog';
    function undoLog() {
      try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch (_) { return []; }
    }

    async function getState() {
      const s = read();
      s.now = Date.now();
      return s;
    }

    async function send(op) {
      const cur = read();
      let next;
      if (BracketCore.OPS.includes(op.op)) {
        const res = BracketCore.apply(cur, op);
        next = res.state;
        const log = undoLog();
        log.push({ time: Date.now(), log: res.log, snapshot: BracketCore.snapshot(cur) });
        localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-50)));
      } else if (op.op === 'undoBracket') {
        const log = undoLog();
        const last = log.pop();
        if (!last) throw new Error('Nothing to undo.');
        next = Object.assign({}, cur, last.snapshot);
        next.sequence = DraftCore.buildSequence(next.firstTeam);
        localStorage.setItem(LOG_KEY, JSON.stringify(log));
      } else {
        next = DraftCore.apply(cur, op);
      }
      next.version = (cur.version || 0) + 1;
      next.now = Date.now();
      next.bracketLog = undoLog().length ? undoLog()[undoLog().length - 1].log : '';
      localStorage.setItem(KEY, JSON.stringify(next));
      listeners.forEach((cb) => cb(next));
      return next;
    }

    function subscribe(cb) {
      listeners.push(cb);
      // "now" must be the current time, not when the state was last saved —
      // the overlay uses it to decide whether a coin flip just happened.
      cb(Object.assign(read(), { now: Date.now() }));
      global.addEventListener('storage', (e) => {
        if (e.key === KEY && e.newValue) cb(JSON.parse(e.newValue));
      });
      global.dispatchEvent(new CustomEvent('backend-status', { detail: 'local' }));
    }

    return { mode: 'local', getState, send, subscribe };
  }

  global.createBackend = (cfg) => (cfg.API_URL ? remoteBackend(cfg) : localBackend());
})(window);
