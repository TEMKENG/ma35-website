# MA35 · Thibaut Temkeng

Persönliche Portfolio-Webseite mit echter 3D-Szene ("Virtuelle Probefahrt": LiDAR-Punktwolke, Radar-Fächer, Ultraschallwellen). Sie ist komplett statisch und läuft kostenlos auf **GitHub Pages**.

- Stack: Vite, TypeScript, Three.js (eigene GLSL-Shader), GSAP, selbst gehostete Schriften (OFL)
- Kein Server, keine Datenbank, keine API-Schlüssel, keine kostenpflichtigen Dienste
- Architektur- und Kostenbericht: [docs/ARCHITEKTUR.md](docs/ARCHITEKTUR.md)
- Logo-Dateien: `public/brand/` (Bildmarke, Wortmarke für dunklen und hellen Hintergrund, Übersicht unter `/brand/`)

## Lokal starten

```bash
npm install
npm run dev          # Entwicklung: http://localhost:5173
npm run build        # Produktions-Build nach dist/
npm run preview:subpath   # Simuliert GitHub Pages unter http://localhost:4321/ma35-website/
```

## Auf GitHub Pages veröffentlichen

Voraussetzung: kostenloses GitHub-Konto. Mit GitHub Free funktioniert Pages nur für **öffentliche** Repositories.

1. Auf GitHub ein neues **öffentliches** Repository anlegen, z. B. `ma35-website`.
   - Soll die Seite direkt unter `https://<benutzername>.github.io/` erscheinen, das Repository `<benutzername>.github.io` nennen.
2. Projekt hochladen (im Ordner `ma35-website`):
   ```bash
   git init
   git add .
   git commit -m "MA35 Webseite"
   git branch -M main
   git remote add origin https://github.com/<benutzername>/ma35-website.git
   git push -u origin main
   ```
3. Auf GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions** wählen.
4. Der Workflow `.github/workflows/deploy.yml` startet bei jedem Push auf `main` automatisch (Reiter **Actions**). Nach ca. 1 Minute ist die Seite online unter
   `https://<benutzername>.github.io/ma35-website/`.

Es muss nichts am Base-Pfad angepasst werden: Der Build nutzt relative Pfade (`base: './'`) und funktioniert dadurch unter `/`, unter `/<repo>/` und unter einer Custom Domain.

### Optional: eigene Domain

Unter **Settings → Pages → Custom domain** die Domain eintragen und beim Domain-Anbieter einen DNS-Eintrag setzen (Anleitung: GitHub Docs, "Managing a custom domain for your GitHub Pages site"). Danach **Enforce HTTPS** aktivieren. Die Domain selbst kostet beim Anbieter Geld, GitHub Pages nicht.

## Inhalte ändern

Alle Texte stehen direkt in `index.html`, damit sie auch ohne JavaScript lesbar sind und von Suchmaschinen gefunden werden. Quelle ist `lebenslauf.yml`.

Bewusst **nicht** veröffentlicht, weil Repository und Seite öffentlich sind: Telefonnummer, Anschrift, Geburtsdatum und Geburtsort. Die E-Mail-Adresse wird erst im Browser zusammengesetzt.

## Barrierefreiheit und Fallbacks

- `prefers-reduced-motion`: Die Szene bleibt stehen, es gibt keine Einblend-Animationen.
- Ohne WebGL2 erscheint ein statischer Farbverlauf. Alle Inhalte bleiben erhalten.
- Ohne JavaScript sind alle Texte sichtbar (`<noscript>`).
- Die Animation pausiert, wenn der Tab im Hintergrund ist. Pixel-Ratio und Punktanzahl werden auf Smartphones reduziert.

## Lizenzen der Abhängigkeiten

| Paket | Lizenz |
|---|---|
| three | MIT |
| gsap | GSAP Standard "no charge" License (kostenlos, auch kommerziell) |
| vite, typescript | MIT, Apache-2.0 |
| @fontsource-variable/inter, space-grotesk | SIL Open Font License 1.1 |
