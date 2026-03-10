// WikiScout Utility Functions

// DOM helpers
const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];

// Create element with attributes and children
function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'class') {
      el.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'dataset') {
      Object.entries(value).forEach(([k, v]) => el.dataset[k] = v);
    } else {
      el.setAttribute(key, value);
    }
  });
  
  children.forEach(child => {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      el.appendChild(child);
    }
  });
  
  return el;
}

// --- Error detail system ---
const _errorDetailOverlay = (() => {
  let overlay = null;
  function getOverlay() {
    if (overlay) return overlay;
    overlay = createElement('div', { class: 'error-detail-overlay', style: {
      display: 'none', position: 'fixed', inset: '0', zIndex: '100000',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      alignItems: 'center', justifyContent: 'center', padding: '24px',
    }});
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { overlay.style.display = 'none'; }
    });
    document.body.appendChild(overlay);
    return overlay;
  }
  return { show(html) {
    const ov = getOverlay();
    ov.innerHTML = html;
    ov.style.display = 'flex';
  }, hide() {
    if (overlay) overlay.style.display = 'none';
  }};
})();

function showErrorDetail(info) {
  const errorId = info.errorId || 'N/A';
  const message = escapeHtml(info.message || 'Unknown error');
  const status = info.status || '';
  const endpoint = escapeHtml(info.endpoint || '');
  const timestamp = info.timestamp || new Date().toISOString();
  const stack = info.stack ? escapeHtml(info.stack) : '';
  const context = info.context ? escapeHtml(typeof info.context === 'string' ? info.context : JSON.stringify(info.context, null, 2)) : '';

  _errorDetailOverlay.show(`
    <div style="background:var(--surface-elevated,#1e1e2e);border-radius:16px;max-width:480px;width:100%;max-height:80vh;overflow-y:auto;padding:24px;color:var(--text-primary,#e0e0e0);font-family:var(--font-sans,system-ui);box-shadow:0 24px 48px rgba(0,0,0,0.4);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="margin:0;font-size:18px;font-weight:600;">Error Details</h3>
        <button onclick="document.querySelector('.error-detail-overlay').style.display='none'"
          style="background:none;border:none;color:var(--text-secondary,#999);font-size:22px;cursor:pointer;padding:4px 8px;line-height:1;">&times;</button>
      </div>
      <div style="background:var(--surface,#15151f);border-radius:12px;padding:16px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="background:var(--danger,#e74c3c);color:white;padding:2px 10px;border-radius:6px;font-size:12px;font-weight:600;">ERROR</span>
          ${status ? `<span style="color:var(--text-secondary,#999);font-size:13px;">HTTP ${status}</span>` : ''}
        </div>
        <div style="font-size:14px;margin-bottom:12px;word-break:break-word;">${message}</div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:12px;color:var(--text-secondary,#999);">
          <span>Error ID</span>
          <span style="font-family:monospace;color:var(--text-primary,#e0e0e0);user-select:all;cursor:pointer;" title="Click to copy">${errorId}</span>
          ${endpoint ? `<span>Endpoint</span><span style="font-family:monospace;">${endpoint}</span>` : ''}
          <span>Time</span><span>${new Date(timestamp).toLocaleString()}</span>
          <span>Device</span><span style="word-break:break-all;">${escapeHtml(navigator.userAgent.slice(0, 100))}</span>
        </div>
      </div>
      ${stack ? `<details style="margin-bottom:12px;"><summary style="cursor:pointer;font-size:13px;color:var(--text-secondary,#999);margin-bottom:8px;">Stack Trace</summary><pre style="background:var(--surface,#15151f);border-radius:8px;padding:12px;font-size:11px;overflow-x:auto;margin:0;white-space:pre-wrap;word-break:break-all;">${stack}</pre></details>` : ''}
      ${context ? `<details style="margin-bottom:12px;"><summary style="cursor:pointer;font-size:13px;color:var(--text-secondary,#999);margin-bottom:8px;">Context</summary><pre style="background:var(--surface,#15151f);border-radius:8px;padding:12px;font-size:11px;overflow-x:auto;margin:0;white-space:pre-wrap;word-break:break-all;">${context}</pre></details>` : ''}
      <div style="display:flex;gap:8px;margin-top:16px;">
        <button onclick="navigator.clipboard.writeText('${errorId}').then(()=>this.textContent='Copied!');setTimeout(()=>this.textContent='Copy Error ID',1500)"
          style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--border,#333);background:var(--surface,#15151f);color:var(--text-primary,#e0e0e0);cursor:pointer;font-size:13px;font-weight:500;">Copy Error ID</button>
        <button onclick="document.querySelector('.error-detail-overlay').style.display='none'"
          style="flex:1;padding:10px;border-radius:10px;border:none;background:var(--primary,#6c5ce7);color:white;cursor:pointer;font-size:13px;font-weight:500;">Dismiss</button>
      </div>
    </div>
  `);
}

