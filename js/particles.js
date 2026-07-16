// js/particles.js — Particle class: rolls along fixed pipe paths rather
// than free-floating physics. Only the sky (rain) and funnel taper use
// force-based motion; everything inside a constant-diameter pipe follows
// a precomputed polyline at a steady roll speed with a small perpendicular
// wobble, and tanks are a gentle roll-to-a-stop with no bounce.

class Particle {
  constructor(x, personType) {
    this.x = x;
    this.y = -8;
    this.vx = (Math.random() - 0.5) * 1.5;
    this.vy = 0.2 + Math.random() * 0.5;
    this.type = personType;
    this.state = 'sky';       // sky | channelFunnel | following | inTank | inBucket | leaked | dead
    this.alpha = 1.0;
    this.radius = CONFIG.PARTICLE_RADIUS;

    this.isPipeline = false;
    this.isGhost = false;
    this.channelIdx = 0;
    this.targetBucket = null;
    this._wobbleSeed = Math.random() * 100;

    // Path-following state (set by _startFollow)
    this._path = null;
    this._segLens = null;
    this._pathTotalLen = 0;
    this._pathDist = 0;
    this._leakMarks = [];
    this._arrive = null;

    // Tank dwell state
    this._tankId = null;
    this._dwell = 0;
    this._dwellTimer = 0;
    this._settled = false;
    this._counted = false;
    this._pileSearched = false;
    this._cornerLeaking = false;
  }

  // ── Core update dispatcher ──────────────────────────────────
  update(layout, leaks) {
    if (this.state === 'dead') return;

    this.vy = Math.min(this.vy + CONFIG.GRAVITY, 4.5);

    switch (this.state) {
      case 'sky':          this._updateSky(layout); break;
      case 'channelFunnel': this._updateChannelFunnel(layout, leaks); break;
      case 'following':    this._updateFollowing(layout, leaks); break;
      case 'inTank':       this._updateInTank(layout, leaks); break;
      case 'inBucket':     this._updateInBucket(layout); break;
      case 'leaked':       this._updateLeaked(layout); break;
    }

    if (this.state === 'sky' || this.state === 'channelFunnel' || this.state === 'leaked') {
      this.x += this.vx;
      this.y += this.vy;
    }
  }

  // ── Sky (rain) ───────────────────────────────────────────────
  // Falls straight down — only the same small undirected jitter every
  // droplet has, never anything aimed at a target. Whether a pipeline-
  // bound droplet actually enters its assigned funnel is decided purely
  // by where it physically ends up once it reaches that funnel's own
  // row: still within the mouth, it's caught; drifted outside it, it
  // just falls on past and is lost, the same as any other miss — nothing
  // reaches back into the sky to steer it there.
  _updateSky(layout) {
    this.vx += (Math.random() - 0.5) * 0.04;
    this.vx *= CONFIG.DAMPING;

    if (this.x < -40 || this.x > layout.width + 40) {
      this.state = 'dead'; return;
    }

    if (this.isPipeline) {
      const ch = layout.channels[this.channelIdx];
      if (this.y >= ch.top) {
        if (this.x >= ch.left && this.x <= ch.right) {
          this.state = 'channelFunnel';
        } else {
          this.state = 'leaked';
        }
      }
    } else if (this.y >= layout.channels[0].top) {
      this.state = 'leaked';
    }
  }

  // ── Funnel taper: caught by the funnel, rolls down the sides onto
  // the channel's own pipe centerline ───────────────────────────
  _updateChannelFunnel(layout, leaks) {
    const ch = layout.channels[this.channelIdx];
    this.vy = Math.min(this.vy, 2.5);

    // Direct easing (never overshoots) rather than a spring force, so
    // there is no oscillation while rolling down the funnel wall onto
    // the pipe centerline.
    this.x += (ch.centerX - this.x) * 0.12;

    if (this.y >= ch.bottom) {
      // A channel's category can carry several leaks (e.g. Fellowships) —
      // ch.leakMarkDists holds one checkpoint distance per leak, in the
      // same order the layout spaced their marks along the shared trunk.
      const groupLeaks = leaks.filter(l => l.stage === 'funnel' && l.channels.includes(ch.id));
      const marks = groupLeaks.map((leak, i) => ({ dist: ch.leakMarkDists[i], leak }))
        .filter(m => m.dist !== undefined);
      this.x = ch.centerX;
      this.y = ch.bottom;
      this._startFollow(ch.path, marks, 'tank1');
    }
  }

