# Contributing to WebFlow Sender

First off — thanks for taking the time to contribute! Every bug report, feature idea, and pull request helps make this project better.

## How Can I Contribute?

### Reporting Bugs

- Check [existing issues](https://github.com/ew1lexa/WebFlow-Sender/issues) first to avoid duplicates
- Use the **Bug Report** issue template
- Include steps to reproduce, expected vs actual behavior, and your environment (OS, Python version, browser)

### Suggesting Features

- Open an issue with the **Feature Request** template
- Describe the use case — *why* you need it, not just *what*

### Code Contributions

1. **Fork** the repository
2. **Create a branch** from `main`: `git checkout -b feature/your-feature`
3. **Make your changes** following the code style below
4. **Test** your changes locally (`python app.py` → open `http://localhost:5000`)
5. **Commit** with a clear message: `Add spintax weight support` (not `fix stuff`)
6. **Push** and open a **Pull Request**

## Code Style

### Python
- Type hints on all function signatures
- `pathlib.Path` over `os.path` where possible
- Specific exception handling — never bare `except:`
- Constants in `UPPER_SNAKE_CASE` at module level

### JavaScript
- `const`/`let`, never `var`
- `async`/`await` over `.then()` chains
- `querySelector` / `querySelectorAll` for DOM access
- Arrow functions for callbacks, named functions for top-level

### Commits
- Use imperative mood: "Add feature" not "Added feature"
- Keep the first line under 72 characters
- Reference issue numbers where relevant: `Fix #12: handle empty email list`

## Development Setup

```bash
git clone https://github.com/ew1lexa/WebFlow-Sender.git
cd WebFlow-Sender
pip install -r requirements.txt
python app.py
```

Open `http://localhost:5000` in your browser.

For SOCKS5 proxy support:
```bash
pip install "requests[socks]"
```

## Project Structure (Quick Reference)

| File | What it does |
|------|-------------|
| `app.py` | Flask routes, API, mailing orchestration |
| `webflow_mailer.py` | Core engine — Webflow API, spintax, uniquification |
| `templates/index.html` | SPA dashboard |
| `static/script.js` | Frontend logic |
| `templates/template_*.txt` | Email templates |

## Good First Issues

Look for issues labeled [`good first issue`](https://github.com/ew1lexa/WebFlow-Sender/labels/good%20first%20issue) — these are scoped, well-described tasks perfect for getting started.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
