// ============================================================================
// GLOBALS
// ============================================================================
let accounts = [];
let settings = {};
let currentAccount = null;
let statusInterval = null;
let selectedMode = 1;
let timerInterval = null;
let timerStartTime = null;
let timerElapsedFromServer = 0;
let timerIsSynced = false;
let _pollLastLogKey = '';
let _pollLastPct = -1;

// ============================================================================
// THEME
// ============================================================================
function initTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    applyTheme(saved);
}

const _SVG_ATTRS = 'viewBox="0 0 24 24" style="display:block;width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"';
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const svgLight = `<svg ${_SVG_ATTRS}><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
    const svgDark = `<svg ${_SVG_ATTRS}><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>`;
    document.querySelectorAll('.theme-toggle-icon').forEach(icon => {
        icon.innerHTML = theme === 'light' ? svgLight : svgDark;
    });
}

function _spawnParticles(cx, cy, count) {
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'theme-particle';
        const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.5;
        const dist = 40 + Math.random() * 80;
        p.style.left = cx + 'px';
        p.style.top = cy + 'px';
        p.style.setProperty('--px', Math.cos(angle) * dist + 'px');
        p.style.setProperty('--py', Math.sin(angle) * dist + 'px');
        p.style.width = (3 + Math.random() * 5) + 'px';
        p.style.height = p.style.width;
        p.style.animationDelay = (Math.random() * 0.1) + 's';
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 900);
    }
}

function _spawnShockwave(cx, cy) {
    const ring = document.createElement('div');
    ring.className = 'theme-shockwave';
    ring.style.left = cx + 'px';
    ring.style.top = cy + 'px';
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 900);
}

function toggleTheme(ev) {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';

    const btn = (ev && ev.currentTarget) || document.querySelector('.theme-toggle-icon');
    const ripple = document.getElementById('theme-ripple');

    const rect = btn ? btn.getBoundingClientRect() : { left: window.innerWidth - 40, top: 24, width: 32, height: 32 };
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    if (btn) {
        btn.classList.remove('switching');
        void btn.offsetHeight;
        btn.classList.add('switching');
        setTimeout(() => btn.classList.remove('switching'), 900);
    }

    const _coarseTap = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    _spawnParticles(cx, cy, _coarseTap ? 5 : 12);
    _spawnShockwave(cx, cy);

    if (ripple) {
        const newBg = next === 'light' ? '#f5f3f0' : '#1a1a1e';

        ripple.style.background = newBg;
        ripple.style.setProperty('--ripple-x', cx + 'px');
        ripple.style.setProperty('--ripple-y', cy + 'px');
        ripple.classList.remove('dissolving');
        ripple.style.opacity = '';
        void ripple.offsetHeight;
        ripple.classList.add('expanding');

        const html = document.documentElement;
        html.classList.add('theme-fading');

        setTimeout(() => {
            localStorage.setItem('theme', next);
            applyTheme(next);
            html.classList.add('theme-flash');
        }, 450);

        setTimeout(() => {
            ripple.classList.add('dissolving');
        }, 600);

        setTimeout(() => {
            ripple.style.transition = 'none';
            ripple.classList.remove('expanding', 'dissolving');
            ripple.style.opacity = '';
            void ripple.offsetHeight;
            ripple.style.transition = '';
            html.classList.remove('theme-fading', 'theme-flash');
        }, 900);
    } else {
        localStorage.setItem('theme', next);
        applyTheme(next);
    }
}

initTheme();

// ============================================================================
// Устройство / режим вёрстки (данные для CSS и логики; сессия не нужна — всё в браузере)
// data-server-device — подсказка с сервера (UA / Client Hints); data-device — актуально после ресайза
// ============================================================================
function syncDeviceContext() {
    const html = document.documentElement;
    const w = window.innerWidth;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    let tier = 'desktop';
    if (w <= 900) {
        tier = 'mobile';
    } else if (coarse && w <= 1200) {
        tier = 'tablet';
    }
    html.dataset.device = tier;
    html.dataset.pointer = coarse ? 'coarse' : 'fine';
}
syncDeviceContext();
let _deviceResizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(_deviceResizeTimer);
    _deviceResizeTimer = setTimeout(syncDeviceContext, 120);
});
window.addEventListener('orientationchange', () => setTimeout(syncDeviceContext, 280));

// ============================================================================
// ACCENT COLOR
// ============================================================================
const ACCENT_PRESETS = [
    { name:'Оранжевый',  hex:'#e8915a' },
    { name:'Красный',    hex:'#ef4444' },
    { name:'Розовый',    hex:'#ec4899' },
    { name:'Фиолетовый', hex:'#a855f7' },
    { name:'Синий',      hex:'#3b82f6' },
    { name:'Голубой',    hex:'#06b6d4' },
    { name:'Бирюзовый',  hex:'#14b8a6' },
    { name:'Зелёный',   hex:'#22c55e' },
    { name:'Лайм',      hex:'#84cc16' },
    { name:'Жёлтый',    hex:'#eab308' },
    { name:'Золото',    hex:'#f59e0b' },
];
const DEFAULT_ACCENT = '#e8915a';

function _hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return {r,g,b};
}

function _darken(hex, amount) {
    const {r,g,b} = _hexToRgb(hex);
    const f = 1 - amount;
    const nr = Math.round(r*f), ng = Math.round(g*f), nb = Math.round(b*f);
    return `#${nr.toString(16).padStart(2,'0')}${ng.toString(16).padStart(2,'0')}${nb.toString(16).padStart(2,'0')}`;
}

