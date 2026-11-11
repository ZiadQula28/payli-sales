/* Page turn direction for cross-document view transitions.
   Loaded in <head> so the listeners exist before the first frame. Plain navigation where unsupported. */
(function () {
  var ORDER = ['index', 'discover', 'journey', 'restaurants', 'demo', 'company', 'resources'];
  function at(url) {
    var m = /\/([a-z]+)\.html(?:[?#]|$)/.exec(String(url || ''));
    return ORDER.indexOf(m ? m[1] : 'index');
  }
  function direction(from, to) {
    var a = at(from), b = at(to);
    if (a < 0 || b < 0 || a === b) return null;
    return b > a ? 'forward' : 'back';
  }
  window.addEventListener('pageswap', function (e) {
    if (!e.viewTransition || !e.activation || !e.activation.entry) return;
    var d = direction(location.href, e.activation.entry.url);
    if (d && e.viewTransition.types) e.viewTransition.types.add(d);
  });
  window.addEventListener('pagereveal', function (e) {
    if (!e.viewTransition || !window.navigation || !navigation.activation || !navigation.activation.from) return;
    var d = direction(navigation.activation.from.url, location.href);
    if (d && e.viewTransition.types) e.viewTransition.types.add(d);
  });
})();