  // ── Generic constant-speed path follower ─────────────────────
  _startFollow(path, leakMarks, arriveState) {
    this._path = path;
    this._segLens = [];
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const dx = path[i + 1].x - path[i].x, dy = path[i + 1].y - path[i].y;
      const len = Math.sqrt(dx * dx + dy * dy);
      this._segLens.push(len);
      total += len;
    }
    this._pathTotalLen = total;
    this._pathDist = 0;
    this._leakMarks = leakMarks.map(m => ({ dist: m.dist, leak: m.leak, done: false }));
    this._arrive = arriveState;
    this.state = 'following';
  }

  _updateFollowing(layout, leaks) {
    // Re-materialize after a dissolve (harmless no-op otherwise, since
    // alpha is already 1 for a particle's first-ever trip through a pipe).
    this.alpha = Math.min(1, this.alpha + 0.02);

    this._pathDist += CONFIG.ROLL_SPEED;

    for (const m of this._leakMarks) {
      if (m.done || this._pathDist < m.dist) continue;
      m.done = true;
      const rate = m.leak.fixed ? m.leak.fixedEscapeRate : m.leak.escapeRate;
      const severity = CONFIG.LEAK_SEVERITY[m.leak.stage] || 1.5;
      if (Math.random() < Math.min(0.97, rate * severity)) { this._doLeak(m.leak.stage === 'funnel'); return; }
    }

    if (this._pathDist >= this._pathTotalLen) {
      const last = this._path[this._path.length - 1];
      const prev = this._path[this._path.length - 2] || last;
      const dx = last.x - prev.x, dy = last.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      this.x = last.x; this.y = last.y;
      // Carry momentum from the pipe into the tank/bucket instead of
      // snapping to rest — gravity takes over from here.
      this.vx = (dx / len) * CONFIG.ROLL_SPEED;
      this.vy = (dy / len) * CONFIG.ROLL_SPEED;
      if (this._arrive === 'tank1') this._enterTank(layout, 'tank1');
      else if (this._arrive === 'tank2') this._enterTank(layout, 'tank2');
      else if (this._arrive === 'bucket') this._enterBucket(layout);
      return;
    }

    let d = this._pathDist, segIdx = 0;
    while (segIdx < this._segLens.length - 1 && d > this._segLens[segIdx]) {
      d -= this._segLens[segIdx];
      segIdx++;
    }
    const p0 = this._path[segIdx], p1 = this._path[segIdx + 1];
    const segLen = this._segLens[segIdx] || 1;
    const t = Math.min(1, d / segLen);
    const baseX = p0.x + (p1.x - p0.x) * t;
    const baseY = p0.y + (p1.y - p0.y) * t;

    const dx = p1.x - p0.x, dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const perpX = -dy / len, perpY = dx / len;
    const wobble = Math.sin(this._pathDist * 0.05 + this._wobbleSeed) * (CONFIG.PIPE_WIDTH * 0.045);
    this.x = baseX + perpX * wobble;
    this.y = baseY + perpY * wobble;
  }

  // ── Tanks: fall in naturally, dwell in the pool, then drain onward ──
  _enterTank(layout, tankId) {
    const tank = layout[tankId];
    this.state = 'inTank';
    this._tankId = tankId;
    this._dwell = CONFIG.DWELL_MIN + Math.random() * (CONFIG.DWELL_MAX - CONFIG.DWELL_MIN);
    this._dwellTimer = 0;
    this._settled = false;
    // Reset from any earlier tank visit — otherwise a particle arriving
    // at tank2 still carries _touchedSurface=true from tank1 and skips
    // the fall phase entirely, sliding at whatever height it entered.
    this._touchedSurface = false;
    // All entries arrive at the same wall, so without a pull toward a
    // spread-out target they'd all cluster near it — give each droplet
    // its own randomized landing spot across the surface.
    this._tankTargetX = tank.left + 15 + Math.random() * (tank.width - 30);
  }

  _updateInTank(layout, leaks) {
    const tank = layout[this._tankId];

    if (!this._settled) {
      if (!this._touchedSurface) {
        // Settle onto the *displayed* water surface (the same eased value
        // drawn on screen), so droplets fall all the way to the bottom
        // while the tank is still empty and only rest higher once real
        // water has visually accumulated there.
        const dispFill = tank._dispFill || 0;
        const innerTop = tank.top + 4, innerBottom = tank.bottom - 4;
        const pileY = innerBottom - (innerBottom - innerTop) * dispFill;
        this._physicsSettle(tank, pileY);
        if (this._touchedSurface) this._slideTimer = 0;
        return;
      }

      // All entries arrive at the same wall, so a droplet that landed
      // right there would just sit in a cluster — glide it along the
      // surface toward its own randomized spot before coming to rest.
      // This happens at a fixed rate regardless of how long the fall
      // was, so droplets that barely fell still spread out.
      this._slideTimer++;
      const dx = this._tankTargetX - this.x;
      if (Math.abs(dx) > 3 && this._slideTimer < 200) {
        this.x += Math.sign(dx) * Math.min(Math.abs(dx), 2.2);
      } else {
        this._settled = true;
        this._restX = this.x;
        this._restY = this.y;
      }
      return;
    }

    this._dwellTimer++;

    // Tank1 has its own dwelling leak — a steady drip out the bottom-left
    // corner, independent of the conn1 pipe leaks (which only apply once
    // a droplet actually starts draining onward). Rolled once per frame
    // rather than at a path checkpoint, since dwelling is time-based, not
    // distance-based.
    if (this._tankId === 'tank1') {
      if (this._cornerLeaking) {
        // Dissolve in place and rematerialize at the corner, the same way
        // a droplet already fades out before draining onward to tank2 —
        // eased movement across the whole tank read as an unnatural zoom
        // for droplets that could be triggering from anywhere inside it.
        this.alpha = Math.max(0, this.alpha - 0.05);
        if (this.alpha <= 0.02) {
          this.x = tank.left + 14;
          this.y = tank.bottom - 6;
          this._doLeak(true);
        }
        return;
      }
      const quietLeak = leaks.find(l => l.id === 'quiet_disengagement');
      const rate = quietLeak ? (quietLeak.fixed ? quietLeak.fixedEscapeRate : quietLeak.escapeRate) : 0;
      if (Math.random() < rate) {
        this._cornerLeaking = true;
        return;
      }
    }

    // Natural floating: slow, gentle drift plus a soft pull back toward
    // the resting spot — calm wandering, not bobbing/bouncing in place.
    this.vx += (Math.random() - 0.5) * 0.01 + (this._restX - this.x) * 0.008;
    this.vy += (Math.random() - 0.5) * 0.008 + (this._restY - this.y) * 0.008;
    this.vx *= 0.92; this.vy *= 0.92;
    this.x += this.vx; this.y += this.vy;
    // Bounce off the tank walls rather than just clamping position, so
    // horizontal momentum carries through the bounce instead of vanishing.
    const margin = this.radius + 2;
    if (this.x < tank.left + margin) { this.x = tank.left + margin; this.vx = Math.abs(this.vx) * 0.85; }
    else if (this.x > tank.right - margin) { this.x = tank.right - margin; this.vx = -Math.abs(this.vx) * 0.85; }
    this.y = Math.max(tank.top + margin, Math.min(tank.bottom - margin, this.y));

    // Start fading out before the float is "done" — the fade overlaps the
    // tail of the dwell (still drifting/bobbing) rather than waiting for
    // movement to finish first and only then dissolving.
    const fadeStart = Math.max(0, this._dwell - CONFIG.DISSOLVE_FRAMES);
    if (this._dwellTimer > fadeStart) {
      this.alpha = Math.max(0, 1 - (this._dwellTimer - fadeStart) / CONFIG.DISSOLVE_FRAMES);
    }
    if (this._dwellTimer < this._dwell || this.alpha > 0.02) return;

    if (this._tankId === 'tank1') {
      const laneIdx = Math.floor(Math.random() * layout.conn1.lanes.length);
      const lane = layout.conn1.lanes[laneIdx];
      const caringLeaks = leaks.filter(l => l.stage === 'caring');
      const marks = layout.conn1.leakPoints
        .filter(p => p.laneIdx === laneIdx)
        .map(p => ({ dist: p.dist, leak: caringLeaks[p.leakIdx] }))
        .filter(m => m.leak);
      this._startFollowFrom(lane.path, marks, 'tank2');
    } else {
      const bl = layout.buckets[this.targetBucket];
      const laneIdx = Math.floor(Math.random() * layout.conn2.lanes.length);
      const lane = layout.conn2.lanes[laneIdx];
      const laneX = lane.path[1].x;
      const railLegLen = Math.abs(bl.centerX - laneX);
      const branchLen = bl.top - layout.distribRailY;

      const upskillLeaks = leaks.filter(l => l.stage === 'upskilling');
      const marks = layout.conn2.leakPoints
        .filter(p => p.laneIdx === laneIdx)
        .map(p => ({ dist: p.dist, leak: upskillLeaks[p.leakIdx] }))
        .filter(m => m.leak);
      const jobLeak = leaks.find(l => l.stage === 'jobs' && l.bucket === this.targetBucket);
      if (jobLeak) marks.push({ dist: layout.conn2.len + railLegLen + branchLen * 0.5, leak: jobLeak });
      // The rail-wide job-decision leak (fellowship hopping) sits on the
      // distribution rail before the first bucket, so every droplet passes
      // its checkpoint on the way to whichever bucket it chose.
      const railLeak = leaks.find(l => l.stage === 'jobs' && l.rail);
      if (railLeak && layout.railLeakX > laneX) {
        marks.push({ dist: layout.conn2.len + (layout.railLeakX - laneX), leak: railLeak });
      }
      // Invisible supply-gap attrition on undersupplied bucket branches —
      // the field simply fails to deliver most people into these paths, so
      // droplets drip out of the branch with no clickable marker. Rates in
      // CONFIG.BUCKET_SHORTFALL are tuned for ~1 arrival per 20 reaching
      // Technical Research.
      // Placed at the same branch depth as the bucket's drawn leak marker
      // (0.5), so the visible drip exits right where the marker explains it.
      const shortfall = CONFIG.BUCKET_SHORTFALL[this.targetBucket];
      if (shortfall) {
        marks.push({ dist: layout.conn2.len + railLegLen + branchLen * 0.5,
          leak: { stage: 'shortfall', escapeRate: shortfall, fixedEscapeRate: shortfall, fixed: false } });
      }

      const path = [
        lane.path[0], lane.path[1],
        { x: bl.centerX, y: layout.distribRailY },
        { x: bl.centerX, y: bl.top },
      ];
      this._startFollowFrom(path, marks, 'bucket');
    }
  }

  // Like _startFollow, but prepends a lead-in segment from wherever the
  // droplet actually is right now to the pipe's real starting point —
  // otherwise draining from a tank would snap the droplet's position
  // straight to the outlet, which reads as a sudden teleport/"shoot"
  // once it fades back into view.
  _startFollowFrom(path, marks, arriveState) {
    const start = { x: this.x, y: this.y };
    const lead = Math.hypot(path[0].x - start.x, path[0].y - start.y);
    const adjustedMarks = marks.map(m => ({ dist: m.dist + lead, leak: m.leak }));
    this._startFollow([start, ...path], adjustedMarks, arriveState);
  }

  // ── Terminal bucket: fall in naturally and come to rest, no bounce ──
  _enterBucket(layout) {
    const bl = layout.buckets[this.targetBucket];
    if (!bl) { this.state = 'dead'; return; }
    this.state = 'inBucket';
    this._settled = false;
    // Must reset, not just _settled — a particle that already fell and
    // landed once (in a tank) carries this flag in as true, which made
    // _updateInBucket immediately treat its entry point as final instead
    // of falling to the pile below (same bug class as the tank1->tank2
    // _enterTank fix).
    this._touchedSurface = false;
  }

  _updateInBucket(layout) {
    if (this._settled) return;
    const bl = layout.buckets[this.targetBucket];
    if (!bl) { this.state = 'dead'; return; }

    // Each horizontal slot tracks its own pile height, rather than every
    // droplet sharing one flat rising plane, so the pile looks like a
    // natural uneven heap instead of stacked layers.
    const nCols = bl.columns.length;
    const colW = bl.width / nCols;
    let colIdx = Math.max(0, Math.min(nCols - 1, Math.floor((this.x - bl.left) / colW)));

    // Just before actually touching down, check a small neighborhood of
    // slots and drift toward whichever has the most open room — the way
    // a falling ball settles into the nearest low gap in a heap instead
    // of balancing exactly above wherever it happened to be falling. Only
    // done once (not re-checked every frame) so it can't loop forever.
    if (!this._pileSearched && this.y >= bl.columns[colIdx] - this.radius * 5) {
      this._pileSearched = true;
      const reach = 4;
      let bestIdx = colIdx, bestY = bl.columns[colIdx];
      for (let d = -reach; d <= reach; d++) {
        const ci = colIdx + d;
        if (ci < 0 || ci >= nCols) continue;
        if (bl.columns[ci] > bestY) { bestY = bl.columns[ci]; bestIdx = ci; }
      }
      if (bestIdx !== colIdx) {
        this.x = bl.left + (bestIdx + 0.5) * colW;
        colIdx = bestIdx;
      }
    }

    this._pileCol = colIdx;
    this._physicsSettle(bl, bl.columns[colIdx]);
    if (this._touchedSurface) {
      // Raise this slot's pile height so the next droplet to land here
      // settles a bit higher, building the heap up instead of every
      // droplet landing at the exact same spot.
      bl.columns[colIdx] = Math.max(bl.top + 20, bl.columns[colIdx] - this.radius * 1.7);
      this._settled = true;
    }
  }

  // ── Shared gravity-driven fall-and-land used by both tanks and buckets.
  // Sets _touchedSurface (not _settled) on landing — buckets treat that
  // as final, tanks use it as the cue to start sliding across the surface.
  // (gravity itself is already applied once per frame in update())
  _physicsSettle(container, pileY) {
    this.vy = Math.min(this.vy, 4);
    this.vx *= 0.985;
    this.x += this.vx;
    this.y += this.vy;

    const margin = this.radius + 2;
    if (this.x < container.left + margin) { this.x = container.left + margin; this.vx = Math.abs(this.vx) * 0.75; }
    if (this.x > container.right - margin) { this.x = container.right - margin; this.vx = -Math.abs(this.vx) * 0.75; }

    if (this.y >= pileY) {
      this.y = pileY;
      this.vy = -Math.abs(this.vy) * 0.12;
      this.vx *= 0.5;
      if (Math.abs(this.vy) < 0.25) {
        this._touchedSurface = true;
        this.vx = 0; this.vy = 0;
      }
    }
  }

  // ── Leaked: drift down to the ground and fade ─────────────────
  _updateLeaked(layout) {
    // Re-materialize after a dissolve (harmless no-op otherwise, since
    // alpha is already 1 for a particle that leaked without dissolving
    // first, e.g. at a pipe leak checkpoint).
    this.alpha = Math.min(1, this.alpha + 0.02);
    this.vx *= CONFIG.DAMPING;
    this.vy = Math.min(this.vy, 4);

    // Buckets have a pitched roof (peak at roofApexY above the side walls)
    // — a stray droplet lands on the slant and rolls off to whichever side
    // it's on, rather than bouncing straight back up off a flat lid.
    const nextY = this.y + this.vy;
    for (const id in layout.buckets) {
      const bl = layout.buckets[id];
      if (this.x <= bl.left + this.radius || this.x >= bl.right - this.radius) continue;
      const half = (bl.right - bl.left) / 2;
      const dist = Math.min(half, Math.abs(this.x - bl.centerX));
      const roofY = bl.top - (bl.top - bl.roofApexY) * (1 - dist / half);
      if (this.y < roofY && nextY >= roofY) {
        const slopeDir = this.x < bl.centerX ? -1 : 1;
        const speed = Math.abs(this.vy) + Math.abs(this.vx);
        this.vx = slopeDir * (speed * 0.6 + Math.random() * 0.6);
        this.vy = -Math.abs(this.vy) * 0.15;
        break;
      }
    }

    if (this.isGhost) {
      this.alpha = Math.max(0, this.alpha - 0.004);
    } else if (this.y > layout.ground - 30) {
      this.alpha = Math.max(0, this.alpha - 0.06);
    }

    if (this.alpha <= 0.01 || this.y > layout.ground + 60 || this.x < -60 || this.x > layout.width + 60) {
      this.state = 'dead';
    }
  }

  _doLeak(forceLeft) {
    this.state = 'leaked';
    const dir = forceLeft ? -1 : (Math.random() > 0.5 ? 1 : -1);
    this.vx = dir * (0.6 + Math.random() * 1.4);
    this.vy = 0.2 + Math.random() * 0.5;
  }

  // ── Drawing ─────────────────────────────────────────────────
  draw(ctx) {
    if (this.state === 'dead') return;

    ctx.save();
    ctx.globalAlpha = this.alpha * (this.isGhost ? 0.16 : 1.0);
    ctx.fillStyle = this.type.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawTooltip(ctx) {
    const px = this.x + 12;
    const py = this.y - 10;
    const pad = 10;
    const lh = 15;

    ctx.save();
    ctx.font = '10px "Inter", sans-serif';
    const descLines = _wrapTextSimple(ctx, this.type.description, 185);
    const w = 210;
    const h = pad * 2 + 14 + 4 + descLines.length * lh;

    let tx = px;
    let ty = py - h / 2;
    if (ty < 5) ty = 5;

    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.strokeStyle = this.type.color;
    ctx.lineWidth = 1.3;
    _roundRect(ctx, tx, ty, w, h, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#33414f';
    ctx.font = 'bold 10.5px "Inter", sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(this.type.label, tx + pad, ty + pad);

    ctx.fillStyle = '#5b6b7a';
    ctx.font = '9.5px "Inter", sans-serif';
    descLines.forEach((line, i) => {
      ctx.fillText(line, tx + pad, ty + pad + 16 + i * lh);
    });

    ctx.restore();
  }
}