function applyAccentColor(hex) {
    const root = document.documentElement;
    const {r,g,b} = _hexToRgb(hex);
    const hover = _darken(hex, 0.12);
    const {r:hr, g:hg, b:hb} = _hexToRgb(hover);

    root.style.setProperty('--primary', hex);
    root.style.setProperty('--primary-hover', hover);
    root.style.setProperty('--primary-muted', `rgba(${r},${g},${b},0.12)`);
    root.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.12)`);
    root.style.setProperty('--accent-r', r);
    root.style.setProperty('--accent-g', g);
    root.style.setProperty('--accent-b', b);

    const preview = document.getElementById('accent-preview');
    if (preview) preview.style.background = hex;

    document.querySelectorAll('.accent-swatch').forEach(s =>
        s.classList.toggle('selected', s.dataset.color === hex)
    );
}

function setAccentColor(hex) {
    localStorage.setItem('accentColor', hex);
    applyAccentColor(hex);
}

function resetAccentColor() {
    localStorage.removeItem('accentColor');
    applyAccentColor(DEFAULT_ACCENT);
    showToast('Цвет сброшен', 'info');
}

function _initAccentPicker() {
    const container = document.getElementById('accent-swatches');
    if (!container) return;
    const current = localStorage.getItem('accentColor') || DEFAULT_ACCENT;

    container.innerHTML = ACCENT_PRESETS.map(p =>
        `<div class="accent-swatch${p.hex === current ? ' selected' : ''}" data-color="${p.hex}" title="${p.name}" style="background:${p.hex};" onclick="setAccentColor('${p.hex}')"></div>`
    ).join('');

    const preview = document.getElementById('accent-preview');
    if (preview) preview.style.background = current;
}

(function initAccent() {
    const saved = localStorage.getItem('accentColor');
    if (saved) applyAccentColor(saved);
})();

// ============================================================================
// COLOR PICKER MODAL
// ============================================================================
const _cp = { h:20, s:0.7, v:0.9, draggingSV:false, draggingHue:false };

function _hsvToRgb(h, s, v) {
    h = ((h % 360) + 360) % 360;
    const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    let r, g, b;
    if (h < 60)      { r=c; g=x; b=0; }
    else if (h < 120) { r=x; g=c; b=0; }
    else if (h < 180) { r=0; g=c; b=x; }
    else if (h < 240) { r=0; g=x; b=c; }
    else if (h < 300) { r=x; g=0; b=c; }
    else              { r=c; g=0; b=x; }
    return { r: Math.round((r+m)*255), g: Math.round((g+m)*255), b: Math.round((b+m)*255) };
}

function _rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
    let h = 0;
    if (d !== 0) {
        if (max === r) h = 60 * (((g - b) / d) % 6);
        else if (max === g) h = 60 * ((b - r) / d + 2);
        else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    return { h, s: max === 0 ? 0 : d / max, v: max };
}

function _rgbToHex(r, g, b) {
    return '#' + [r,g,b].map(c => c.toString(16).padStart(2,'0')).join('');
}

function _drawSV() {
    const canvas = document.getElementById('cpicker-sv');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    for (let x = 0; x < w; x++) {
        const s = x / w;
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        const {r, g, b} = _hsvToRgb(_cp.h, s, 1);
        grad.addColorStop(0, `rgb(${r},${g},${b})`);
        grad.addColorStop(1, '#000');
        ctx.fillStyle = grad;
        ctx.fillRect(x, 0, 1, h);
    }
}

function _updatePickerUI() {
    const {r, g, b} = _hsvToRgb(_cp.h, _cp.s, _cp.v);
    const hex = _rgbToHex(r, g, b);

    document.getElementById('cpicker-hex').value = hex;
    document.getElementById('cpicker-r').value = r;
    document.getElementById('cpicker-g').value = g;
    document.getElementById('cpicker-b').value = b;

    const rangeR = document.getElementById('cpicker-range-r');
    const rangeG = document.getElementById('cpicker-range-g');
    const rangeB = document.getElementById('cpicker-range-b');
    if (rangeR) rangeR.value = r;
    if (rangeG) rangeG.value = g;
    if (rangeB) rangeB.value = b;

    _updateChannelTracks(r, g, b);

    const live = document.getElementById('cpicker-live');
    live.style.background = hex;
    live.style.setProperty('--cpick-color', hex);
    live.style.boxShadow = `0 4px 20px ${hex}55`;

    const svCur = document.getElementById('cpicker-sv-cursor');
    svCur.style.left = (_cp.s * 100) + '%';
    svCur.style.top = ((1 - _cp.v) * 100) + '%';
    svCur.style.background = hex;

    const hueThumb = document.getElementById('cpicker-hue-thumb');
    hueThumb.style.left = (_cp.h / 360 * 100) + '%';
    hueThumb.style.background = _rgbToHex(...Object.values(_hsvToRgb(_cp.h, 1, 1)));

    applyAccentColor(hex);
}

function _updateChannelTracks(r, g, b) {
    const setTrack = (id, from, to) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.setProperty('--track-from', from);
        el.style.setProperty('--track-to', to);
    };
    setTrack('cpicker-range-r', _rgbToHex(0, g, b), _rgbToHex(255, g, b));
    setTrack('cpicker-range-g', _rgbToHex(r, 0, b), _rgbToHex(r, 255, b));
    setTrack('cpicker-range-b', _rgbToHex(r, g, 0), _rgbToHex(r, g, 255));
}

function openColorPickerModal() {
    _cp._originalColor = localStorage.getItem('accentColor') || DEFAULT_ACCENT;
    const {r, g, b} = _hexToRgb(_cp._originalColor);
    const hsv = _rgbToHsv(r, g, b);
    _cp.h = hsv.h; _cp.s = hsv.s; _cp.v = hsv.v;

    document.getElementById('modal-color-picker').classList.add('active');

    requestAnimationFrame(() => {
        _drawSV();
        _updatePickerUI();
        _setupPickerEvents();
    });
}

function applyPickerColor() {
    const hex = document.getElementById('cpicker-hex').value;
    setAccentColor(hex);
    closeModal('modal-color-picker');
    showToast(`Цвет ${hex} применён`, 'success');
}

function cancelColorPicker() {
    applyAccentColor(_cp._originalColor || DEFAULT_ACCENT);
    closeModal('modal-color-picker');
}

function _setupPickerEvents() {
    const svWrap = document.getElementById('cpicker-sv-wrap');
    const hueWrap = document.getElementById('cpicker-hue-wrap');
    if (svWrap._cpReady) return;
    svWrap._cpReady = true;

    const getSVFromPoint = (clientX, clientY) => {
        const rect = svWrap.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
        return { s: x, v: 1 - y };
    };
    const getSVFromEvent = e => getSVFromPoint(e.clientX, e.clientY);
    const setHueFromClientX = clientX => {
        const rect = hueWrap.getBoundingClientRect();
        _cp.h = Math.max(0, Math.min(360, (clientX - rect.left) / rect.width * 360));
        _drawSV();
        _updatePickerUI();
    };

    svWrap.addEventListener('mousedown', e => {
        _cp.draggingSV = true;
        const {s, v} = getSVFromEvent(e);
        _cp.s = s; _cp.v = v;
        _updatePickerUI();
    });

    hueWrap.addEventListener('mousedown', e => {
        _cp.draggingHue = true;
        setHueFromClientX(e.clientX);
    });

    document.addEventListener('mousemove', e => {
        if (_cp.draggingSV) {
            const {s, v} = getSVFromEvent(e);
            _cp.s = s; _cp.v = v;
            _updatePickerUI();
        }
        if (_cp.draggingHue) {
            setHueFromClientX(e.clientX);
        }
    });

    document.addEventListener('mouseup', () => {
        _cp.draggingSV = false;
        _cp.draggingHue = false;
    });

    svWrap.addEventListener('touchstart', e => {
        if (e.targetTouches.length !== 1) return;
        e.preventDefault();
        _cp.draggingSV = true;
        const t = e.targetTouches[0];
        const { s, v } = getSVFromPoint(t.clientX, t.clientY);
        _cp.s = s; _cp.v = v;
        _updatePickerUI();
    }, { passive: false });
    hueWrap.addEventListener('touchstart', e => {
        if (e.targetTouches.length !== 1) return;
        e.preventDefault();
        _cp.draggingHue = true;
        setHueFromClientX(e.targetTouches[0].clientX);
    }, { passive: false });
    document.addEventListener('touchmove', e => {
        if (!_cp.draggingSV && !_cp.draggingHue) return;
        const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
        if (!t) return;
        e.preventDefault();
        if (_cp.draggingSV) {
            const { s, v } = getSVFromPoint(t.clientX, t.clientY);
            _cp.s = s; _cp.v = v;
            _updatePickerUI();
        }
        if (_cp.draggingHue) setHueFromClientX(t.clientX);
    }, { passive: false });
    document.addEventListener('touchend', () => {
        _cp.draggingSV = false;
        _cp.draggingHue = false;
    });
    document.addEventListener('touchcancel', () => {
        _cp.draggingSV = false;
        _cp.draggingHue = false;
    });

    const hexInput = document.getElementById('cpicker-hex');
    const _applyHex = () => {
        let hex = hexInput.value.trim();
        if (!hex.startsWith('#')) hex = '#' + hex;
        if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
            const {r, g, b} = _hexToRgb(hex);
            const hsv = _rgbToHsv(r, g, b);
            _cp.h = hsv.h; _cp.s = hsv.s; _cp.v = hsv.v;
            _drawSV();
            _updatePickerUI();
        }
    };
    hexInput.addEventListener('input', _applyHex);
    hexInput.addEventListener('change', _applyHex);

    const _syncRgbFromInputs = () => {
        const r = parseInt(document.getElementById('cpicker-r').value) || 0;
        const g = parseInt(document.getElementById('cpicker-g').value) || 0;
        const b = parseInt(document.getElementById('cpicker-b').value) || 0;
        const hsv = _rgbToHsv(
            Math.max(0, Math.min(255, r)),
            Math.max(0, Math.min(255, g)),
            Math.max(0, Math.min(255, b))
        );
        _cp.h = hsv.h; _cp.s = hsv.s; _cp.v = hsv.v;
        _drawSV();
        _updatePickerUI();
    };

    ['cpicker-r','cpicker-g','cpicker-b'].forEach(id => {
        const el = document.getElementById(id);
        el.addEventListener('input', _syncRgbFromInputs);
        el.addEventListener('change', _syncRgbFromInputs);
    });

    ['cpicker-range-r','cpicker-range-g','cpicker-range-b'].forEach((rangeId, i) => {
        const numIds = ['cpicker-r','cpicker-g','cpicker-b'];
        const rangeEl = document.getElementById(rangeId);
        if (!rangeEl) return;
        rangeEl.addEventListener('input', () => {
            document.getElementById(numIds[i]).value = rangeEl.value;
            _syncRgbFromInputs();
        });
    });
}

// ============================================================================
// TOAST
// ============================================================================
function showToast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#e8915a';
    const colors = { success: '#5ec4b0', error: '#e87272', info: accent };
    const icons = { success: '✓', error: '✕', info: 'i' };
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const bg = isLight ? 'rgba(255,255,255,0.95)' : 'rgba(42,42,47,0.95)';
    const border = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
    const textColor = isLight ? '#1a1a1e' : '#e8e8ed';
    const shadow = isLight ? '0 8px 32px rgba(0,0,0,0.1)' : '0 8px 32px rgba(0,0,0,0.4)';
    t.style.cssText = `
        background:${bg}; backdrop-filter:blur(20px);
        border:1px solid ${border}; border-left:3px solid ${colors[type] || colors.info};
        color:${textColor}; padding:14px 20px; border-radius:12px;
        box-shadow:${shadow};
        font-size:13px; font-weight:500; max-width:360px;
        display:flex; align-items:center; gap:10px;
        animation:toastIn .3s cubic-bezier(.2,1,.3,1);
    `;
    t.innerHTML = `<span style="width:20px;height:20px;border-radius:50%;background:${colors[type]};color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${icons[type]}</span><span>${msg}</span>`;
    c.appendChild(t);
    try { if (typeof soundNotificationsEnabled !== 'undefined' && soundNotificationsEnabled && typeof notificationSound !== 'undefined') { notificationSound.currentTime = 0; notificationSound.play().catch(() => {}); } } catch(_) {}
    setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(30px)'; t.style.transition='all .3s'; setTimeout(()=>t.remove(),300); }, 3500);
}
const _s = document.createElement('style');
_s.innerHTML = `@keyframes toastIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}`;
document.head.appendChild(_s);

// ============================================================================
// DIALOGS
// ============================================================================
function customConfirm(message, title = 'Подтверждение') {
    return new Promise(resolve => {
        const d = document.getElementById('custom-dialog');
        document.getElementById('dialog-title').textContent = title;
        document.getElementById('dialog-message').textContent = message;
        d.classList.add('active');
        const ok = document.getElementById('dialog-confirm');
        const no = document.getElementById('dialog-cancel');
        const cleanup = () => { ok.removeEventListener('click',y); no.removeEventListener('click',n); };
        const y = () => { d.classList.remove('active'); resolve(true); cleanup(); };
        const n = () => { d.classList.remove('active'); resolve(false); cleanup(); };
        ok.addEventListener('click', y);
        no.addEventListener('click', n);
    });
}

// ============================================================================
// INIT
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadAccounts();
    await loadSettings();
    setupNav();
    setupEmailsCounter();
    loadTemplatePicker();
    _initAnimations();
});

function _countUp(elId, target, suffix = '') {
    const el = document.getElementById(elId);
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    if (start === target) { el.textContent = target + suffix; return; }
    const duration = 600;
    const startTime = performance.now();
    const step = ts => {
        const progress = Math.min((ts - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(start + (target - start) * eased) + suffix;
        if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

function _initAnimations() {
    document.addEventListener('click', e => {
        const btn = e.target.closest('.btn');
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        btn.style.setProperty('--ripple-x', ((e.clientX - rect.left) / rect.width * 100) + '%');
        btn.style.setProperty('--ripple-y', ((e.clientY - rect.top) / rect.height * 100) + '%');
        btn.classList.remove('rippling');
        void btn.offsetWidth;
        btn.classList.add('rippling');
        setTimeout(() => btn.classList.remove('rippling'), 600);
    });

    document.addEventListener('mousemove', e => {
        const cards = document.querySelectorAll('.card');
        for (const card of cards) {
            const rect = card.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                card.style.setProperty('--mouse-x', (e.clientX - rect.left) + 'px');
                card.style.setProperty('--mouse-y', (e.clientY - rect.top) + 'px');
            }
        }
    });
}

// ============================================================================
// NAVIGATION
// ============================================================================
const MOBILE_PAGE_TITLES = {
    accounts: 'Аккаунты',
    template: 'Шаблон',
    settings: 'Настройки',
    send: 'Отправка',
    analytics: 'Аналитика',
};

function isMobileNavLayout() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 900px)').matches;
}

function closeMobileNav() {
    document.body.classList.remove('mobile-nav-open');
    const btn = document.getElementById('btn-mobile-menu');
    if (btn) btn.setAttribute('aria-expanded', 'false');
}

function openMobileNav() {
    document.body.classList.add('mobile-nav-open');
    const btn = document.getElementById('btn-mobile-menu');
    if (btn) btn.setAttribute('aria-expanded', 'true');
}

function toggleMobileNav() {
    if (document.body.classList.contains('mobile-nav-open')) closeMobileNav();
    else openMobileNav();
}

function updateMobileHeaderTitle(page) {
    const el = document.getElementById('mobile-page-title');
    if (el) el.textContent = MOBILE_PAGE_TITLES[page] || 'WebFlow Sender';
}

function setupNav() {
    const saved = localStorage.getItem('currentPage') || 'accounts';
    switchPage(saved);
    document.querySelectorAll('.nav-item').forEach(i =>
        i.addEventListener('click', () => {
            switchPage(i.dataset.page);
            if (isMobileNavLayout()) closeMobileNav();
        })
    );
    window.addEventListener('resize', () => {
        if (!isMobileNavLayout()) closeMobileNav();
    });
}
function switchPage(page) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const nav = document.querySelector(`.nav-item[data-page="${page}"]`);
    const pg = document.getElementById(`page-${page}`);
    if (nav) nav.classList.add('active');
    if (pg) pg.classList.add('active');
    localStorage.setItem('currentPage', page);
    updateMobileHeaderTitle(page);
    if (page === 'template') loadTemplate();
    if (page === 'send') updateSendInfo();
    if (page === 'analytics') loadAnalytics();
    if (page === 'settings') loadSettings();
}

