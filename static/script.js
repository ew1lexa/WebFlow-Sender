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

// ============================================================================
// TOAST
// ============================================================================
function showToast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    const colors = { success: '#30d158', error: '#ff453a', info: '#3b82f6' };
    const icons = { success: '✓', error: '✕', info: 'i' };
    t.style.cssText = `
        background:rgba(28,28,30,0.95); backdrop-filter:blur(20px);
        border:1px solid rgba(255,255,255,0.08); border-left:3px solid ${colors[type] || colors.info};
        color:#f5f5f7; padding:14px 20px; border-radius:12px;
        box-shadow:0 8px 32px rgba(0,0,0,0.4);
        font-size:13px; font-weight:500; max-width:360px;
        display:flex; align-items:center; gap:10px;
        animation:toastIn .3s cubic-bezier(.2,1,.3,1);
    `;
    t.innerHTML = `<span style="width:20px;height:20px;border-radius:50%;background:${colors[type]};color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${icons[type]}</span><span>${msg}</span>`;
    c.appendChild(t);
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
});

// ============================================================================
// NAVIGATION
// ============================================================================
function setupNav() {
    const saved = localStorage.getItem('currentPage') || 'accounts';
    switchPage(saved);
    document.querySelectorAll('.nav-item').forEach(i => i.addEventListener('click', () => switchPage(i.dataset.page)));
}
function switchPage(page) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const nav = document.querySelector(`.nav-item[data-page="${page}"]`);
    const pg = document.getElementById(`page-${page}`);
    if (nav) nav.classList.add('active');
    if (pg) pg.classList.add('active');
    localStorage.setItem('currentPage', page);
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
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
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
        if (d.ok) { resEl.style.background = 'rgba(48,209,88,0.1)'; resEl.style.color = 'var(--success)'; resEl.textContent = 'Прокси работает. Внешний IP: ' + d.ip; }
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
async function loadTemplatePicker() {
    try {
        const r = await fetch('/api/templates/list');
        const templates = await r.json();
        const grid = document.getElementById('template-picker');
        if (!templates.length) { grid.innerHTML = '<div class="text-dim" style="grid-column:1/-1;text-align:center;padding:20px;">Нет шаблонов</div>'; return; }
        // Сохраняем sender_name для каждого шаблона
        window._templateSenderNames = {};
        templates.forEach(t => { window._templateSenderNames[t.filename] = t.sender_name || t.name; });
        grid.innerHTML = templates.map(t => `
            <div class="tpl-card" onclick="applyTemplate('${t.filename}','${esc(t.name)}')">
                <div class="tpl-dot" style="background:${t.color};"></div>
                <div class="tpl-name">${t.name}</div>
            </div>
        `).join('');
    } catch(e) { console.error(e); }
}

