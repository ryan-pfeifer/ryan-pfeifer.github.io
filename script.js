/* Ryan Pfeifer — portfolio interactions. Vanilla JS, no dependencies. */
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = motionQuery.matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasIO = 'IntersectionObserver' in window;
  const onVisible = (el, cb, margin = '0px') => {
    if (!hasIO) { cb(true); return; }
    new IntersectionObserver((entries) => cb(entries[entries.length - 1].isIntersecting), { rootMargin: margin }).observe(el);
  };

  /* ------------------------------------------------------------------ */
  /* Small things: year, revision date, timeline "now" marker            */
  /* ------------------------------------------------------------------ */
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const revEl = $('#rev');
  if (revEl) {
    const d = new Date(document.lastModified);
    if (!isNaN(d)) revEl.textContent = d.toISOString().slice(0, 10);
  }

  const timeline = $('.t-rows');
  if (timeline) {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const frac = now.getFullYear() + (now - yearStart) / (365.25 * 864e5);
    // the axis runs from mid-2024 to mid-2028
    timeline.style.setProperty('--now', clamp(((frac - 2024.5) / 4) * 100, 0, 100).toFixed(2));
  }

  /* ------------------------------------------------------------------ */
  /* Navigation: mobile menu and scroll spy                              */
  /* ------------------------------------------------------------------ */
  const navBtn = $('.nav-toggle');
  const nav = $('#site-nav');
  if (navBtn && nav) {
    const setOpen = (open) => {
      navBtn.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('open', open);
    };
    navBtn.addEventListener('click', () => setOpen(navBtn.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.site-header')) setOpen(false); });
  }

  if (hasIO && nav) {
    const links = $$('a[href^="#"]', nav);
    const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => a.removeAttribute('aria-current'));
        const a = byId.get(en.target.id);
        if (a) a.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    $$('main > section[id]').forEach((s) => spy.observe(s));
  }

  /* ------------------------------------------------------------------ */
  /* Schematic / layout view (light / dark theme)                        */
  /* ------------------------------------------------------------------ */
  const viewBtn = $('.view-toggle');
  const currentTheme = () => root.dataset.theme
    || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const syncToggle = () => { if (viewBtn) viewBtn.setAttribute('aria-checked', String(currentTheme() === 'dark')); };
  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch (e) { /* private mode */ }
    syncToggle();
  };
  syncToggle();
  if (viewBtn) {
    viewBtn.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      if (reduced) { applyTheme(next); return; }
      if (!document.startViewTransition) {
        root.classList.add('theme-fade');
        applyTheme(next);
        setTimeout(() => root.classList.remove('theme-fade'), 450);
        return;
      }
      // the new view wipes outward from the switch
      const r = viewBtn.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      const vt = document.startViewTransition(() => applyTheme(next));
      vt.ready.then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 620, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' }
        );
      }).catch(() => {});
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncToggle);
  }

  /* ------------------------------------------------------------------ */
  /* Scroll reveals                                                      */
  /* ------------------------------------------------------------------ */
  const revealEls = $$('.reveal');
  if (hasIO && !reduced) {
    root.classList.add('reveal-ready');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in'));
  }

  /* ------------------------------------------------------------------ */
  /* Hero: routed PCB traces with signal pulses                          */
  /* ------------------------------------------------------------------ */
  function mulberry32(seed) {
    let a = seed;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // parallel copy of a polyline, offset by d, with mitered corners
  function offsetLine(pts, d) {
    if (!d) return pts.map((p) => p.slice());
    const normals = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const dx = pts[i + 1][0] - pts[i][0];
      const dy = pts[i + 1][1] - pts[i][1];
      const len = Math.hypot(dx, dy) || 1;
      normals.push([-dy / len, dx / len]);
    }
    return pts.map((p, i) => {
      const a = normals[Math.max(0, i - 1)];
      const b = normals[Math.min(normals.length - 1, i)];
      let mx = a[0] + b[0];
      let my = a[1] + b[1];
      const ml = Math.hypot(mx, my) || 1;
      mx /= ml; my /= ml;
      const s = d / (mx * a[0] + my * a[1]);
      return [p[0] + mx * s, p[1] + my * s];
    });
  }

  function initTraces() {
    const hero = $('.hero');
    const base = $('.traces-base');
    const hot = $('.traces-hot');
    if (!hero || !base) return;

    const NS = 'http://www.w3.org/2000/svg';
    const svgEl = (name, attrs) => {
      const node = document.createElementNS(NS, name);
      for (const k in attrs) node.setAttribute(k, attrs[k]);
      return node;
    };
    const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    const GRID = 18;    // routing grid, px
    const PITCH = 7;    // trace-to-trace pitch inside a bus, px
    let anims = [];
    let pulses = [];
    let builtW = 0;
    let builtH = 0;
    let first = true;
    let visible = true;

    function build() {
      const w = hero.clientWidth;
      const h = hero.clientHeight + 120;   // headroom so late font loads don't leave a bare strip
      if (!w) return;
      builtW = w; builtH = hero.clientHeight;
      anims.forEach((a) => a.cancel());
      anims = []; pulses = [];
      base.replaceChildren();
      if (hot) hot.replaceChildren();

      const cols = Math.ceil(w / GRID) + 2;
      const rows = Math.ceil(h / GRID) + 2;
      const occ = [new Uint8Array(cols * rows), new Uint8Array(cols * rows)];   // one map per copper layer
      const rnd = mulberry32(0x5521);
      const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
      const want = clamp(Math.round((w * h) / 26000), 10, 40);
      const maxPulses = w < 700 ? 6 : 14;
      const gTrace = svgEl('g', {});
      const gVia = svgEl('g', {});
      const gPulse = svgEl('g', {});
      let made = 0;
      let order = 0;

      for (let tries = 0; tries < want * 18 && made < want; tries++) {
        const layer = rnd() < 0.58 ? 0 : 1;
        const count = ri(1, 4);
        const fromEdge = rnd() < 0.6;
        let x; let y; let d;
        if (fromEdge) {
          const side = ri(0, 3);
          if (side === 0) { x = 0; y = ri(2, rows - 3); d = 0; }
          else if (side === 1) { x = cols - 1; y = ri(2, rows - 3); d = 4; }
          else if (side === 2) { x = ri(2, cols - 3); y = 0; d = 2; }
          else { x = ri(2, cols - 3); y = rows - 1; d = 6; }
        } else {
          x = ri(3, cols - 4); y = ri(3, rows - 4); d = ri(0, 3) * 2;
        }
        if (occ[layer][y * cols + x]) continue;

        // walk the grid: straight runs joined by 45-degree jogs, never crossing same-layer copper
        const cells = [[x, y]];
        const verts = [[x, y]];
        let bend = 0;
        const legs = ri(2, 5);
        for (let leg = 0; leg < legs; leg++) {
          const dx = DIRS[d][0];
          const dy = DIRS[d][1];
          const len = d % 2 ? ri(2, 5) : ri(3, 13);
          let steps = 0;
          for (; steps < len; steps++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 1 || ny < 1 || nx > cols - 2 || ny > rows - 2 || occ[layer][ny * cols + nx]) break;
            x = nx; y = ny;
            cells.push([x, y]);
          }
          if (steps) verts.push([x, y]);
          if (steps < len) break;
          const turn = bend >= 2 ? -1 : bend <= -2 ? 1 : (rnd() < 0.5 ? -1 : 1);
          bend += turn;
          d = (d + turn + 8) % 8;
        }
        if (cells.length < 6 || verts.length < 2) continue;

        for (const cell of cells) {
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              const mx = cell[0] + ox;
              const my = cell[1] + oy;
              if (mx >= 0 && my >= 0 && mx < cols && my < rows) occ[layer][my * cols + mx] = 1;
            }
          }
        }
        made++;

        const centre = verts.map((v) => [(v[0] - 1) * GRID, (v[1] - 1) * GRID]);
        let pulseLine = null;
        for (let i = 0; i < count; i++) {
          const line = offsetLine(centre, (i - (count - 1) / 2) * PITCH);
          // stagger the vias at the end of a bus
          const n = line.length;
          const ex = line[n - 1][0] - line[n - 2][0];
          const ey = line[n - 1][1] - line[n - 2][1];
          const elen = Math.hypot(ex, ey);
          if (i % 2 && elen > 28) {
            line[n - 1][0] -= (ex / elen) * 11;
            line[n - 1][1] -= (ey / elen) * 11;
          }
          const dAttr = 'M' + line.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');
          const path = svgEl('path', { d: dAttr, class: 'trace l' + layer, pathLength: 1 });
          path.style.setProperty('--i', order);
          gTrace.appendChild(path);
          const ends = fromEdge ? [line[n - 1]] : [line[0], line[n - 1]];
          ends.forEach((p) => {
            const via = svgEl('circle', { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 2.7, class: 'via l' + layer });
            via.style.setProperty('--i', order);
            gVia.appendChild(via);
          });
          order++;
          if (i === Math.floor(count / 2)) pulseLine = { line, dAttr };
        }

        if (pulseLine && pulses.length < maxPulses && rnd() < 0.65) {
          const node = svgEl('path', { d: pulseLine.dAttr, class: 'pulse l' + layer, pathLength: 1000 });
          gPulse.appendChild(node);
          let length = 0;
          const samples = [];
          for (let i = 0; i < pulseLine.line.length - 1; i++) {
            const a = pulseLine.line[i];
            const b = pulseLine.line[i + 1];
            const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
            const n = Math.max(1, Math.round(seg / 40));
            for (let k = 0; k <= n; k++) samples.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
            length += seg;
          }
          pulses.push({ node, length, samples, busy: false });
        }
      }

      base.classList.toggle('draw', first && !reduced);
      base.append(gTrace, gVia, gPulse);
      if (hot) hot.append(gTrace.cloneNode(true), gVia.cloneNode(true));

      if (!reduced && typeof base.animate === 'function') {
        pulses.forEach((p) => {
          const travel = (p.length / 190) * 1000;
          const anim = p.node.animate(
            [
              { strokeDashoffset: 40, offset: 0 },
              { strokeDashoffset: -1000, offset: 0.45 },
              { strokeDashoffset: -1000, offset: 1 },
            ],
            { duration: travel / 0.45, delay: (first ? 1500 : 0) + rnd() * 3500, iterations: Infinity }
          );
          if (!visible) anim.pause();
          anims.push(anim);
        });
      }
      first = false;
    }

    build();

    let resizeTimer = 0;
    if ('ResizeObserver' in window) {
      new ResizeObserver(() => {
        if (Math.abs(hero.clientWidth - builtW) < 60 && Math.abs(hero.clientHeight - builtH) < 110) return;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(build, 180);
      }).observe(hero);
    }

    onVisible(hero, (v) => {
      visible = v;
      anims.forEach((a) => (v ? a.play() : a.pause()));
    });

    // cursor: a spotlight on the copper, and the nearest net fires a pulse
    if (finePointer && hot) {
      let px = 0;
      let py = 0;
      let queued = false;
      let lastFire = 0;
      const fire = () => {
        const now = performance.now();
        if (reduced || now - lastFire < 150) return;
        let best = null;
        let bestD = 70 * 70;
        for (const p of pulses) {
          if (p.busy) continue;
          for (const s of p.samples) {
            const dd = (s[0] - px) * (s[0] - px) + (s[1] - py) * (s[1] - py);
            if (dd < bestD) { bestD = dd; best = p; }
          }
        }
        if (!best) return;
        lastFire = now;
        best.busy = true;
        const a = best.node.animate(
          [{ strokeDashoffset: 40 }, { strokeDashoffset: -1000 }],
          { duration: clamp((best.length / 520) * 1000, 350, 1400), easing: 'ease-out' }
        );
        const done = () => { best.busy = false; };
        a.onfinish = done;
        a.oncancel = done;
      };
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        px = e.clientX - r.left;
        py = e.clientY - r.top;
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          hot.style.setProperty('--mx', px.toFixed(0) + 'px');
          hot.style.setProperty('--my', py.toFixed(0) + 'px');
          hero.classList.add('lit');
          fire();
        });
      });
      hero.addEventListener('pointerleave', () => hero.classList.remove('lit'));
    }

    return { rebuild: build };
  }

  /* ------------------------------------------------------------------ */
  /* Oscilloscope: modeled double-pulse test                             */
  /* ------------------------------------------------------------------ */
  function initScope() {
    const canvas = $('#scope-canvas');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const stateEl = $('#scope-state');
    const measEl = $('#scope-meas');
    const tbEl = $('#scope-tb');
    const runBtn = $('#scope-run');
    const zoomBtn = $('#scope-zoom');

    const N = 720;
    const CH = [
      { key: 'vgs', name: 'VGS', unit: 'V', color: '#f6d54a', gnd: 7.4, per: 5 },
      { key: 'vds', name: 'VDS', unit: 'V', color: '#52d6ff', gnd: 2.8, per: 250 },
      { key: 'id', name: 'ID', unit: 'A', color: '#ff72d2', gnd: 5.6, per: 10 },
    ];
    const ring = (dt, amp, tau, period) => (dt < 0 ? 0 : amp * Math.exp(-dt / tau) * Math.cos((2 * Math.PI * dt) / period));
    const ringSin = (dt, amp, tau, period) => (dt < 0 ? 0 : amp * Math.exp(-dt / tau) * Math.sin((2 * Math.PI * dt) / period));
    const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };

    // Both pulses, t in microseconds. 500 V bus into an inductive load:
    // current ramps during pulse 1, freewheels, then pulse 2 turns on at that current.
    function wideModel(t) {
      const on = (t >= 3 && t < 11) || (t >= 14 && t < 16);
      const vgs = (on ? 6 : 0)
        + ring(t - 3, 0.8, 0.16, 0.2) - ring(t - 11, 0.8, 0.16, 0.2)
        + ring(t - 14, 0.8, 0.16, 0.2) - ring(t - 16, 0.8, 0.16, 0.2);
      const vds = (on ? 3 : 500)
        - ring(t - 3, 38, 0.2, 0.24) + ring(t - 11, 68, 0.32, 0.26)
        - ring(t - 14, 44, 0.2, 0.24) + ring(t - 16, 78, 0.32, 0.26);
      let id = 0;
      if (t >= 3 && t < 11) id = (20 * (t - 3)) / 8;
      else if (t >= 14 && t < 16) id = 20 + 2.5 * (t - 14) + ring(t - 14, 4.5, 0.12, 0.3);
      else id = ringSin(t - 11, -1.6, 0.25, 0.26) * (t < 14 ? 1 : 0) + ringSin(t - 16, -2, 0.25, 0.26);
      return [vgs, vds, id];
    }
    // The first turn-off edge, t in nanoseconds: gate falls to its plateau,
    // drain voltage rises, then the current commutates to the freewheel path.
    function edgeModel(t) {
      const vgs = 6 - 3.7 * smooth(8, 12, t) - 2.3 * smooth(24, 29, t) + ringSin(t - 29, 0.45, 5, 4.2);
      const vds = 500 * smooth(12, 24, t) + ringSin(t - 24, 62, 7, 5.2);
      const id = 20 * (1 - smooth(23, 27.5, t)) - ringSin(t - 27.5, 2.2, 6, 5.2);
      return [vgs, vds, id];
    }
    const MODES = {
      wide: { span: 20, unit: 'µs', tb: '2 µs/div', model: wideModel, meas: 'Bus 500 V, peak current 25 A, pulses of 8 µs and 2 µs' },
      edge: { span: 50, unit: 'ns', tb: '5 ns/div', model: edgeModel, meas: '' },
    };
    // measure the modeled edge the way a scope would: 10% to 90% of the bus
    (() => {
      let t10 = 0;
      let t90 = 0;
      for (let t = 0; t < 50; t += 0.01) {
        const v = 500 * smooth(12, 24, t);
        if (!t10 && v >= 50) t10 = t;
        if (!t90 && v >= 450) { t90 = t; break; }
      }
      const tr = t90 - t10;
      MODES.edge.meas = `VDS rise, 10 to 90%: ${tr.toFixed(1)} ns (about ${Math.round(400 / tr)} V/ns)`;
    })();

    const noise = () => Math.random() + Math.random() + Math.random() - 1.5;
    let mode = 'wide';
    let data = null;
    let prev = null;
    function acquire() {
      const m = MODES[mode];
      const out = { vgs: new Float32Array(N), vds: new Float32Array(N), id: new Float32Array(N) };
      for (let i = 0; i < N; i++) {
        const s = m.model((i / (N - 1)) * m.span);
        out.vgs[i] = s[0] + noise() * 0.1;
        out.vds[i] = s[1] + noise() * 4.5;
        out.id[i] = s[2] + noise() * 0.2;
      }
      return out;
    }

    let W = 0;
    let H = 0;
    let dpr = 1;
    let grid = null;
    function buildGrid() {
      grid = document.createElement('canvas');
      grid.width = W; grid.height = H;
      const g = grid.getContext('2d');
      g.fillStyle = '#05090b';
      g.fillRect(0, 0, W, H);
      const dx = W / 10;
      const dy = H / 8;
      g.lineWidth = Math.max(1, Math.round(dpr));
      g.strokeStyle = 'rgba(255,255,255,0.085)';
      g.beginPath();
      for (let i = 1; i < 10; i++) { const x = Math.round(i * dx) + 0.5; g.moveTo(x, 0); g.lineTo(x, H); }
      for (let j = 1; j < 8; j++) { const y = Math.round(j * dy) + 0.5; g.moveTo(0, y); g.lineTo(W, y); }
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.24)';
      g.beginPath();
      const tick = 3 * dpr;
      for (let i = 1; i < 50; i++) { const x = Math.round((i * dx) / 5) + 0.5; g.moveTo(x, H / 2 - tick); g.lineTo(x, H / 2 + tick); }
      for (let j = 1; j < 40; j++) { const y = Math.round((j * dy) / 5) + 0.5; g.moveTo(W / 2 - tick, y); g.lineTo(W / 2 + tick, y); }
      g.stroke();
      CH.forEach((c) => {            // ground markers on the left edge
        const y = c.gnd * dy;
        g.fillStyle = c.color;
        g.beginPath();
        g.moveTo(0, y - 5 * dpr); g.lineTo(8 * dpr, y); g.lineTo(0, y + 5 * dpr);
        g.fill();
      });
    }

    let head = reduced ? 1 : 0;
    let cursor = null;
    const yOf = (c, v) => (c.gnd - v / c.per) * (H / 8);
    function plot(arr, c, i0, i1, alpha) {
      if (i1 <= i0) return;
      const sx = W / (N - 1);
      ctx.beginPath();
      ctx.moveTo(i0 * sx, yOf(c, arr[i0]));
      for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(i * sx, yOf(c, arr[i]));
      ctx.strokeStyle = c.color;
      ctx.globalAlpha = alpha * 0.2;       // soft glow under the trace
      ctx.lineWidth = 5 * dpr;
      ctx.stroke();
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 1.6 * dpr;
      ctx.stroke();
    }
    function draw() {
      if (!grid || !data) return;
      ctx.globalAlpha = 1;
      ctx.drawImage(grid, 0, 0);
      ctx.lineJoin = 'round';
      const hi = Math.round(head * (N - 1));
      const sx = W / (N - 1);
      CH.forEach((c) => {
        if (prev && hi < N - 1) plot(prev[c.key], c, hi, N - 1, 0.26);   // last sweep lingers
        plot(data[c.key], c, 0, hi, 1);
      });
      if (head > 0 && head < 1) {
        ctx.globalAlpha = 1;
        CH.forEach((c) => {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(hi * sx, yOf(c, data[c.key][hi]), 2.6 * dpr, 0, 6.2832);
          ctx.fill();
        });
      }
      if (cursor !== null) {
        const i = Math.round(cursor * (N - 1));
        const x = i * sx;
        ctx.globalAlpha = 0.65;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = dpr;
        ctx.setLineDash([4 * dpr, 4 * dpr]);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        CH.forEach((c) => {
          ctx.fillStyle = c.color;
          ctx.beginPath();
          ctx.arc(x, yOf(c, data[c.key][i]), 3.4 * dpr, 0, 6.2832);
          ctx.fill();
        });
      }
      ctx.globalAlpha = 1;
    }

    function showReadout() {
      if (!measEl) return;
      const m = MODES[mode];
      if (cursor === null) { measEl.textContent = m.meas; return; }
      const i = Math.round(cursor * (N - 1));
      const t = cursor * m.span;
      measEl.textContent = `t = ${t.toFixed(1)} ${m.unit}   VGS ${data.vgs[i].toFixed(1)} V   VDS ${Math.round(data.vds[i])} V   ID ${data.id[i].toFixed(1)} A`;
    }

    const SWEEP = 2400;
    const HOLD = 3200;
    let running = !reduced;
    let visible = false;
    let phase = 'sweep';
    let t0 = 0;
    let raf = 0;
    let dirty = true;
    function frame(now) {
      raf = 0;
      if (running) {
        if (!t0) t0 = now - (phase === 'sweep' ? head * SWEEP : 0);
        const elapsed = now - t0;
        if (phase === 'sweep') {
          head = Math.min(1, elapsed / SWEEP);
          dirty = true;
          if (head >= 1) { phase = 'hold'; t0 = now; }
        } else if (elapsed > HOLD) {
          prev = data;
          data = acquire();
          phase = 'sweep'; t0 = now; head = 0; dirty = true;
        }
      }
      if (dirty) { draw(); dirty = false; }
      if (visible && running) raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (!raf && visible) raf = requestAnimationFrame(frame); };

    function setRunning(on) {
      running = on;
      t0 = 0;
      if (runBtn) { runBtn.textContent = on ? 'Stop' : 'Run'; runBtn.setAttribute('aria-pressed', String(on)); }
      if (stateEl) { stateEl.textContent = on ? 'Run' : 'Stop'; stateEl.classList.toggle('stop', !on); }
      dirty = true;
      kick();
    }
    function setMode(next) {
      mode = next;
      prev = null;
      data = acquire();
      phase = 'sweep'; t0 = 0;
      head = running ? 0 : 1;
      if (tbEl) tbEl.textContent = MODES[mode].tb;
      if (zoomBtn) {
        zoomBtn.textContent = mode === 'edge' ? 'Show both pulses' : 'Zoom into turn-off';
        zoomBtn.setAttribute('aria-pressed', String(mode === 'edge'));
      }
      showReadout();
      dirty = true;
      kick();
    }

    function resize() {
      const r = canvas.getBoundingClientRect();
      if (!r.width) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.round(r.width * dpr);
      H = Math.round(r.height * dpr);
      canvas.width = W; canvas.height = H;
      buildGrid();
      draw();          // paint once even if the scope is off screen
      dirty = true;
      kick();
    }

    data = acquire();
    setRunning(running);
    showReadout();
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
    else window.addEventListener('resize', resize);
    resize();
    onVisible(canvas, (v) => { visible = v; t0 = 0; if (v) { dirty = true; kick(); } });

    if (runBtn) runBtn.addEventListener('click', () => setRunning(!running));
    if (zoomBtn) zoomBtn.addEventListener('click', () => setMode(mode === 'wide' ? 'edge' : 'wide'));
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      cursor = clamp((e.clientX - r.left) / r.width, 0, 1);
      showReadout();
      dirty = true;
      kick();
    });
    const clearCursor = () => { cursor = null; showReadout(); dirty = true; kick(); };
    canvas.addEventListener('pointerleave', clearCursor);
    canvas.addEventListener('pointercancel', clearCursor);

    return { refresh: () => { if (reduced) { head = 1; setRunning(false); } } };
  }

  /* ------------------------------------------------------------------ */
  /* RV32I pipeline: a cycle-accurate model of the CPU's hazard rules    */
  /*   - EX/MEM and MEM/WB forwarding, EX/MEM wins when both match       */
  /*   - load-use: hold PC and IF/ID, bubble into ID/EX (1 cycle)        */
  /*   - predict not taken, resolve in EX, flush IF/ID and ID/EX (2)     */
  /*   - register file writes before it reads (WB to ID bypass)          */
  /* ------------------------------------------------------------------ */
  const PROGRAM = [
    { op: 'addi', rd: 1, rs1: 0, imm: 5 },
    { op: 'addi', rd: 2, rs1: 0, imm: 3 },
    { op: 'add', rd: 3, rs1: 1, rs2: 2 },
    { op: 'sw', rs1: 0, rs2: 3, imm: 0 },
    { op: 'lw', rd: 4, rs1: 0, imm: 0 },
    { op: 'add', rd: 5, rs1: 4, rs2: 1 },
    { op: 'bne', rs1: 5, rs2: 3, imm: 12 },
    { op: 'addi', rd: 6, rs1: 0, imm: 1 },    // wrong path
    { op: 'addi', rd: 7, rs1: 0, imm: 1 },    // wrong path
    { op: 'sub', rd: 6, rs1: 5, rs2: 2 },     // branch target
  ];
  const OPS = {
    addi: { write: true, rs1: true },
    add: { write: true, rs1: true, rs2: true },
    sub: { write: true, rs1: true, rs2: true },
    lw: { write: true, rs1: true, load: true },
    sw: { rs1: true, rs2: true, store: true },
    bne: { rs1: true, rs2: true, branch: true },
  };
  const STAGES = ['IF', 'ID', 'EX', 'MEM', 'WB'];
  const asm = (i) => {
    if (i.op === 'addi') return `addi x${i.rd}, x${i.rs1}, ${i.imm}`;
    if (i.op === 'lw') return `lw x${i.rd}, ${i.imm}(x${i.rs1})`;
    if (i.op === 'sw') return `sw x${i.rs2}, ${i.imm}(x${i.rs1})`;
    if (i.op === 'bne') return `bne x${i.rs1}, x${i.rs2}, +${i.imm}`;
    return `${i.op} x${i.rd}, x${i.rs1}, x${i.rs2}`;
  };

  function simulatePipeline() {
    const reg = new Int32Array(8);
    const mem = {};
    const rows = [];
    const views = [];
    let pc = 0;
    let fetch = null;      // instruction in IF
    let ifid = null;       // pipeline registers: null = empty, { bubble } = nop, else an instruction
    let idex = null;
    let exmem = null;
    let memwb = null;
    const live = (s) => !!(s && s.ins);
    const ref = (s) => (!s ? null : s.ins ? { id: s.id, text: s.text } : { bubble: true });
    const BUBBLE = () => ({ bubble: true });

    for (let cycle = 1; cycle < 64; cycle++) {
      if (!fetch && PROGRAM[pc >> 2]) {
        const ins = PROGRAM[pc >> 2];
        fetch = { id: rows.length, ins, f: OPS[ins.op], pc, text: asm(ins) };
        rows.push({ text: fetch.text, cells: [], first: cycle });
      }
      if (!fetch && !live(ifid) && !live(idex) && !live(exmem) && !live(memwb)) break;

      const v = {
        cycle,
        st: [ref(fetch), ref(ifid), ref(idex), ref(exmem), ref(memwb)],
        flags: ['', '', '', '', ''],
        fa: 0, fb: 0, fra: 0, frb: 0,
        stall: false, redirect: false, wrote: 0, memWrote: false, note: '',
      };

      // WB: the register file writes in the first half of the cycle
      if (live(memwb) && memwb.f.write && memwb.ins.rd) {
        reg[memwb.ins.rd] = memwb.val;
        v.wrote = memwb.ins.rd;
        v.flags[4] = `x${memwb.ins.rd} ← ${memwb.val}`;
      }

      // MEM
      let memNext = exmem ? BUBBLE() : null;
      if (live(exmem)) {
        let val = exmem.alu;
        if (exmem.f.load) { val = mem[exmem.alu] | 0; v.flags[3] = `M[${exmem.alu}] → ${val}`; }
        if (exmem.f.store) { mem[exmem.alu] = exmem.store; v.memWrote = true; v.flags[3] = `M[${exmem.alu}] ← ${exmem.store}`; }
        memNext = { id: exmem.id, ins: exmem.ins, f: exmem.f, text: exmem.text, val };
      }

      // EX: forwarding muxes, ALU, branch resolution
      let exNext = idex ? BUBBLE() : null;
      let target = 0;
      if (live(idex)) {
        const ins = idex.ins;
        const forward = (r, fallback) => {
          if (r && live(exmem) && exmem.f.write && exmem.ins.rd === r) return [exmem.alu, 2];
          if (r && live(memwb) && memwb.f.write && memwb.ins.rd === r) return [memwb.val, 1];
          return [fallback, 0];
        };
        const [a, fa] = idex.f.rs1 ? forward(ins.rs1, idex.a) : [idex.a, 0];
        const [b, fb] = idex.f.rs2 ? forward(ins.rs2, idex.b) : [idex.b, 0];
        v.fa = fa; v.fb = fb; v.fra = ins.rs1; v.frb = ins.rs2;
        let alu = 0;
        if (idex.f.branch) {
          const taken = a !== b;
          if (taken) { v.redirect = true; target = idex.pc + ins.imm; }
          v.flags[2] = taken ? `taken, PC ← 0x${target.toString(16)}` : 'not taken';
        } else {
          alu = ins.op === 'add' ? a + b : ins.op === 'sub' ? a - b : a + ins.imm;
          v.flags[2] = idex.f.load || idex.f.store ? `addr = ${alu}` : `alu = ${alu}`;
        }
        exNext = { id: idex.id, ins, f: idex.f, text: idex.text, alu, store: b };
      }

      // ID: register read and load-use detection
      let idNext = ifid ? BUBBLE() : null;
      if (live(ifid)) {
        const ins = ifid.ins;
        v.stall = !v.redirect && live(idex) && !!idex.f.load && !!idex.ins.rd
          && ((ifid.f.rs1 && ins.rs1 === idex.ins.rd) || (ifid.f.rs2 && ins.rs2 === idex.ins.rd));
        idNext = { id: ifid.id, ins, f: ifid.f, text: ifid.text, pc: ifid.pc, a: reg[ins.rs1 || 0], b: reg[ins.rs2 || 0] };
      }

      [fetch, ifid, idex, exmem, memwb].forEach((s, i) => {
        if (!live(s)) return;
        const kind = i < 2 && v.redirect ? 'squash' : i < 2 && v.stall ? 'hold' : '';
        rows[s.id].cells[cycle] = { s: STAGES[i], kind };
        if (kind === 'squash') v.flags[i] = 'flushed';
        if (kind === 'hold') v.flags[i] = i ? 'stall' : 'hold';
      });

      const fwd = [];
      if (v.fa) fwd.push(`x${v.fra} from ${v.fa === 2 ? 'EX/MEM' : 'MEM/WB'} (ForwardA = ${v.fa})`);
      if (v.fb) fwd.push(`x${v.frb} from ${v.fb === 2 ? 'EX/MEM' : 'MEM/WB'} (ForwardB = ${v.fb})`);
      if (v.redirect) {
        v.note = `The branch resolves taken in EX. PC loads 0x${target.toString(16)} and IF.Flush turns the two wrong-path instructions into bubbles: a 2-cycle penalty.`;
      } else if (v.stall) {
        v.note = `Load-use hazard: lw is in EX and the instruction in ID needs x${idex.ins.rd}. PC and IF/ID hold while a bubble enters ID/EX.`;
      } else if (fwd.length) {
        v.note = `EX takes ${fwd.join(' and ')} instead of waiting for writeback.`;
      } else {
        v.note = cycle === 1 ? 'The first instruction is fetched.' : 'No hazards this cycle.';
      }
      v.regs = Array.from(reg);
      v.m0 = mem[0] | 0;
      views.push(v);

      // clock edge
      if (v.redirect) { pc = target; fetch = null; ifid = BUBBLE(); idex = BUBBLE(); }
      else if (v.stall) { idex = BUBBLE(); }
      else { idex = idNext; ifid = fetch; if (fetch) pc += 4; fetch = null; }
      exmem = exNext;
      memwb = memNext;
    }
    return { views, rows };
  }

  function initPipeline() {
    const host = $('#pipeline');
    if (!host) return;
    const stagesEl = $('.pipe-stages', host);
    const stageEls = $$('.stage', stagesEl);
    const wires = $('.pipe-wires', host);
    const noteEl = $('#pipe-note');
    const cycleEl = $('#pipe-cycle');
    const chart = $('#pipe-chart');
    const chartWrap = chart.parentElement;
    const regsEl = $('#pipe-regs');
    const sigEl = $('#pipe-signals');
    const playBtn = $('#pipe-play');
    const stepBtn = $('#pipe-step');
    const resetBtn = $('#pipe-reset');
    const NS = 'http://www.w3.org/2000/svg';
    const COLORS = ['#e5484d', '#f08c2e', '#d9b100', '#4fb35f', '#1fa896', '#3d9bf0', '#6f7cf7', '#a86cf0', '#e062ad', '#8a94a3'];

    const { views, rows } = simulatePipeline();
    const total = views.length;

    // pipeline diagram: one row per fetched instruction, one column per cycle
    const head = ['<caption class="sr-only">Pipeline diagram: the stage each instruction occupies in each clock cycle</caption><thead><tr><th scope="col" class="ins">Instruction</th>'];
    for (let c = 1; c <= total; c++) head.push(`<th scope="col">${c}</th>`);
    head.push('</tr></thead><tbody>');
    rows.forEach((r) => {
      head.push(`<tr><th scope="row" class="ins"><code>${r.text}</code></th>${'<td></td>'.repeat(total)}</tr>`);
    });
    head.push('</tbody>');
    chart.innerHTML = head.join('');
    const headCells = $$('thead th', chart).slice(1);
    const rowEls = $$('tbody tr', chart);
    const cellEls = rowEls.map((tr, r) => {
      const tds = $$('td', tr);
      tds.forEach((td) => td.style.setProperty('--c', COLORS[r % COLORS.length]));
      return tds;
    });

    const regNames = ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'M[0]'];
    regsEl.innerHTML = regNames.map((n) => `<li>${n}<b>0</b></li>`).join('');
    const regEls = $$('li', regsEl);
    const sigNames = ['stall', 'redirect', 'ForwardA', 'ForwardB'];
    sigEl.innerHTML = sigNames.map(() => '<li></li>').join('');
    const sigEls = $$('li', sigEl);

    let cur = 0;
    let prevIds = [];

    function drawWires(v) {
      wires.replaceChildren();
      if (!v.fa && !v.fb) return;
      const hostBox = stagesEl.getBoundingClientRect();
      const box = (i) => {
        const r = stageEls[i].getBoundingClientRect();
        return { l: r.left - hostBox.left, t: r.top - hostBox.top, r: r.right - hostBox.left, b: r.bottom - hostBox.top, w: r.width, h: r.height };
      };
      const ex = box(2);
      const horizontal = Math.abs(box(0).t - box(1).t) < 4;
      [['a', v.fa, v.fra, 0.3, 0.4], ['b', v.fb, v.frb, 0.7, 0.6]].forEach(([, f, r, into, out]) => {
        if (!f) return;
        const src = box(f === 2 ? 3 : 4);
        const depth = f === 2 ? 15 : 31;
        let d; let headPts; let lx; let ly;
        if (horizontal) {
          const sx = src.l + src.w * out;
          const dx = ex.l + ex.w * into;
          const y = ex.b + depth;
          d = `M${sx} ${src.b}V${y}H${dx}V${ex.b + 7}`;
          headPts = `${dx - 4.5},${ex.b + 9} ${dx + 4.5},${ex.b + 9} ${dx},${ex.b + 1.5}`;
          lx = sx + 7; ly = y - 4;
        } else {
          const sy = src.t + src.h * out;
          const dy = ex.t + ex.h * into;
          const x = ex.r + depth * 0.85;
          d = `M${src.r} ${sy}H${x}V${dy}H${ex.r + 7}`;
          headPts = `${ex.r + 9},${dy - 4.5} ${ex.r + 9},${dy + 4.5} ${ex.r + 1.5},${dy}`;
          lx = x + 4; ly = sy + 4;
        }
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', 'wire f' + f);
        const arrow = document.createElementNS(NS, 'polygon');
        arrow.setAttribute('points', headPts);
        arrow.setAttribute('class', 'wire-head f' + f);
        const label = document.createElementNS(NS, 'text');
        label.setAttribute('x', lx);
        label.setAttribute('y', ly);
        label.setAttribute('class', 'wire-label f' + f);
        label.textContent = 'x' + r;
        wires.append(path, arrow, label);
      });
    }

    function render() {
      const v = views[cur];
      cycleEl.textContent = v.cycle;
      noteEl.textContent = v.note;

      stageEls.forEach((el, i) => {
        const o = v.st[i];
        const inst = $('.stage-inst', el);
        const flag = $('.stage-flag', el);
        const id = o ? (o.bubble ? 'bubble' : o.id) : null;
        const code = document.createElement('code');
        let cls = 'stage';
        if (o && !o.bubble) {
          code.textContent = o.text;
          el.style.setProperty('--c', COLORS[o.id % COLORS.length]);
        } else if (o) {
          code.textContent = 'nop (bubble)';
          cls += ' bubble';
          el.style.removeProperty('--c');
        } else {
          code.textContent = 'empty';
          cls += ' empty';
          el.style.removeProperty('--c');
        }
        if (id !== prevIds[i] && id !== null && !reduced) code.className = 'enter';
        prevIds[i] = id;
        inst.replaceChildren(code);
        flag.textContent = v.flags[i];
        if (i < 2 && v.stall && o && !o.bubble) cls += ' hold';
        if (i < 2 && v.redirect && o && !o.bubble) cls += ' squash';
        if (i === 2 && v.redirect) cls += ' redirect';
        if (i === 2 && (v.fa || v.fb) && !v.redirect) cls += ' fwd';
        el.className = cls;
      });

      const sig = [v.stall ? 1 : 0, v.redirect ? 1 : 0, v.fa, v.fb];
      sigEls.forEach((el, i) => {
        el.textContent = `${sigNames[i]} = ${sig[i]}`;
        el.classList.toggle('on', !!sig[i]);
      });

      regEls.forEach((el, i) => {
        const val = i < 7 ? v.regs[i + 1] : v.m0;
        el.lastElementChild.textContent = val;
        el.classList.toggle('wr', i < 7 ? v.wrote === i + 1 : v.memWrote);
      });

      rows.forEach((row, r) => {
        rowEls[r].classList.toggle('pending', row.first > v.cycle);
        for (let c = 1; c <= total; c++) {
          const td = cellEls[r][c - 1];
          const cell = row.cells[c];
          const isCur = c === v.cycle;
          if (cell && c <= v.cycle) {
            td.textContent = cell.s;
            td.className = 'on' + (cell.kind ? ' ' + cell.kind : '') + (isCur ? ' cur' : '');
          } else {
            td.textContent = '';
            td.className = '';
          }
        }
      });
      headCells.forEach((th, i) => th.classList.toggle('cur', i + 1 === v.cycle));

      // keep the current cycle in view when the diagram scrolls sideways
      const th = headCells[v.cycle - 1];
      const wrapBox = chartWrap.getBoundingClientRect();
      const right = th.getBoundingClientRect().right - wrapBox.left + chartWrap.scrollLeft;
      if (v.cycle === 1) chartWrap.scrollLeft = 0;
      else if (right > chartWrap.scrollLeft + chartWrap.clientWidth - 8) chartWrap.scrollLeft = right - chartWrap.clientWidth + 40;

      drawWires(v);
    }

    let playing = !reduced;
    let visible = false;
    let timer = 0;
    const schedule = () => {
      clearTimeout(timer);
      if (!playing || !visible) return;
      timer = setTimeout(() => {
        cur = (cur + 1) % total;
        render();
        schedule();
      }, cur === total - 1 ? 3600 : 1500);
    };
    const setPlaying = (on) => {
      playing = on;
      playBtn.textContent = on ? 'Pause' : 'Play';
      playBtn.setAttribute('aria-pressed', String(on));
      schedule();
    };

    playBtn.addEventListener('click', () => setPlaying(!playing));
    stepBtn.addEventListener('click', () => { setPlaying(false); cur = (cur + 1) % total; render(); });
    resetBtn.addEventListener('click', () => { setPlaying(false); cur = 0; prevIds = []; render(); });

    setPlaying(playing);
    render();
    onVisible(host, (v) => { visible = v; schedule(); }, '-15% 0px -15% 0px');
    if ('ResizeObserver' in window) new ResizeObserver(() => drawWires(views[cur])).observe(stagesEl);

    return { refresh: () => { if (reduced) setPlaying(false); } };
  }

  /* ------------------------------------------------------------------ */
  /* Card tilt                                                           */
  /* ------------------------------------------------------------------ */
  function initTilt() {
    if (!finePointer) return;
    $$('.tilt').forEach((card) => {
      let raf = 0;
      let last = null;
      const reset = () => {
        card.classList.remove('tilting');
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      };
      card.addEventListener('pointermove', (e) => {
        if (reduced || e.pointerType !== 'mouse') return;
        last = e;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const r = card.getBoundingClientRect();
          const x = (last.clientX - r.left) / r.width;
          const y = (last.clientY - r.top) / r.height;
          card.style.setProperty('--ry', ((x - 0.5) * 6).toFixed(2) + 'deg');
          card.style.setProperty('--rx', ((0.5 - y) * 5).toFixed(2) + 'deg');
          card.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
          card.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
          card.classList.add('tilting');
        });
      });
      card.addEventListener('pointerleave', reset);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Lightbox: zoomable photos and click-to-load video                   */
  /* ------------------------------------------------------------------ */
  function initLightbox() {
    const dialog = $('#lightbox');
    if (!dialog || typeof dialog.showModal !== 'function') return;   // links fall back to opening normally
    const body = $('.lightbox-body', dialog);
    const open = (node, isVideo) => {
      body.replaceChildren(node);
      body.classList.toggle('video', isVideo);
      dialog.showModal();
    };
    document.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      const yt = e.target.closest('a[data-yt]');
      const zoom = e.target.closest('a[data-zoom]');
      if (yt) {
        e.preventDefault();
        const frame = document.createElement('iframe');
        frame.src = `https://www.youtube-nocookie.com/embed/${yt.dataset.yt}?autoplay=1&playsinline=1&rel=0`;
        frame.title = yt.dataset.title || 'Video';
        frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        frame.allowFullscreen = true;
        open(frame, true);
      } else if (zoom) {
        e.preventDefault();
        const img = new Image();
        img.src = zoom.getAttribute('href');
        const thumb = $('img', zoom);
        img.alt = thumb ? thumb.alt : '';
        open(img, false);
      }
    });
    $('.lightbox-close', dialog).addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => body.replaceChildren());   // also stops video playback
  }

  /* ------------------------------------------------------------------ */
  const parts = [initTraces, initScope, initPipeline, initTilt, initLightbox].map((init) => {
    try { return init(); } catch (err) { console.error(err); return null; }
  });

  motionQuery.addEventListener('change', (e) => {
    reduced = e.matches;
    if (reduced) {
      root.classList.remove('reveal-ready');
      revealEls.forEach((el) => el.classList.add('in'));
    }
    parts.forEach((p) => {
      if (!p) return;
      if (p.rebuild) p.rebuild();
      if (p.refresh) p.refresh();
    });
  });
})();