// ============================================================================
// ACCOUNTS
// ============================================================================
async function loadAccounts() {
    try {
        const r = await fetch('/api/accounts');
        accounts = await r.json();
        const saved = localStorage.getItem('currentAccount');
        if (saved && accounts.find(a => a._filename === saved)) {
            currentAccount = saved;
        } else if (accounts.length > 0) {
            currentAccount = accounts[0]._filename;
            localStorage.setItem('currentAccount', currentAccount);
        } else {
            currentAccount = null;
            localStorage.removeItem('currentAccount');
        }
        renderAccounts();
        updateStats();
        updateBadge();
        const navBadge = document.getElementById('nav-badge-accounts');
        if (navBadge) navBadge.textContent = accounts.length;
    } catch (e) { console.error(e); }
}

function renderAccounts() {
    const c = document.getElementById('accounts-list');
    if (!accounts.length) {
        c.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="icon"><svg class="ico" style="width:48px;height:48px;opacity:0.5;"><use href="#ico-user"/></svg></div><div>Нет аккаунтов</div><div style="font-size:13px;margin-top:4px;">Добавьте первый аккаунт</div></div>`;
        return;
    }
    c.innerHTML = accounts.map(a => {
        const sel = currentAccount === a._filename ? 'selected' : '';
        const proxy = a.proxy ? a.proxy.substring(0,25) + (a.proxy.length>25?'...':'') : 'Без прокси';
        return `
        <div class="account-card ${sel}" onclick="selectAccount('${a._filename}')">
            <div class="flex-between">
                <div><div class="account-name">${esc(a.app_name)}</div><div class="account-proxy">${esc(proxy)}</div></div>
                <svg class="ico" style="width:20px;height:20px;opacity:0.2;"><use href="#ico-globe"/></svg>
            </div>
            <div class="account-stats">
                <div class="account-stat"><div class="tag" style="font-size:9px;">Отправлено</div><div class="account-stat-val">${a.emails_sent||0}</div></div>
                <div class="account-stat"><div class="tag" style="font-size:9px;color:var(--success);">Статус</div><div class="account-stat-val text-success" style="font-size:12px;">Активен</div></div>
            </div>
            <div class="account-actions">
                <button class="btn btn-ghost" onclick="openRenameModal(event,'${a._filename}','${esc(a.app_name)}')" title="Переименовать"><svg class="ico" style="width:18px;height:18px;"><use href="#ico-pencil"/></svg></button>
                <button class="btn btn-ghost" onclick="openProxyModal(event,'${a._filename}','${esc(a.proxy||'')}')" title="Прокси"><svg class="ico" style="width:18px;height:18px;"><use href="#ico-shield"/></svg></button>
                <button class="btn btn-danger" onclick="deleteAccount(event,'${a._filename}')" title="Удалить"><svg class="ico" style="width:18px;height:18px;"><use href="#ico-trash"/></svg></button>
            </div>
        </div>`;
    }).join('');
}

function esc(t) { const d=document.createElement('div'); d.textContent=t; return d.innerHTML; }
function updateStats() {
    document.getElementById('stat-total').textContent = accounts.length;
    document.getElementById('stat-sent').textContent = accounts.reduce((s,a) => s+(a.emails_sent||0), 0);
}
function updateBadge() {
    const badge = document.getElementById('active-badge');
    const name = document.getElementById('active-badge-name');
    if (currentAccount) {
        const acc = accounts.find(a => a._filename === currentAccount);
        if (acc) { name.textContent = acc.app_name; badge.style.display = 'inline-flex'; return; }
    }
    badge.style.display = 'none';
}
function selectAccount(fn) {
    currentAccount = fn;
    localStorage.setItem('currentAccount', fn);
    renderAccounts();
    updateBadge();
    
    // Синхронизируем токены аккаунта → config.json и поля настроек
    const acc = accounts.find(a => a._filename === fn);
    if (acc) {
        // Обновляем поля настроек, если они загружены
        const sidEl = document.getElementById('engine-session-id');
        const xsrfEl = document.getElementById('engine-xsrf-token');
        if (sidEl && acc.session_id) sidEl.value = acc.session_id;
        if (xsrfEl && acc.xsrf_token) xsrfEl.value = acc.xsrf_token;
        
        // Синхронизируем на бэкенде: account → config.json
        fetch('/api/accounts/sync-config', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({filename: fn})
        }).catch(e => console.error('Sync error:', e));
    }
}
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    if (window._cursorResetMagnet) window._cursorResetMagnet();
}
function openCreateAccountModal() {
    ['create-app-name','create-session-id','create-xsrf-token'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('modal-create-account').classList.add('active');
}
async function saveNewAccount() {
    const name = document.getElementById('create-app-name').value.trim();
    const sid = document.getElementById('create-session-id').value.trim();
    const xsrf = document.getElementById('create-xsrf-token').value.trim();
    if (!name || !sid || !xsrf) return showToast('Заполните все поля', 'error');
    try {
        const r = await fetch('/api/accounts/save', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({app_name:name,session_id:sid,xsrf_token:xsrf}) });
        const data = await r.json();
        if (r.ok && data.success) {
            showToast('Аккаунт добавлен','success');
            closeModal('modal-create-account');
            await loadAccounts();
            
            // Автоматически выбираем новый аккаунт и синхронизируем
            const newAcc = accounts.find(a => a.app_name === name);
            if (newAcc) {
                selectAccount(newAcc._filename);
            }
        }
    } catch(e) { showToast('Ошибка','error'); }
}
function openRenameModal(e,fn,name) { e.stopPropagation(); document.getElementById('rename-filename').value=fn; document.getElementById('rename-input').value=name; document.getElementById('modal-rename').classList.add('active'); }
async function confirmRename() {
    const fn = document.getElementById('rename-filename').value;
    const name = document.getElementById('rename-input').value.trim();
    if (!name) return showToast('Введите имя','error');
    try { const r = await fetch('/api/accounts/rename',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:fn,name})}); if(r.ok){showToast('Обновлено','success');closeModal('modal-rename');await loadAccounts();} } catch(e){showToast('Ошибка','error');}
}
function openProxyModal(e,fn,proxy) { e.stopPropagation(); document.getElementById('proxy-filename').value=fn; document.getElementById('proxy-input').value=proxy; document.getElementById('modal-proxy').classList.add('active'); const res=document.getElementById('proxy-test-result'); res.style.display='none'; res.textContent=''; }
async function testProxy() {
    const proxy = document.getElementById('proxy-input').value.trim();
    const resEl = document.getElementById('proxy-test-result');
    resEl.style.display = 'block';
    if (!proxy) { resEl.style.background = 'rgba(255,69,58,0.1)'; resEl.style.color = 'var(--danger)'; resEl.textContent = 'Введите прокси и нажмите «Проверить»'; return; }
    resEl.style.background = 'rgba(255,255,255,0.05)'; resEl.style.color = 'var(--text-secondary)'; resEl.textContent = 'Проверка...';
    try {
        const r = await fetch('/api/proxy/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proxy }) });
        const d = await r.json();
        if (d.ok) { resEl.style.background = 'rgba(94,196,176,0.1)'; resEl.style.color = 'var(--success)'; resEl.textContent = 'Прокси работает. Внешний IP: ' + d.ip; }
        else { resEl.style.background = 'rgba(255,69,58,0.1)'; resEl.style.color = 'var(--danger)'; resEl.textContent = d.error || 'Ошибка'; }
    } catch (e) { resEl.style.background = 'rgba(255,69,58,0.1)'; resEl.style.color = 'var(--danger)'; resEl.textContent = 'Ошибка сети'; }
}
async function confirmProxy() {
    const fn = document.getElementById('proxy-filename').value;
    const proxy = document.getElementById('proxy-input').value.trim();
    try { const r = await fetch('/api/accounts/update-proxy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:fn,proxy})}); if(r.ok){showToast('Прокси обновлены','success');closeModal('modal-proxy');await loadAccounts();} } catch(e){showToast('Ошибка','error');}
}
async function deleteAccount(e,fn) {
    e.stopPropagation();
    if (!await customConfirm('Удалить этот аккаунт?')) return;
    try { await fetch('/api/accounts/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:fn})}); if(currentAccount===fn){currentAccount=null;localStorage.removeItem('currentAccount');} await loadAccounts(); showToast('Удалён','info'); } catch(e){}
}
async function deleteAllAccounts() {
    if (!await customConfirm('Удалить ВСЕ аккаунты?')) return;
    await fetch('/api/accounts/delete-all',{method:'POST'});
    currentAccount=null; localStorage.removeItem('currentAccount');
    await loadAccounts(); showToast('Все удалены','info');
}

// ============================================================================
// TEMPLATE PICKER
// ============================================================================
const CUSTOM_TPL_COLORS = [
    '#3b82f6','#6366f1','#8b5cf6','#a855f7','#d946ef',
    '#ec4899','#f43f5e','#ef4444','#f97316','#f59e0b',
    '#eab308','#84cc16','#22c55e','#14b8a6','#06b6d4',
    '#0ea5e9','#1a1a1a','#6b7280'
];
const CUSTOM_TPL_ICONS = [
    'mail','send','bell','tag','cart','box','truck','gift',
    'dollar','star','key','shield','fire','zap','globe',
    'link','folder','pencil','check','eye'
];
const BRAND_ICONS = {
    depop:'tag', poshmark:'star', ebay:'cart', vinted:'truck',
    mercari:'box', stockx:'zap', inbox:'mail'
};

async function loadTemplatePicker() {
    try {
        const r = await fetch('/api/templates/list');
        const templates = await r.json();
        const grid = document.getElementById('template-picker');
        window._templateSenderNames = {};
        window._templateSubjects = {};
        templates.forEach(t => {
            window._templateSenderNames[t.filename] = t.sender_name || t.name;
            if (t.subject) window._templateSubjects[t.filename] = t.subject;
        });

        const builtIn = templates.filter(t => !t.custom);
        const custom = templates.filter(t => t.custom);

        const _ico = id => `<svg class="ico"><use href="#ico-${id}"/></svg>`;

        let html = builtIn.map(t => {
            const icon = BRAND_ICONS[t.key] || 'mail';
            return `<div class="tpl-card" onclick="applyTemplate('${t.filename}','${esc(t.name)}')" style="--card-color:${t.color};">
                <div class="tpl-actions">
                    <button class="btn-clone" title="Клонировать" onclick="event.stopPropagation();cloneAsCustom('${t.filename}','${esc(t.name)}','${t.color}')">${_ico('box')}</button>
                </div>
                <div class="tpl-icon-bubble" style="--card-color:${t.color};">${_ico(icon)}</div>
                <div class="tpl-name">${t.name}</div>
            </div>`;
        }).join('');

        html += custom.map(t => {
            const icon = t.icon || 'mail';
            return `<div class="tpl-card" onclick="applyTemplate('${t.filename}','${esc(t.name)}')" style="--card-color:${t.color};">
                <div class="tpl-actions">
                    <button title="Редактировать" onclick="event.stopPropagation();editCustomTemplate('${t.key}')">${_ico('pencil')}</button>
                    <button class="btn-clone" title="Дублировать" onclick="event.stopPropagation();cloneAsCustom('${t.filename}','${esc(t.name)}','${t.color}')">${_ico('box')}</button>
                    <button class="btn-del" title="Удалить" onclick="event.stopPropagation();deleteCustomTemplate('${t.key}','${esc(t.name)}')">${_ico('trash')}</button>
                </div>
                <div class="tpl-icon-bubble" style="--card-color:${t.color};">${_ico(icon)}</div>
                <div class="tpl-name">${t.name}</div>
                <div class="tpl-badge">custom</div>
            </div>`;
        }).join('');

        html += `
            <div class="tpl-card-add" onclick="openCustomTemplateModal()">
                <div class="tpl-add-icon">${_ico('send')}</div>
                <span>Создать шаблон</span>
            </div>
        `;

        grid.innerHTML = html;
    } catch(e) { console.error(e); }
}

async function applyTemplate(filename, name) {
    try {
        const r = await fetch(`/api/templates/load-file?filename=${filename}`);
        const data = await r.json();
        if (data.success) {
            document.getElementById('template-content').value = data.content;

            const senderName = data.sender_name
                || (window._templateSenderNames && window._templateSenderNames[filename])
                || name;
            document.getElementById('template-sender-name').value = senderName;

            if (data.subject) {
                document.getElementById('template-subject').value = data.subject;
            }

            const panel = document.getElementById('template-inline-preview');
            if (panel && panel.classList.contains('open')) {
                _previewLastContent = '';
                updateLivePreview(true);
            }

            if (currentAccount) {
                const subject = document.getElementById('template-subject').value;
                await fetch('/api/template/save', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({account: currentAccount, subject, content: data.content, sender_name: senderName})
                });
                const acc = accounts.find(a => a._filename === currentAccount);
                if (acc) {
                    acc.template_content = data.content;
                    acc.template_subject = subject;
                    acc.sender_name = senderName;
                }
                showToast(`Шаблон «${name}» применён`, 'success');
            } else {
                showToast(`Шаблон «${name}» загружен — выберите аккаунт`, 'info');
            }
        }
    } catch(e) { showToast('Ошибка загрузки','error'); }
}

// ============================================================================
// CUSTOM TEMPLATES
// ============================================================================

function _renderColorPalette(selectedColor) {
    const palette = document.getElementById('custom-tpl-palette');
    palette.innerHTML = CUSTOM_TPL_COLORS.map(c =>
        `<div class="color-swatch${c === selectedColor ? ' selected' : ''}" style="background:${c};" data-color="${c}" onclick="selectTplColor('${c}')"></div>`
    ).join('');
}

function _renderIconPalette(selectedIcon) {
    const palette = document.getElementById('custom-tpl-icons');
    palette.innerHTML = CUSTOM_TPL_ICONS.map(ic =>
        `<div class="icon-swatch${ic === selectedIcon ? ' selected' : ''}" data-icon="${ic}" onclick="selectTplIcon('${ic}')"><svg class="ico"><use href="#ico-${ic}"/></svg></div>`
    ).join('');
}

function selectTplColor(color) {
    document.getElementById('custom-tpl-color').value = color;
    document.querySelectorAll('#custom-tpl-palette .color-swatch').forEach(s => {
        s.classList.toggle('selected', s.getAttribute('data-color') === color);
    });
}

function selectTplIcon(icon) {
    document.getElementById('custom-tpl-icon').value = icon;
    document.querySelectorAll('#custom-tpl-icons .icon-swatch').forEach(s => {
        s.classList.toggle('selected', s.getAttribute('data-icon') === icon);
    });
}

function insertTplVar(varName) {
    const ta = document.getElementById('custom-tpl-content');
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    ta.value = ta.value.substring(0, start) + varName + ta.value.substring(end);
    ta.selectionStart = ta.selectionEnd = start + varName.length;
    ta.focus();
    _autoResizeCustomTpl();
}

function toggleCustomTplEditor(mode) {
    const textarea = document.getElementById('custom-tpl-content');
    const preview = document.getElementById('custom-tpl-preview');
    const varbar = document.getElementById('custom-tpl-varbar');
    const dropzone = document.getElementById('custom-tpl-dropzone');
    document.querySelectorAll('.custom-tpl-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
    if (mode === 'code') {
        textarea.style.display = '';
        varbar.style.display = '';
        if (dropzone) dropzone.style.display = '';
        preview.style.display = 'none';
    } else {
        textarea.style.display = 'none';
        varbar.style.display = 'none';
        if (dropzone) dropzone.style.display = 'none';
        preview.style.display = 'block';
        _renderCustomTplPreview();
    }
}

function _renderCustomTplPreview() {
    const raw = document.getElementById('custom-tpl-content').value;
    const container = document.getElementById('custom-tpl-preview');
    if (!raw.trim()) {
        container.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 16px;text-align:center;opacity:0.5;">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <div style="margin-top:10px;font-size:13px;">Вставьте HTML на вкладке «Код»</div></div>`;
        return;
    }
    let html = raw;
    try {
        const vars = getTemplateVars();
        for (const [k, v] of Object.entries(vars)) { html = html.split(k).join(v); }
    } catch(_) {}
    html = processSpintax(html);
    const shadow = container.shadowRoot || container.attachShadow({ mode: 'open' });
    shadow.innerHTML = html;
}

