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
  if (a11y.highContrast) root.classList.add("high-contrast");
  if (a11y.dyslexiaFont) root.classList.add("dyslexia-font");
  if (a11y.colorblind) root.classList.add("colorblind");

  // reduceMotion has an OS-level fallback: if the user has never explicitly
  // set it in-app, respect the system's prefers-reduced-motion instead of
  // defaulting to motion-on.
  var reduceMotion =
    a11y.reduceMotion === true ||
    (a11y.reduceMotion === undefined &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (reduceMotion) root.classList.add("reduce-motion");
})();
