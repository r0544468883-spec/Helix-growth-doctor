/* HELIX Growth Doctor — behavior tag. Embed on the site:
   <script src="https://<growth-doctor-host>/helix-tag.js" data-ws="<WORKSPACE_ID>"></script>
   Collects: pageviews, clicks (x/y for heatmap), funnel steps (data-helix-step),
   and returns (repeat visits). First-party — data goes to YOUR endpoint only. */
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

  // Click heatmap — normalized x/y so it maps across screen sizes.
  document.addEventListener('click', function (e) {
    send('click', null, { x: +(e.clientX / innerWidth).toFixed(3), y: +(e.clientY / innerHeight).toFixed(3), page: location.pathname });
  }, { passive: true });
})();
