/* HELIX Growth Doctor — behavior tag. Embed on the site:
   <script src="https://<growth-doctor-host>/helix-tag.js" data-ws="<WORKSPACE_ID>"></script>
   Collects: pageviews, clicks (x/y for heatmap), funnel steps (data-helix-step),
   returns (repeat visits), and CRO friction signals — scroll depth, rage clicks,
   dead clicks, and time-on-page. First-party — data goes to YOUR endpoint only,
   no DOM recording (privacy moat: lightweight, not session-replay). */
(function () {
  var s = document.currentScript;
  var ws = s && s.getAttribute('data-ws');
  var api = (s && s.src ? s.src.replace(/\/helix-tag\.js.*$/, '') : '') + '/api/collect';
  if (!ws) return;

  // Stable anonymous visitor id + return detection.
  var vid = localStorage.getItem('helix_vid');
  var isReturn = !!vid;
  if (!vid) { vid = 'v_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); localStorage.setItem('helix_vid', vid); }

  function send(name, step, meta) {
    try {
      navigator.sendBeacon(api, new Blob([JSON.stringify({
        ws: ws, visitor_id: vid, name: name, step: step, meta: meta || {}, page: location.pathname,
      })], { type: 'application/json' }));
    } catch (e) { /* fail silent */ }
  }

  // Pageview + return.
  send('pageview', null, { ref: document.referrer });
  if (isReturn) send('return', null, {});

  // Funnel step from a data attribute (e.g. <body data-helix-step="checkout" data-helix-index="3">).
  var stepName = document.body && document.body.getAttribute('data-helix-step');
  if (stepName) send('step:' + stepName, parseInt(document.body.getAttribute('data-helix-index') || '0', 10), {});

  function norm(e) { return { x: +(e.clientX / innerWidth).toFixed(3), y: +(e.clientY / innerHeight).toFixed(3) }; }
  function interactive(el) {
    return !!(el && el.closest && el.closest('a,button,input,select,textarea,label,[role="button"],[onclick]'));
  }

  // Click heatmap + rage/dead detection.
  var recent = []; // recent click {t,x,y} for rage bursts
  document.addEventListener('click', function (e) {
    var p = norm(e);
    send('click', null, { x: p.x, y: p.y, page: location.pathname });

    // Rage click — 3+ clicks within 800ms inside a small radius = frustration.
    var now = Date.now();
    recent.push({ t: now, x: p.x, y: p.y });
    recent = recent.filter(function (c) { return now - c.t < 800; });
    if (recent.length >= 3) {
      var near = recent.filter(function (c) { return Math.abs(c.x - p.x) < 0.05 && Math.abs(c.y - p.y) < 0.05; });
      if (near.length >= 3) { send('rage', null, { x: p.x, y: p.y, page: location.pathname }); recent = []; }
    }

    // Dead click — looks clickable (pointer cursor) but isn't a real control → nothing happens.
    try {
      if (!interactive(e.target) && getComputedStyle(e.target).cursor === 'pointer') {
        send('dead', null, { x: p.x, y: p.y, page: location.pathname });
      }
    } catch (err) { /* getComputedStyle may throw on odd targets */ }
  }, { passive: true });

  // Scroll depth — track the deepest point reached (0..1), reported once on exit.
  var maxDepth = 0;
  addEventListener('scroll', function () {
    var h = document.documentElement.scrollHeight - innerHeight;
    var d = h > 0 ? (scrollY / h) : 1;
    if (d > maxDepth) maxDepth = d > 1 ? 1 : d;
  }, { passive: true });

  // Time-on-page + scroll depth, flushed once when the tab is hidden/unloaded.
  var start = Date.now();
  var flushed = false;
  function flush() {
    if (flushed) return; flushed = true;
    send('scroll', null, { depth: +maxDepth.toFixed(3), page: location.pathname });
    send('time', null, { seconds: Math.round((Date.now() - start) / 1000), page: location.pathname });
  }
  addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
  addEventListener('pagehide', flush);
})();
