// Simuliert GitHub Pages lokal: dist/ unter /ma35-website/, unbekannte Pfade -> 404.html (Status 404).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT || 4321);
const BASE = process.env.BASE || '/ma35-website/';
const DIST = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png' };

createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (url.startsWith(BASE)) {
    let file = normalize(join(DIST, url.slice(BASE.length)));
    if (file.startsWith(normalize(DIST))) {
      try {
        if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
        return res.end(body);
      } catch {}
    }
  }
  res.writeHead(404, { 'content-type': TYPES['.html'] });
  res.end(await readFile(join(DIST, '404.html')));
}).listen(PORT, () => console.log(`GitHub-Pages-Simulation: http://localhost:${PORT}${BASE}`));
