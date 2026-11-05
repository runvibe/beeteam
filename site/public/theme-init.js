// Runs synchronously in <head>, before React and stylesheets, to avoid a wrong-theme flash.
(function () {
  var preference = "system";
  try {
    var saved = window.localStorage.getItem("beeteam.theme");
    if (saved === "light" || saved === "dark" || saved === "system")
      preference = saved;
  } catch {
    /* Private/restricted storage: use the system default. */
  }
  var preset = "default";
  try {
    var palette = window.localStorage.getItem("beeteam.palette");
    if (["default", "codex", "claude-code", "copilot"].indexOf(palette) !== -1)
      preset = palette;
  } catch {
    /* Keep Default when storage is unavailable. */
  }
  document.documentElement.dataset.palette = preset;
  var dark =
    preference === "dark" ||
    (preference === "system" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", !!dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
})();
