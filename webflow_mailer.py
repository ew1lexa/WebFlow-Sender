#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WebFlow Mass Email Sender
Скрипт для массовой рассылки писем через WebFlow API
"""

import json
import time
import re
import requests
import random
import string
import hashlib
from typing import List, Dict, Optional
from pathlib import Path


def _normalize_proxy(proxy: Optional[str]) -> Optional[dict]:
    """Преобразует строку прокси в формат для requests.
    Поддержка: host:port:user:pass (по умолчанию socks5h), http://..., socks5://...
    Формат host:port:user:pass чаще всего у SOCKS5-прокси — иначе будет BadStatusLine.
    """
    if not proxy or not proxy.strip():
        return None
    p = proxy.strip()
    if p.startswith(('http://', 'https://', 'socks4://', 'socks5://', 'socks5h://')):
        url = p
    else:
        # host:port:user:pass или host:port — по умолчанию SOCKS5 (часто так отдают провайдеры)
        parts = p.split(':')
        if len(parts) == 4:
            host, port, user, password = parts
            url = f"socks5h://{user}:{password}@{host}:{port}"
        elif len(parts) == 2:
            url = f"socks5h://{parts[0]}:{parts[1]}"
        else:
            return None
    return {'http': url, 'https': url}


def generate_random_name(min_length: int = 5, max_length: int = 12) -> str:
    """Генерация случайного имени из букв"""
    length = random.randint(min_length, max_length)
    name = random.choice(string.ascii_uppercase)
    name += ''.join(random.choices(string.ascii_lowercase, k=length-1))
    return name


def generate_random_email() -> str:
    """Генерация случайного email адреса"""
    username_length = random.randint(5, 15)
    username = ''.join(random.choices(string.ascii_lowercase + string.digits, k=username_length))
    domains = [
        'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
        'icloud.com', 'mail.com', 'protonmail.com', 'aol.com'
    ]
    domain = random.choice(domains)
    return f"{username}@{domain}"


# ============================================================================
# SPINTAX + УНИКАЛИЗАЦИЯ ШАБЛОНОВ
# ============================================================================

def process_spintax(text: str) -> str:
    """
    Обрабатывает spintax в тексте.
    Синтаксис: [вариант1|вариант2|вариант3]
    Для каждого вхождения случайно выбирается один вариант.
    Поддерживает вложенный spintax: [Привет [друг|товарищ]|Здравствуйте]
    Пропускает MSO-условия: <!--[if mso]> и <![endif]-->
    """
    # Защищаем MSO-условия от обработки
    mso_placeholders = {}
    mso_pattern = re.compile(r'<!--\[if[^\]]*\]>.*?<!\[endif\]-->', re.DOTALL)
    counter = [0]
    
    def protect_mso(match):
        key = f'__MSO_PLACEHOLDER_{counter[0]}__'
        mso_placeholders[key] = match.group(0)
        counter[0] += 1
        return key
    
    text = mso_pattern.sub(protect_mso, text)
    
    # Обрабатываем spintax — только блоки содержащие |
    def replace_spintax(match):
        inner = match.group(1)
        if '|' not in inner:
            return match.group(0)  # Не spintax, оставляем как есть
        options = inner.split('|')
        return random.choice(options).strip()
    
    pattern = re.compile(r'\[([^\[\]]+)\]')
    max_iterations = 20  # На случай вложенного spintax
    for _ in range(max_iterations):
        new_text = pattern.sub(replace_spintax, text)
        if new_text == text:
            break
        text = new_text
    
    # Восстанавливаем MSO-условия
    for key, value in mso_placeholders.items():
        text = text.replace(key, value)
    
    return text


def uniquify_html(html: str) -> str:
    """
    Делает HTML-код уникальным для каждого батча, не меняя визуальное отображение.
    
    Методы:
    1. Рандомные HTML-комментарии между строками (не внутри тегов)
    2. Рандомный атрибут data-id на table элементах
    3. Невидимый блок с рандомным контентом после <body>
    
    ВАЖНО: НЕ трогаем padding/margin/стили — это ломает вёрстку email-шаблонов.
    ВАЖНО: НЕ вставляем span внутрь таблиц — это ломает раскладку в почтовых клиентах.
    """
    uid = hashlib.md5(str(random.random()).encode()).hexdigest()[:12]
    
    # 1. Вставляем рандомные HTML-комментарии между тегами (безопасно)
    comment_words = [
        'layout', 'block', 'section', 'content', 'wrapper', 'module',
        'header', 'body', 'footer', 'main', 'container', 'grid',
        'row', 'cell', 'panel', 'frame', 'zone', 'area', 'region'
    ]
    num_comments = random.randint(2, 4)
    for _ in range(num_comments):
        word1 = random.choice(comment_words)
        word2 = random.choice(comment_words)
        rand_num = random.randint(100, 9999)
        comment = f'<!-- {word1}-{word2}-{rand_num} -->'
        
        # Вставляем между </tr> тегами (безопасное место, не ломает layout)
        close_tags = list(re.finditer(r'</tr>', html))
        if close_tags:
            pos = random.choice(close_tags)
            insert_at = pos.end()
            html = html[:insert_at] + '\n' + comment + html[insert_at:]
    
    # 2. Рандомный data-атрибут на первом table
    html = html.replace(
        'role="presentation" border="0"',
        f'role="presentation" data-mid="{uid}" border="0"',
        1
    )
    
    # 3. Добавляем невидимый блок с рандомным контентом после <body>
    invisible_words = ['sale', 'order', 'confirmed', 'shipped', 'purchased', 'listing', 'payment', 'delivered']
    random.shuffle(invisible_words)
    invisible_text = ' '.join(invisible_words[:random.randint(2, 4)])
    invisible_block = f'<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:0;color:#f4f0f0;line-height:0;">{invisible_text} {uid}</div>'
    
    # Вставляем после первого <body...>
    body_match = re.search(r'<body[^>]*>', html)
    if body_match:
        insert_pos = body_match.end()
        html = html[:insert_pos] + '\n' + invisible_block + html[insert_pos:]
    
    return html


def process_template(template: str) -> str:
    """
    Полная обработка шаблона: spintax + уникализация.
    Вызывается перед каждой отправкой батча.
    """
    result = process_spintax(template)
    result = uniquify_html(result)
    return result


class WebflowMailer:
    """Класс для работы с WebFlow API и отправки массовых писем (Bulk Sender)"""
    
    def __init__(self, config_path: str = "config.json", cookies_path: str = "cookies.json", 
                 override_session_id: str = None, override_xsrf_token: str = None, proxy: str = None):
        """
        Инициализация WebFlowMailer
        
        Args:
            config_path: путь к файлу конфигурации
            cookies_path: путь к файлу с cookies
            override_session_id: временный ID сессии (не сохраняется в файл)
            override_xsrf_token: временный XSRF токен (не сохраняется в файл)
            proxy: прокси (host:port:user:pass или http://..., socks5://...)
        """
        self.config = self._load_json(config_path)
        self.cookies = self._load_cookies(cookies_path)
        self.last_error = ""  # Последняя ошибка для проброса в UI
        self.proxies = _normalize_proxy(proxy)
        
        # Переопределяем токены из параметров, если они переданы
        if override_session_id:
            self.config['session_id'] = override_session_id
        if override_xsrf_token:
            self.config['xsrf_token'] = override_xsrf_token
        
        # Загружаем шаблоны для обоих режимов
        # Для обратной совместимости: если template_main_file не указан, используем template_file
        main_template_file = self.config.get('template_main_file', self.config.get('template_file', 'template.txt'))
        inbox_template_file = self.config.get('template_inbox_file', 'template_inbox.txt')
        
        self.template_main = self._load_template(main_template_file)
        self.template_inbox = self._load_template(inbox_template_file)
        
        # Для обратной совместимости
        self.template = self.template_main
        
    def _load_json(self, filepath: str) -> dict:
        """Загрузка JSON файла"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            raise FileNotFoundError(f"❌ Файл {filepath} не найден!")
        except json.JSONDecodeError:
            raise ValueError(f"❌ Ошибка чтения JSON из {filepath}")
    
    def _load_cookies(self, filepath: str) -> Dict[str, str]:
        """Загрузка cookies из JSON файла. Если файла нет — возвращаем пустой словарь."""
        try:
            cookies_data = self._load_json(filepath)
        except FileNotFoundError:
            return {}
        # Преобразуем список cookies в словарь для requests
        if isinstance(cookies_data, list):
            # Поддержка как простого формата [{name, value}], так и расширенного формата
            # из браузерных расширений [{name, value, domain, expirationDate, ...}]
            cookies_dict = {}
            for cookie in cookies_data:
                if 'name' in cookie and 'value' in cookie:
                    cookies_dict[cookie['name']] = cookie['value']
            return cookies_dict
        return cookies_data
    
    def _load_template(self, filename: str = None) -> str:
        """Загрузка HTML шаблона письма"""
        if filename is None:
            filename = self.config.get('template_file', 'template.txt')
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            raise FileNotFoundError(f"❌ Файл шаблона {filename} не найден!")
    
    def _get_headers(self, content_type: str = "application/json") -> dict:
        """Формирование заголовков для запросов"""
        headers = {
            "accept": "application/json",
            "accept-encoding": "gzip, deflate, br, zstd",
            "accept-language": "en-US,en;q=0.9",
            "content-type": content_type,
            "origin": self.config['origin'],
            "referer": self.config['referer'],
            "sec-ch-ua": '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
            "x-requested-with": "XMLHttpRequest",
            "x-session-id": self.config['session_id'],
            "x-xsrf-token": self.config['xsrf_token']
        }
        
        # Добавляем специфичные заголовки для некоторых запросов
        if "x-content-type-options" in self.config.get('additional_headers', {}):
            headers["x-content-type-options"] = "nosniff"
            
        return headers
    
    def _request_kw(self) -> dict:
        """kwargs для requests: proxies (и timeout при необходимости)."""
        kw = {}
        if self.proxies:
            kw['proxies'] = self.proxies
        kw['timeout'] = 60
        return kw
    
    def update_form_settings(self, emails: List[str], template: str = None, subject: str = None) -> bool:
        """
        Обновление настроек формы с новым списком email адресов
        
        Args:
            emails: список email адресов для рассылки
            template: HTML шаблон письма (если None, используется template_main)
            subject: тема письма (если None, используется из конфига)
            
        Returns:
            True если успешно, False в противном случае
        """
        url = self.config['form_settings_url']
        
        # Используем переданные параметры или значения по умолчанию
        if template is None:
            template = self.template_main
        if subject is None:
            subject = self.config.get('email_subject_main', self.config.get('email_subject', 'Order Confirmed'))
        
        payload = {
            "settings": {
                "emailDestinations": emails,
                "emailSenderName": self.config['email_sender_name'],
                "emailReplyTos": self.config['email_reply_tos'],
                "emailSubject": subject,
                "emailFormTemplate": template
            }
        }
        
        try:
            response = requests.post(
                url,
                json=payload,
                headers=self._get_headers(),
                cookies=self.cookies,
                **self._request_kw()
            )
            
            if response.status_code == 200:
                print(f"✅ Форма обновлена ({len(emails)} получателей)")
                return True
            elif response.status_code == 401 or response.status_code == 403:
                self.last_error = f"AUTH_401 Авторизация [{response.status_code}] — обновите токены"
                print(f"❌ {self.last_error}")
                return False
            elif response.status_code == 429:
                self.last_error = f"#RATE_429 Rate limit [{response.status_code}]"
                print(f"❌ {self.last_error}")
                return False
            else:
                self.last_error = f"FORM_UPD Обновление формы [{response.status_code}]"
                print(f"❌ {self.last_error}")
                return False
                
        except requests.exceptions.ConnectionError as e:
            self.last_error = f"#NET_ERR Ошибка сети: {str(e)[:80]}"
            print(f"❌ {self.last_error}")
            return False
        except Exception as e:
            self.last_error = f"FORM_UPD Ошибка: {str(e)[:80]}"
            print(f"❌ {self.last_error}")
            return False
    
    def publish_site(self) -> str:
        """
        Публикация сайта для применения изменений
        
        Returns:
            task_id если успешно, None в противном случае
        """
        url = self.config['publish_url']
        
        payload = {
            "publishTarget": [self.config['publish_target']],
            "meta": {
                "designerMode": "design",
                "sessionId": self.config['session_id'],
                "skipDatabasePublishing": False
            }
        }
        
        try:
            response = requests.post(
                url,
                json=payload,
                headers=self._get_headers("application/json; charset=UTF-8"),
                cookies=self.cookies,
                **self._request_kw()
            )
            
            if response.status_code == 200:
                data = response.json()
                task_id = data.get('taskId')
                print(f"✅ Публикация запущена")
                return task_id
            elif response.status_code == 401 or response.status_code == 403:
                self.last_error = f"AUTH_401 Публикация [{response.status_code}] — обновите токены"
                print(f"❌ {self.last_error}")
                return None
            elif response.status_code == 429:
                self.last_error = f"#RATE_429 Публикация — rate limit [{response.status_code}]"
                print(f"❌ {self.last_error}")
                return None
            else:
                self.last_error = f"#PUB_FAIL Публикация [{response.status_code}]"
                print(f"❌ {self.last_error}")
                return None
                
        except requests.exceptions.ConnectionError as e:
            self.last_error = f"#NET_ERR Сеть при публикации: {str(e)[:80]}"
            print(f"❌ {self.last_error}")
            return None
        except Exception as e:
            self.last_error = f"#PUB_FAIL Ошибка: {str(e)[:80]}"
            print(f"❌ {self.last_error}")
            return None
    
    def check_publish_status(self, task_id: str) -> bool:
        """
        Проверка статуса публикации
        
        Args:
            task_id: ID задачи публикации
            
        Returns:
            True если публикация завершена, False в противном случае
        """
        url = self.config['task_status_url'].format(task_id=task_id)
        timestamp = int(time.time() * 1000)
        
        try:
            response = requests.get(
                f"{url}?t={timestamp}",
                headers=self._get_headers(),
                cookies=self.cookies,
                **self._request_kw()
            )
            
            if response.status_code == 200:
                data = response.json()
                status = data.get('status', {}).get('status')
                
                if status == 'finished':
                    print(f"✅ Опубликовано")
                    return True
                elif status == 'started':
                    return False
                else:
                    return False
            else:
                print(f"❌ Ошибка {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Ошибка: {e}")
            return False
    
    def wait_for_publish(self, task_id: str, max_attempts: int = 30, delay: int = 2) -> bool:
        """
        Ожидание завершения публикации
        
        Args:
            task_id: ID задачи публикации
            max_attempts: максимальное количество попыток проверки
            delay: задержка между проверками в секундах
            
        Returns:
            True если публикация завершена, False если превышено время ожидания
        """
        for attempt in range(max_attempts):
            if self.check_publish_status(task_id):
                return True
            time.sleep(delay)
        
        self.last_error = f"PUB_TIME Таймаут публикации ({max_attempts * delay}с)"
        print(f"❌ {self.last_error}")
        return False
    
    def trigger_form_submission(self) -> bool:
        """
        Отправка формы на сайте для триггера рассылки писем
        
        Returns:
            True если успешно, False в противном случае
        """
        url = self.config['form_submit_url']
        
        # Генерируем случайные данные для каждой отправки
        random_name = generate_random_name()
        random_email = generate_random_email()
        
        # Формируем данные формы
        form_data = {
            'name': self.config['form_name'],
            'pageId': self.config['page_id'],
            'elementId': self.config['element_id'],
            'domain': self.config['domain'],
            'collectionId': '',
            'itemSlug': '',
            'source': self.config['source'],
            'test': 'false',
            'fields[name]': random_name,
            'fields[email]': random_email,
            'dolphin': 'false'
        }
        
        headers = {
            "accept": "application/json, text/javascript, */*; q=0.01",
            "accept-encoding": "gzip, deflate, br, zstd",
            "accept-language": "en-US,en;q=0.9",
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "origin": f"https://{self.config['domain']}",
            "referer": f"https://{self.config['domain']}/",
            "sec-ch-ua": '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "cross-site",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36"
        }
        
        try:
            response = requests.post(
                url,
                data=form_data,
                headers=headers,
                **self._request_kw()
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('code') == 200:
                    print(f"✅ Письма отправлены")
                    return True
                else:
                    self.last_error = f"#TRIG_ERR Ответ формы: code={data.get('code')} — {data.get('msg', 'неизвестно')}"
                    print(f"❌ {self.last_error}")
                    return False
            elif response.status_code == 429:
                self.last_error = f"#RATE_429 Триггер формы [{response.status_code}]"
                print(f"❌ {self.last_error}")
                return False
            else:
                self.last_error = f"#TRIG_ERR Триггер формы [{response.status_code}]"
                print(f"❌ {self.last_error}")
                return False
                
        except requests.exceptions.ConnectionError as e:
            self.last_error = f"#NET_ERR Сеть при отправке формы: {str(e)[:80]}"
            print(f"❌ {self.last_error}")
            return False
        except Exception as e:
            self.last_error = f"#TRIG_ERR Ошибка: {str(e)[:80]}"
            print(f"❌ {self.last_error}")
            return False
    
    def _generate_order_id(self) -> str:
        """Генерация случайного номера заказа на основе настроек"""
        order_type = self.config.get('order_id_type', 'digits')
        order_length = int(self.config.get('order_id_length', 8))
        
        if order_type == 'digits':
            return ''.join(random.choices(string.digits, k=order_length))
        elif order_type == 'letters':
            return ''.join(random.choices(string.ascii_uppercase, k=order_length))
        else:
            return ''.join(random.choices(string.ascii_uppercase + string.digits, k=order_length))
    
    def _substitute_variables(self, template: str, email: str = None) -> str:
        """
        Подстановка переменных в шаблон.
        Каждый вызов генерирует УНИКАЛЬНЫЕ случайные значения.
        
        {email} — email получателя
        {username} — имя из email
        {order_id} — случайный номер заказа
        {redirect} — целевая ссылка
        {date} — текущая дата
        {time} — текущее время
        {random_price} — случайная цена
        {tracking_number} — случайный трекинг
        {item_name} — случайное название товара
        {first_name} — случайное имя
        {last_name} — случайная фамилия
        """
        from datetime import datetime as dt
        
        order_id = self._generate_order_id()
        redirect = self.config.get('redirect_url', '')
        
        # Используем переданный email или генерируем случайный
        if email:
            target_email = email
            username = email.split('@')[0]
        else:
            username = generate_random_name().lower()
            target_email = generate_random_email()
        
        # New variables
        now = dt.now()
        date_str = now.strftime('%b %d, %Y')
        time_str = now.strftime('%H:%M')
        price = f"${random.uniform(12.99, 299.99):.2f}"
        tracking_prefixes = ['1Z', '9400', '9261', 'TBA', 'JD', 'CJ', '420']
        tracking = random.choice(tracking_prefixes) + ''.join(random.choices(string.digits, k=random.randint(12, 18)))
        
        item_names = [
            'Vintage Nike Windbreaker', 'Y2K Cargo Pants', 'Ralph Lauren Polo Shirt',
            "Levi's 501 Jeans", 'Carhartt WIP Jacket', 'Champion Reverse Weave Hoodie',
            'Coach Leather Crossbody', 'iPhone 15 Pro Max 256GB', 'Sony WH-1000XM5',
            'Jordan 1 Retro High OG', 'Yeezy Boost 350 V2', 'Nike Dunk Low Panda',
            'Nike Air Force 1 Low', 'Premium Wireless Earbuds', 'Leather Messenger Bag',
            'Smart Fitness Watch', 'Bluetooth Speaker JBL', 'Dr. Martens 1460 Boots'
        ]
        item = random.choice(item_names)
        
        first_names = ['James', 'John', 'Robert', 'Michael', 'David', 'Mary', 'Jennifer',
                       'Emma', 'Olivia', 'Sophia', 'Daniel', 'Matthew', 'Jessica', 'Sarah']
        last_names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
                      'Davis', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson']
        
        template = template.replace('{email}', target_email)
        template = template.replace('{username}', username)
        template = template.replace('{order_id}', order_id)
        template = template.replace('{redirect}', redirect)
        template = template.replace('{date}', date_str)
        template = template.replace('{time}', time_str)
        template = template.replace('{random_price}', price)
        template = template.replace('{tracking_number}', tracking)
        template = template.replace('{item_name}', item)
        template = template.replace('{first_name}', random.choice(first_names))
        template = template.replace('{last_name}', random.choice(last_names))
        
        return template
    
    def send_batch(self, emails: List[str]) -> bool:
        """
        Отправка одной партии писем — каждый email получает СВОЙ уникальный шаблон.
        
        Webflow отправляет один шаблон всем получателям в emailDestinations,
        поэтому для уникальных переменных ({email}, {first_name}, и т.д.)
        каждый email обрабатывается индивидуально.
        
        Args:
            emails: список email адресов
            
        Returns:
            True если успешно, False в противном случае
        """
        for email_addr in emails:
            # Уникализируем шаблон для КАЖДОГО получателя
            unique_template = process_template(self.template_main)
            unique_subject = process_spintax(
                self.config.get('email_subject_main', self.config.get('email_subject', 'Order Confirmed'))
            )
            
            # Подставляем переменные с конкретным email получателя
            unique_template = self._substitute_variables(unique_template, email_addr)
            unique_subject = self._substitute_variables(unique_subject, email_addr)
            
            if not self.update_form_settings([email_addr], template=unique_template, subject=unique_subject):
                return False
            
            time.sleep(1)
            
            task_id = self.publish_site()
            if not task_id:
                return False
            
            if not self.wait_for_publish(task_id):
                return False
            
            time.sleep(2)
            
            if not self.trigger_form_submission():
                return False
        
        return True
    
    def send_batch_dual_mode(self, emails: List[str]) -> bool:
        """
        Отправка двух писем на одни адреса: сначала inbox, потом main.
        Каждый email получает СВОЙ уникальный шаблон с уникальными переменными.
        
        Args:
            emails: список email адресов
            
        Returns:
            True если успешно, False в противном случае
        """
        for email_addr in emails:
            # === INBOX письмо ===
            unique_inbox = process_template(self.template_inbox)
            unique_inbox_subject = process_spintax(
                self.config.get('email_subject_inbox', 'Account Notification')
            )
            
            unique_inbox = self._substitute_variables(unique_inbox, email_addr)
            unique_inbox_subject = self._substitute_variables(unique_inbox_subject, email_addr)
            
            if not self.update_form_settings([email_addr], template=unique_inbox, subject=unique_inbox_subject):
                return False
            
            time.sleep(1)
            task_id = self.publish_site()
            if not task_id:
                return False
            if not self.wait_for_publish(task_id):
                return False
            time.sleep(2)
            if not self.trigger_form_submission():
                return False
            
            delay = self.config.get('dual_mode_delay', 3)
            time.sleep(delay)
            
            # === MAIN письмо ===
            unique_main = process_template(self.template_main)
            unique_main_subject = process_spintax(
                self.config.get('email_subject_main', self.config.get('email_subject', 'Order Confirmed'))
            )
            
            unique_main = self._substitute_variables(unique_main, email_addr)
            unique_main_subject = self._substitute_variables(unique_main_subject, email_addr)
            
            if not self.update_form_settings([email_addr], template=unique_main, subject=unique_main_subject):
                return False
            
            time.sleep(1)
            task_id = self.publish_site()
            if not task_id:
                return False
            if not self.wait_for_publish(task_id):
                return False
            time.sleep(2)
            if not self.trigger_form_submission():
                return False
        
        return True
    
    def send_mass_emails(self, all_emails: List[str], mode: int = 1, progress_callback=None):
        """
        Массовая рассылка писем — каждый email обрабатывается индивидуально
        для уникальных переменных ({email}, {first_name}, и др.).
        
        При получении 429 (rate limit) автоматически ждёт и повторяет попытку
        с экспоненциальным бэкоффом (15с → 30с → 60с), до 3 попыток.
        
        Args:
            all_emails: полный список email адресов
            mode: 1 = одно письмо, 2 = два письма (inbox + main)
            progress_callback: функция для обновления прогресса (current, total, success, failed, log_msg)
        """
        # Убираем дубликаты
        all_emails = list(dict.fromkeys(all_emails))
        
        total = len(all_emails)
        mode_name = "Режим 1" if mode == 1 else "Режим 2"
        
        MAX_RETRIES = 3
        RETRY_DELAYS = [15, 30, 60]  # секунды: 1-я, 2-я, 3-я попытка
        
        print(f"\n🚀 Рассылка")
        print(f"📊 {mode_name} | {total} получателей\n")
        
        success_count = 0
        failed_count = 0
        current_count = 0
        
        batch_delay = self.config.get('batch_delay', 5)
        
        for idx, email_addr in enumerate(all_emails):
            num = idx + 1
            
            print(f"[{num}/{total}] Отправка → {email_addr}...")
            log_msg = f"🚀 Отправка {num}/{total} → {email_addr}"
            
            if progress_callback:
                progress_callback(current_count, total, success_count, failed_count, log_msg)
            
            # Попытки отправки с auto-retry при 429
            success = False
            for attempt in range(MAX_RETRIES + 1):
                if mode == 1:
                    success = self.send_batch([email_addr])
                else:
                    success = self.send_batch_dual_mode([email_addr])
                
                if success:
                    break
                
                # Проверяем: это rate limit (429)?
                is_rate_limit = '#RATE_429' in (self.last_error or '')
                
                if not is_rate_limit or attempt >= MAX_RETRIES:
                    # Не 429 или исчерпаны попытки — фейл
                    break
                
                # Auto-retry: ждём и пробуем снова
                wait_time = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                retry_msg = f"⏳ Rate limit — пауза {wait_time}с, повтор {attempt + 1}/{MAX_RETRIES} → {email_addr}"
                print(f"🔄 {retry_msg}")
                if progress_callback:
                    progress_callback(current_count, total, success_count, failed_count, retry_msg)
                time.sleep(wait_time)
            
            if success:
                success_count += 1
                res_msg = f"✅ [{num}/{total}] {email_addr} — доставлен"
                self.last_error = ""
            else:
                failed_count += 1
                err_detail = self.last_error if self.last_error else "Неизвестная ошибка"
                res_msg = f"❌ [{num}/{total}] {email_addr} — {err_detail}"
                print(f"⚠️  Ошибка: {err_detail}")
            
            current_count += 1
            
            if progress_callback:
                progress_callback(current_count, total, success_count, failed_count, res_msg)
            
            # Пауза между отправками (кроме последнего)
            if idx < total - 1:
                print(f"⏳ Пауза {batch_delay}с...\n")
                if progress_callback:
                    progress_callback(current_count, total, success_count, failed_count, f"⏳ Пауза {batch_delay}с...")
                time.sleep(batch_delay)
        
        final_msg = f"Рассылка завершена: ✅ {success_count} | ❌ {failed_count}"
        print(f"\n📊 {final_msg}\n")
        if progress_callback:
            progress_callback(total, total, success_count, failed_count, final_msg)


def get_email_list() -> List[str]:
    """
    Интерактивный ввод списка email адресов
    """
    print("\n📧 Ввод email адресов")
    print("Введите адреса (Enter на пустой строке для завершения)\n")
    
    emails = []
    while True:
        line = input().strip()
        if not line:
            if emails:
                break
            else:
                print("⚠️  Введите хотя бы один email адрес")
                continue
        emails.append(line)
    
    print(f"\n✅ Введено {len(emails)} email адресов\n")
    return emails


def main():
    """Главная функция"""
    print("\n🌐 WebFlow Mass Email Sender\n")
    
    try:
        mailer = WebflowMailer()
    except Exception as e:
        print(f"❌ Ошибка инициализации: {e}")
        return
    
    print("📧 Выбор режима")
    print("\n1. Одиночная отправка (один шаблон)")
    print("2. Двойная отправка (Inbox warming + Main)")
    
    while True:
        mode_input = input("\nВыберите режим (1 или 2): ").strip()
        if mode_input in ['1', '2']:
            mode = int(mode_input)
            break
        print("❌ Введите 1 или 2")
    
    emails = get_email_list()
    mailer.send_mass_emails(emails, mode=mode)


if __name__ == "__main__":
    main()
