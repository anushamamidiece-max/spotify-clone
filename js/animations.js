(() => {
  window.SonoraMotion = {
    reveal() { requestAnimationFrame(() => document.querySelector('.app-shell')?.classList.add('is-ready')); },
    pulse(el) { if (!el) return; el.animate([{transform:'scale(1)'},{transform:'scale(.92)'},{transform:'scale(1)'}],{duration:240,easing:'ease-out'}); }
  };
})();
