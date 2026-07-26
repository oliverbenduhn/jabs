# Deployment – jabs

> **Zweck**: Wie `jabs` produktiv ausgeliefert wird – GitHub Pages, Netlify, Vercel, Nginx, Apache, Custom-Domain.
> **Grundregel**: **Statisch**. Es gibt keinen Backend-Service, keinen Build-Step, keine Environment-Variablen. `index.htm` (oder `index.html`) ist alles, was deployed werden muss.

---

## 1. Inhaltsverzeichnis

- [Schnellstart](#2-schnellstart)
- [GitHub Pages](#3-github-pages)
- [Netlify](#4-netlify)
- [Vercel](#5-vercel)
- [Nginx](#6-nginx)
- [Apache](#7-apache)
- [Lokales file://](#8-lokales-file-protokoll)
- [Custom Domain](#9-custom-domain)
- [Health-Check](#10-health-check)

---

## 2. Schnellstart

```bash
# 1. Repository klonen
git clone https://github.com/oliverbenduhn/jabs.git
cd jabs

# 2. Sicherstellen, dass die Tests grün sind
npm test

# 3. Ausliefern – Variante 1: GitHub Pages (siehe §3)
# Variante 2: Manuell auf einen beliebigen statischen Webserver
rsync -av --delete \
    --exclude='.git' --exclude='node_modules' --exclude='test' \
    ./ user@server:/var/www/jabs/
```

---

## 3. GitHub Pages

### 3.1 Variante A: Branch `gh-pages`

```bash
git checkout -b gh-pages
git push origin gh-pages
# GitHub Settings → Pages → Source: gh-pages branch
```

Die Wurfel-URL wird sein: `https://<user>.github.io/jabs/`.

### 3.2 Variante B: GitHub Actions (empfohlen für Custom-Domain)

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - id: deployment
        uses: actions/deploy-pages@v4
```

GitHub Settings → Pages → Source: **GitHub Actions**.

### 3.3 Wichtig: `index.htm` vs. `index.html`

GitHub Pages löst die **Wurzel-URL** nur auf `index.html`, `index.md` oder `README.md` auf – **nicht** auf `index.htm`. Das Projekt enthält deshalb eine `index.html`, die per Meta-Refresh auf `index.htm` weiterleitet:

```html
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="0; url=index.htm">
    <link rel="canonical" href="index.htm">
    <title>Bubble Shooter</title>
</head>
<body>
    <p>Weiterleitung zu <a href="index.htm">index.htm</a> …</p>
</body>
</html>
```

**Verhalten**: Beim Aufruf von `https://<user>.github.io/jabs/` lädt der Browser zuerst `index.html`, das per `<meta http-equiv="refresh">` sofort auf `index.htm` umleitet. Die URL-Leiste zeigt anschließend `index.htm`.

### 3.4 Verifizieren

```bash
curl -I https://<user>.github.io/jabs/
# HTTP/2 200
curl -I https://<user>.github.io/jabs/index.htm
# HTTP/2 200
```

---

## 4. Netlify

### 4.1 Drag-and-Drop

1. `https://app.netlify.com/drop` öffnen.
2. Projektordner per Drag-and-Drop fallen lassen.
3. Live-URL wird generiert.

### 4.2 Git-Integration

`netlify.toml`:

```toml
[build]
  publish = "."
  command = "npm test"
```

- Build-Command `npm test` läuft bei jedem Deploy.
- Publish-Directory ist `.` (statische Dateien direkt).

### 4.3 Redirects

`_redirects` (optional, für schönere URLs):

```
/play   /index.htm   200
```

---

## 5. Vercel

`vercel.json`:

```json
{
  "version": 2,
  "builds": [{ "src": "index.htm", "use": "@vercel/static" }],
  "routes": [{ "src": "/", "dest": "/index.html" }]
}
```

Deploy:

```bash
npm i -g vercel
vercel --prod
```

---

## 6. Nginx

### 6.1 Minimale Konfiguration

`/etc/nginx/sites-available/jabs`:

```nginx
server {
    listen 80;
    server_name jabs.example.com;
    root /var/www/jabs;
    index index.html index.htm;

    # Cache statische Assets
    location ~* \.(css|js|svg|woff2?)$ {
        expires 1h;
        add_header Cache-Control "public, max-age=3600";
    }

    # Sicherheits-Header
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header Referrer-Policy strict-origin-when-cross-origin;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/jabs /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6.2 HTTPS via Let's Encrypt

```bash
sudo certbot --nginx -d jabs.example.com
```

---

## 7. Apache

`/etc/apache2/sites-available/jabs.conf`:

```apache
<VirtualHost *:80>
    ServerName jabs.example.com
    DocumentRoot /var/www/jabs
    DirectoryIndex index.html index.htm

    <Directory /var/www/jabs>
        Require all granted
    </Directory>

    # Cache statische Assets
    <IfModule mod_expires.c>
        ExpiresActive On
        ExpiresByType text/css "access plus 1 hour"
        ExpiresByType application/javascript "access plus 1 hour"
    </IfModule>
</VirtualHost>
```

```bash
sudo a2ensite jabs
sudo systemctl reload apache2
```

---

## 8. Lokales file://-Protokoll

Das Spiel ist bewusst so gebaut, dass es **ohne Server** funktioniert:

```bash
open index.htm        # macOS
xdg-open index.htm    # Linux
start index.htm       # Windows
```

**Einschränkungen**:
- Manche Browser blockieren bei `file://` bestimmte Features (z. B. Service Worker) – irrelevant für `jabs`.
- Resize-Verhalten kann je nach Browser leicht abweichen.

**Empfehlung**: Für Entwicklung trotzdem `python3 -m http.server` verwenden, weil realistischere Mobile-Emulation.

---

## 9. Custom Domain

### 9.1 Apex-Domain (`example.com`)

Projekt liegt auf `example.com/jabs/`. Es gibt **keine** server-seitige Logik – einfach das Verzeichnis publizieren.

### 9.2 Subdomain (`play.example.com`)

Siehe Nginx/Apache oben – Document-Root auf den Projektordner setzen.

### 9.3 GitHub Pages mit Custom Domain

1. DNS: CNAME `play.example.com` → `<user>.github.io`.
2. GitHub Settings → Pages → Custom domain: `play.example.com`.
3. GitHub Settings → Pages → **Enforce HTTPS** aktivieren.
4. `CNAME`-Datei im Repo-Root mit Inhalt `play.example.com`.

---

## 10. Health-Check

### 10.1 Funktionaler Smoke-Test nach Deploy

```bash
URL=https://<deine-domain>
curl -fsSL $URL/index.htm > /tmp/jabs.htm
test $(grep -c 'class BubbleShooter' /tmp/jabs.htm) -gt 0 || echo "FAIL: BubbleShooter missing"
test $(grep -c '<canvas id="gameCanvas"' /tmp/jabs.htm) -gt 0 || echo "FAIL: Canvas missing"
test $(grep -c 'requestAnimationFrame' /tmp/jabs.htm) -gt 0 || echo "FAIL: Game Loop missing"
echo "OK: jabs deployment healthy"
```

### 10.2 Browser-Verifikation (manuell)

1. Desktop: Spielen, Schießen, Power-Ups, Game Over.
2. Mobile-Emulation (DevTools): Touch-Drag, Resize, Rotation.
3. `?page=index.htm` zeigt `200`, `Content-Type: text/html`.
4. Browser-Console ist leer (keine 404, keine Errors).

### 10.3 Performance-Budget (optional)

Mit Lighthouse oder WebPageTest prüfen:

| Metrik | Ziel |
|---|---|
| First Contentful Paint | < 1 s |
| Time to Interactive | < 1.5 s |
| Total Transfer Size | < 50 KB (gzipped: < 15 KB) |
| Lighthouse Performance Score | > 95 |

---

## 11. Was NICHT im Deployment enthalten sein muss

| Datei | Grund |
|---|---|
| `node_modules/` | existiert nicht – Zero Dependencies |
| `test/` | nur für Entwicklung, nicht für Endnutzer |
| `agent.md`, `.cursorrules` | KI-Regelwerk – gehört in den Source-Tree, nicht ausgeliefert (oder per `.htaccess`/`robots.txt` ausschließen) |
| `master-audit-*.md` | Audit-Historie – siehe oben |
| `docs/` | Wiki – optional via separater Subdomain |

**Empfohlene `.gitignore`-Ergänzung für Production-Builds** (falls je ein Build hinzukommt):

```
node_modules/
*.log
.DS_Store
```