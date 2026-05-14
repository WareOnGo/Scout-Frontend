/**
 * Lightweight stacked toasts (no UI framework).
 */

let container = null;

function ensureContainer() {
  if (typeof document === 'undefined') return null;
  if (!container) {
    container = document.createElement('div');
    container.id = 'app-toast-root';
    container.className = 'toast-stack';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  return container;
}

/**
 * @param {string} text
 * @param {{ type?: 'info'|'success'|'error', duration?: number }} [opts]
 */
export function showToast(text, opts = {}) {
  const { type = 'info', duration = 4000 } = opts;
  const root = ensureContainer();
  if (!root) return;

  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', 'status');
  el.textContent = text;
  if (String(text).includes('\n')) {
    el.style.whiteSpace = 'pre-wrap';
  }

  root.appendChild(el);

  const remove = () => {
    el.classList.add('toast--out');
    setTimeout(() => el.remove(), 220);
  };

  const timer = setTimeout(remove, duration);
  el.addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
}

export function destroyAllToasts() {
  if (container) container.innerHTML = '';
}
