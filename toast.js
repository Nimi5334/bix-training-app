/**
 * Toast Notification System
 * Replaces ugly alert() calls with modern, non-blocking toasts
 * Usage: toast.success('Saved!'), toast.error('Failed'), toast.info('Processing...')
 */

let container = null;

function ensureContainer() {
  if (container) return container;
  container = document.createElement('div');
  container.id = 'bix-toast-container';
  container.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: none;
    max-width: 360px;
  `;
  document.body.appendChild(container);

  // Inject styles once
  if (!document.getElementById('bix-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'bix-toast-styles';
    style.textContent = `
      @keyframes bix-toast-in {
        from { opacity: 0; transform: translateX(100%); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes bix-toast-out {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(100%); }
      }
      .bix-toast {
        pointer-events: auto;
        padding: 14px 18px;
        border-radius: 10px;
        color: #fff;
        font-size: 14px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        animation: bix-toast-in 0.25s ease-out;
        cursor: pointer;
        border-left: 4px solid rgba(255,255,255,0.4);
      }
      .bix-toast.success { background: #10b981; }
      .bix-toast.error   { background: #ef4444; }
      .bix-toast.info    { background: #3b82f6; }
      .bix-toast.warn    { background: #f59e0b; }
      .bix-toast.removing { animation: bix-toast-out 0.25s ease-in forwards; }
      .bix-toast .icon { font-size: 18px; flex-shrink: 0; }
      @media (max-width: 600px) {
        #bix-toast-container { left: 12px; right: 12px; max-width: none; top: 12px; }
      }
    `;
    document.head.appendChild(style);
  }
  return container;
}

function show(message, type = 'info', duration = 3500) {
  const c = ensureContainer();
  const el = document.createElement('div');
  el.className = 'bix-toast ' + type;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warn: '⚠️' };
  el.innerHTML = `<span class="icon">${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  el.onclick = () => dismiss(el);
  c.appendChild(el);
  if (duration > 0) {
    setTimeout(() => dismiss(el), duration);
  }
  return el;
}

function dismiss(el) {
  if (!el || !el.parentNode) return;
  el.classList.add('removing');
  setTimeout(() => el.remove(), 250);
}

export const toast = {
  success: (msg, duration) => show(msg, 'success', duration),
  error:   (msg, duration) => show(msg, 'error', duration ?? 5000),
  info:    (msg, duration) => show(msg, 'info', duration),
  warn:    (msg, duration) => show(msg, 'warn', duration),
  dismiss,
};

// Also attach to window for non-module scripts
if (typeof window !== 'undefined') window.toast = toast;
