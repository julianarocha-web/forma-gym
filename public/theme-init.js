// Runs before CSS/React. Only a visual preference is read; never workout/auth data.
(function () {
  var choice;
  try { choice = localStorage.getItem('forma-theme'); } catch (_) {}
  var theme = choice === 'dark' || choice === 'light' ? choice : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();
