import threading
import json
import os
import glob
import random
import re
import string
import time
from datetime import datetime
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_from_directory
from webflow_mailer import WebflowMailer, _normalize_proxy
import requests as req

app = Flask(__name__)
app.secret_key = os.urandom(24)

# ============================================================================
# AUTO-CREATE DEFAULT DATA FILES ON FIRST RUN
# ============================================================================
_DEFAULT_CONFIG = {
    "site_id": "", "element_id": "", "page_id": "", "site_name": "", "domain": "",
    "session_id": "", "xsrf_token": "", "email_sender_name": "",
    "email_reply_tos": ["no-reply@webflow.com"],
    "template_file": "templates/template.txt",
    "template_main_file": "templates/template_depop.txt",
    "template_inbox_file": "templates/template_inbox.txt",
    "email_subject_main": "Sold! Listing closed, payment received",
    "email_subject_inbox": "Account Notification",
    "dual_mode_delay": 3.5, "batch_size": 5, "batch_delay": 3.5,
    "form_name": "Email Form", "delay_min": 2, "delay_max": 5,
    "order_id_type": "digits", "order_id_length": 8,
    "design_host": "", "form_settings_url": "", "publish_url": "",
    "task_status_url": "", "form_submit_url": "", "origin": "", "referer": "",
    "source": "", "publish_target": "", "redirect_url": "",
    "additional_headers": {"x-content-type-options": "nosniff"},
}
_DEFAULT_FILES: dict[str, object] = {
    "config.json":    _DEFAULT_CONFIG,
    "cookies.json":   [],
    "settings.json":  {"delay_min": 2, "delay_max": 5, "order_id_length": 8, "order_id_type": "digits"},
    "analytics.json": [],
}
for _fname, _default in _DEFAULT_FILES.items():
    if not os.path.exists(_fname):
        with open(_fname, 'w', encoding='utf-8') as _f:
            json.dump(_default, _f, indent=4, ensure_ascii=False)
for _dir in ('accounts', 'logs'):
    os.makedirs(_dir, exist_ok=True)

# ============================================================================
# ДАННЫЕ ДЛЯ РАНДОМИЗАЦИИ
# ============================================================================

FIRST_NAMES = [
    'James', 'John', 'Robert', 'Michael', 'David', 'William', 'Richard', 'Joseph',
    'Thomas', 'Christopher', 'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara',
    'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen', 'Emma', 'Olivia', 'Ava',
    'Isabella', 'Sophia', 'Mia', 'Charlotte', 'Amelia', 'Harper', 'Evelyn',
    'Daniel', 'Matthew', 'Anthony', 'Mark', 'Steven', 'Andrew', 'Paul',
    'Joshua', 'Kenneth', 'Kevin', 'Brian', 'George', 'Timothy', 'Ronald', 'Edward',
    'Jason', 'Jeffrey', 'Ryan', 'Jacob', 'Gary', 'Nicholas', 'Eric', 'Jonathan',
    'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon', 'Benjamin', 'Samuel',
    'Nancy', 'Betty', 'Margaret', 'Sandra', 'Ashley', 'Dorothy', 'Kimberly', 'Emily',
    'Donna', 'Michelle', 'Carol', 'Amanda', 'Melissa', 'Stephanie', 'Rebecca',
    'Sharon', 'Laura', 'Cynthia', 'Amy', 'Angela', 'Anna', 'Brenda', 'Pamela',
    'Nicole', 'Samantha', 'Katherine', 'Christine', 'Rachel', 'Maria', 'Heather',
    'Diane', 'Ruth', 'Julie', 'Olivia', 'Noah', 'Liam', 'Mason', 'Ethan', 'Logan',
    'Alexander', 'Aiden', 'Lucas', 'Henry', 'Sebastian', 'Jack', 'Owen', 'Dylan',
    'Luke', 'Gabriel', 'Zoe', 'Lily', 'Hannah', 'Natalie', 'Grace', 'Aria'
]

LAST_NAMES = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
    'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
    'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
    'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Hill',
    'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell',
    'Mitchell', 'Carter', 'Roberts', 'Phillips', 'Evans', 'Turner', 'Parker', 'Collins'
]

EMAIL_DOMAINS = [
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
    'mail.com', 'protonmail.com', 'aol.com', 'live.com', 'msn.com'
]

ITEM_NAMES = [
    'Vintage Nike Windbreaker', 'Y2K Cargo Pants', 'Ralph Lauren Polo Shirt',
    "Levi's 501 Jeans", 'Carhartt WIP Jacket', 'Adidas Track Pants',
    'Champion Reverse Weave Hoodie', 'Patagonia Fleece Vest',
    'Coach Leather Crossbody', 'Tory Burch Sandals', 'Michael Kors Tote Bag',
    'Lululemon Align Leggings', 'Free People Tunic Top',
    'iPhone 15 Pro Max 256GB', 'Sony WH-1000XM5 Headphones', 'MacBook Air M2',
    'Samsung Galaxy S24 Ultra', 'Apple Watch Series 9', 'AirPods Pro 2nd Gen',
    'Zara Wool Coat', 'Dr. Martens 1460 Boots',
    'The North Face Puffer Jacket', 'New Balance 574 Sneakers',
    'Jordan 1 Retro High OG', 'Yeezy Boost 350 V2', 'Nike Dunk Low Panda',
    'Nike Air Force 1 Low', 'Travis Scott x Nike Collab',
    'Premium Wireless Earbuds', 'Leather Messenger Bag', 'Smart Fitness Watch',
    'Portable Power Bank 20000mAh', 'Bluetooth Speaker JBL',
    'Mechanical Keyboard RGB', 'Canvas Sneakers', 'Stainless Steel Water Bottle'
]