async function applyTemplate(filename, name) {
    try {
        const r = await fetch(`/api/templates/load-file?filename=${filename}`);
        const data = await r.json();
        if (data.success) {
            document.getElementById('template-content').value = data.content;
            // Автоматически подставляем имя отправителя из бренда
            const senderName = (window._templateSenderNames && window._templateSenderNames[filename]) || name;
            document.getElementById('template-sender-name').value = senderName;
            
            // Автосохранение в текущий аккаунт
            if (currentAccount) {
                const subject = document.getElementById('template-subject').value;
                await fetch('/api/template/save', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({account: currentAccount, subject, content: data.content, sender_name: senderName})
                });
                // Обновляем in-memory аккаунт чтобы другие функции не затёрли шаблон
                const acc = accounts.find(a => a._filename === currentAccount);
                if (acc) {
                    acc.template_content = data.content;
                    acc.template_subject = subject;
                    acc.sender_name = senderName;
                }
                showToast(`Шаблон "${name}" сохранён в аккаунт · Отправитель: ${senderName}`, 'success');
            } else {
                showToast(`Шаблон "${name}" загружен — выберите аккаунт и сохраните`, 'info');
            }
        }
    } catch(e) { showToast('Ошибка загрузки','error'); }
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
    const frame = document.getElementById('preview-frame');
    frame.src = URL.createObjectURL(new Blob([content],{type:'text/html'}));
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
            for (const [k,id] of Object.entries(map)) { const el=document.getElementById(id); if(el&&cfg[k]!=null) el.value=cfg[k]; }
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
function selectMode(btn) { document.querySelectorAll('.mode-opt').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); selectedMode=parseInt(btn.dataset.mode); document.getElementById('send-mode').value=selectedMode; }
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
        dot.style.background = '#3b82f6';
        dot.classList.add('pulse');
        text.textContent = `Отправка ${current}/${total}...`;
        text.style.color = '#60a5fa';
    } else if (status === 'completed') {
        dot.style.background = '#30d158';
        text.textContent = 'Завершено';
        text.style.color = '#30d158';
    } else if (status === 'error') {
        dot.style.background = '#ff453a';
        text.textContent = 'Ошибка';
        text.style.color = '#ff453a';
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
    statusInterval = setInterval(async()=>{
        try{
            const r=await fetch('/api/status'); const d=await r.json();
            const pct=d.total>0?Math.round(d.current/d.total*100):0;
            document.getElementById('progress-percent').textContent=pct+'%';
            document.getElementById('progress-fill').style.width=pct+'%';
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
            if(d.logs&&d.logs.length){
                // Проверяем, скроллил ли пользователь вверх (не авто-скроллить если читает старые логи)
                const wasAtBottom = lc.scrollHeight - lc.scrollTop - lc.clientHeight < 60;
                lc.innerHTML=d.logs.slice(-100).map(l=>{
                    const clr=l.level==='error'?'var(--danger)':l.level==='success'?'var(--success)':'var(--text-secondary)';
                    let msg = esc(l.message).replace(/(#[A-Z_0-9]+)/g, '<span style="background:rgba(37,99,235,0.15);color:#60a5fa;padding:1px 5px;border-radius:4px;font-size:10px;font-weight:700;">$1</span>');
                    return `<div style="margin-bottom:6px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.03);"><div style="display:flex;justify-content:space-between;font-size:10px;opacity:0.4;margin-bottom:2px;"><span>${l.timestamp}</span></div><div style="color:${clr};font-size:11px;">${msg}</div></div>`;
                }).join('');
                // Автоскролл вниз к новым логам (если пользователь не скроллил вверх)
                if (wasAtBottom) lc.scrollTop = lc.scrollHeight;
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
    },1500);
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
    await randomizeVars();
    previewTemplateWithVars();
}

// ============================================================================
// VISUAL EDITOR (Code / Preview toggle)
// ============================================================================
let templateEditorDebounce = null;
function toggleTemplateEditor(mode) {
    const textarea = document.getElementById('template-content');
    const preview = document.getElementById('template-live-preview');
    document.querySelectorAll('.template-editor-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
    if (mode === 'code') {
        textarea.style.display = '';
        preview.style.display = 'none';
        if (templateEditorDebounce) { clearInterval(templateEditorDebounce); templateEditorDebounce = null; }
    } else {
        textarea.style.display = 'none';
        preview.style.display = '';
        updateLivePreview();
        // Start debounced updates
        if (templateEditorDebounce) clearInterval(templateEditorDebounce);
        templateEditorDebounce = setInterval(updateLivePreview, 600);
    }
}
function updateLivePreview() {
    const content = document.getElementById('template-content').value;
    if (!content) return;
    let html = content;
    const vars = getTemplateVars();
    for (const [k, v] of Object.entries(vars)) { html = html.split(k).join(v); }
    html = processSpintax(html);
    const frame = document.getElementById('template-live-preview');
    const blob = new Blob([html], {type: 'text/html'});
    const url = URL.createObjectURL(blob);
    frame.src = url;
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

    document.getElementById('analytics-total').textContent = totalSent;
    document.getElementById('analytics-success').textContent = totalSuccess;
    document.getElementById('analytics-failed').textContent = totalFailed;
    document.getElementById('analytics-rate').textContent = rate + '%';

    // Chart: last 14 days
    renderChart(data);

    // Top accounts
    const accMap = {};
    data.forEach(r => { accMap[r.account] = (accMap[r.account] || 0) + r.total; });
    const topAccounts = Object.entries(accMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    document.getElementById('analytics-top-accounts').innerHTML = topAccounts.map((a, i) =>
        `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="font-weight:600;"><span style="color:var(--text-tertiary); margin-right:8px;">${i+1}.</span>${esc(a[0])}</span>
            <span style="color:var(--primary); font-weight:700;">${a[1]}</span>
        </div>`
    ).join('') || 'Нет данных';

    // Recent mailings
    const recent = data.slice(-5).reverse();
    document.getElementById('analytics-recent').innerHTML = recent.map(r =>
        `<div style="padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.04);">
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
                else if (line.includes('[INFO]')) color = '#60a5fa';
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
        btn.style.borderColor = 'rgba(48,209,88,0.3)';
        btn.style.color = '#30d158';
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
    // Escape - close modals
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
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