function _autoResizeCustomTpl() {
    // textarea has fixed max-height with internal scroll — no-op
}

function _initCustomTplModal() {
    const ta = document.getElementById('custom-tpl-content');
    ta.removeEventListener('input', _autoResizeCustomTpl);
    ta.addEventListener('input', _autoResizeCustomTpl);
    _setupCustomTplDragDrop();
    toggleCustomTplEditor('code');
    document.getElementById('modal-custom-template').classList.add('active');
    setTimeout(() => { document.getElementById('custom-tpl-name').focus(); _autoResizeCustomTpl(); }, 200);
}

function openCustomTemplateModal(prefillContent) {
    document.getElementById('custom-tpl-modal-title').textContent = 'Новый шаблон';
    document.getElementById('custom-tpl-id').value = '';
    document.getElementById('custom-tpl-name').value = '';
    document.getElementById('custom-tpl-subject').value = '';
    document.getElementById('custom-tpl-sender').value = '';
    document.getElementById('custom-tpl-color').value = '#3b82f6';
    document.getElementById('custom-tpl-icon').value = 'mail';
    document.getElementById('custom-tpl-content').value = prefillContent || '';
    _renderColorPalette('#3b82f6');
    _renderIconPalette('mail');
    _initCustomTplModal();
}

async function editCustomTemplate(templateId) {
    try {
        const r = await fetch(`/api/templates/custom/get?id=${templateId}`);
        const d = await r.json();
        if (!d.success) { showToast(d.error || 'Ошибка', 'error'); return; }
        document.getElementById('custom-tpl-modal-title').textContent = 'Редактировать шаблон';
        document.getElementById('custom-tpl-id').value = templateId;
        document.getElementById('custom-tpl-name').value = d.name;
        document.getElementById('custom-tpl-subject').value = d.subject || '';
        document.getElementById('custom-tpl-sender').value = d.sender_name || '';
        document.getElementById('custom-tpl-color').value = d.color || '#3b82f6';
        document.getElementById('custom-tpl-icon').value = d.icon || 'mail';
        document.getElementById('custom-tpl-content').value = d.content || '';
        _renderColorPalette(d.color || '#3b82f6');
        _renderIconPalette(d.icon || 'mail');
        _initCustomTplModal();
    } catch(e) { showToast('Ошибка загрузки', 'error'); }
}

async function saveCustomTemplate() {
    const name = document.getElementById('custom-tpl-name').value.trim();
    const subject = document.getElementById('custom-tpl-subject').value.trim();
    const sender = document.getElementById('custom-tpl-sender').value.trim();
    const color = document.getElementById('custom-tpl-color').value;
    const icon = document.getElementById('custom-tpl-icon').value;
    const content = document.getElementById('custom-tpl-content').value;
    const id = document.getElementById('custom-tpl-id').value;

    const missing = [];
    if (!name) missing.push('Название');
    if (!sender) missing.push('Отправитель');
    if (!subject) missing.push('Тема письма');
    if (!content.trim()) missing.push('Тело письма');
    if (missing.length) {
        showToast(`Заполните: ${missing.join(', ')}`, 'error');
        const firstEmpty = !name ? 'custom-tpl-name' : !sender ? 'custom-tpl-sender' : !subject ? 'custom-tpl-subject' : 'custom-tpl-content';
        document.getElementById(firstEmpty).focus();
        return;
    }

    try {
        const r = await fetch('/api/templates/custom/save', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id: id || undefined, name, subject, sender_name: sender, color, icon, content })
        });
        const d = await r.json();
        if (d.success) {
            showToast(id ? `Шаблон «${name}» обновлён` : `Шаблон «${name}» создан`, 'success');
            closeModal('modal-custom-template');
            await loadTemplatePicker();
        } else {
            showToast(d.error || 'Ошибка сохранения', 'error');
        }
    } catch(e) { showToast('Ошибка сети', 'error'); }
}

async function deleteCustomTemplate(templateId, name) {
    const ok = await customConfirm(`Удалить шаблон «${name}»?`, 'Это действие нельзя отменить.');
    if (!ok) return;
    try {
        const r = await fetch('/api/templates/custom/delete', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id: templateId })
        });
        const d = await r.json();
        if (d.success) {
            showToast(`Шаблон «${name}» удалён`, 'success');
            await loadTemplatePicker();
        } else {
            showToast(d.error || 'Ошибка', 'error');
        }
    } catch(e) { showToast('Ошибка сети', 'error'); }
}

async function cloneAsCustom(filename, name, color) {
    try {
        const r = await fetch(`/api/templates/load-file?filename=${filename}`);
        const d = await r.json();
        if (!d.success) { showToast('Не удалось загрузить', 'error'); return; }
        document.getElementById('custom-tpl-modal-title').textContent = 'Клонировать шаблон';
        document.getElementById('custom-tpl-id').value = '';
        document.getElementById('custom-tpl-name').value = name + ' (copy)';
        document.getElementById('custom-tpl-subject').value = d.subject || '';
        document.getElementById('custom-tpl-sender').value = d.sender_name || '';
        document.getElementById('custom-tpl-color').value = color || '#3b82f6';
        document.getElementById('custom-tpl-icon').value = 'mail';
        document.getElementById('custom-tpl-content').value = d.content || '';
        _renderColorPalette(color || '#3b82f6');
        _renderIconPalette('mail');
        _initCustomTplModal();
        showToast(`Клонирован «${name}» — отредактируйте и сохраните`, 'info');
    } catch(e) { showToast('Ошибка', 'error'); }
}