TRACKING_PREFIXES = ['1Z', '9400', '9261', 'TBA', 'JD', 'CJ', '420']

def generate_random_vars(settings=None, redirect_url=''):
    """Генерирует случайные значения переменных для шаблона"""
    if settings is None:
        settings = load_settings()
    
    first = random.choice(FIRST_NAMES)
    last = random.choice(LAST_NAMES)
    
    # Генерируем username в разных стилях
    style = random.choice(['simple', 'with_num', 'with_last', 'dot', 'underscore'])
    if style == 'simple':
        username = first.lower()
    elif style == 'with_num':
        username = first.lower() + str(random.randint(1, 999))
    elif style == 'with_last':
        username = first.lower() + last.lower()
    elif style == 'dot':
        username = first.lower() + '.' + last.lower()
    else:
        username = first.lower() + '_' + last.lower() + str(random.randint(1, 99))
    
    email = username + '@' + random.choice(EMAIL_DOMAINS)
    
    # Order ID
    order_type = settings.get('order_id_type', 'digits')
    order_length = int(settings.get('order_id_length', 8))
    if order_type == 'digits':
        order_id = ''.join(random.choices(string.digits, k=order_length))
    elif order_type == 'letters':
        order_id = ''.join(random.choices(string.ascii_uppercase, k=order_length))
    else:
        order_id = ''.join(random.choices(string.ascii_uppercase + string.digits, k=order_length))
    
    # New extended variables
    now = datetime.now()
    date_str = now.strftime('%b %d, %Y')
    time_str = now.strftime('%H:%M')
    random_price = f"${random.uniform(12.99, 299.99):.2f}"
    tracking = random.choice(TRACKING_PREFIXES) + ''.join(random.choices(string.digits, k=random.randint(12, 18)))
    item_name = random.choice(ITEM_NAMES)
    
    return {
        'email': email,
        'username': username,
        'order_id': order_id,
        'redirect': redirect_url or 'https://example.com/confirm',
        'first_name': first,
        'last_name': last,
        'date': date_str,
        'time': time_str,
        'random_price': random_price,
        'tracking_number': tracking,
        'item_name': item_name
    }

# ============================================================================
# ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
# ============================================================================

progress_data = {
    'status': 'idle',  # idle, running, completed, error, stopped
    'current': 0,
    'total': 0,
    'success': 0,
    'failed': 0,
    'logs': [],
    'start_time': None,
    'end_time': None
}

stop_flag = threading.Event()

template_setting_active = False
template_setting_logs = []

# ============================================================================
# УТИЛИТЫ
# ============================================================================

def load_settings():
    """Загружает настройки"""
    settings_path = "settings.json"
    if not os.path.exists(settings_path):
        return {
            "order_id_type": "digits",
            "order_id_length": 8,
            "delay_min": 2,
            "delay_max": 5
        }
    try:
        with open(settings_path, 'r', encoding='utf-8') as f:
            settings = json.load(f)
            if "order_id_type" not in settings:
                settings["order_id_type"] = "digits"
            if "order_id_length" not in settings:
                settings["order_id_length"] = 8
            return settings
    except Exception:
        return {
            "order_id_type": "digits",
            "order_id_length": 8,
            "delay_min": 2,
            "delay_max": 5
        }

def save_settings(settings):
    """Сохраняет настройки"""
    with open("settings.json", 'w', encoding='utf-8') as f:
        json.dump(settings, f, indent=2)

def load_accounts():
    """Загружает все аккаунты Webflow"""
    accounts_dir = "accounts"
    if not os.path.exists(accounts_dir):
        os.makedirs(accounts_dir, exist_ok=True)
        return []
    
    accounts = []
    for filepath in glob.glob(f"{accounts_dir}/account_*.json"):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                acc = json.load(f)
                acc["_filepath"] = filepath
                acc["_filename"] = os.path.basename(filepath)
                if "app_name" not in acc:
                    acc["app_name"] = "Webflow Project"
                if "template_subject" not in acc:
                    acc["template_subject"] = "Order Confirmation"
                if "template_content" not in acc:
                    acc["template_content"] = ""
                if "proxy" not in acc:
                    acc["proxy"] = ""
                if "redirect_url" not in acc:
                    acc["redirect_url"] = ""
                if "sender_name" not in acc:
                    acc["sender_name"] = ""
                accounts.append(acc)
        except Exception:
            continue
    
    return accounts

