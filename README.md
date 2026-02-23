# WebFlow Sender

Инструмент для email-рассылок через формы сайтов на **Webflow**: рассылки, прогрев инбокса (Inbox Warming) и уникализация писем (Spintax, HTML-рандомизация) — без Mailchimp и сторонних ESP.

---

## Возможности

- **Рассылки через Webflow** — отправка через form submission вашего сайта (site_id, element_id, session_id, xsrf_token)
- **Мультиаккаунт** — несколько профилей (аккаунтов), батчи и задержки между отправками
- **Inbox Warming** — режим прогрева инбокса с шаблоном уведомлений
- **Уникализация** — Spintax в шаблонах, HTML-рандомизация для снижения риска спама
- **Готовые шаблоны** — Depop, eBay, Poshmark, Vinted, Mercari, StockX, Inbox Warming
- **Веб-интерфейс** — редактор HTML с превью, настройки, аналитика и логи

---

## Требования

- Python 3.8+
- Аккаунт Webflow Designer и сайт с формой

---

## Установка и запуск

```bash
git clone https://github.com/YOUR_USERNAME/WebFlow-Sender.git
cd WebFlow-Sender
pip install -r requirements.txt
```

Скопируй конфиги (без них приложение не сможет отправить письма):

```bash
# Windows
copy config.example.json config.json
copy cookies.example.json cookies.json

# Linux / macOS
cp config.example.json config.json
cp cookies.example.json cookies.json
```

Отредактируй `config.json`: подставь свои `site_id`, `element_id`, `page_id`, `session_id`, `xsrf_token`, URL сайта и т.д. (всё берётся из браузера в Webflow Designer). Файл `cookies.json` потом можно обновить через интерфейс (синхронизация сессии).

```bash
python app.py
```

В браузере открой адрес из консоли (обычно `http://127.0.0.1:5000`).

---

## Структура проекта

| Путь | Назначение |
|------|------------|
| `app.py` | Flask-приложение, API, маршруты |
| `webflow_mailer.py` | Отправка через Webflow, Spintax, работа с формой |
| `templates/` | HTML интерфейса и шаблоны писем (`template_*.txt`) |
| `static/` | CSS, JS фронтенда |
| `accounts/` | Профили аккаунтов (не коммитятся) |
| `logs/` | Логи по датам (не коммитятся) |

Конфигурация: `config.json`, `settings.json`, аналитика — `analytics.json`. Секреты и данные пользователей в репозиторий не попадают (см. `.gitignore`).

---

## Лицензия

MIT — использование и модификация свободны.

---

**Платонов Марк Игоревич** · [@Ew1lexa](https://t.me/Ew1lexa) · Омск, 2026