function _handleHtmlFile(file) {
    if (!file) return;
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm') && file.type !== 'text/html') {
        showToast('Поддерживаются только .html файлы', 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
        document.getElementById('custom-tpl-content').value = ev.target.result;
        toggleCustomTplEditor('code');
        showToast(`Загружен ${file.name}`, 'success');
    };
    reader.readAsText(file);
}

function _setupCustomTplDragDrop() {
    const dropzone = document.getElementById('custom-tpl-dropzone');
    const fileInput = document.getElementById('custom-tpl-file-input');
    if (!dropzone || dropzone._ddReady) return;
    dropzone._ddReady = true;

    const prevent = e => { e.preventDefault(); e.stopPropagation(); };

    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) _handleHtmlFile(fileInput.files[0]);
        fileInput.value = '';
    });

    dropzone.addEventListener('dragover', e => { prevent(e); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', e => { prevent(e); dropzone.classList.remove('dragover'); });
    dropzone.addEventListener('drop', e => {
        prevent(e);
        dropzone.classList.remove('dragover');
        _handleHtmlFile(e.dataTransfer.files[0]);
    });
}

// ============================================================================
// TEMPLATES
// ============================================================================
async function loadTemplate() {
    if (!currentAccount) return;
    const acc = accounts.find(a => a._filename === currentAccount);
    const info = document.getElementById('template-account-info');
    if (acc) { document.getElementById('template-account-email').textContent = acc.app_name; info.style.display = 'block'; }
    try {
        const r = await fetch(`/api/template/load?account=${currentAccount}`);
        const d = await r.json();
        if (d.success) { document.getElementById('template-sender-name').value = d.sender_name||''; document.getElementById('template-subject').value = d.subject||''; document.getElementById('template-content').value = d.content||''; }
    } catch(e){}
}
async function setTemplateToCurrentAccount() {
    if (!currentAccount) return showToast('Выберите аккаунт','error');
    const sender_name = document.getElementById('template-sender-name').value;
    const subject = document.getElementById('template-subject').value;
    const content = document.getElementById('template-content').value;
    if (!content.trim()) return showToast('HTML содержимое пустое — вставьте шаблон!','error');
    try {
        const r = await fetch('/api/template/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:currentAccount,subject,content,sender_name})});
        if(r.ok) {
            // Обновляем in-memory аккаунт
            const acc = accounts.find(a => a._filename === currentAccount);
            if (acc) { acc.template_content = content; acc.template_subject = subject; acc.sender_name = sender_name; }
            showToast('Шаблон сохранён','success');
        }
    } catch(e){showToast('Ошибка','error');}
}
async function setTemplateToAllAccounts() {
    if (!await customConfirm('Применить шаблон ко ВСЕМ аккаунтам?')) return;
    const sender_name = document.getElementById('template-sender-name').value;
    const subject = document.getElementById('template-subject').value;
    const content = document.getElementById('template-content').value;
    if (!content.trim()) return showToast('HTML содержимое пустое — вставьте шаблон!','error');
    try { const r = await fetch('/api/template/set',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'all',subject,content,sender_name})}); if(r.ok) showToast('Применено','success'); } catch(e){showToast('Ошибка','error');}
}
function clearTemplate() {
    document.getElementById('template-sender-name').value = '';
    document.getElementById('template-subject').value = '';
    document.getElementById('template-content').value = '';

    const container = document.getElementById('preview-panel-content');
    if (container) {
        const shadow = container.shadowRoot;
        if (shadow) shadow.innerHTML = '';
        container.innerHTML = '';
    }
    _previewLastContent = '';

    const panel = document.getElementById('template-inline-preview');
    if (panel && panel.style.display !== 'none') {
        toggleTemplateEditor('code');
    }

    showToast('Поля очищены', 'info');
}
function previewTemplate() {
    previewTemplateWithVars();
}
function processSpintax(text) {
    let result = text;
    let maxIter = 50;
    while (result.includes('[') && maxIter-- > 0) {
        result = result.replace(/\[([^\[\]]+)\]/g, (m, inner) => {
            const opts = inner.split('|');
            return opts[Math.floor(Math.random() * opts.length)];
        });
    }
    return result;
}
function getTemplateVars() {
    return {
        '{email}': document.getElementById('tpl-var-email').value || 'user@example.com',
        '{username}': document.getElementById('tpl-var-username').value || 'JohnDoe',
        '{order_id}': document.getElementById('tpl-var-order-id').value || '78432156',
        '{redirect}': document.getElementById('tpl-var-redirect').value || 'https://example.com',
        '{date}': document.getElementById('tpl-var-date').value || 'Feb 09, 2026',
        '{time}': document.getElementById('tpl-var-time').value || '14:32',
        '{random_price}': document.getElementById('tpl-var-random-price').value || '$49.99',
        '{tracking_number}': document.getElementById('tpl-var-tracking-number').value || '1Z999AA10123456784',
        '{item_name}': document.getElementById('tpl-var-item-name').value || 'Vintage Nike Windbreaker'
    };
}
function previewTemplateWithVars() {
    let content = document.getElementById('template-content').value;
    if (!content) return showToast('Шаблон пуст','error');
    const vars = getTemplateVars();
    for (const [k,v] of Object.entries(vars)) {
        content = content.split(k).join(v);
    }
    content = processSpintax(content);
    _renderFullscreenPreview(content);
    document.getElementById('modal-preview').classList.add('active');
}

