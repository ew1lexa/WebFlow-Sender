# Changelog

All notable changes to WebFlow Sender are documented here.

## [2.1.0] — 2026-03-19

### Custom Templates & UI Polish

### Added
- Custom template system: create, edit, duplicate, and delete user templates stored in `custom_templates.json`
- Icon picker with 20 SVG icons from the global sprite (mail, cart, tag, truck, gift, star, etc.)
- Color picker with 13 preset colors for template card accent
- Drag-and-drop HTML file import into template editor (with click-to-upload fallback)
- Variable insertion toolbar: one-click insert for `{email}`, `{username}`, `{order_id}`, `{date}`, `{price}`, `{item}`, `{tracking}`, `{redirect}`
- Clone-as-custom button on built-in template cards
- Code / Preview toggle in custom template editor with spintax + variable processing
- Subject and sender name fields per custom template, auto-applied on selection
- Full field validation: name, sender, subject, and body all required before save

### Changed
- Replaced all emoji icons with consistent SVG sprite icons across the app
- Redesigned template cards: gradient icon bubbles, radial glow on hover, top-line accent effect
- Each built-in template now has a unique icon (Depop=tag, eBay=cart, Poshmark=star, Vinted=truck, Mercari=box, StockX=zap, Inbox=mail)
- Action buttons on cards (edit, clone, delete) now use SVG icons instead of text symbols
- "Create template" card redesigned with dashed icon bubble and send icon

### Fixed
- Color picker selection not highlighting (was comparing RGB vs hex)
- Sender name auto-filling with template name when left empty

---

## [2.0.0] — 2026-03-19

### Complete Redesign & Anti-Spam Engine

This is a major release that rewrites the entire application from scratch.

### Added

**Engine**
- Per-recipient template processing — each email gets unique spintax resolution, HTML fingerprint, and variable substitution
- Spintax processor with nested syntax support and MSO block protection
- HTML uniquification layer: random comments, `data-mid` attributes, invisible preheader blocks
- Auto-retry on 429 rate limit with exponential backoff (15s → 30s → 60s, up to 3 attempts)
- Jitter on all delays to avoid detection patterns
- User-Agent rotation on form submission requests
- 11 dynamic template variables: `{email}`, `{username}`, `{first_name}`, `{last_name}`, `{order_id}`, `{redirect}`, `{date}`, `{time}`, `{random_price}`, `{tracking_number}`, `{item_name}`

**Multi-Account**
- Unlimited Webflow profiles with independent `session_id` / `xsrf_token`
- Per-account proxy support (SOCKS5, HTTP) with built-in connectivity test via `api.ipify.org`
- Per-account sender name, subject, template, and redirect URL

**Templates**
- 7 branded email templates: Depop, eBay, Poshmark, Vinted, Mercari, StockX, Inbox Warming
- Mode 2 (Dual/Inbox Warming): sends warm-up email before main template

**Dashboard (SPA)**
- Five-tab interface: Accounts, Template, Settings, Send, Analytics
- Dark / Light theme with animated circular ripple transition
- Auto-configuration from Webflow URL — paste a link, get Site ID, domain, and all API endpoints
- Code / Preview template editor with live Shadow DOM preview (inline + fullscreen)
- Real-time progress tracking: timer, speed, ETA, per-email log
- 14-day analytics chart, account leaderboard, historical log viewer
- Drag-and-drop `.txt` file import for recipient lists
- Full export / import of accounts, settings, and config to single JSON
- Sound notifications on all UI events and mailing completion
- Custom cursor with magnetic hover effect
- Keyboard shortcuts: `Ctrl+S` (save), `Ctrl+Enter` (start), `Esc` (close modal)

**Infrastructure**
- Auto-creation of all config files and directories on first run
- Daily log files in `logs/` directory
- Analytics recording to `analytics.json`

## [1.0.0] — Initial Release

- Basic Webflow form API integration
- Single template support
- Command-line interface
