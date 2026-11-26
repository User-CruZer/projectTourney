/* Start page (index.html): choosing a tournament opens the code prompt (js/gate.js). */
(function () {
  document.querySelectorAll('.choice').forEach((a) => a.addEventListener('click', (e) => {
    if (window.HWGate && HWGate.open(a.dataset.page)) e.preventDefault();   // else: follow the link as a guest
  }));
})();
