/* Единая система всплывающих уведомлений */
(function () {
  let container = null;
  let nextToastId = 1;

  function getContainer() {
    if (container && container.isConnected) return container;
    container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-relevant', 'additions');
      container.setAttribute('aria-atomic', 'false');
      document.body.appendChild(container);
    }
    return container;
  }

  window.showToast = function (message, type = 'info', duration = 3200) {
    if (message === undefined || message === null || message === '') return null;
    const allowedTypes = ['success', 'error', 'warning', 'info'];
    const safeType = allowedTypes.includes(type) ? type : 'info';
    const toast = document.createElement('div');
    const id = nextToastId++;
    toast.className = 'toast toast-' + safeType;
    toast.dataset.toastId = String(id);
    toast.setAttribute('role', safeType === 'error' ? 'alert' : 'status');

    const text = document.createElement('span');
    text.className = 'toast-message';
    text.textContent = String(message);

    const close = document.createElement('button');
    close.className = 'toast-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Закрыть уведомление');
    close.textContent = '×';
    close.addEventListener('click', () => dismissToast(toast));

    toast.append(text, close);
    getContainer().appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    const timeout = Math.max(1200, Number(duration) || 3200);
    const timer = window.setTimeout(() => dismissToast(toast), timeout);
    toast.addEventListener('mouseenter', () => window.clearTimeout(timer), { once: true });
    return id;
  };

  function dismissToast(toast) {
    if (!toast || toast.dataset.dismissed === 'true') return;
    toast.dataset.dismissed = 'true';
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-hiding');
    window.setTimeout(() => toast.remove(), 220);
  }
})();
