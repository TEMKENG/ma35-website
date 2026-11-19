import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/inter';
import './style.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
root.classList.add('js');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;

// ---------- E-Mail erst im Browser zusammensetzen ----------
document.querySelectorAll<HTMLAnchorElement>('a[data-u][data-d]').forEach((a) => {
  const addr = `${a.dataset.u}@${a.dataset.d}`;
  a.href = `mailto:${addr}`;
  const span = a.querySelector('span');
  if (span) span.textContent = addr;
});
document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = String(new Date().getFullYear())));

// ---------- Mobiles Menü ----------
const toggle = document.querySelector<HTMLButtonElement>('.nav__toggle');
const links = document.querySelector<HTMLElement>('.nav__links');
const setMenu = (open: boolean) => {
  toggle?.setAttribute('aria-expanded', String(open));
  toggle?.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
  links?.classList.toggle('is-open', open);
};
toggle?.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
links?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (e) => e.key === 'Escape' && setMenu(false));

// ---------- 3D-Szene (lazy geladen, damit Text sofort sichtbar ist) ----------
type Api = import('./scene').SceneApi;
let sceneApi: Api | null = null;
const canvas = document.getElementById('scene') as HTMLCanvasElement | null;

const hasWebGL = (() => {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
})();

if (canvas && hasWebGL) {
  import('./scene').then(({ createScene }) => {
    sceneApi = createScene(canvas, { reducedMotion, mobile });
    if (!sceneApi) {
      root.classList.add('no-webgl');
      return;
    }
    sceneApi.setProgress(scrollProgress());
    const angle = document.querySelector('[data-hud="angle"]');
    const points = document.querySelector('[data-hud="points"]');
    const speed = document.querySelector('[data-hud="speed"]');
    sceneApi.onHud((h) => {
      if (angle) angle.textContent = `${String(h.angle).padStart(3, '0')}°`;
      if (points) points.textContent = h.points.toLocaleString('de-DE');
      if (speed) speed.textContent = String(h.speed);
    });
  });
} else {
  root.classList.add('no-webgl');
}

// ---------- Scroll-Fortschritt: Kamera + Navigationsleiste ----------
// Kamera-Stationen sind an die Abschnitte gekoppelt: Hero = 0, Kontakt = 1.
const sectionIds = ['top', 'profil', 'erfahrung', 'kompetenzen', 'projekte', 'engagement', 'kontakt'];
const sections = sectionIds.map((id) => (id === 'top' ? document.querySelector<HTMLElement>('.hero') : document.getElementById(id)));

function scrollProgress(): number {
  const y = window.scrollY + window.innerHeight * 0.4;
  const tops = sections.map((s) => (s ? s.getBoundingClientRect().top + window.scrollY : 0));
  const n = tops.length - 1;
  for (let i = 0; i < n; i++) {
    if (y < tops[i + 1]) {
      const local = (y - tops[i]) / Math.max(1, tops[i + 1] - tops[i]);
      return (i + Math.min(Math.max(local, 0), 1)) / n;
    }
  }
  return 1;
}

const bar = document.querySelector<HTMLElement>('.nav__progress i');
const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('.nav__links a'));
const onScroll = () => {
  const p = scrollProgress();
  sceneApi?.setProgress(p);
  const docP = window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  if (bar) bar.style.transform = `scaleX(${docP})`;
  const idx = Math.round(p * (sections.length - 1));
  const activeId = sectionIds[idx];
  navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${activeId}`));
};
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);
onScroll();

// ---------- Maus-Parallaxe & Licht auf Karten ----------
if (!mobile) {
  window.addEventListener(
    'pointermove',
    (e) => {
      sceneApi?.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    },
    { passive: true },
  );
  document.querySelectorAll<HTMLElement>('.card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

// ---------- Animationen ----------
if (!reducedMotion) {
  gsap.from('.hero__logo, .eyebrow', { y: 24, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.12, delay: 0.1 });
  gsap.from('.hero__title .line', { yPercent: 110, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.12, delay: 0.25 });
  gsap.from('.hero__lead, .hero__actions', { y: 20, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.1, delay: 0.6 });
  gsap.from('.hud > div', { x: 20, opacity: 0, duration: 0.8, stagger: 0.08, delay: 1 });

  // Einblenden per IntersectionObserver: robust auch bei Ankersprüngen und späten Layoutänderungen
  let queue: HTMLElement[] = [];
  let flushScheduled = false;
  const flush = () => {
    gsap.to(queue, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08, overwrite: true });
    queue = [];
    flushScheduled = false;
  };
  const revealIo = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        revealIo.unobserve(e.target);
        queue.push(e.target as HTMLElement);
      }
      if (queue.length && !flushScheduled) {
        flushScheduled = true;
        requestAnimationFrame(flush);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0 },
  );
  document.querySelectorAll('.reveal').forEach((el) => revealIo.observe(el));

  // Hero-Text gleitet beim Weiterscrollen weg
  gsap.to('.hero__inner', {
    yPercent: -18,
    opacity: 0.15,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh());

  // Zähler in den Kennzahlen
  const countIo = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      countIo.unobserve(e.target);
      const el = e.target as HTMLElement;
      const target = Number(el.dataset.count);
      const prefix = el.dataset.prefix ?? '';
      const suffix = el.dataset.suffix ?? '';
      const obj = { v: 0 };
      gsap.to(obj, {
        v: target,
        duration: 1.6,
        ease: 'power2.out',
        onUpdate: () => (el.textContent = `${prefix}${Math.round(obj.v)}${suffix}`),
      });
    }
  });
  document.querySelectorAll('[data-count]').forEach((el) => countIo.observe(el));
} else {
  document.querySelectorAll<HTMLElement>('.reveal').forEach((el) => {
    el.style.opacity = '1';
    el.style.transform = 'none';
  });
}
