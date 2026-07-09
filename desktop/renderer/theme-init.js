// Applies the saved theme/accessibility classes to <html> before the body
// paints, so the app never flashes the default theme/contrast/motion on
// launch. Loaded as a blocking (no defer/async) <script src> in <head> —
// deliberately NOT inline, since the CSP has no 'unsafe-inline' for
// script-src and we don't want to weaken it just for this. window.metriqInitial
// is populated synchronously by preload.js before this file runs.
(function () {
  var initial = window.metriqInitial || {};
  var root = document.documentElement;

  if (initial.theme === "light") root.classList.add("light");

  var a11y = initial.accessibility || {};
  var canMatchMedia = typeof window.matchMedia === "function";

  // highContrast and reduceMotion both have an OS-level fallback: if the
  // user has never explicitly set the toggle in-app, respect the system
  // setting instead of defaulting to off. Once toggled in-app, that
  // explicit choice always wins over the OS signal.
  var highContrast =
    a11y.highContrast === true ||
    (a11y.highContrast === undefined && canMatchMedia && window.matchMedia("(prefers-contrast: more)").matches);
  if (highContrast) root.classList.add("high-contrast");

  if (a11y.dyslexiaFont) root.classList.add("dyslexia-font");
  if (a11y.colorblind) root.classList.add("colorblind");

  var reduceMotion =
    a11y.reduceMotion === true ||
    (a11y.reduceMotion === undefined && canMatchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (reduceMotion) root.classList.add("reduce-motion");
})();