// ============================================================================
// SETTINGS
// ============================================================================
async function loadSettings() {
    try {
        const r = await fetch('/api/settings/load'); settings = await r.json();
        document.getElementById('setting-delay-min').value = settings.delay_min || 2;
        document.getElementById('setting-delay-max').value = settings.delay_max || 5;
        const orderType = settings.order_id_type || 'digits';
        document.getElementById('setting-order-type').value = orderType;
        // sync custom select UI
        const labels = {digits:'Только цифры',letters:'Только буквы',mixed:'Смешанный'};
        const selEl = document.getElementById('select-order-type');
        if (selEl) {
            selEl.querySelector('.select-label').textContent = labels[orderType] || orderType;
            selEl.querySelectorAll('.custom-select-option').forEach(o => o.classList.toggle('selected', o.dataset.value === orderType));
        }
        const cr = await fetch('/api/config/load'); const cfg = await cr.json();
        if (cfg) {
            const map = {session_id:'engine-session-id',xsrf_token:'engine-xsrf-token',site_id:'engine-site-id',element_id:'engine-element-id',page_id:'engine-page-id',site_name:'engine-site-name',domain:'engine-domain',email_sender_name:'engine-sender-name',batch_size:'engine-batch-size',batch_delay:'engine-batch-delay'};
            for (const [k,id] of Object.entries(map)) {
                const el = document.getElementById(id);
                if (el && cfg[k] != null) {
                    el.value = cfg[k];
                    if (el.type === 'number' && el.min !== '' && el.max !== '') {
                        const mn = parseFloat(el.min), mx = parseFloat(el.max);
                        let v = parseFloat(el.value);
                        if (isNaN(v)) v = mn;
                        el.value = Math.max(mn, Math.min(mx, v));
                    }
                }
            }
        }
        
        // Перезаписываем session_id и xsrf_token из активного аккаунта (приоритет аккаунта)
        if (currentAccount) {
            const acc = accounts.find(a => a._filename === currentAccount);
            if (acc) {
                if (acc.session_id) document.getElementById('engine-session-id').value = acc.session_id;
                if (acc.xsrf_token) document.getElementById('engine-xsrf-token').value = acc.xsrf_token;
            }
        }
        
        // Load designer session cookie display (don't show full value for security)
        document.getElementById('engine-designer-session').value = '';
        document.getElementById('engine-designer-session').placeholder = 'Вставьте новое значение wfdesignersession (текущее сохранено)';
        _initAccentPicker();
    } catch(e){ console.error(e); }
}
async function saveAllSettings() {
    try {
        const s1 = await fetch('/api/settings/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({delay_min:parseFloat(document.getElementById('setting-delay-min').value),delay_max:parseFloat(document.getElementById('setting-delay-max').value),order_id_type:document.getElementById('setting-order-type').value})});
        const cfg = {};
        ['session_id','xsrf_token','site_id','element_id','page_id','site_name','domain'].forEach(k => cfg[k]=document.getElementById('engine-'+k.replace(/_/g,'-')).value);
        cfg.email_sender_name = document.getElementById('engine-sender-name').value;
        cfg.batch_size = parseInt(document.getElementById('engine-batch-size').value)||5;
        cfg.batch_delay = parseFloat(document.getElementById('engine-batch-delay').value)||3.5;
        const ds = document.getElementById('engine-designer-session').value.trim();
        if (ds) cfg.designer_session = ds;
        const s2 = await fetch('/api/config/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cfg)});
        if (ds) document.getElementById('engine-designer-session').value = '';
        
        // Синхронизируем токены с активным аккаунтом (всегда, даже если только один заполнен)
        let accountSynced = false;
        if (currentAccount) {
            const newSid = document.getElementById('engine-session-id').value.trim();
            const newXsrf = document.getElementById('engine-xsrf-token').value.trim();
            if (newSid || newXsrf) {
                const acc = accounts.find(a => a._filename === currentAccount);
                if (acc) {
                    if (newSid) acc.session_id = newSid;
                    if (newXsrf) acc.xsrf_token = newXsrf;
                    await fetch('/api/accounts/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({_filepath: acc._filepath, ...acc})});
                    accountSynced = true;
                }
            }
        }
        
        if(s1.ok&&s2.ok) {
            showToast('Настройки сохранены' + (accountSynced ? ' + аккаунт синхронизирован' : ''),'success');
            await loadAccounts();
        } else showToast('Ошибка','error');
    } catch(e){ showToast('Ошибка','error'); }
}

// ============================================================================
// SAVE AUTH SECTION (Session ID, XSRF Token, Designer Cookie)
// ============================================================================
async function saveAuthSection() {
    const btn    = document.getElementById('btn-save-auth');
    const status = document.getElementById('auth-save-status');
    const sid    = document.getElementById('engine-session-id').value.trim();
    const xsrf   = document.getElementById('engine-xsrf-token').value.trim();
    const ds     = document.getElementById('engine-designer-session').value.trim();

    if (!sid && !xsrf && !ds) {
        showToast('Заполните хотя бы одно поле авторизации', 'error');
        return;
    }

    btn.disabled = true;
    try {
        const payload = { session_id: sid, xsrf_token: xsrf };
        if (ds) payload.designer_session = ds;
        const r = await fetch('/api/config/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);

        if (ds) {
            document.getElementById('engine-designer-session').value = '';
            document.getElementById('engine-designer-session').placeholder =
                'Сохранено — вставьте новое значение для обновления';
        }

        status.style.color = 'var(--success)';
        status.textContent = '✓ Сохранено';
        status.style.opacity = '1';
        setTimeout(() => { status.style.opacity = '0'; }, 3000);

        showToast('Авторизация сохранена', 'success');
    } catch (e) {
        status.style.color = 'var(--danger)';
        status.textContent = '✗ Ошибка сохранения';
        status.style.opacity = '1';
        showToast('Ошибка сохранения авторизации', 'error');
    } finally {
        btn.disabled = false;
    }
}

// ============================================================================
// AUTO-DETECT WEBFLOW URL
// ============================================================================
async function parseWebflowUrl() {
    const input = document.getElementById('url-parse-input');
    const btn   = document.getElementById('btn-parse-url');
    const url   = (input?.value || '').trim();

    if (!url) { showToast('Вставьте ссылку на сайт', 'error'); return; }

    btn.disabled = true;
    btn.innerHTML = '<svg class="ico spin" style="margin-right:6px;width:14px;height:14px;"><use href="#ico-loader"/></svg>Распознаю...';
    _setParseStatus('', 'loading');

    try {
        const r    = await fetch('/api/config/parse-url', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ url }),
        });
        const data = await r.json();

        if (!data.success) {
            _setParseStatus('❌ ' + data.error, 'error');
            showToast(data.error, 'error');
            return;
        }

        const cfg = data.config;

        const fieldMap = {
            'engine-site-id':    cfg.site_id    || '',
            'engine-element-id': cfg.element_id || '',
            'engine-page-id':    cfg.page_id    || '',
            'engine-site-name':  cfg.site_name  || '',
            'engine-domain':     cfg.domain     || '',
        };
        for (const [id, val] of Object.entries(fieldMap)) {
            const el = document.getElementById(id);
            if (el && val) el.value = val;
        }

        await fetch('/api/config/save', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(cfg),
        });

        const fullyFetched = data.fetched.includes('site_id') && data.fetched.includes('element_id');

        const cfgSection = document.getElementById('section-site-config');
        if (cfgSection) cfgSection.style.display = fullyFetched ? 'none' : '';

        const fetchedLabels = [];
        if (data.fetched.includes('site_id'))    fetchedLabels.push('Site ID');
        if (data.fetched.includes('page_id'))    fetchedLabels.push('Page ID');
        if (data.fetched.includes('element_id')) fetchedLabels.push('Element ID');
        const fetchedInfo = fetchedLabels.length
            ? 'Получено: <strong>' + fetchedLabels.join(', ') + '</strong>'
            : '⚠️ Не удалось получить ID — убедитесь что сайт опубликован';
        const warnHtml = data.warnings.length
            ? '<div style="margin-top:6px;opacity:0.6;font-size:11px;">' + data.warnings.join(' · ') + '</div>'
            : '';

        _setParseStatus(
            '✓ <strong>' + (cfg.site_name || cfg.design_host) + '</strong><br>' + fetchedInfo + warnHtml,
            fullyFetched ? 'success' : data.fetched.length ? 'partial' : 'warn'
        );

        showToast(fullyFetched ? 'Конфигурация заполнена' : 'Частично заполнено — проверьте предупреждения', fullyFetched ? 'success' : 'info');

    } catch (e) {
        _setParseStatus('❌ Ошибка: ' + e.message, 'error');
        showToast('Ошибка запроса', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg class="ico" style="margin-right:6px;"><use href="#ico-zap"/></svg>Распознать';
    }
}

function _setParseStatus(html, type) {
    const el = document.getElementById('url-parse-status');
    if (!el) return;
    if (!html) { el.style.display = 'none'; return; }
    const c = {
        success: ['rgba(94,196,176,0.08)',  'rgba(94,196,176,0.2)',  'var(--success)'],
        partial: ['var(--primary-muted)',  'color-mix(in srgb, var(--primary) 20%, transparent)',  'var(--primary)'],
        warn:    ['var(--primary-muted)',  'color-mix(in srgb, var(--primary) 20%, transparent)',  'var(--primary)'],
        error:   ['rgba(232,114,114,0.08)', 'rgba(232,114,114,0.2)', 'var(--danger)'],
        loading: ['rgba(255,255,255,0.03)', 'var(--border)',          'var(--text-secondary)'],
    }[type] || ['rgba(255,255,255,0.03)', 'var(--border)', 'var(--text-secondary)'];
    el.style.cssText = `display:block;background:${c[0]};border:1px solid ${c[1]};color:${c[2]};margin-top:12px;padding:10px 14px;border-radius:var(--radius-sm);font-size:12px;line-height:1.6;`;
    el.innerHTML = html;
}

// ============================================================================
// TIMER
// ============================================================================
function formatTimer(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function startTimer() {
    timerStartTime = Date.now();
    timerIsSynced = false;
    const card = document.getElementById('timer-card');
    card.classList.remove('timer-done', 'timer-error');
    card.classList.add('timer-active');
    document.getElementById('timer-label').textContent = 'Идёт отправка...';
    document.getElementById('timer-icon').innerHTML = '<svg class="ico"><use href="#ico-timer"/></svg>';
    document.getElementById('timer-speed').textContent = '—';
    document.getElementById('timer-eta').textContent = '—';

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimerDisplay, 200);
}

function updateTimerDisplay() {
    if (!timerStartTime) return;
    const elapsed = (Date.now() - timerStartTime) / 1000;
    document.getElementById('timer-display').textContent = formatTimer(elapsed);
}

function syncTimerFromServer(elapsed, current, total, status) {
    // Sync the start time from server elapsed for accuracy
    if (elapsed > 0 && !timerIsSynced) {
        timerStartTime = Date.now() - (elapsed * 1000);
        timerIsSynced = true;
    }

    // Speed: emails per minute
    if (elapsed > 0 && current > 0) {
        const perMin = (current / elapsed * 60).toFixed(1);
        document.getElementById('timer-speed').textContent = perMin + ' / мин';
    }

    // ETA
    if (current > 0 && current < total && elapsed > 0) {
        const remaining = total - current;
        const secPerEmail = elapsed / current;
        const etaSec = remaining * secPerEmail;
        document.getElementById('timer-eta').textContent = formatTimer(etaSec);
    } else if (current >= total && total > 0) {
        document.getElementById('timer-eta').textContent = '0:00';
    }
}

function stopTimer(status, elapsed) {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    const card = document.getElementById('timer-card');
    card.classList.remove('timer-active');

    // Show final time
    if (elapsed > 0) {
        document.getElementById('timer-display').textContent = formatTimer(elapsed);
    }

    if (status === 'completed') {
        card.classList.add('timer-done');
        document.getElementById('timer-label').textContent = 'Завершено за';
        document.getElementById('timer-icon').innerHTML = '<svg class="ico"><use href="#ico-check"/></svg>';
        document.getElementById('timer-eta').textContent = 'Готово';
    } else if (status === 'error') {
        card.classList.add('timer-error');
        document.getElementById('timer-label').textContent = 'Ошибка через';
        document.getElementById('timer-icon').innerHTML = '<svg class="ico"><use href="#ico-cross"/></svg>';
        document.getElementById('timer-eta').textContent = 'Ошибка';
    } else if (status === 'stopped') {
        card.classList.add('timer-error');
        document.getElementById('timer-label').textContent = 'Остановлено через';
        document.getElementById('timer-icon').innerHTML = '<svg class="ico"><use href="#ico-pause"/></svg>';
        document.getElementById('timer-eta').textContent = 'Стоп';
    }
}

function resetTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    timerStartTime = null;
    timerIsSynced = false;
    const card = document.getElementById('timer-card');
    card.classList.remove('timer-active', 'timer-done', 'timer-error');
    document.getElementById('timer-display').textContent = '00:00:00';
    document.getElementById('timer-label').textContent = 'Время отправки';
    document.getElementById('timer-icon').innerHTML = '<svg class="ico"><use href="#ico-timer"/></svg>';
    document.getElementById('timer-speed').textContent = '—';
    document.getElementById('timer-eta').textContent = '—';
}

