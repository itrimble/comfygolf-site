/* Play/Guide UTM passthrough (Remnant UTM convention).
   If utm_campaign is on the URL, store utm_source, utm_medium, utm_campaign,
   utm_content, and utm_term for the session (sessionStorage). Every Play or
   Guide link gets those query params appended. No campaign on the URL or in
   the session -> leave the links unchanged. No fallback campaign. */
(function () {
  var KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var STORE = 'remnant_utms';

  var read = function () {
    try {
      var p = new URLSearchParams(window.location.search);
      if (p.get('utm_campaign')) {
        var o = {};
        for (var i = 0; i < KEYS.length; i++) {
          var v = p.get(KEYS[i]);
          if (v) o[KEYS[i]] = v;
        }
        try { sessionStorage.setItem(STORE, JSON.stringify(o)); } catch (e) {}
        return o;
      }
      try { return JSON.parse(sessionStorage.getItem(STORE) || 'null'); } catch (e) { return null; }
    } catch (e) { return null; }
  };

  var isPlayOrGuide = function (u) {
    var path = u.pathname.replace(/\/+$/, '');
    return /(?:^|\/)(play|guide)$/.test(path);
  };

  var decorate = function (href) {
    if (!params || !params.utm_campaign) return href;
    try {
      var u = new URL(href, window.location.href);
      if (!isPlayOrGuide(u)) return href;
      for (var i = 0; i < KEYS.length; i++) {
        if (params[KEYS[i]]) u.searchParams.set(KEYS[i], params[KEYS[i]]);
      }
      return u.toString();
    } catch (e) { return href; }
  };

  var apply = function () {
    if (!params || !params.utm_campaign) return;
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var next = decorate(links[i].href);
      if (next !== links[i].href) links[i].href = next;
    }
  };

  var params = read();
  if (!params || !params.utm_campaign) return;

  apply();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  }
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!a) return;
    var next = decorate(a.href);
    if (next !== a.href) a.href = next;
  }, true);

  /* The landing page hydrates a prerendered React tree, which can reset hrefs.
     Re-apply after mutations, then disconnect. */
  var root = document.getElementById('root') || document.body;
  try {
    var mo = new MutationObserver(apply);
    mo.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['href'] });
    setTimeout(function () { mo.disconnect(); }, 3000);
  } catch (e) {}
  setTimeout(apply, 0);
  setTimeout(apply, 100);
})();
