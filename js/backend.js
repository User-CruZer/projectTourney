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

    function emit(state) {
      if (state.version === lastVersion) return;
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
      if (!timer) poll();
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
        if (parsed && parsed.schema === 2) return parsed;
      } catch (_) {}
      const s = DraftCore.emptyState();
      localStorage.setItem(KEY, JSON.stringify(s));
      return s;
    }

    async function getState() {
      const s = read();
      s.now = Date.now();
      return s;
    }

    async function send(op) {
      const next = DraftCore.apply(read(), op);
      localStorage.setItem(KEY, JSON.stringify(next));
      listeners.forEach((cb) => cb(next));
      return next;
    }

    function subscribe(cb) {
      listeners.push(cb);
      cb(read());
      global.addEventListener('storage', (e) => {
        if (e.key === KEY && e.newValue) cb(JSON.parse(e.newValue));
      });
      global.dispatchEvent(new CustomEvent('backend-status', { detail: 'local' }));
    }

    return { mode: 'local', getState, send, subscribe };
  }

  global.createBackend = (cfg) => (cfg.API_URL ? remoteBackend(cfg) : localBackend());
})(window);