// ============================================================================
// SENDING
// ============================================================================
function selectMode(btn) { document.querySelectorAll('.mode-opt').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); selectedMode=parseInt(btn.dataset.mode); document.getElementById('send-mode').value=selectedMode; const sm=document.getElementById('stat-mode'); if(sm) sm.textContent='Режим '+selectedMode; }
function setupEmailsCounter() { document.getElementById('emails-input').addEventListener('input',function(){ document.getElementById('emails-count').textContent=this.value.split('\n').filter(l=>l.trim()&&l.includes('@')).length; }); }
function loadEmailsFromFile(e) { const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=ev=>{document.getElementById('emails-input').value=ev.target.result; const n=ev.target.result.split('\n').filter(l=>l.trim()&&l.includes('@')).length; document.getElementById('emails-count').textContent=n; showToast(`Загружено ${n} email`,'success');}; r.readAsText(f); }
function updateSendInfo() {
    const info=document.getElementById('send-account-info');
    if(currentAccount){
        const a=accounts.find(x=>x._filename===currentAccount);
        if(a){
            document.getElementById('send-account-name').textContent=a.app_name;
            info.style.display='block';
            // Load redirect URL
            document.getElementById('send-redirect-url').value = a.redirect_url || '';
            return;
        }
    }
    info.style.display='none';
}
async function saveRedirectUrl(silent) {
    const url = document.getElementById('send-redirect-url').value.trim();
    if (!url) { if(!silent) showToast('Введите ссылку', 'error'); return; }
    if (!currentAccount) { if(!silent) showToast('Выберите аккаунт', 'error'); return; }
    try {
        // Сохраняем redirect_url ТОЛЬКО для текущего аккаунта (не глобально)
        await fetch('/api/accounts/update-field', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({filename: currentAccount, field: 'redirect_url', value: url})
        });
        // Обновляем в памяти
        const acc = accounts.find(a => a._filename === currentAccount);
        if (acc) acc.redirect_url = url;
        if (!silent) showToast('Ссылка сохранена для этого аккаунта', 'success');
    } catch(e) { if(!silent) showToast('Ошибка сохранения', 'error'); }
}
async function startSending() {
    if(!currentAccount) return showToast('Выберите аккаунт','error');
    const emails=document.getElementById('emails-input').value;
    if(!emails.trim()) return showToast('Список пуст','error');
    
    // Auto-save redirect URL before sending
    const redirectUrl = document.getElementById('send-redirect-url').value.trim();
    if (redirectUrl) {
        await saveRedirectUrl(true);
    }
    
    document.getElementById('btn-start').style.display='none';
    document.getElementById('btn-stop').style.display='flex';
    document.getElementById('logs-container').innerHTML='<div style="color:var(--primary);">Запуск...</div>';
    resetTimer();
    try {
        const r = await fetch('/api/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:currentAccount,emails,mode:selectedMode})});
        if(r.ok){startTimer();startPolling();showToast('Запущено','info');} else {const d=await r.json();showToast(d.error||'Ошибка','error');resetBtns();}
    } catch(e){showToast('Ошибка','error');resetBtns();}
}
async function stopSending() { if(!await customConfirm('Остановить рассылку?'))return; try{await fetch('/api/stop',{method:'POST'});showToast('Остановка...','info');}catch(e){} }
function resetBtns() { document.getElementById('btn-start').style.display='flex'; document.getElementById('btn-stop').style.display='none'; }
function updateSidebarStatus(status, current, total) {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    dot.classList.remove('pulse');
    if (status === 'running') {
        dot.style.background = 'var(--primary)';
        dot.classList.add('pulse');
        text.textContent = `Отправка ${current}/${total}...`;
        text.style.color = 'var(--primary)';
    } else if (status === 'completed') {
        dot.style.background = '#5ec4b0';
        text.textContent = 'Завершено';
        text.style.color = '#5ec4b0';
    } else if (status === 'error') {
        dot.style.background = '#e87272';
        text.textContent = 'Ошибка';
        text.style.color = '#e87272';
    } else if (status === 'stopped') {
        dot.style.background = '#ff9f0a';
        text.textContent = 'Остановлено';
        text.style.color = '#ff9f0a';
    } else {
        dot.style.background = '#48484a';
        text.textContent = 'Готов';
        text.style.color = 'var(--text-secondary)';
    }
}
function startPolling() {
    if(statusInterval) clearInterval(statusInterval);
    _pollLastLogKey = '';
    _pollLastPct = -1;
    const pollMs = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) ? 2200 : 1500;
    statusInterval = setInterval(async()=>{
        try{
            const r=await fetch('/api/status'); const d=await r.json();
            const pct=d.total>0?Math.round(d.current/d.total*100):0;
            if (pct !== _pollLastPct) {
                _pollLastPct = pct;
                document.getElementById('progress-percent').textContent=pct+'%';
                document.getElementById('progress-fill').style.width=pct+'%';
            }
            document.getElementById('progress-text').textContent=`${d.current} / ${d.total}`;
            document.getElementById('send-success').textContent=d.success;
            document.getElementById('send-errors').textContent=d.failed;
            // Update sidebar status bar
            updateSidebarStatus(d.status, d.current, d.total);
            // Sync timer with server data
            if (d.status === 'running') {
                syncTimerFromServer(d.elapsed || 0, d.current, d.total, d.status);
            }
            const lc=document.getElementById('logs-container');
            if(d.logs&&d.logs.length&&lc){
                const logs=d.logs.slice(-100);
                const last=logs[logs.length-1];
                const logKey=logs.length+'\n'+(last?last.timestamp+'\n'+last.message+'\n'+last.level:'');
                if(logKey!==_pollLastLogKey){
                    _pollLastLogKey=logKey;
                    const wasAtBottom = lc.scrollHeight - lc.scrollTop - lc.clientHeight < 60;
                    lc.innerHTML=logs.map(l=>{
                        const clr=l.level==='error'?'var(--danger)':l.level==='success'?'var(--success)':'var(--text-secondary)';
                        let msg = esc(l.message).replace(/(#[A-Z_0-9]+)/g, '<span style="background:var(--primary-muted);color:var(--primary);padding:1px 5px;border-radius:4px;font-size:10px;font-weight:700;">$1</span>');
                        return `<div style="margin-bottom:6px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.03);"><div style="display:flex;justify-content:space-between;font-size:10px;opacity:0.4;margin-bottom:2px;"><span>${l.timestamp}</span></div><div style="color:${clr};font-size:11px;">${msg}</div></div>`;
                    }).join('');
                    if (wasAtBottom) lc.scrollTop = lc.scrollHeight;
                }
            } else if (_pollLastLogKey !== '' && lc) {
                _pollLastLogKey = '';
                lc.innerHTML = '';
            }
            if(['completed','error','stopped','idle'].includes(d.status)){
                if(d.status!=='idle'){
                    const msgs={completed:'Завершено',error:'Ошибка',stopped:'Остановлено'};
                    const types={completed:'success',error:'error',stopped:'info'};
                    showToast(msgs[d.status],types[d.status]);
                    // Browser notifications
                    if (d.status === 'completed') {
                        sendNotification('Рассылка завершена', `${d.success} успешно, ${d.failed} ошибок`);
                    } else if (d.status === 'error') {
                        sendNotification('Ошибка рассылки', 'Произошла критическая ошибка');
                    } else if (d.status === 'stopped') {
                        sendNotification('Рассылка остановлена', 'Остановлено пользователем');
                    }
                }
                stopTimer(d.status, d.elapsed || 0);
                clearInterval(statusInterval);statusInterval=null;resetBtns();await loadAccounts();
                // Reset sidebar status after delay
                setTimeout(() => updateSidebarStatus('idle'), 5000);
            }
        }catch(e){}
    },pollMs);
}

// ============================================================================
// TEMPLATE VARIABLE RANDOMIZER
// ============================================================================
async function randomizeVars() {
    try {
        const url = currentAccount
            ? `/api/random-vars?account=${currentAccount}`
            : '/api/random-vars';
        const r = await fetch(url);
        const data = await r.json();
        
        document.getElementById('tpl-var-email').value = data.email || '';
        document.getElementById('tpl-var-username').value = data.username || '';
        document.getElementById('tpl-var-order-id').value = data.order_id || '';
        if (data.redirect) document.getElementById('tpl-var-redirect').value = data.redirect;
        document.getElementById('tpl-var-date').value = data.date || '';
        document.getElementById('tpl-var-time').value = data.time || '';
        document.getElementById('tpl-var-random-price').value = data.random_price || '';
        document.getElementById('tpl-var-tracking-number').value = data.tracking_number || '';
        document.getElementById('tpl-var-item-name').value = data.item_name || '';
        
        showToast('Переменные рандомизированы', 'success');
    } catch(e) {
        showToast('Ошибка рандомизации', 'error');
        console.error(e);
    }
}

async function applyVarsToTemplate() {
    const content = document.getElementById('template-content').value;
    if (!content) return showToast('Шаблон пуст', 'error');
    
    const vars = getTemplateVars();
    
    let result = content;
    for (const [k, v] of Object.entries(vars)) {
        result = result.split(k).join(v);
    }
    result = processSpintax(result);
    
    document.getElementById('template-content').value = result;
    showToast('Переменные подставлены в шаблон', 'success');
}

async function randomizeAndPreview() {
    if (!document.getElementById('template-content').value.trim()) return showToast('Шаблон пуст', 'error');
    await randomizeVars();
    previewTemplateWithVars();
}

// ============================================================================
// VISUAL EDITOR (Code / Preview toggle)
// ============================================================================
let _previewLastContent = '';
let _previewDebounceTimer = null;

function toggleTemplateEditor(mode) {
    const textarea = document.getElementById('template-content');
    const panel = document.getElementById('template-inline-preview');
    document.querySelectorAll('.template-editor-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));

    if (mode === 'code') {
        textarea.style.display = '';
        panel.classList.remove('open');
        textarea.removeEventListener('input', _onTemplateInput);
    } else {
        textarea.style.display = 'none';
        panel.classList.add('open');
        _previewLastContent = '';
        updateLivePreview(true);
        textarea.addEventListener('input', _onTemplateInput);
    }
}

function _onTemplateInput() {
    if (_previewDebounceTimer) clearTimeout(_previewDebounceTimer);
    _previewDebounceTimer = setTimeout(() => updateLivePreview(false), 400);
}

function updateLivePreview(force) {
    const raw = document.getElementById('template-content').value;
    const container = document.getElementById('preview-panel-content');
    if (!raw) {
        container.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;text-align:center;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5;margin-bottom:16px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15" style="opacity:0.4"/><line x1="9" y1="18" x2="13" y2="18" style="opacity:0.3"/></svg>
            <div style="font-size:14px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;">Шаблон не загружен</div>
            <div style="font-size:12px;color:var(--text-tertiary);max-width:260px;">Выберите шаблон из списка или вставьте HTML-код на вкладке «Код»</div>
        </div>`;
        return;
    }

    const vars = getTemplateVars();
    let html = raw;
    for (const [k, v] of Object.entries(vars)) { html = html.split(k).join(v); }

    if (!force && html === _previewLastContent) return;
    _previewLastContent = html;

    const rendered = processSpintax(html);
    const shadow = container.shadowRoot || container.attachShadow({ mode: 'open' });
    shadow.innerHTML = rendered;
}

function togglePreviewExpand() {
    const body = document.getElementById('preview-panel-body');
    const bar = document.getElementById('preview-expand-bar');
    const isCollapsed = body.classList.contains('collapsed');

    if (isCollapsed) {
        body.classList.remove('collapsed');
        body.classList.add('expanded');
        bar.classList.add('expanded');
        bar.querySelector('span').innerHTML = '<span class="expand-arrow">▼</span> Свернуть';
    } else {
        body.classList.remove('expanded');
        body.classList.add('collapsed');
        bar.classList.remove('expanded');
        bar.querySelector('span').innerHTML = '<span class="expand-arrow">▼</span> Развернуть полностью';
    }
}

async function randomizeInlinePreview() {
    if (!document.getElementById('template-content').value.trim()) return showToast('Шаблон пуст', 'error');
    await randomizeVars();
    _previewLastContent = '';
    updateLivePreview(true);
}

function openPreviewFullscreen() {
    const raw = document.getElementById('template-content').value;
    if (!raw) return showToast('Шаблон пуст', 'error');
    const vars = getTemplateVars();
    let content = raw;
    for (const [k, v] of Object.entries(vars)) { content = content.split(k).join(v); }
    content = processSpintax(content);
    _renderFullscreenPreview(content);
    document.getElementById('modal-preview').classList.add('active');
}

function _renderFullscreenPreview(html) {
    const container = document.getElementById('preview-frame-container');
    const shadow = container.shadowRoot || container.attachShadow({ mode: 'open' });
    shadow.innerHTML = html;
}

async function randomizeFullscreenPreview() {
    const raw = document.getElementById('template-content').value;
    if (!raw.trim()) return showToast('Шаблон пуст', 'error');
    await randomizeVars();
    const vars = getTemplateVars();
    let content = raw;
    for (const [k, v] of Object.entries(vars)) { content = content.split(k).join(v); }
    content = processSpintax(content);
    _renderFullscreenPreview(content);
    showToast('Переменные обновлены', 'success');
}

// ============================================================================
// ANALYTICS
// ============================================================================
async function loadAnalytics() {
    try {
        const [analyticsRes, logsRes] = await Promise.all([
            fetch('/api/analytics/data').then(r => r.json()),
            fetch('/api/logs/list').then(r => r.json())
        ]);
        renderAnalytics(analyticsRes);
        renderLogsList(logsRes);
    } catch(e) { console.error(e); }
}

function renderAnalytics(data) {
    if (!data || !data.length) {
        document.getElementById('analytics-total').textContent = '0';
        document.getElementById('analytics-success').textContent = '0';
        document.getElementById('analytics-failed').textContent = '0';
        document.getElementById('analytics-rate').textContent = '0%';
        document.getElementById('analytics-chart').innerHTML = '<div style="color:var(--text-tertiary); font-size:13px; margin:auto;">Нет данных для отображения</div>';
        document.getElementById('analytics-top-accounts').innerHTML = 'Нет данных';
        document.getElementById('analytics-recent').innerHTML = 'Нет данных';
        return;
    }

    // Summary stats
    const totalSent = data.reduce((s, r) => s + r.total, 0);
    const totalSuccess = data.reduce((s, r) => s + r.success, 0);
    const totalFailed = data.reduce((s, r) => s + r.failed, 0);
    const rate = totalSent > 0 ? Math.round(totalSuccess / totalSent * 100) : 0;

    _countUp('analytics-total', totalSent);
    _countUp('analytics-success', totalSuccess);
    _countUp('analytics-failed', totalFailed);
    _countUp('analytics-rate', rate, '%');

    // Chart: last 14 days
    renderChart(data);

    // Top accounts
    const accMap = {};
    data.forEach(r => { accMap[r.account] = (accMap[r.account] || 0) + r.total; });
    const topAccounts = Object.entries(accMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    document.getElementById('analytics-top-accounts').innerHTML = topAccounts.map((a, i) =>
        `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border);">
            <span style="font-weight:600;"><span style="color:var(--text-tertiary); margin-right:8px;">${i+1}.</span>${esc(a[0])}</span>
            <span style="color:var(--primary); font-weight:700;">${a[1]}</span>
        </div>`
    ).join('') || 'Нет данных';

    // Recent mailings
    const recent = data.slice(-5).reverse();
    document.getElementById('analytics-recent').innerHTML = recent.map(r =>
        `<div style="padding:8px 0; border-bottom:1px solid var(--border);">
            <div class="flex-between" style="margin-bottom:4px;">
                <span style="font-weight:600; font-size:12px;">${esc(r.account)}</span>
                <span style="font-size:10px; color:var(--text-tertiary);">${r.date} ${r.time || ''}</span>
            </div>
            <div style="font-size:11px;">
                <span style="color:var(--text-secondary);">Всего: ${r.total}</span>
                <span style="color:var(--success); margin-left:10px;">✓ ${r.success}</span>
                <span style="color:var(--danger); margin-left:10px;">✕ ${r.failed}</span>
            </div>
        </div>`
    ).join('') || 'Нет данных';
}

function renderChart(data) {
    const chart = document.getElementById('analytics-chart');
    // Aggregate by date for last 14 days
    const today = new Date();
    const days = [];
    for (let i = 13; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
    }
    const byDay = {};
    days.forEach(d => byDay[d] = 0);
    data.forEach(r => { if (byDay[r.date] !== undefined) byDay[r.date] += r.total; });

    const values = days.map(d => byDay[d]);
    const maxVal = Math.max(...values, 1);

    chart.innerHTML = days.map((d, i) => {
        const h = Math.max(2, (values[i] / maxVal) * 130);
        const label = d.slice(5); // MM-DD
        return `<div class="chart-bar" style="height:${h}px;" title="${d}: ${values[i]} писем">
            <span class="chart-bar-val">${values[i] || ''}</span>
            <span class="chart-bar-label">${label}</span>
        </div>`;
    }).join('');
}

// ============================================================================
// LOG VIEWER
// ============================================================================
function renderLogsList(dates) {
    const container = document.getElementById('select-log-date');
    const labelEl = container && container.querySelector('.select-label');
    const dropdown = document.getElementById('log-date-dropdown');
    if (!dropdown || !labelEl) return;
    labelEl.textContent = 'Выберите дату...';
    const options = ['<div class="custom-select-option selected" data-value="" onclick="pickLogDate(this.dataset.value)">Выберите дату...</div>'];
    (dates || []).forEach(d => {
        options.push(`<div class="custom-select-option" data-value="${esc(d)}" onclick="pickLogDate(this.dataset.value)">${esc(d)}</div>`);
    });
    dropdown.innerHTML = options.join('');
}
function pickLogDate(value) {
    const container = document.getElementById('select-log-date');
    if (!container) return;
    const labelEl = container.querySelector('.select-label');
    const dropdown = container.querySelector('.custom-select-dropdown');
    if (labelEl) labelEl.textContent = value || 'Выберите дату...';
    if (dropdown) dropdown.classList.remove('open');
    container.querySelector('.custom-select-trigger').classList.remove('open');
    container.querySelectorAll('.custom-select-option').forEach(o => o.classList.toggle('selected', o.dataset.value === value));
    viewLog(value || null);
}
async function viewLog(date) {
    if (!date) { document.getElementById('log-content').textContent = 'Выберите дату для просмотра логов...'; return; }
    try {
        const r = await fetch(`/api/logs/view?date=${date}`);
        const data = await r.json();
        if (data.success) {
            const el = document.getElementById('log-content');
            el.innerHTML = data.content.split('\n').map(line => {
                if (!line.trim()) return '';
                let color = 'var(--text-secondary)';
                if (line.includes('[ERROR]')) color = 'var(--danger)';
                else if (line.includes('[SUCCESS]')) color = 'var(--success)';
                else if (line.includes('[INFO]')) color = 'var(--primary)';
                return `<div style="color:${color}; margin-bottom:2px;">${esc(line)}</div>`;
            }).join('');
        } else {
            document.getElementById('log-content').textContent = 'Лог не найден';
        }
    } catch(e) { document.getElementById('log-content').textContent = 'Ошибка загрузки'; }
}

// ============================================================================
// SOUND NOTIFICATIONS
// ============================================================================
const notificationSound = new Audio('/static/Nota.mp3');
notificationSound.volume = 0.7;
let soundNotificationsEnabled = localStorage.getItem('soundNotifications') !== 'false'; // enabled by default

function sendNotification(title, body) {
    if (soundNotificationsEnabled) {
        try {
            notificationSound.currentTime = 0;
            notificationSound.play().catch(e => console.warn('Sound play failed:', e));
        } catch(e) { console.warn('Sound notification error:', e); }
    }
}

function toggleSoundNotifications() {
    soundNotificationsEnabled = !soundNotificationsEnabled;
    localStorage.setItem('soundNotifications', soundNotificationsEnabled);
    updateNotificationButton();
    if (soundNotificationsEnabled) {
        showToast('Звуковые уведомления включены', 'success');
        // Play test sound
        try {
            notificationSound.currentTime = 0;
            notificationSound.play().catch(e => {});
        } catch(e) {}
    } else {
        showToast('Звуковые уведомления выключены', 'info');
    }
}

function updateNotificationButton() {
    const btn = document.getElementById('btn-notifications');
    const textEl = document.getElementById('btn-notifications-text');
    if (!btn) return;
    if (soundNotificationsEnabled) {
        if (textEl) textEl.textContent = 'Включены';
        btn.style.borderColor = 'rgba(94,196,176,0.3)';
        btn.style.color = '#5ec4b0';
    } else {
        if (textEl) textEl.textContent = 'Выключены';
        btn.style.borderColor = '';
        btn.style.color = '';
    }
}

// Auto-update button on load
document.addEventListener('DOMContentLoaded', () => {
    updateNotificationButton();
});

// ============================================================================
// DRAG & DROP
// ============================================================================
(function() {
    document.addEventListener('DOMContentLoaded', () => {
        const zone = document.getElementById('drop-zone');
        const overlay = document.getElementById('drop-overlay');
        const input = document.getElementById('emails-input');
        if (!zone) return;

        let dragCounter = 0;

        zone.addEventListener('dragenter', e => {
            e.preventDefault();
            dragCounter++;
            zone.classList.add('drag-over');
            overlay.style.display = 'flex';
        });
        zone.addEventListener('dragleave', e => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                zone.classList.remove('drag-over');
                overlay.style.display = 'none';
            }
        });
        zone.addEventListener('dragover', e => {
            e.preventDefault();
        });
        zone.addEventListener('drop', e => {
            e.preventDefault();
            dragCounter = 0;
            zone.classList.remove('drag-over');
            overlay.style.display = 'none';

            const files = e.dataTransfer.files;
            if (files.length === 0) return;
            const file = files[0];
            if (!file.name.endsWith('.txt')) {
                showToast('Поддерживаются только .txt файлы', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = ev => {
                input.value = ev.target.result;
                const count = ev.target.result.split('\n').filter(l => l.trim() && l.includes('@')).length;
                document.getElementById('emails-count').textContent = count;
                showToast(`Загружено ${count} email из ${file.name}`, 'success');
            };
            reader.readAsText(file);
        });
    });
})();

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================
document.addEventListener('keydown', e => {
    // Ctrl+S - save
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        const currentPage = localStorage.getItem('currentPage') || 'accounts';
        if (currentPage === 'template') setTemplateToCurrentAccount();
        else if (currentPage === 'settings') saveAllSettings();
        else showToast('Сохранено (Ctrl+S)', 'info');
    }
    // Ctrl+Enter - start sending
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        const currentPage = localStorage.getItem('currentPage') || 'accounts';
        if (currentPage === 'send') startSending();
    }
    // Escape - close modals & mobile drawer
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
        if (document.body.classList.contains('mobile-nav-open')) closeMobileNav();
        if (window._cursorResetMagnet) window._cursorResetMagnet();
    }
});

// ============================================================================
// EXPORT / IMPORT
// ============================================================================
async function exportAllData() {
    try {
        const [acc,sett,cfg] = await Promise.all([fetch('/api/accounts').then(r=>r.json()),fetch('/api/settings/load').then(r=>r.json()),fetch('/api/config/load').then(r=>r.json())]);
        const clean = acc.map(a=>{const c={...a};delete c._filepath;delete c._filename;return c;});
        const data = {_v:1,_date:new Date().toISOString(),accounts:clean,settings:sett,config:cfg};
        const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
        const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`webflow_backup_${new Date().toISOString().slice(0,10)}.json`; a.click();
        showToast(`Экспорт: ${clean.length} аккаунтов`,'success');
    } catch(e){showToast('Ошибка экспорта','error');}
}
async function importAllData(event) {
    const file=event.target.files[0]; if(!file)return;
    try {
        const data=JSON.parse(await file.text());
        if(!data.accounts||!Array.isArray(data.accounts)) return showToast('Неверный формат','error');
        if(!await customConfirm(`Импортировать ${data.accounts.length} аккаунтов?`)){event.target.value='';return;}
        let n=0;
        for(const a of data.accounts){try{await fetch('/api/accounts/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(a)});n++;}catch(e){}}
        if(data.settings) await fetch('/api/settings/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data.settings)});
        if(data.config) await fetch('/api/config/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data.config)});
        await loadAccounts(); await loadSettings();
        showToast(`Импорт: ${n} аккаунтов`,'success');
    } catch(e){showToast('Ошибка файла','error');}
    event.target.value='';
}
