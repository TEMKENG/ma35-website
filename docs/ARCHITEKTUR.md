# MA35 – Architektur- und Kostenbericht

Stand: 2026-11-19. Grundlage: offizielle GitHub-Dokumentation (am selben Tag abgerufen) und die Lizenzangaben der npm-Pakete.

## 1. Geprüfte GitHub-Pages-Bedingungen (GitHub Free)

| Punkt | Offizielle Aussage | Folge für MA35 |
|---|---|---|
| Tarif | GitHub Free für persönliche Konten: Pages nur in **öffentlichen** Repositories ("GitHub Pages in public repositories"). Private Pages gibt es nur mit GitHub Enterprise Cloud. | Repository muss öffentlich sein. Keine Geheimnisse ins Repo. |
| Art des Hostings | "Static site hosting service" für HTML, CSS und JavaScript, optional mit Build-Prozess. Kein serverseitiger Code. | Komplett statischer Vite-Build, keine API, keine Datenbank. |
| Größe der Seite | Höchstens 1 GB. | Build ist rund 1 MB groß. |
| Repository-Größe | Empfohlen höchstens 1 GB. | Kein Problem. |
| Bandbreite | Weiche Grenze von 100 GB pro Monat. | Bei ca. 400 KB gzip pro Besuch reicht das für rund 250 000 Besuche. |
| Builds | Weiche Grenze von 10 Builds pro Stunde. Gilt nicht für eigene Actions-Workflows. | Wir veröffentlichen per Actions-Workflow. |
| Deployment-Zeit | Deployments brechen nach 10 Minuten ab. | Der Build dauert unter 1 Minute. |
| GitHub Actions | Standard-Runner sind in öffentlichen Repositories kostenlos und belasten das Freikontingent nicht. | Deployment kostet nichts. |
| Seitentypen | Nutzer-Seite: Repo `<name>.github.io` (eine pro Konto). Projektseite: eine pro Repository unter `/<repo>/`. | Beide Fälle werden unterstützt (relativer Base-Pfad). |
| 404 | `404.html` im veröffentlichten Stammverzeichnis. | `public/404.html` wird mitgebaut. |
| Custom Domain | Möglich, eigene Anleitung bei GitHub. | Optional, siehe README. Der relative Base-Pfad funktioniert auch dort. |
| Nutzungsregeln | Keine Geschäfts-, E-Commerce- oder SaaS-Seiten, keine sensiblen Transaktionen wie Passwörter oder Kreditkarten. | Persönliches Portfolio ohne Formulare und ohne Datenerfassung. |

## 2. Architektur- und Kosten-Audit

| Technologie / Dienst | Zweck | Kosten | Lizenz | GitHub Pages Free kompatibel? | Einschränkungen / Hinweise |
|---|---|---|---|---|---|
| HTML5 / CSS3 | Struktur, Layout, Glas-Effekte, Responsivität | Kostenlos | Offener Standard | Ja | – |
| TypeScript 7.0.2 | Typsichere Logik, nur zur Build-Zeit | Kostenlos | Apache-2.0 | Ja | Wird nicht ausgeliefert |
| Vite 8.3.8 | Statischer Build nach `dist/` | Kostenlos | MIT | Ja | `base: './'` für beliebige Unterpfade |
| Three.js 0.187.0 | Echtes WebGL-3D: Punktwolken-Landschaft, Radarkegel, Fahrzeug | Kostenlos | MIT | Ja | Läuft nur im Browser |
| GLSL-Shader (eigene) | Radar-Sweep, LiDAR-Punkte, Wellen | Kostenlos | Eigener Code | Ja | Fallback ohne WebGL vorhanden |
| GSAP 3.15.1 (+ ScrollTrigger) | Kamerafahrt beim Scrollen, Text-Reveals | Kostenlos | GSAP Standard "no charge" License | Ja | Kommerzielle Nutzung erlaubt. Ausnahme: Tools, die mit Webflow konkurrieren. Trifft hier nicht zu |
| Space Grotesk Variable (@fontsource) | Überschriften | Kostenlos | OFL-1.1 | Ja | Selbst gehostet, keine Google-Anfragen (DSGVO) |
| Inter Variable (@fontsource) | Fließtext | Kostenlos | OFL-1.1 | Ja | Selbst gehostet |
| MA35-Logo (SVG) | Marke, Favicon | Kostenlos | Eigenes Werk | Ja | Keine Fremd-Assets |
| GitHub Actions | Build und Deployment | Kostenlos (öffentliches Repo) | – | Ja | Offizielle Actions `checkout`, `setup-node`, `configure-pages`, `upload-pages-artifact`, `deploy-pages` |
| GitHub Pages | Hosting | Kostenlos | – | Ja | Siehe Tabelle 1 |

**Bewusst nicht verwendet:**