// --- Toast notifications with long-press support ---
const toast = {
  container: null,
  
  init() {
    if (!this.container) {
      this.container = createElement('div', { class: 'toast-container' });
      document.body.appendChild(this.container);
    }
  },
  
  show(message, type = 'info', duration = 3000, errorInfo = null) {
    this.init();
    
    const toastEl = createElement('div', { class: `toast toast-${type}` }, [
      createElement('span', {}, [message])
    ]);

    if (type === 'error') {
      // Add subtle hold hint
      const hint = createElement('span', {
        style: { fontSize: '10px', opacity: '0.6', marginLeft: '8px', whiteSpace: 'nowrap' }
      }, ['hold for details']);
      toastEl.firstChild.appendChild(hint);

      // Long-press handler
      let pressTimer = null;
      let didLongPress = false;
      const startPress = (e) => {
        didLongPress = false;
        pressTimer = setTimeout(() => {
          didLongPress = true;
          const info = errorInfo || _lastErrorInfo || { message };
          showErrorDetail(info);
        }, 500);
      };
      const endPress = () => {
        clearTimeout(pressTimer);
      };
      toastEl.addEventListener('mousedown', startPress);
      toastEl.addEventListener('touchstart', startPress, { passive: true });
      toastEl.addEventListener('mouseup', endPress);
      toastEl.addEventListener('mouseleave', endPress);
      toastEl.addEventListener('touchend', endPress);
      toastEl.addEventListener('touchcancel', endPress);
      toastEl.style.cursor = 'pointer';
    }
    
    this.container.appendChild(toastEl);
    
    setTimeout(() => {
      toastEl.style.opacity = '0';
      toastEl.style.transform = 'translateX(100%)';
      setTimeout(() => toastEl.remove(), 300);
    }, type === 'error' ? Math.max(duration, 5000) : duration);
  },
  
  success(message) { this.show(message, 'success'); },
  error(message, errorInfo) { this.show(message, 'error', 5000, errorInfo); },
  warning(message) { this.show(message, 'warning'); },
};

// Tracks the last error info for any toast
let _lastErrorInfo = null;

// --- Client-side error reporter ---
const errorReporter = {
  async report(opts) {
    const { message, stack, context, severity } = opts;
    const info = {
      errorId: null,
      message,
      stack,
      context,
      status: opts.status || null,
      endpoint: opts.endpoint || null,
      timestamp: new Date().toISOString(),
    };
    _lastErrorInfo = info;

    try {
      const apiKey = localStorage.getItem('wikiscout_api_key') || 'ws_a1b0cec440d9c6dec7fd6e5e66b5cc2fe9ac8b7aecd45f5109019e5eec14ac7c';
      const res = await fetch(`${window._wsApiBase || 'https://api.wikiscout.org'}/errors/report/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({
          message,
          stack: stack || null,
          context: context || null,
          severity: severity || 'error',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        info.errorId = data.error_id || null;
        _lastErrorInfo = info;
      }
    } catch (e) {
      console.warn('Error reporter failed:', e);
    }

    return info;
  },
};

// Local storage helpers
const storage = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  
  remove(key) {
    localStorage.removeItem(key);
  },
  
  clear() {
    localStorage.clear();
  }
};

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle function
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Format date/time
function formatDate(date, options = {}) {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options
  });
}

function formatTime(date) {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function formatRelativeTime(date) {
  const now = new Date();
  const d = new Date(date);
  const diff = now - d;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return formatDate(date);
}

// Check if device is mobile
function isMobile() {
  return window.matchMedia('(max-width: 768px)').matches;
}

// Loading state helpers
function showLoading(element, text = 'Loading...') {
  element.classList.add('loading');
  element.dataset.originalContent = element.innerHTML;
  element.innerHTML = `<span class="animate-spin">⟳</span> ${text}`;
  element.disabled = true;
}

function hideLoading(element) {
  element.classList.remove('loading');
  if (element.dataset.originalContent) {
    element.innerHTML = element.dataset.originalContent;
    delete element.dataset.originalContent;
  }
  element.disabled = false;
}

// Skeleton loader
function createSkeleton(lines = 3, width = '100%') {
  const container = createElement('div', { class: 'skeleton-container' });
  
  for (let i = 0; i < lines; i++) {
    const lineWidth = i === lines - 1 ? '60%' : width;
    container.appendChild(
      createElement('div', { 
        class: 'skeleton', 
        style: { height: '16px', width: lineWidth, marginBottom: '8px' }
      })
    );
  }
  
  return container;
}

// Form validation
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateRequired(value) {
  return value !== null && value !== undefined && value.toString().trim() !== '';
}

// Generate unique ID
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Deep clone object
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Copy to clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }
}

// Modal helpers
function openModal(modalId) {
  const modal = $(`#${modalId}`);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = $(`#${modalId}`);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// Click outside handler
function onClickOutside(element, callback) {
  document.addEventListener('click', (e) => {
    if (!element.contains(e.target)) {
      callback(e);
    }
  });
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    $, $$, createElement, toast, storage, debounce, throttle,
    formatDate, formatTime, formatRelativeTime, isMobile,
    showLoading, hideLoading, createSkeleton, validateEmail, validateRequired,
    generateId, deepClone, escapeHtml, copyToClipboard, openModal, closeModal,
    onClickOutside, errorReporter, showErrorDetail,
  };
}