def save_account(account):
    """Сохраняет аккаунт"""
    filepath = account.get("_filepath")
    if not filepath:
        accounts_dir = "accounts"
        os.makedirs(accounts_dir, exist_ok=True)
        if "app_name" in account:
            safe_name = account['app_name'].replace(' ', '_').lower()
            safe_name = ''.join(c for c in safe_name if c.isalnum() or c == '_')
            filename = f"account_{safe_name}.json"
        else:
            filename = f"account_{int(time.time())}.json"
        filepath = os.path.join(accounts_dir, filename)
    
    acc_copy = account.copy()
    acc_copy.pop("_filepath", None)
    acc_copy.pop("_filename", None)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(acc_copy, f, indent=2, ensure_ascii=False)

def add_log(message, level='info'):
    """Добавить сообщение в лог рассылки"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    progress_data['logs'].append({
        'message': message,
        'level': level,
        'timestamp': timestamp
    })
    # Write to log file
    try:
        log_dir = "logs"
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, datetime.now().strftime("%Y-%m-%d") + ".log")
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(f"[{timestamp}] [{level.upper()}] {message}\n")
    except Exception:
        pass

def record_analytics(account_name, total, success, failed):
    """Record mailing analytics to analytics.json"""
    try:
        analytics_path = "analytics.json"
        if os.path.exists(analytics_path):
            with open(analytics_path, 'r', encoding='utf-8') as f:
                analytics = json.load(f)
        else:
            analytics = []
        
        analytics.append({
            'date': datetime.now().strftime('%Y-%m-%d'),
            'time': datetime.now().strftime('%H:%M:%S'),
            'account': account_name,
            'total': total,
            'success': success,
            'failed': failed
        })
        
        with open(analytics_path, 'w', encoding='utf-8') as f:
            json.dump(analytics, f, indent=2, ensure_ascii=False)
    except Exception:
        pass

# ============================================================================
# ЛОГИКА МАССОВОЙ УСТАНОВКИ ШАБЛОНОВ
# ============================================================================

def run_bulk_template_set(mode, current_account_filename, subject, content, sender_name=''):
    global template_setting_active, template_setting_logs
    template_setting_active = True
    template_setting_logs = []
    
    accounts = load_accounts()
    targets = []
    
    if mode == 'current':
        acc = next((a for a in accounts if a["_filename"] == current_account_filename), None)
        if acc:
            targets = [acc]
    else:
        targets = accounts

    for acc in targets:
        name = acc.get('app_name', 'Unknown')
        template_setting_logs.append({"email": name, "status": "pending", "message": "Установка..."})
        
        try:
            acc['template_subject'] = subject
            acc['template_content'] = content
            acc['sender_name'] = sender_name
            save_account(acc)
            
            for log in template_setting_logs:
                if log["email"] == name:
                    log["status"] = "success"
                    log["message"] = "Успешно"
        except Exception as e:
            for log in template_setting_logs:
                if log["email"] == name:
                    log["status"] = "error"
                    log["message"] = str(e)
    
    template_setting_active = False

# ============================================================================
# ЛОГИКА РАССЫЛКИ
# ============================================================================

def run_mailing(emails, mode, account_filename):
    """Запуск рассылки через WebflowMailer"""
    global progress_data
    
    try:
        stop_flag.clear()
        progress_data['status'] = 'running'
        progress_data['total'] = len(emails)
        progress_data['current'] = 0
        progress_data['success'] = 0
        progress_data['failed'] = 0
        progress_data['logs'] = []
        progress_data['start_time'] = time.time()
        progress_data['end_time'] = None
        
        accounts = load_accounts()
        acc = next((a for a in accounts if a["_filename"] == account_filename), None)
        
        if not acc:
            add_log("#FORM_UPD Аккаунт не найден в системе", 'error')
            progress_data['status'] = 'error'
            return
        
        # Проверяем что шаблон не пустой
        if not acc.get('template_content', '').strip():
            add_log("TPL_EMPTY Шаблон не задан! Перейдите на вкладку 'Шаблон', выберите шаблон и нажмите 'Сохранить'", 'error')
            progress_data['status'] = 'error'
            return

        add_log(f"Начало рассылки: {len(emails)} получателей | Режим {mode}", 'info')
        
        def update_progress(current, total, success, failed, log_msg):
            if stop_flag.is_set():
                raise InterruptedError("Рассылка остановлена пользователем")
            progress_data['current'] = current
            progress_data['total'] = total
            progress_data['success'] = success
            progress_data['failed'] = failed
            level = 'success' if 'доставлен' in log_msg or 'завершен' in log_msg.lower() else ('error' if 'Ошибка' in log_msg else 'info')
            add_log(log_msg, level)

        base_dir = Path(__file__).parent
        
        template_path = base_dir / "temp_template.txt"
        with open(template_path, "w", encoding="utf-8") as f:
            f.write(acc.get("template_content", ""))

        mailer = WebflowMailer(
            config_path=str(base_dir / 'config.json'),
            cookies_path=str(base_dir / 'cookies.json'),
            override_session_id=acc.get('session_id'),
            override_xsrf_token=acc.get('xsrf_token'),
            proxy=acc.get('proxy') or ''
        )
        
        mailer.config['email_subject_main'] = acc.get('template_subject', 'Order Confirmation')
        mailer.template_main = acc.get('template_content', "")
        mailer.config['redirect_url'] = acc.get('redirect_url', '')
        
        # Имя отправителя из аккаунта (если задано)
        if acc.get('sender_name'):
            mailer.config['email_sender_name'] = acc['sender_name']
        
        # Передаём настройки для генерации order_id
        settings = load_settings()
        mailer.config['order_id_type'] = settings.get('order_id_type', 'digits')
        mailer.config['order_id_length'] = int(settings.get('order_id_length', 8))
        
        mailer.send_mass_emails(emails, mode, progress_callback=update_progress)
        
        progress_data['end_time'] = time.time()
        if stop_flag.is_set():
            progress_data['status'] = 'stopped'
            add_log('STOP_USR Рассылка остановлена пользователем', 'info')
        else:
            progress_data['status'] = 'completed'
            add_log(f'Рассылка завершена — ✅ {progress_data["success"]} | ❌ {progress_data["failed"]}', 'success')
        
        # Обновляем статистику в файле аккаунта
        acc['emails_sent'] = acc.get('emails_sent', 0) + progress_data['success']
        save_account(acc)
        
        # Record analytics
        record_analytics(
            acc.get('app_name', 'Unknown'),
            progress_data['total'],
            progress_data['success'],
            progress_data['failed']
        )
        
    except InterruptedError:
        progress_data['end_time'] = time.time()
        progress_data['status'] = 'stopped'
        add_log('STOP_USR Рассылка остановлена пользователем', 'info')
    except Exception as e:
        progress_data['end_time'] = time.time()
        progress_data['status'] = 'error'
        add_log(f'NET_ERR Критическая ошибка: {str(e)}', 'error')

# ============================================================================
# API ROUTES
# ============================================================================

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/accounts')
def api_accounts():
    return jsonify(load_accounts())

@app.route('/api/accounts/save', methods=['POST'])
def api_save_account():
    data = request.json
    save_account(data)
    # Возвращаем имя файла для синхронизации
    if "app_name" in data and not data.get("_filepath"):
        safe_name = data['app_name'].replace(' ', '_').lower()
        safe_name = ''.join(c for c in safe_name if c.isalnum() or c == '_')
        filename = f"account_{safe_name}.json"
    else:
        filename = data.get("_filename", "")
    return jsonify({"success": True, "filename": filename})

@app.route('/api/accounts/update-field', methods=['POST'])
def api_update_account_field():
    """Обновить одно поле в аккаунте без перезаписи всего файла"""
    data = request.json
    filename = data.get('filename')
    field = data.get('field')
    value = data.get('value')
    
    if not filename or not field:
        return jsonify({"success": False, "error": "Missing filename or field"})
    
    accounts = load_accounts()
    acc = next((a for a in accounts if a["_filename"] == filename), None)
    if acc:
        acc[field] = value
        save_account(acc)
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "Account not found"})

@app.route('/api/accounts/sync-config', methods=['POST'])
def api_sync_account_to_config():
    """Синхронизация токенов аккаунта → config.json"""
    data = request.json
    filename = data.get('filename')
    if not filename:
        return jsonify({"success": False, "error": "No filename"})
    
    accounts = load_accounts()
    acc = next((a for a in accounts if a["_filename"] == filename), None)
    if not acc:
        return jsonify({"success": False, "error": "Account not found"})
    
    try:
        if os.path.exists('config.json'):
            with open('config.json', 'r', encoding='utf-8') as f:
                config = json.load(f)
        else:
            config = {}
        
        changed = False
        if acc.get('session_id'):
            config['session_id'] = acc['session_id']
            changed = True
        if acc.get('xsrf_token'):
            config['xsrf_token'] = acc['xsrf_token']
            changed = True
        
        if changed:
            with open('config.json', 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=4, ensure_ascii=False)
        
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/accounts/get')
def api_get_account():
    """Получить данные одного аккаунта"""
    filename = request.args.get('filename')
    if not filename:
        return jsonify({"success": False, "error": "No filename"})
    accounts = load_accounts()
    acc = next((a for a in accounts if a["_filename"] == filename), None)
    if acc:
        return jsonify({"success": True, "account": acc})
    return jsonify({"success": False, "error": "Not found"})

@app.route('/api/accounts/delete', methods=['POST'])
def api_delete_account():
    data = request.json
    filename = data.get('filename')
    if not filename:
        return jsonify({"success": False, "error": "No filename"})
    
    filepath = os.path.join("accounts", filename)
    if os.path.exists(filepath):
        os.remove(filepath)
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "File not found"})

@app.route('/api/accounts/delete-all', methods=['POST'])
def api_delete_all_accounts():
    for f in glob.glob("accounts/account_*.json"):
        os.remove(f)
    return jsonify({"success": True})

@app.route('/api/accounts/rename', methods=['POST'])
def api_rename_app():
    data = request.json
    filename = data.get('filename')
    new_name = data.get('name')
    
    accounts = load_accounts()
    acc = next((a for a in accounts if a["_filename"] == filename), None)
    if acc:
        acc['app_name'] = new_name
        save_account(acc)
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "Account not found"})

@app.route('/api/accounts/update-proxy', methods=['POST'])
def api_update_proxy():
    data = request.json
    filename = data.get('filename')
    proxy = data.get('proxy')
    
    accounts = load_accounts()
    acc = next((a for a in accounts if a["_filename"] == filename), None)
    if acc:
        acc['proxy'] = proxy
        save_account(acc)
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "Account not found"})


@app.route('/api/proxy/test', methods=['POST'])
def api_proxy_test():
    """Проверка прокси: запрос через прокси к api.ipify.org, возвращает внешний IP или ошибку."""
    data = request.json or {}
    proxy_str = (data.get('proxy') or '').strip()
    if not proxy_str:
        return jsonify({"ok": False, "error": "Прокси не указан"})
    proxies = _normalize_proxy(proxy_str)
    if not proxies:
        return jsonify({"ok": False, "error": "Неверный формат прокси. Используйте host:port:user:pass или http://user:pass@host:port"})
    try:
        r = req.get('https://api.ipify.org?format=json', proxies=proxies, timeout=15)
        r.raise_for_status()
        ip = r.json().get('ip', r.text)
        return jsonify({"ok": True, "ip": ip})
    except req.exceptions.ProxyError as e:
        return jsonify({"ok": False, "error": f"Ошибка прокси: {str(e)[:120]}"})
    except req.exceptions.Timeout:
        return jsonify({"ok": False, "error": "Таймаут — прокси не ответил за 15 сек"})
    except req.exceptions.RequestException as e:
        err = str(e)
        if "SOCKS" in err or "socks" in err.lower():
            return jsonify({"ok": False, "error": "Нужна поддержка SOCKS. Выполни: pip install requests[socks]"})
        return jsonify({"ok": False, "error": err[:120]})
    except Exception as e:
        err = str(e)
        if "SOCKS" in err or "socks" in err.lower():
            return jsonify({"ok": False, "error": "Нужна поддержка SOCKS. Выполни: pip install requests[socks]"})
        return jsonify({"ok": False, "error": err[:120]})

@app.route('/api/template/load')
def api_load_template():
    acc_file = request.args.get('account')
    if not acc_file:
        return jsonify({"success": False, "error": "No account"})
    
    accounts = load_accounts()
    acc = next((a for a in accounts if a["_filename"] == acc_file), None)
    if acc:
        return jsonify({
            "success": True,
            "subject": acc.get("template_subject", ""),
            "content": acc.get("template_content", ""),
            "sender_name": acc.get("sender_name", "")
        })
    return jsonify({"success": False, "error": "Account not found"})

@app.route('/api/template/save', methods=['POST'])
def api_save_template():
    data = request.json
    acc_file = data.get('account')
    subject = data.get('subject')
    content = data.get('content')
    sender_name = data.get('sender_name', '')
    
    accounts = load_accounts()
    acc = next((a for a in accounts if a["_filename"] == acc_file), None)
    if acc:
        acc['template_subject'] = subject
        acc['template_content'] = content
        acc['sender_name'] = sender_name
        save_account(acc)
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "Account not found"})

@app.route('/api/template/set', methods=['POST'])
def api_set_template():
    data = request.json
    mode = data.get('mode')
    current_account = data.get('current_account')
    subject = data.get('subject')
    content = data.get('content')
    sender_name = data.get('sender_name', '')
    
    thread = threading.Thread(target=run_bulk_template_set, args=(mode, current_account, subject, content, sender_name))
    thread.daemon = True
    thread.start()
    return jsonify({"success": True})

@app.route('/api/template/set-logs')
def api_template_set_logs():
    return jsonify({"active": template_setting_active, "logs": template_setting_logs})

CUSTOM_TEMPLATES_PATH = "custom_templates.json"

def load_custom_templates() -> list[dict]:
    """Загружает пользовательские шаблоны из JSON."""
    if not os.path.exists(CUSTOM_TEMPLATES_PATH):
        return []
    try:
        with open(CUSTOM_TEMPLATES_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []

def save_custom_templates(templates: list[dict]) -> None:
    """Сохраняет пользовательские шаблоны в JSON."""
    with open(CUSTOM_TEMPLATES_PATH, 'w', encoding='utf-8') as f:
        json.dump(templates, f, indent=2, ensure_ascii=False)

@app.route('/api/templates/list')
def api_list_templates():
    """Список встроенных + пользовательских шаблонов"""
    templates_dir = "templates"
    templates = []
    brand_colors = {
        'depop': '#ff2300', 'poshmark': '#7e1b56', 'ebay': '#0654ba',
        'vinted': '#09847a', 'mercari': '#ea352d', 'stockx': '#1a1a1a',
        'inbox': '#4a90e2'
    }
    brand_names = {
        'depop': 'Depop', 'poshmark': 'Poshmark', 'ebay': 'eBay',
        'vinted': 'Vinted', 'mercari': 'Mercari', 'stockx': 'StockX',
        'inbox': 'Inbox Warming'
    }
    brand_sender_names = {
        'depop': 'Depop', 'poshmark': 'Poshmark', 'ebay': 'eBay',
        'vinted': 'Vinted', 'mercari': 'Mercari', 'stockx': 'StockX',
        'inbox': 'Support'
    }
    for filepath in sorted(glob.glob(f"{templates_dir}/template_*.txt")):
        fname = os.path.basename(filepath)
        key = fname.replace('template_', '').replace('.txt', '')
        templates.append({
            'filename': fname,
            'key': key,
            'name': brand_names.get(key, key.title()),
            'color': brand_colors.get(key, '#3b82f6'),
            'sender_name': brand_sender_names.get(key, key.title()),
            'custom': False
        })

    for ct in load_custom_templates():
        templates.append({
            'filename': f"__custom__{ct['id']}",
            'key': ct['id'],
            'name': ct['name'],
            'color': ct.get('color', '#3b82f6'),
            'icon': ct.get('icon', 'mail'),
            'subject': ct.get('subject', ''),
            'sender_name': ct.get('sender_name', ct['name']),
            'custom': True
        })

    return jsonify(templates)

@app.route('/api/templates/custom/save', methods=['POST'])
def api_save_custom_template():
    """Создать или обновить пользовательский шаблон."""
    data = request.json or {}
    name = (data.get('name') or '').strip()
    content = data.get('content', '')
    color = data.get('color', '#3b82f6')
    icon = data.get('icon', 'mail')
    sender_name = (data.get('sender_name') or '').strip()
    subject = (data.get('subject') or '').strip()
    template_id = data.get('id', '')

    missing = [f for f, v in [('Название', name), ('Отправитель', sender_name),
                                ('Тема письма', subject), ('Тело письма', content.strip())] if not v]
    if missing:
        return jsonify({"success": False, "error": f"Заполните: {', '.join(missing)}"}), 400

    templates = load_custom_templates()

    if template_id:
        found = False
        for t in templates:
            if t['id'] == template_id:
                t['name'] = name
                t['content'] = content
                t['color'] = color
                t['icon'] = icon
                t['sender_name'] = sender_name
                t['subject'] = subject
                found = True
                break
        if not found:
            return jsonify({"success": False, "error": "Шаблон не найден"}), 404
    else:
        template_id = f"custom_{int(time.time())}_{random.randint(100,999)}"
        templates.append({
            'id': template_id,
            'name': name,
            'content': content,
            'color': color,
            'icon': icon,
            'sender_name': sender_name,
            'subject': subject
        })

    save_custom_templates(templates)
    return jsonify({"success": True, "id": template_id})

@app.route('/api/templates/custom/delete', methods=['POST'])
def api_delete_custom_template():
    """Удалить пользовательский шаблон."""
    data = request.json or {}
    template_id = data.get('id', '')
    if not template_id:
        return jsonify({"success": False, "error": "ID не указан"}), 400

    templates = load_custom_templates()
    before = len(templates)
    templates = [t for t in templates if t['id'] != template_id]
    if len(templates) == before:
        return jsonify({"success": False, "error": "Шаблон не найден"}), 404

    save_custom_templates(templates)
    return jsonify({"success": True})

@app.route('/api/templates/custom/get')
def api_get_custom_template():
    """Получить содержимое пользовательского шаблона."""
    template_id = request.args.get('id', '')
    if not template_id:
        return jsonify({"success": False, "error": "ID не указан"})

    for t in load_custom_templates():
        if t['id'] == template_id:
            return jsonify({"success": True, "content": t['content'], "name": t['name'],
                            "color": t['color'], "icon": t.get('icon', 'mail'),
                            "sender_name": t.get('sender_name', ''),
                            "subject": t.get('subject', '')})
    return jsonify({"success": False, "error": "Шаблон не найден"})

@app.route('/api/templates/load-file')
def api_load_template_file():
    """Загрузить содержимое файла шаблона (встроенного или пользовательского)."""
    filename = request.args.get('filename', '')

    if filename.startswith('__custom__'):
        template_id = filename.replace('__custom__', '')
        for t in load_custom_templates():
            if t['id'] == template_id:
                return jsonify({"success": True, "content": t['content'],
                                "subject": t.get('subject', ''),
                                "sender_name": t.get('sender_name', '')})
        return jsonify({"success": False, "error": "Custom template not found"})

    if not filename:
        return jsonify({"success": False, "error": "No filename"})
    filepath = os.path.join("templates", filename)
    if not os.path.exists(filepath):
        return jsonify({"success": False, "error": "File not found"})
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({"success": True, "content": content})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/redirect/set', methods=['POST'])
def api_set_redirect():
    """Установить redirect URL для всех аккаунтов"""
    data = request.json
    url = data.get('url', '')
    
    accounts = load_accounts()
    for acc in accounts:
        acc['redirect_url'] = url
        save_account(acc)
    
    return jsonify({"success": True, "updated": len(accounts)})

@app.route('/api/settings/load')
def api_load_settings():
    return jsonify(load_settings())

@app.route('/api/settings/save', methods=['POST'])
def api_save_settings():
    save_settings(request.json)
    return jsonify({"success": True})

@app.route('/api/config/load')
def api_load_config():
    try:
        with open('config.json', 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))
    except Exception:
        return jsonify({})

@app.route('/api/config/save', methods=['POST'])
def api_save_config():
    try:
        data = request.json
        
        # Если передана designer_session, обновляем cookies.json отдельно
        designer_session = data.pop('designer_session', None)
        if designer_session and designer_session.strip():
            update_designer_cookie(designer_session.strip())
        
        if os.path.exists('config.json'):
            with open('config.json', 'r', encoding='utf-8') as f:
                current_config = json.load(f)
        else:
            current_config = {}
        
        current_config.update(data)
        
        with open('config.json', 'w', encoding='utf-8') as f:
            json.dump(current_config, f, indent=4, ensure_ascii=False)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

def update_designer_cookie(value):
    """Обновляет wfdesignersession в cookies.json"""
    cookies_path = "cookies.json"
    try:
        if os.path.exists(cookies_path):
            with open(cookies_path, 'r', encoding='utf-8') as f:
                cookies = json.load(f)
        else:
            cookies = []
        
        found = False
        for c in cookies:
            if c.get('name') == 'wfdesignersession':
                c['value'] = value
                found = True
                break
        
        if not found:
            config_domain = ""
            try:
                with open('config.json', 'r', encoding='utf-8') as cf:
                    config_domain = json.load(cf).get('design_host', '')
            except Exception:
                pass
            cookie_domain = f"{config_domain}.design.webflow.com" if config_domain else "design.webflow.com"
            cookies.append({
                "domain": cookie_domain,
                "expirationDate": 1900000000,
                "hostOnly": True,
                "httpOnly": True,
                "name": "wfdesignersession",
                "path": "/",
                "sameSite": "no_restriction",
                "secure": True,
                "session": False,
                "storeId": None,
                "value": value
            })
        
        with open(cookies_path, 'w', encoding='utf-8') as f:
            json.dump(cookies, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Ошибка обновления cookie: {e}")

@app.route('/api/config/parse-url', methods=['POST'])
def api_parse_url():
    """Парсит Webflow URL → загружает HTML публичной страницы → извлекает
    site_id, page_id, element_id и все производные URL без авторизации."""
    import re
    from urllib.parse import urlparse

    data = request.json or {}
    url = (data.get('url') or '').strip()

    if not url:
        return jsonify({'success': False, 'error': 'URL не указан'})

    # ── Фаза 1: парсим URL ──────────────────────────────────────────────────
    design_host = None
    try:
        parsed = urlparse(url if '://' in url else 'https://' + url)
        hostname = (parsed.hostname or '').lower()
        if hostname.endswith('.webflow.io'):
            design_host = hostname[:-len('.webflow.io')]
        else:
            m = re.search(r'webflow\.com/design/([^/?#\s]+)', url)
            if m:
                design_host = m.group(1)
    except Exception:
        pass

    if not design_host:
        return jsonify({'success': False,
                        'error': 'Не удалось распознать сайт. Используйте формат: https://your-site-xxxxx.webflow.io'})

    # Пытаемся выделить site_name: {name}-{hex_hash}
    m = re.match(r'^(.*)-([0-9a-f]{14,})$', design_host)
    site_name = m.group(1) if m else design_host

    cfg: dict = {
        'site_name':        site_name,
        'domain':           f'{design_host}.webflow.io',
        'design_host':      design_host,
        'origin':           f'https://{design_host}.design.webflow.com',
        'referer':          f'https://{design_host}.design.webflow.com/',
        'source':           f'https://{design_host}.webflow.io/',
        'publish_target':   f'{design_host}.webflow.io',
        'redirect_url':     f'https://{design_host}.webflow.io/',
        'publish_url':      f'https://{design_host}.design.webflow.com/api/sites/{design_host}/queue-publish',
        'task_status_url':  f'https://{design_host}.design.webflow.com/api/site/{design_host}/tasks/{{task_id}}',
    }

    fetched: list[str] = []
    warnings: list[str] = []

    # ── Фаза 2: парсим HTML опубликованного сайта (без авторизации) ────────
    pub_url = f"https://{cfg['domain']}/"
    try:
        r = req.get(pub_url, timeout=15, headers={
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                          'AppleWebKit/537.36 (KHTML, like Gecko) '
                          'Chrome/144.0.0.0 Safari/537.36',
        })
        if r.status_code == 200:
            html = r.text

            # data-wf-site → site_id
            m = re.search(r'data-wf-site=["\']([a-f0-9]{20,})["\']', html)
            if m:
                site_id = m.group(1)
                cfg['site_id'] = site_id
                cfg['form_submit_url'] = f'https://webflow.com/api/v1/form/{site_id}'
                fetched.append('site_id')

            # data-wf-page → page_id
            m = re.search(r'data-wf-page=["\']([a-f0-9]{20,})["\']', html)
            if m:
                cfg['page_id'] = m.group(1)
                fetched.append('page_id')

            # <form ... data-wf-element-id="..."> → element_id
            m = re.search(
                r'<form[^>]+data-wf-element-id=["\']([a-f0-9-]{20,36})["\']',
                html, re.I,
            )
            if m:
                el_id = m.group(1)
                cfg['element_id'] = el_id
                cfg['form_settings_url'] = (
                    f'https://{design_host}.design.webflow.com'
                    f'/api/v1/site/{design_host}/form/{el_id}/settings'
                )
                fetched.append('element_id')
            else:
                has_form = '<form' in html.lower()
                if has_form:
                    warnings.append('Форма найдена, но без data-wf-element-id — опубликуйте сайт в Webflow')
                else:
                    warnings.append('Форма не найдена на странице — добавьте форму в Webflow Designer')
        else:
            warnings.append(f'Не удалось загрузить {pub_url} → HTTP {r.status_code}')
    except req.exceptions.Timeout:
        warnings.append(f'Таймаут при загрузке {pub_url}')
    except req.exceptions.RequestException as e:
        warnings.append(f'Ошибка загрузки: {str(e)[:100]}')

    msg_parts = [f'Хост: {design_host}']
    if fetched:
        label_map = {'site_id': 'Site ID', 'page_id': 'Page ID', 'element_id': 'Element ID'}
        msg_parts.append('Получено: ' + ', '.join(label_map.get(f, f) for f in fetched))
    else:
        msg_parts.append('Не удалось получить ID — убедитесь что сайт опубликован')
    if warnings:
        msg_parts.append('; '.join(warnings))

    return jsonify({
        'success': True,
        'config':  cfg,
        'fetched': fetched,
        'warnings': warnings,
        'message': ' · '.join(msg_parts),
    })


@app.route('/api/random-vars')
def api_random_vars():
    """Генерация случайных значений переменных для шаблона"""
    acc_file = request.args.get('account')
    redirect_url = ''
    
    if acc_file:
        accounts = load_accounts()
        acc = next((a for a in accounts if a["_filename"] == acc_file), None)
        if acc and acc.get('redirect_url'):
            redirect_url = acc['redirect_url']
    
    if not redirect_url:
        try:
            with open('config.json', 'r', encoding='utf-8') as f:
                cfg = json.load(f)
            redirect_url = cfg.get('redirect_url', '')
        except Exception:
            pass
    
    result = generate_random_vars(redirect_url=redirect_url)
    return jsonify(result)

@app.route('/api/send', methods=['POST'])
def api_send_emails():
    data = request.json
    emails_text = data.get('emails', '')
    mode = int(data.get('mode', 1))
    account_filename = data.get('account')
    
    emails = [e.strip() for e in emails_text.split('\n') if e.strip() and '@' in e.strip()]
    if not emails:
        return jsonify({'error': 'Список email пуст'}), 400
    if not account_filename:
        return jsonify({'error': 'Аккаунт не выбран'}), 400
    
    thread = threading.Thread(target=run_mailing, args=(emails, mode, account_filename))
    thread.daemon = True
    thread.start()
    
    return jsonify({'success': True, 'total': len(emails)})

@app.route('/api/stop', methods=['POST'])
def api_stop_sending():
    """Остановить текущую рассылку"""
    stop_flag.set()
    return jsonify({"success": True})

@app.route('/api/status')
def get_status():
    data = dict(progress_data)
    # Compute elapsed seconds
    if data['start_time']:
        if data['end_time']:
            data['elapsed'] = round(data['end_time'] - data['start_time'], 1)
        else:
            data['elapsed'] = round(time.time() - data['start_time'], 1)
    else:
        data['elapsed'] = 0
    return jsonify(data)

@app.route('/api/analytics/data')
def api_analytics_data():
    """Return analytics data"""
    try:
        if os.path.exists('analytics.json'):
            with open('analytics.json', 'r', encoding='utf-8') as f:
                return jsonify(json.load(f))
        return jsonify([])
    except Exception:
        return jsonify([])

@app.route('/api/logs/list')
def api_logs_list():
    """List available log files"""
    log_dir = "logs"
    if not os.path.exists(log_dir):
        return jsonify([])
    files = sorted(glob.glob(f"{log_dir}/*.log"), reverse=True)
    result = [os.path.basename(f).replace('.log', '') for f in files]
    return jsonify(result)

@app.route('/api/logs/view')
def api_logs_view():
    """View log file contents"""
    date = request.args.get('date')
    if not date:
        return jsonify({"success": False, "error": "No date"})
    log_file = os.path.join("logs", f"{date}.log")
    if not os.path.exists(log_file):
        return jsonify({"success": False, "error": "Log not found"})
    try:
        with open(log_file, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({"success": True, "content": content})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

if __name__ == '__main__':
    print('WebFlow Mass Email Sender Pro')
    print('http://localhost:5000')
    os.makedirs("accounts", exist_ok=True)
    os.makedirs("logs", exist_ok=True)
    app.run(debug=True, host='0.0.0.0', port=5000)
