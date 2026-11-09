/* ============================================================
   HOCKEY MANAGER — TOAST NOTIFICATIONS
   Ненавязчивые уведомления вместо блокирующих alert().
   ============================================================ */
(function () {
  const ICONS = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  function getToastStack() {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      stack.setAttribute('aria-live', 'polite');
      stack.setAttribute('aria-relevant', 'additions');
      document.body.appendChild(stack);
    }
    return stack;
  }

  window.showToast = function showToast(message, type = 'info', duration = 3600) {
    const kind = Object.prototype.hasOwnProperty.call(ICONS, type) ? type : 'info';
    const stack = getToastStack();
    const toast = document.createElement('div');
    toast.className = 'toast ' + kind;
    toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = ICONS[kind];

    const text = document.createElement('span');
    text.className = 'toast-message';
    text.textContent = String(message ?? '');

    const close = document.createElement('button');
    close.className = 'toast-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Закрыть уведомление');
    close.textContent = '×';

    let timer;
    const dismiss = () => {
      if (timer) window.clearTimeout(timer);
      if (!toast.isConnected) return;
      toast.classList.add('toast-out');
      window.setTimeout(() => toast.remove(), 200);
    };
    close.addEventListener('click', dismiss);
    toast.append(icon, text, close);
    stack.appendChild(toast);

    const timeout = Number(duration);
    if (timeout > 0) timer = window.setTimeout(dismiss, timeout);
    return toast;
  };
})();