| Kandidat | Entscheidung | Begründung |
|---|---|---|
| React / React Three Fiber | Nicht verwendet | Wäre kompatibel. Bei einer einzigen Seite ohne komplexen Zustand kostet es aber ca. 45 KB gzip mehr und bringt keinen Gewinn. Three.js direkt ist schlanker. |
| Framer Motion | Nicht verwendet | Setzt React voraus. GSAP deckt alle Animationen ab. |
| Astro | Nicht verwendet | Wäre kompatibel. Für eine Seite genügt Vite. |
| Kontaktformular-Dienste, Analytics, CMS | Nicht verwendet | Bräuchten Fremddienste oder ein Backend. Kontakt läuft über `mailto:`, LinkedIn und GitHub. |
| Google Fonts per CDN | Nicht verwendet | Externe Anfrage mit IP-Übertragung. Fonts sind selbst gehostet. |

## 3. Entscheidungen nach Rollen

- **Creative Director:** Leitidee "Virtuelle Probefahrt". Die Seite ist eine nächtliche Testfahrt durch eine Landschaft aus LiDAR-Punkten. Ein Radar tastet die Szene ab. Primärfarbe Blau (`#2F6BFF` Signal, `#0A1A3F` Navy, `#7CC4FF` Eisblau, `#020617` Hintergrund). Marke: MA35-Monogramm mit drei Radarbögen. Alles ist eigener Code, kein kostenpflichtiges Designsystem.
- **UI/UX Designer:** Eine Seite mit Ankern (`#profil`, `#erfahrung` …). Es gibt kein Routing, also auch keine Rewrites. Navigation hat Fortschrittsanzeige, ist per Tastatur bedienbar, hat einen Skip-Link und ein mobiles Menü. Inhalte sind echtes HTML und funktionieren auch ohne JavaScript und ohne WebGL.
- **3D & Motion Designer:** Three.js-Szene mit ca. 18 000 Punkten (auf Smartphones weniger), eigenen Vertex- und Fragment-Shadern, Radar-Sweep, Fahrzeug aus Linien und Partikel-Sternfeld. Die Kamera fährt per GSAP ScrollTrigger mit. `prefers-reduced-motion` schaltet auf eine ruhige Standszene um. Pixel-Ratio ist begrenzt, und die Animation pausiert, wenn der Tab nicht sichtbar ist.
- **Frontend Architect:** Vite, TypeScript, Three.js, GSAP. Alles wird zur Build-Zeit gebündelt. Assets werden über Vite-Imports oder `public/` mit relativen Pfaden eingebunden. Es gibt keine Laufzeit-Abhängigkeit von Servern, CDNs oder Schlüsseln.
- **Critical Reviewer:** Ein Kontaktformular wurde verworfen, weil es einen Server oder einen Drittanbieter braucht. Google Fonts wurden verworfen (Datenschutz). Telefonnummer, Anschrift und Geburtsdatum werden nicht veröffentlicht, da das Repository und die Seite öffentlich sind. Die E-Mail-Adresse wird erst im Browser zusammengesetzt, damit einfache Spam-Crawler sie schwerer finden.

## 4. Routing und Pfade

- `base: './'` in `vite.config.ts`: Alle Asset-URLs im Build sind relativ. Die Seite funktioniert deshalb unter `https://name.github.io/`, `https://name.github.io/repo/`, einer Custom Domain und sogar lokal über `file://` (nur ohne Module-Fonts).
- Navigation nur über Hash-Anker. Unbekannte Pfade landen auf `404.html`, die nach 5 Sekunden zur Startseite zurückleitet. Der Pfad dorthin wird im Browser ermittelt: Liefert `/<erstes Segment>/` die MA35-Startseite, ist das eine Projektseite, sonst geht es zu `/`.

## 5. Validierung (2026-11-19)

| Prüfung | Ergebnis |
|---|---|
| Produktions-Build (`npm run build`, inkl. `tsc`) | Fehlerfrei, `dist/` ca. 1,1 MB |
| Ausgabeformat | Nur HTML, CSS, JS, SVG, WOFF2 |
| Assets unter Unterpfad `/ma35-website/` und unter `/` | Alle Status 200, keine absoluten Pfade im Build |
| 404 unter Unterpfad | Status 404, Link führt zu `/ma35-website/` |
| Interne Anker | Alle Ziele vorhanden, Einblendungen funktionieren auch bei direkten Sprüngen (`#kontakt`) |
| 3D und Animation | Szene rendert, Kamerafahrt folgt dem Scrollen |
| Desktop und Smartphone (375 px) | Kein horizontales Scrollen, mobiles Menü funktioniert |
| Backend / bezahlte Dienste | Keine. Externe Links nur zu LinkedIn, GitHub, Arbeitgebern und Hochschulen |
