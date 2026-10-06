/*
  Hamilton: an opt-in easter egg.

  Builds nothing until he is switched on in Settings, and tears itself back
  down when he is switched off, so the default state costs one function call
  and no DOM. All of the motion lives in css/hamilton.css.

  He rides along after login only, so the opening and the login orb stay as
  they were. #login carrying .off is what "logged in" looks like in this app,
  and app.js toggles that class directly, so a MutationObserver on it is the
  honest signal rather than a flag we would have to keep in sync.
*/
(function () {
  var el = null, observer = null;

  function build() {
    if (el) return;
    el = document.createElement('div');
    el.id = 'hamilton';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<img class="ham-car" src="img/hamilton-car.png" alt="">' +
      '<img class="ham-head" src="img/hamilton-head.png" alt="">';
    document.body.appendChild(el);
  }

  function destroy() {
    if (!el) return;
    el.remove();
    el = null;
  }

  function loggedIn() {
    var login = document.getElementById('login');
    return !!login && login.classList.contains('off');
  }

  function sync() {
    /* data.js declares db with `let`, which is a lexical global and never a
       property of window, so it has to be reached by bare name */
    var on = typeof db !== 'undefined' && !!db.hamilton;
    var want = on && loggedIn();
    if (want) build(); else destroy();
  }

  window.refreshHamilton = sync;

  function start() {
    var login = document.getElementById('login');
    if (login && !observer) {
      observer = new MutationObserver(sync);
      observer.observe(login, { attributes: true, attributeFilter: ['class'] });
    }
    sync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
