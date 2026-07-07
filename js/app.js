// js/app.js — Orchestration, animation loops, events

(function () {
  // ── State ──────────────────────────────────────────────────
  let page = 'title';                // 'title' | 'pipeline'
  let titleCanvas, tCtx;
  let pipeCanvas, pCtx;
  let layout  = null;
  let leaks   = null;               // working copy (modified on fix/toggle)
  let particles  = [];
  let titleDots  = [];
  let bucketCounts = {};            // cumulative careers placed per bucket
  let raf        = null;
  let titleRaf   = null;
  let lastSpawn  = 0;
  let mouseX = 0, mouseY = 0;
  let mouseInCanvas = false;
  let layerHoverAlpha = { discovery: 0, caring: 0, upskilling: 0, jobs: 0 };
  let hoveredParticle = null;
  let hoveredChannelIdx = null;     // entry-channel hovered
  let leakHitZones    = [];         // rebuilt each frame
  let infoHitZones     = [];        // rebuilt each frame
  let selectedLeak    = null;
  let hoveredInfoId    = null;       // id of the tank/bucket currently shown in the info panel via hover
  let mouseOverPanel   = false;      // true while the cursor is over the panel DOM itself
  let titleReady = false;

  // ── Init ───────────────────────────────────────────────────
  function init() {
    // Deep-copy leaks so original LEAKS const is not mutated
    leaks = LEAKS.map(l => Object.assign({}, l));

    JOB_BUCKETS.forEach(b => { bucketCounts[b.id] = 0; });

    wireEvents();

    if (window.innerWidth >= 1100) {
      initTitle();
    }

    window.addEventListener('resize', handleResize);
  }

  function handleResize() {
    if (window.innerWidth < 1100) return;
    if (page === 'title') {
      if (!titleReady) {
        initTitle();
      } else {
        resizeTitleCanvas();
      }
    }
  }

  // ── Title page ─────────────────────────────────────────────
  function initTitle() {
    titleCanvas = document.getElementById('title-canvas');
    tCtx = titleCanvas.getContext('2d');
    resizeTitleCanvas();
    spawnTitleDots();
    titleReady = true;
    titleRaf = requestAnimationFrame(animateTitle);
  }

  function resizeTitleCanvas() {
    titleCanvas.width  = window.innerWidth;
    titleCanvas.height = window.innerHeight;
  }

  function spawnTitleDots() {
    titleDots = [];
    for (let i = 0; i < 90; i++) {
      titleDots.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.6,
        vy: 0.25 + Math.random() * 0.7,
        r: 2.5 + Math.random() * 3.5,
        color: PERSON_TYPES[Math.floor(Math.random() * PERSON_TYPES.length)].color,
        alpha: 0.15 + Math.random() * 0.25,
      });
    }
  }

  function animateTitle() {
    if (page !== 'title') return;
    const w = titleCanvas.width, h = titleCanvas.height;
    tCtx.fillStyle = CONFIG.BG_TOP;
    tCtx.fillRect(0, 0, w, h);

    titleDots.forEach(d => {
      d.x += d.vx; d.y += d.vy;
      if (d.y > h + 10) { d.y = -10; d.x = Math.random() * w; }
      if (d.x < -10 || d.x > w + 10) { d.x = Math.random() * w; d.y = Math.random() * h; }
      tCtx.save();
      tCtx.globalAlpha = d.alpha;
      tCtx.fillStyle   = d.color;
      tCtx.beginPath();
      tCtx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      tCtx.fill();
      tCtx.restore();
    });

    titleRaf = requestAnimationFrame(animateTitle);
  }

  // ── Pipeline page ──────────────────────────────────────────
  function initPipeline() {
    pipeCanvas = document.getElementById('pipeline-canvas');
    pCtx = pipeCanvas.getContext('2d');

    // Leave a little room for #pipeline-wrap's own vertical scrollbar so
    // a viewport-width canvas doesn't itself trigger horizontal scrolling.
    const minW = Math.max(window.innerWidth - 20, CONFIG.CANVAS_WIDTH);
    layout = computeLayout(minW);
    CONFIG.CENTER_X = layout.cx;

    pipeCanvas.width  = layout.width;
    pipeCanvas.height = layout.height;
    pipeCanvas.style.width  = layout.width  + 'px';
    pipeCanvas.style.height = layout.height + 'px';

    buildLegend();
    particles  = [];
    JOB_BUCKETS.forEach(b => {
      bucketCounts[b.id] = 0;
      const bl = layout.buckets[b.id];
      bl.columns.fill(bl.bottom - CONFIG.PARTICLE_RADIUS - 2);
    });
    lastSpawn  = performance.now();
    raf = requestAnimationFrame(animatePipeline);
  }

  function buildLegend() {
    const el = document.getElementById('header-legend');
    el.innerHTML = '';
    PERSON_TYPES.forEach(t => {
      const d = document.createElement('div');
      d.className = 'legend-item';
      d.innerHTML = `<span class="legend-dot" style="background:${t.color}"></span><span>${t.label}</span>`;
      el.appendChild(d);
    });
  }

  function animatePipeline(now) {
    if (page !== 'pipeline') return;

    if (now - lastSpawn > CONFIG.SPAWN_INTERVAL) {
      for (let i = 0; i < CONFIG.SPAWN_PER_TICK; i++) spawnParticle();
      lastSpawn = now;
    }

    // Depth layers double as the page background — each solid band's
    // description only fades in while the cursor is somewhere within its
    // vertical range, regardless of x.
    const hoveredLayerId = mouseInCanvas ? _layerIdAt(mouseY, layout) : null;
    Object.keys(layerHoverAlpha).forEach(id => {
      const target = id === hoveredLayerId ? 1 : 0;
      layerHoverAlpha[id] += (target - layerHoverAlpha[id]) * 0.08;
    });
    _drawBackgroundLayers(pCtx, layout, layerHoverAlpha);

    leakHitZones = [];
    infoHitZones = [];

    // Update every particle first, then draw everything in the right
    // z-order — otherwise ghosts drawn before this frame's update would
    // lag a frame behind the (already-updated) pipeline particles.
    const dead = [];
    particles.forEach((p, i) => {
      p.update(layout, leaks);
      if (p.state === 'dead') { dead.push(i); return; }

      if (p.state === 'inBucket' && p._settled && !p._counted) {
        p._counted = true;
        bucketCounts[p.targetBucket] = (bucketCounts[p.targetBucket] || 0) + 1;
        const bl = layout.buckets[p.targetBucket];
        const idx = p._pileCol || 0;
        bl.columns[idx] = Math.max(bl.top + CONFIG.PARTICLE_RADIUS + 4, bl.columns[idx] - CONFIG.PARTICLE_RADIUS * 2.1 - Math.random() * 1.5);
      }
    });
    for (let i = dead.length - 1; i >= 0; i--) particles.splice(dead[i], 1);

    const tankOccupancy = { tank1: 0, tank2: 0 };
    particles.forEach(p => {
      if (p.state === 'inTank') tankOccupancy[p._tankId] = (tankOccupancy[p._tankId] || 0) + 1;
    });
    layout.tank1.occupancy = tankOccupancy.tank1;
    layout.tank2.occupancy = tankOccupancy.tank2;

    // Ghost rain is pure background — draw it before the opaque tanks and
    // pipes so they naturally occlude it, instead of ghosts appearing to
    // float through/over the tanks.
    particles.forEach(p => { if (p.isGhost) p.draw(pCtx); });

    drawPipeline(pCtx, layout, leaks, bucketCounts, tankOccupancy, leakHitZones, infoHitZones);

    hoveredParticle = null;
    hoveredChannelIdx = null;

    particles.forEach(p => {
      if (p.isGhost) return;
      p.draw(pCtx);
      if (!hoveredParticle) {
        const dx = mouseX - p.x, dy = mouseY - p.y;
        if (dx*dx + dy*dy < (p.radius + 5) * (p.radius + 5)) {
          hoveredParticle = p;
        }
      }
    });

    // Drawn after every particle so a falling droplet passes behind the
    // label text (still legible) instead of the label disappearing under
    // whatever happens to be falling through that spot.
    _drawEntryChannelLabels(pCtx, layout);

    // Independent of hoveredParticle for the same reason as the leak/tank
    // panel below — funnels are full of falling droplets, so gating this
    // on "no particle currently hovered" silently blocked the channel
    // tooltip most of the time, especially when moving the mouse quickly.
    for (const zone of leakHitZones) {
      if (zone.type === 'funnelSeg') {
        if (mouseX >= zone.x && mouseX <= zone.x + zone.w &&
            mouseY >= zone.y && mouseY <= zone.y + zone.h) {
          hoveredChannelIdx = zone.segIdx;
          break;
        }
      }
    }

    // Channel tooltip takes priority over a particle tooltip when both
    // apply at once, so the two boxes never try to render on top of
    // each other.
    if (hoveredChannelIdx !== null) {
      const seg = ENTRY_CHANNELS[hoveredChannelIdx];
      drawChannelTooltip(pCtx, seg, mouseX, mouseY, pipeCanvas.width);
    } else if (hoveredParticle) {
      hoveredParticle.drawTooltip(pCtx);
    }

    // Independent of hoveredParticle: tanks are full of floating droplets,
    // so gating this on "no particle currently hovered" meant the cursor
    // coinciding with any one of them (very likely, moving fast or slow)
    // silently blocked the tank/leak panel from ever appearing.
    const hitLeak = _findLeakAt(mouseX, mouseY);
    const hitZone = hitLeak ? null : _findInfoZoneAt(mouseX, mouseY);
    _updateInfoPanelHover(hitLeak, hitZone ? hitZone.id : null);

    raf = requestAnimationFrame(animatePipeline);
  }

  // Which depth layer a given canvas y-coordinate falls in — x doesn't
  // matter, the layers are full-width bands.
  function _layerIdAt(y, layout) {
    if (y < layout.tank1.bottom) return 'discovery';
    if (y < layout.tank2.bottom) return 'caring';
    if (y < layout.distribRailY) return 'upskilling';
    return 'jobs';
  }

  // ── Particle spawning ──────────────────────────────────────
  function spawnParticle() {
    if (particles.length >= CONFIG.MAX_PARTICLES) return;

    let rng = Math.random(), pType = PERSON_TYPES[PERSON_TYPES.length - 1];
    for (const t of PERSON_TYPES) {
      rng -= t.weight;
      if (rng <= 0) { pType = t; break; }
    }

    const isPipeline = Math.random() < CONFIG.FUNNEL_CAPTURE_RATE;
    const isGhost    = !isPipeline && Math.random() < CONFIG.GHOST_CHANCE;
    if (!isPipeline && !isGhost) return;

    let spawnX;
    if (isPipeline) {
      const chIdx = _pickChannel(pType);
      const ch = layout.channels[chIdx];
      spawnX = ch.left + Math.random() * ch.topWidth;
      const p = new Particle(spawnX, pType);
      p.isPipeline = true;
      p.isGhost = false;
      p.channelIdx = chIdx;
      p.targetBucket = _pickBucket(pType);
      particles.push(p);
    } else {
      spawnX = 30 + Math.random() * (layout.width - 60);
      const p = new Particle(spawnX, pType);
      p.isPipeline = false;
      p.isGhost = true;
      particles.push(p);
    }
  }

  function _pickChannel(pType) {
    const keys = ENTRY_CHANNELS.map(s => s.id);
    const w    = pType.funnelWeights;
    let rng = Math.random();
    for (let i = 0; i < keys.length; i++) {
      rng -= (w[keys[i]] || 0);
      if (rng <= 0) return i;
    }
    return 0;
  }

  function _pickBucket(pType) {
    const w   = pType.bucketWeights;
    const keys = Object.keys(w);
    let rng = Math.random();
    for (const k of keys) { rng -= w[k]; if (rng <= 0) return k; }
    return keys[0];
  }

  // ── Events ─────────────────────────────────────────────────
  function wireEvents() {
    document.getElementById('start-btn').addEventListener('click', () => {
      page = 'pipeline';
      document.getElementById('title-page').classList.remove('active');
      document.getElementById('pipeline-page').classList.add('active');
      if (titleRaf) cancelAnimationFrame(titleRaf);
      setTimeout(initPipeline, 60);
    });

    document.getElementById('back-btn').addEventListener('click', () => {
      page = 'title';
      document.getElementById('pipeline-page').classList.remove('active');
      document.getElementById('title-page').classList.add('active');
      if (raf) cancelAnimationFrame(raf);
      hideLeakPanel();
      particles = [];
      JOB_BUCKETS.forEach(b => { bucketCounts[b.id] = 0; });
      if (window.innerWidth >= 1100) {
        if (!titleReady) initTitle();
        else titleRaf = requestAnimationFrame(animateTitle);
      }
    });

    const wrap = document.getElementById('pipeline-wrap');
    wrap.addEventListener('mousemove', e => {
      if (page !== 'pipeline' || !pipeCanvas) return;
      const rect = pipeCanvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      mouseInCanvas = true;
    });
    wrap.addEventListener('mouseleave', () => { mouseInCanvas = false; });

    // Clicking a leak indicator toggles its fixed state directly — the
    // panel is purely informational now, with no button of its own.
    wrap.addEventListener('click', e => {
      if (page !== 'pipeline' || !pipeCanvas) return;
      const rect = pipeCanvas.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      const hitLeak = _findLeakAt(cx, cy);
      if (hitLeak) {
        hitLeak.fixed = !hitLeak.fixed;
        showLeakPanel(hitLeak);
      }
    });

    // Keep the panel open while the cursor is over it, even though the
    // canvas hover that originally opened it has ended.
    const panelEl = document.getElementById('leak-panel');
    panelEl.addEventListener('mouseenter', () => { mouseOverPanel = true; });
    panelEl.addEventListener('mouseleave', () => { mouseOverPanel = false; });
  }

  // Info panels are hover-driven: called every frame with whatever the
  // cursor is currently over (at most one of the two is non-null).
  function _updateInfoPanelHover(hitLeak, hitZoneId) {
    if (hitLeak) {
      hoveredInfoId = null;
      if (selectedLeak !== hitLeak) showLeakPanel(hitLeak);
    } else if (hitZoneId) {
      if (hoveredInfoId !== hitZoneId || selectedLeak) { selectedLeak = null; showInfoPanel(hitZoneId); }
      hoveredInfoId = hitZoneId;
    } else if (!mouseOverPanel && (selectedLeak || hoveredInfoId)) {
      selectedLeak = null;
      hoveredInfoId = null;
      hideLeakPanel();
    }
  }

  function _findLeakAt(cx, cy) {
    for (const zone of leakHitZones) {
      if (zone.type !== 'leak') continue;
      const dx = cx - zone.x, dy = cy - zone.y;
      if (dx*dx + dy*dy < zone.r * zone.r) return zone.leak;
    }
    return null;
  }

  function _findInfoZoneAt(cx, cy) {
    for (const zone of infoHitZones) {
      if (cx >= zone.x && cx <= zone.x + zone.w && cy >= zone.y && cy <= zone.y + zone.h) return zone;
    }
    return null;
  }

  // ── Leak panel ─────────────────────────────────────────────
  function showLeakPanel(leak) {
    selectedLeak = leak;
    document.getElementById('leak-tag').textContent = 'Pipeline Leak';
    document.getElementById('leak-title').textContent    = leak.title;
    document.getElementById('leak-problem').textContent  = leak.problem;
    document.getElementById('leak-solution').textContent = leak.solution;
    document.getElementById('leak-impact').textContent   = leak.impactNote;

    const wrap = document.getElementById('leak-solution-wrap');
    const hint = document.getElementById('leak-hint');

    if (leak.fixed) {
      wrap.classList.remove('hidden');
      hint.textContent = 'Click the leak again to reopen it.';
    } else {
      wrap.classList.add('hidden');
      hint.textContent = 'Click the leak to apply a partial fix.';
    }

    _openPanel();
  }

  function showInfoPanel(id) {
    selectedLeak = null;
    document.getElementById('leak-solution-wrap').classList.add('hidden');
    document.getElementById('leak-hint').textContent = '';

    const bucket = JOB_BUCKETS.find(b => b.id === id);
    if (!bucket) return;
    document.getElementById('leak-tag').textContent = 'Career Path';
    document.getElementById('leak-title').textContent = bucket.label;
    document.getElementById('leak-problem').textContent = bucket.theoryOfChange;

    _openPanel();
  }

  function _openPanel() {
    const panel = document.getElementById('leak-panel');
    panel.classList.remove('hidden');
    setTimeout(() => panel.classList.add('visible'), 10);
  }

  function hideLeakPanel() {
    const panel = document.getElementById('leak-panel');
    panel.classList.remove('visible');
    setTimeout(() => panel.classList.add('hidden'), 130);
    selectedLeak = null;
  }

  // ── Boot ───────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
