// js/pipeline.js — Layout computation and all canvas drawing
//
// Entry funnels are stacked in a compact column to the left of tank1, one
// row per funnel category from the post, and lead in sideways through a
// constant-diameter pipe. Every connection between major tanks is 3
// parallel pipes. Pipes are drawn as a 3-tone banded tube with flange
// rings at joints for a cartoonish plumbing look. Leaks are tick marks
// crossing a pipe wall at a specific point; a category with several leaks
// gets several marks spaced out along its shared trunk.

// How wide each layer's description paragraph wraps, per layer index.
// Caring gets extra width because its description is the longest and its
// band (set by tank2's height) is comparatively short.
const LAYER_DESC_W = [340, 400, 340, 340];

// ── Layout ───────────────────────────────────────────────────
function computeLayout(canvasWidth) {
  // ── Entry-channel column: one row per GROUP of channels that share a
  //    funnel category. Grouped channels cluster their funnel mouths side
  //    by side and converge into a single shared pipe, instead of every
  //    channel getting its own independent pipe (which reads as clutter). ──
  const funnelH = 24, rowH = 110;
  const chPipeW = CONFIG.CHANNEL_PIPE_WIDTH;
  const funnelColX = 70;
  const memberGap = 10;
  const xJitterPattern = [0, 22, 10, 30];
  // Small per-member vertical offset so a group's funnels don't all sit at
  // a perfectly uniform height — their drop pipes into the shared trunk
  // end up slightly different lengths, reading as more organic than a
  // rigid grid. Kept small and deterministic (not random) so it stays
  // stable across reloads and comfortably inside the rowH margin.
  const yJitterPattern = [0, 6, -5, 3];
  const stackTop = 118;

  // Each channel's mouth width scales with how many people that outreach
  // method actually reaches (population-weighted across person types) —
  // channels that reach a lot of people get a wider opening, niche ones
  // get a narrower one.
  const channelReach = {};
  ENTRY_CHANNELS.forEach(ch => {
    channelReach[ch.id] = PERSON_TYPES.reduce((sum, pt) => sum + pt.weight * (pt.funnelWeights[ch.id] || 0), 0);
  });
  const reachVals = Object.values(channelReach);
  const minReach = Math.min(...reachVals), maxReach = Math.max(...reachVals);
  const FUNNEL_W_MIN = 44, FUNNEL_W_MAX = 74;
  function funnelWidthFor(chId) {
    const t = maxReach > minReach ? (channelReach[chId] - minReach) / (maxReach - minReach) : 0.5;
    return FUNNEL_W_MIN + t * (FUNNEL_W_MAX - FUNNEL_W_MIN);
  }
  const channelById = {};
  ENTRY_CHANNELS.forEach(ch => { channelById[ch.id] = ch; });

  // First pass: lay out each group's cluster (independent of tank1, which
  // isn't placed yet) so we know how far right the widest cluster reaches.
  // Members of a group sit side by side, each at its own slightly-jittered
  // row height, and all drop straight down (perpendicular, not diagonal)
  // into a single shared horizontal trunk below the group's lowest member —
  // so multiple funnels join the trunk at their own distinct points along
  // it (a row of T-joints), rather than all converging on one spot.
  // Long enough that the vertical drop pipe has visible length to show its
  // banded 3-tone stroke — too short and it reads as a blobby double-joint
  // rather than a proper cartoon pipe.
  const dropGap = 30;
  // A few solo-channel rows sit at an explicit horizontal offset instead of
  // the generic stagger pattern, so they can line up under a specific
  // funnel elsewhere in the column (requested per-channel positioning).
  const xOffsetOverrides = { university: 196, friends: 135, events: -20 };
  const groupsRaw = FUNNEL_GROUPS.map((g, gi) => {
    const rowTop = stackTop + gi * rowH;
    const widths = g.channelIds.map(id => funnelWidthFor(id));
    const clusterW = widths.reduce((a, b) => a + b, 0) + memberGap * (widths.length - 1);
    const xOffset = xOffsetOverrides[g.id] !== undefined ? xOffsetOverrides[g.id] : xJitterPattern[gi % xJitterPattern.length];
    const clusterLeft = funnelColX + xOffset;
    let cursor = clusterLeft;
    const lefts = widths.map(w => { const l = cursor; cursor += w + memberGap; return l; });
    const tops = widths.map((_, mi) => rowTop + yJitterPattern[mi % yJitterPattern.length]);
    const bottoms = tops.map(t => t + funnelH);
    const mergeY = Math.max(...bottoms) + dropGap;
    const leftmostCenterX = lefts[0] + widths[0] / 2;
    const rightmostCenterX = lefts[lefts.length - 1] + widths[widths.length - 1] / 2;
    return { ...g, widths, lefts, tops, bottoms, mergeY, leftmostCenterX, rightmostCenterX };
  });

  // tank1's position is derived from a short, fixed run past the
  // rightmost-reaching funnel of any group — keeps the shared trunk pipes
  // short while guaranteeing no funnel overlaps tank1's wall.
  const entryRunLen = 110;
  const tank1W = 230;
  const tank1Left = Math.max(...groupsRaw.map(g => g.rightmostCenterX)) + entryRunLen;
  const tank1Right = tank1Left + tank1W;
  const cx = tank1Left + tank1W / 2;

  // Second pass: build the flat per-channel array (indexed to match
  // ENTRY_CHANNELS, since particles reference channels by that index),
  // now that tank1Left is known. Each member's path runs funnel-bottom ->
  // straight down to the group's shared trunk (perpendicular tee-join) ->
  // sideways along the trunk into tank1's wall — the existing generic
  // path-follower handles 3-point paths already, so no particle-physics
  // changes are needed for this.
  const channels = new Array(ENTRY_CHANNELS.length);
  const groups = groupsRaw.map(g => {
    // Leak marks sit on the trunk past every member's join point, clearly
    // on the "merged" stretch rather than coinciding with any one T-joint.
    // A group with several leaks (e.g. Fellowships) spaces them out along
    // the same trunk.
    const nLeaks = LEAKS.filter(l => l.stage === 'funnel' && l.channels.includes(g.channelIds[0])).length;
    const fracs = nLeaks === 1 ? [0.6] : nLeaks === 2 ? [0.38, 0.72] : [];
    const markXs = fracs.map(f => g.rightmostCenterX + f * (tank1Left - g.rightmostCenterX));
    const leakMarkPoints = markXs.map(x => ({ x, y: g.mergeY }));

    g.channelIds.forEach((chId, mi) => {
      const chIndex = ENTRY_CHANNELS.findIndex(c => c.id === chId);
      const w = g.widths[mi];
      const left = g.lefts[mi];
      const top = g.tops[mi];
      const bottom = g.bottoms[mi];
      const centerX = left + w / 2;
      const dropLen = g.mergeY - bottom;
      const path = [
        { x: centerX, y: bottom },
        { x: centerX, y: g.mergeY },
        { x: tank1Left, y: g.mergeY },
      ];
      channels[chIndex] = {
        id: chId, index: chIndex, def: channelById[chId],
        top, bottom, left, right: left + w,
        topWidth: w, bottomWidth: chPipeW, centerX,
        path, leakMarkPoints,
        leakMarkDists: markXs.map(mx => dropLen + (mx - centerX)),
        groupId: g.id, mergeY: g.mergeY, labelBand: mi % 2,
      };
    });

    return {
      id: g.id, label: g.label, mergeY: g.mergeY, leakMarkPoints, tank1Left,
      leftmostCenterX: g.leftmostCenterX,
      labelX: g.lefts[0] - 4, labelY: Math.min(...g.tops) - 28,
    };
  });

  const lastEntryMergeY = groups[groups.length - 1].mergeY;
  const tank1Top = stackTop - 28;
  const tank1H = (lastEntryMergeY - tank1Top) + 40;
  const tank1Bottom = tank1Top + tank1H;
  const tank1 = { left: tank1Left, right: tank1Right, top: tank1Top, bottom: tank1Bottom, centerX: cx, width: tank1W, id: 'tank1', label: 'REALLY STARTING TO CARE' };

  // ── tank1 -> tank2: 3 parallel lanes that drop, then run sideways to
  //    the right (tank2 sits to the right of and below tank1), carrying
  //    the caring-stage leaks ──
  const laneOff = CONFIG.LANE_OFFSET;
  const outletsX = [cx - laneOff, cx, cx + laneOff];
  tank1.outletXs = outletsX;
  // railGap must clear the rendered pipe width (~PIPE_WIDTH+6) so the 3
  // stacked horizontal rails don't visually bleed into one another (and
  // so a leak tick mark on one doesn't reach into its neighbor).
  const dropLen0 = 40, railGap = 34;
  const cx2 = cx + CONFIG.TANK2_OFFSET_X;
  const tank2W = 190;
  const tank2Left = cx2 - tank2W / 2;

  // The lane starting farthest from tank2 (the leftmost outlet) has the
  // longest rightward rail, so it must sit at the *deepest* height —
  // otherwise its rail would pass through x-positions where a shallower
  // lane's vertical drop is still descending, and the two pipes would
  // visually cross each other.
  const railYs = outletsX.map((x, i) => tank1Bottom + dropLen0 + (outletsX.length - 1 - i) * railGap);
  const conn1Lanes = outletsX.map((x, i) => ({
    x, path: [{ x, y: tank1Bottom }, { x, y: railYs[i] }, { x: tank2Left, y: railYs[i] }],
  }));
  const nCaringLeaks = LEAKS.filter(l => l.stage === 'caring').length;
  const conn1LeakPoints = _distributeLeaksOnLanes(nCaringLeaks, conn1Lanes, 15);

  const tank2Top = Math.min(...railYs) - 20;
  // Extra depth beyond the rail spread gives the caring layer's (long)
  // description paragraph room, since tank2.bottom is that layer's floor —
  // sized so the wrapped text ends inside the band instead of crossing
  // the dashed boundary into the upskilling layer.
  const tank2H = (Math.max(...railYs) - Math.min(...railYs)) + 140;
  const tank2Bottom = tank2Top + tank2H;
  const tank2 = { left: tank2Left, right: tank2Left + tank2W, top: tank2Top, bottom: tank2Bottom, centerX: cx2, width: tank2W, id: 'tank2', label: 'UPSKILLING + CHOICES' };

  // ── tank2 -> distribution rail: 3 parallel lanes (carry the upskilling leaks) ──
  const lanesX2 = [cx2 - laneOff, cx2, cx2 + laneOff];
  tank2.outletXs = lanesX2;
  const conn2Len = 170;
  const conn2Top = tank2Bottom;
  const distribRailY = conn2Top + conn2Len;
  const conn2Lanes = lanesX2.map(x => ({ x, path: [{ x, y: conn2Top }, { x, y: distribRailY }] }));
  const nUpskillLeaks = LEAKS.filter(l => l.stage === 'upskilling').length;
  const conn2LeakPoints = _distributeLeaksOnLanes(nUpskillLeaks, conn2Lanes, 0);

  // Buckets sit to the right of (and below) tank2, rather than centered
  // under its outlet, so the leak marks on tank2's connectors don't read
  // as if they're falling straight into the buckets.
  const bktTop = distribRailY + 40;
  const bktBot = bktTop + 215;
  const bktW = 104, bktGap = 12;
  const nBkt = JOB_BUCKETS.length;
  const totalBktW = nBkt * bktW + (nBkt - 1) * bktGap;
  const bktLeft = tank2.right + 12;

  const buckets = {};
  JOB_BUCKETS.forEach((b, i) => {
    const left = bktLeft + i * (bktW + bktGap);
    const centerX = left + bktW / 2;
    buckets[b.id] = {
      left, right: left + bktW, top: bktTop, bottom: bktBot,
      centerX, width: bktW,
      roofApexY: bktTop - CONFIG.BUCKET_ROOF_H,
      columns: new Array(CONFIG.BUCKET_COLUMNS).fill(bktBot - CONFIG.PARTICLE_RADIUS - 2),
    };
  });

  // A job-decision leak that isn't tied to one bucket (fellowship hopping)
  // sits on the distribution rail itself, where every droplet passes —
  // between the rightmost tank2 lane and the first bucket.
  const railLeakX = (lanesX2[lanesX2.length - 1] + bktLeft) / 2;

  // Extra room below the bucket names for the additional-note chips.
  const nameBlockH = 60;
  const ground = bktBot + 14 + nameBlockH + 70;

  // The buckets are the rightmost content now; make sure the canvas is
  // actually wide enough to hold them rather than trusting the caller's
  // width (which was sized before this layout knew where things land).
  const bktRightEdge = bktLeft + totalBktW;
  const width = Math.max(canvasWidth, bktRightEdge + 30);
  const height = ground + 40;

  return {
    width, cx, cx2,
    channels, groups,
    tank1, tank2,
    conn1: { lanes: conn1Lanes, leakPoints: conn1LeakPoints },
    conn2: { top: conn2Top, bottom: distribRailY, len: conn2Len, lanes: conn2Lanes, leakPoints: conn2LeakPoints },
    distribRailY,
    railLeakX,
    buckets,
    ground,
    height,
    // Depth-layer bands and each band's text anchor, shared by the layer
    // background, the stage chips, and app.js's hover fade. The jobs
    // anchor sits directly left of the bucket row (rather than at the far
    // page margin) so its heading/description aren't separated from the
    // buckets by a wide stretch of dead space.
    layerBounds: [0, tank1Bottom, tank2Bottom, distribRailY, height],
    layerAnchorX: [tank1Right + 40, tank2.right + 40, tank2.right + 40, Math.max(20, bktLeft - LAYER_DESC_W[3] - 40)],
  };
}

// Point at a given arc-length distance along a polyline, plus the local
// segment direction (used both to draw a static tick mark and, at
// runtime, to decide whether it crosses a vertical or horizontal pipe).
function _pointAtDist(path, dist) {
  let d = dist;
  for (let i = 0; i < path.length - 1; i++) {
    const dx = path[i + 1].x - path[i].x, dy = path[i + 1].y - path[i].y;
    const len = Math.hypot(dx, dy);
    if (d <= len || i === path.length - 2) {
      const t = len > 0 ? Math.max(0, Math.min(1, d / len)) : 0;
      return { x: path[i].x + dx * t, y: path[i].y + dy * t, dx, dy };
    }
    d -= len;
  }
  const last = path[path.length - 1];
  return { x: last.x, y: last.y, dx: 0, dy: 0 };
}

function _pathLength(path) {
  let L = 0;
  for (let i = 0; i < path.length - 1; i++) {
    L += Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
  }
  return L;
}

// Spread `count` leaks across N lanes (round-robin), stacking repeats at a
// deeper fraction down the same lane so no two marks land on top of each
// other. Marks always land on the lane's *last* segment (past its own
// bend, whatever that lane's individual drop length happens to be) with
// at least `bendMargin` px of clearance, so a mark never sits on or right
// next to a corner.
function _distributeLeaksOnLanes(count, lanes, bendMargin) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const laneIdx = i % lanes.length;
    const occurrence = Math.floor(i / lanes.length);
    const frac = 0.3 + occurrence * 0.4;
    const lane = lanes[laneIdx];
    const total = _pathLength(lane.path);
    const bendDist = lane.path.length > 2
      ? Math.hypot(lane.path[1].x - lane.path[0].x, lane.path[1].y - lane.path[0].y)
      : 0;
    const skip = bendDist > 0 ? bendDist + bendMargin : 0;
    const dist = skip + frac * (total - skip);
    const pt = _pointAtDist(lane.path, dist);
    pts.push({ x: pt.x, y: pt.y, dx: pt.dx, dy: pt.dy, dist, laneIdx, leakIdx: i });
  }
  return pts;
}

// ── Full-bleed depth layers, drawn as the page background ─────
// Each solid band spans the full canvas width; the big label is always
// visible, the description fades in via layerAlpha (eased per-frame in
// app.js, keyed by layer id) once the band has scrolled into view — and
// then stays visible.
function _drawBackgroundLayers(ctx, layout, layerAlpha) {
  const boundsY = layout.layerBounds;
  const anchorX = layout.layerAnchorX;

  ctx.save();
  PIPELINE_LAYERS.forEach((layer, i) => {
    ctx.fillStyle = layer.color;
    ctx.fillRect(0, boundsY[i], layout.width, boundsY[i + 1] - boundsY[i]);
  });

  // Dashed dividers at the 3 internal boundaries — the bottom-most
  // boundary (layout.ground) already gets its own dashed line and
  // caption from _drawGround, so it isn't repeated here.
  ctx.strokeStyle = 'rgba(159, 176, 192, 0.5)';
  ctx.lineWidth = 1;
  ctx.setLineDash([10, 10]);
  boundsY.slice(1, 4).forEach(y => {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(layout.width, y);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  PIPELINE_LAYERS.forEach((layer, i) => {
    const x = anchorX[i];
    const labelY = boundsY[i] + 46;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#3d4c5a';
    ctx.font = 'bold 22px "Inter", sans-serif';
    ctx.fillText(layer.label, x, labelY);

    const alpha = layerAlpha[layer.id] || 0;
    if (alpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#55636f';
      ctx.font = '12px "Inter", sans-serif';
      const maxW = Math.min(LAYER_DESC_W[i], layout.width - x - 30);
      const lines = _wrapTextSimple(ctx, layer.text, maxW);
      let ly = labelY + 26;
      lines.forEach(line => { ctx.fillText(line, x, ly); ly += 18; });
      // Interaction hint (discovery layer): bold, on its own line below
      // the description paragraph.
      if (layer.hint) {
        ly += 6;
        ctx.fillStyle = '#3d4c5a';
        ctx.font = 'bold 12px "Inter", sans-serif';
        const hintLines = _wrapTextSimple(ctx, layer.hint, maxW);
        hintLines.forEach(line => { ctx.fillText(line, x, ly); ly += 18; });
      }
      ctx.restore();
    }
  });

  ctx.restore();
}

// ── Hoverable info chips beside each layer heading ────────────
// A vertical column of small labeled chips to the right of each layer's
// description block; the ⓘ badge signals there's more on hover, and the
// full text opens in the side panel.
function _drawStageChips(ctx, layout, infoHitZones) {
  const boundsY = layout.layerBounds;
  const anchorX = layout.layerAnchorX;

  PIPELINE_LAYERS.forEach((layer, i) => {
    const boxes = STAGE_BOXES[layer.id];
    if (!boxes || !boxes.length) return;
    // The discovery band's left side is filled with funnels, so its chips
    // sit to the right of the description. The bottom three bands are
    // empty on the left, so their chip columns share one x there —
    // vertically aligned with each other down the page's left edge.
    const x = i === 0 ? anchorX[i] + LAYER_DESC_W[i] + 40 : 20;
    // Start below the heading's text line — a long heading would
    // otherwise run underneath a right-side chip column.
    let y = boundsY[i] + 58;
    boxes.forEach(box => {
      _drawInfoChip(ctx, x, y, box.label, box.id, infoHitZones);
      y += 32;
    });
  });
}

// One chip: rounded pill with a pulsing ⓘ badge and a short label.
// Pushes its own hover hit-zone.
function _drawInfoChip(ctx, x, y, label, infoId, infoHitZones) {
  ctx.save();
  ctx.font = 'bold 10px "Inter", sans-serif';
  const textW = ctx.measureText(label).width;
  const w = textW + 40, h = 24;

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeStyle = 'rgba(91, 122, 153, 0.65)';
  ctx.lineWidth = 1.2;
  _roundRect(ctx, x, y, w, h, 12);
  ctx.fill(); ctx.stroke();

  // Pulsing ⓘ badge — the "there's information here" indicator.
  const pulse = 0.75 + 0.25 * Math.sin(Date.now() * 0.004);
  ctx.fillStyle = `rgba(91, 122, 153, ${pulse})`;
  ctx.beginPath();
  ctx.arc(x + 14, y + h / 2, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold italic 9px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('i', x + 14, y + h / 2 + 0.5);

  ctx.fillStyle = '#44556a';
  ctx.font = 'bold 10px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 26, y + h / 2 + 0.5);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();

  infoHitZones.push({ kind: 'info', id: infoId, x, y, w, h });
}

// ── Additional-note chips anchored under the Technical Research bucket ──
function _drawNoteBadges(ctx, layout, infoHitZones) {
  const bl = layout.buckets['research'];
  if (!bl) return;
  let y = bl.bottom + 58;
  NOTE_BADGES.forEach(nb => {
    _drawInfoChip(ctx, bl.left, y, nb.label, nb.id, infoHitZones);
    y += 30;
  });
}

// ── Main draw entry ──────────────────────────────────────────
function drawPipeline(ctx, layout, leaks, bucketCounts, tankOccupancy, leakHitZones, infoHitZones) {
  _drawEntryChannels(ctx, layout, leaks, leakHitZones);
  _drawTankBox(ctx, layout.tank1, tankOccupancy.tank1, 70, layout.tank1.outletXs);
  _drawLanes(ctx, layout.conn1, CONFIG.PIPE_WIDTH, leaks.filter(l => l.stage === 'caring'), leakHitZones);
  _drawTankBox(ctx, layout.tank2, tankOccupancy.tank2, 50, layout.tank2.outletXs);
  _drawLanes(ctx, layout.conn2, CONFIG.PIPE_WIDTH, leaks.filter(l => l.stage === 'upskilling'), leakHitZones);
  _drawBucketManifold(ctx, layout, leaks, leakHitZones);
  _drawBuckets(ctx, layout, bucketCounts, leaks, leakHitZones, infoHitZones);
  _drawNoteBadges(ctx, layout, infoHitZones);
  _drawGround(ctx, layout);
  _drawStageChips(ctx, layout, infoHitZones);
}

// ── Cartoon pipe helper: 3-tone banded tube along a polyline ──
function _strokePipe(ctx, pts, width) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = CONFIG.PIPE_BORDER;
  ctx.lineWidth = width + 6;
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.stroke();
  ctx.strokeStyle = CONFIG.PIPE_MID;
  ctx.lineWidth = width;
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.stroke();
  ctx.strokeStyle = CONFIG.PIPE_LUMEN;
  ctx.lineWidth = Math.max(2, width - 9);
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.stroke();
  ctx.restore();
}

// Flange / collar ring marking a pipe joint (cartoon plumbing fitting)
function _drawJoint(ctx, x, y, width) {
  ctx.save();
  ctx.fillStyle = CONFIG.PIPE_BORDER;
  ctx.beginPath();
  ctx.arc(x, y, width / 2 + 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = CONFIG.PIPE_MID;
  ctx.beginPath();
  ctx.arc(x, y, width / 2 + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function _drawLanes(ctx, conn, width, stageLeaks, leakHitZones) {
  conn.lanes.forEach(lane => {
    lane.path.forEach(p => _drawJoint(ctx, p.x, p.y, width));
    _strokePipe(ctx, lane.path, width);
  });
  conn.leakPoints.forEach(pt => {
    const leak = stageLeaks[pt.leakIdx];
    if (!leak) return;
    const orientation = Math.abs(pt.dy) >= Math.abs(pt.dx) ? 'h' : 'v';
    _drawLeakMark(ctx, pt.x, pt.y, width / 2, leak, leakHitZones, orientation);
  });
}

// ── Entry channels: small funnel + sideways pipe into tank1 ───
function _drawEntryChannels(ctx, layout, leaks, leakHitZones) {
  ctx.save();

  layout.groups.forEach(g => {
    const members = layout.channels.filter(ch => ch.groupId === g.id);
    const chW = CONFIG.CHANNEL_PIPE_WIDTH;

    // Trunk drawn first so each member's T-joint fitting (drawn below,
    // per member) renders on top of the straight run, reading as a lateral
    // pipe stamped onto the trunk rather than being erased by it.
    _strokePipe(ctx, [{ x: g.leftmostCenterX, y: g.mergeY }, { x: g.tank1Left, y: g.mergeY }], chW);

    members.forEach(ch => {
      const botL = ch.centerX - ch.bottomWidth / 2;
      const botR = ch.centerX + ch.bottomWidth / 2;

      ctx.fillStyle = CONFIG.PIPE_FILL;
      ctx.beginPath();
      ctx.moveTo(ch.left, ch.top);
      ctx.lineTo(ch.right, ch.top);
      ctx.lineTo(botR, ch.bottom);
      ctx.lineTo(botL, ch.bottom);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = CONFIG.PIPE_BORDER;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(ch.left, ch.top);  ctx.lineTo(botL, ch.bottom); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ch.right, ch.top); ctx.lineTo(botR, ch.bottom); ctx.stroke();

      // Rim collar on the funnel mouth
      ctx.strokeStyle = CONFIG.PIPE_BORDER;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(ch.left - 2, ch.top); ctx.lineTo(ch.right + 2, ch.top); ctx.stroke();

      // Each member drops straight down (perpendicular) into the group's
      // shared trunk, joining it at its own point along the trunk — a row
      // of T-joints rather than every member converging on one spot. Only
      // one flange (at the trunk join) is drawn — the funnel's own rim
      // collar above already caps the other end, so a second flange there
      // would just crowd out the short segment's visible pipe banding.
      _strokePipe(ctx, [{ x: ch.centerX, y: ch.bottom }, { x: ch.centerX, y: ch.mergeY }], ch.bottomWidth);
      _drawJoint(ctx, ch.centerX, ch.mergeY, ch.bottomWidth);

      leakHitZones.push({ type: 'funnelSeg', segIdx: ch.index, seg: ch.def,
        x: ch.left - 4, y: ch.top - 20, w: ch.right - ch.left + 8, h: ch.bottom - ch.top + 24 });
    });

    // The group's leak marks on the shared trunk — most categories have a
    // single shared failure mode, but a category can carry several leaks
    // (e.g. Fellowships), each drawn at its own clearly-spaced point.
    const groupLeaks = leaks.filter(l => l.stage === 'funnel' && l.channels.includes(members[0].id));
    groupLeaks.forEach((leak, li) => {
      const pt = g.leakMarkPoints[li];
      if (pt) _drawLeakMark(ctx, pt.x, pt.y, chW / 2, leak, leakHitZones, 'v');
    });
  });

  ctx.restore();
}

// ── Entry-channel labels, drawn in their own pass after particles so a
// falling droplet reads as passing behind the label text (which stays
// legible) rather than the label flickering out under whatever happens
// to be falling through that spot at the moment.
function _drawEntryChannelLabels(ctx, layout) {
  ctx.save();
  // Two staggered label heights above each funnel mouth so adjacent
  // members' labels (packed close together in a cluster) don't run into
  // each other even when the text is wider than the funnel itself.
  const labelYOffset = [-6, -15];
  ctx.fillStyle = '#4d6072';
  ctx.font = '8px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  layout.channels.forEach(ch => {
    ctx.fillText(ch.def.label, ch.centerX, ch.top + labelYOffset[ch.labelBand]);
  });

  // Funnel-category headings from the post, above each cluster.
  ctx.fillStyle = '#3d4c5a';
  ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  layout.groups.forEach(g => {
    ctx.fillText(g.label, g.labelX, g.labelY);
  });
  ctx.restore();
}

// ── Tank: rectangular container with a rising/falling fill level
function _drawTankBox(ctx, tank, occupancy, maxViz, outletXs) {
  ctx.save();

  // The displayed level eases toward the real occupancy rather than
  // tracking it directly, so bursty arrivals don't make the tank look
  // like it fills instantly. Droplet settle depth (in particles.js) reads
  // this same eased value, so droplets always rest right at the surface.
  const targetFrac = Math.max(0, Math.min(1, occupancy / maxViz));
  tank._dispFill = (tank._dispFill === undefined ? 0 : tank._dispFill);
  tank._dispFill += (targetFrac - tank._dispFill) * CONFIG.TANK_FILL_EASE;
  const fillFrac = tank._dispFill;
  const innerTop = tank.top + 4, innerBottom = tank.bottom - 4;
  const fillH = (innerBottom - innerTop) * fillFrac;

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  _roundRect(ctx, tank.left, tank.top, tank.width, tank.bottom - tank.top, 10);
  ctx.fill();

  if (fillH > 2) {
    const fillTop = innerBottom - fillH;
    ctx.save();
    _roundRect(ctx, tank.left + 3, tank.top + 3, tank.width - 6, tank.bottom - tank.top - 6, 8);
    ctx.clip();
    const grad = ctx.createLinearGradient(0, innerBottom, 0, fillTop);
    grad.addColorStop(0, 'rgba(91, 122, 153, 0.38)');
    grad.addColorStop(1, 'rgba(91, 122, 153, 0.16)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(tank.left, fillTop);
    const waveT = Date.now() * 0.0025;
    for (let x = tank.left; x <= tank.right; x += 10) {
      const wy = fillTop + Math.sin(x * 0.05 + waveT) * 2.5;
      ctx.lineTo(x, wy);
    }
    ctx.lineTo(tank.right, innerBottom);
    ctx.lineTo(tank.left, innerBottom);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.strokeStyle = CONFIG.PIPE_BORDER;
  ctx.lineWidth = 2.2;
  _roundRect(ctx, tank.left, tank.top, tank.width, tank.bottom - tank.top, 10);
  ctx.stroke();

  // Punch an actual opening through the bottom wall at each outlet pipe —
  // otherwise the pipe just starts flush against a solid, uninterrupted
  // wall line, and droplets read as passing through solid material rather
  // than draining out through a real hole.
  if (outletXs && outletXs.length) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const gapW = CONFIG.PIPE_WIDTH + 10;
    outletXs.forEach(x => { ctx.fillRect(x - gapW / 2, tank.bottom - 4, gapW, 8); });
    ctx.restore();
  }

  ctx.restore();
}

// ── Bucket distribution manifold ──────────────────────────────
function _drawBucketManifold(ctx, layout, leaks, leakHitZones) {
  const ids = JOB_BUCKETS.map(b => b.id);
  const firstBl = layout.buckets[ids[0]];
  const lastBl = layout.buckets[ids[ids.length - 1]];
  const laneXs = layout.conn2.lanes.map(l => l.x);
  const railLeft = Math.min(firstBl.centerX, ...laneXs);
  const railRight = Math.max(lastBl.centerX, ...laneXs);

  _strokePipe(ctx, [{ x: railLeft, y: layout.distribRailY }, { x: railRight, y: layout.distribRailY }], CONFIG.PIPE_WIDTH);

  JOB_BUCKETS.forEach(b => {
    const bl = layout.buckets[b.id];
    _drawJoint(ctx, bl.centerX, layout.distribRailY, CONFIG.BRANCH_WIDTH);
    // Spigot enters at the roof's peak, the highest point of the bucket.
    _strokePipe(ctx, [{ x: bl.centerX, y: layout.distribRailY }, { x: bl.centerX, y: bl.roofApexY }], CONFIG.BRANCH_WIDTH);
    ctx.save();
    ctx.fillStyle = CONFIG.PIPE_BORDER;
    ctx.beginPath();
    ctx.arc(bl.centerX, bl.roofApexY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Rail-wide job-decision leak (fellowship hopping) — every droplet
  // passes this point on its way to whichever bucket it chose.
  const railLeak = leaks.find(l => l.stage === 'jobs' && l.rail);
  if (railLeak) {
    _drawLeakMark(ctx, layout.railLeakX, layout.distribRailY, CONFIG.PIPE_WIDTH / 2, railLeak, leakHitZones, 'v');
  }
}

// ── Buckets ──────────────────────────────────────────────────
function _drawBuckets(ctx, layout, bucketCounts, leaks, leakHitZones, infoHitZones) {
  ctx.save();

  JOB_BUCKETS.forEach((b) => {
    const bl = layout.buckets[b.id];
    const count = bucketCounts[b.id] || 0;
    infoHitZones.push({ kind: 'bucket', id: b.id, x: bl.left, y: bl.top, w: bl.width, h: bl.bottom - bl.top });

    // Pitched roof, not a flat lid — the only way in is through the
    // branch pipe/spigot at the peak; anything else that lands on the
    // slanted roof naturally slides off to one side instead of resting
    // or bouncing straight back up.
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(bl.left, bl.top);
    ctx.lineTo(bl.left, bl.bottom);
    ctx.lineTo(bl.right, bl.bottom);
    ctx.lineTo(bl.right, bl.top);
    ctx.lineTo(bl.centerX, bl.roofApexY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = b.color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(bl.left, bl.top);
    ctx.lineTo(bl.left, bl.bottom);
    ctx.lineTo(bl.right, bl.bottom);
    ctx.lineTo(bl.right, bl.top);
    ctx.lineTo(bl.centerX, bl.roofApexY);
    ctx.lineTo(bl.left, bl.top);
    ctx.stroke();

    // Water level tracks the actual pile of settled droplets (average
    // column height) so the level and the ball count can never drift
    // apart, and all buckets share the tanks' blue-gray water rather
    // than each bucket's accent color.
    const baseline = bl.bottom - CONFIG.PARTICLE_RADIUS - 2;
    const avgPile = bl.columns.reduce((s, c) => s + (baseline - c), 0) / bl.columns.length;
    const fillH = Math.min(avgPile, bl.bottom - bl.top - 24);
    if (fillH > 0) {
      const grad = ctx.createLinearGradient(0, bl.bottom, 0, bl.bottom - fillH);
      grad.addColorStop(0, 'rgba(91, 122, 153, 0.38)');
      grad.addColorStop(1, 'rgba(91, 122, 153, 0.16)');
      ctx.fillStyle = grad;
      ctx.fillRect(bl.left + 2, bl.bottom - fillH, bl.width - 4, fillH);
    }

    ctx.fillStyle = '#5b6b7a';
    ctx.font = '8px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(count + ' placed', bl.centerX, bl.bottom - 5);

    _drawBucketName(ctx, bl, b);

    const bucketLeak = leaks.find(l => l.stage === 'jobs' && l.bucket === b.id);
    if (bucketLeak) {
      const my = layout.distribRailY + (bl.top - layout.distribRailY) * 0.5;
      _drawLeakMark(ctx, bl.centerX, my, CONFIG.BRANCH_WIDTH / 2, bucketLeak, leakHitZones, 'h');
    }
  });

  ctx.restore();
}

// Large, neatly-centered bucket name beneath the bucket.
function _drawBucketName(ctx, bl, b) {
  ctx.save();
  const words = b.label.split(' ');
  const mid = Math.ceil(words.length / 2);
  const line1 = words.slice(0, mid).join(' ');
  const line2 = words.slice(mid).join(' ');

  ctx.fillStyle = '#33414f';
  ctx.font = 'bold 14px "Inter", sans-serif';
  ctx.textAlign = 'center';
  const y0 = bl.bottom + 26;
  if (line2) {
    ctx.fillText(line1, bl.centerX, y0);
    ctx.fillText(line2, bl.centerX, y0 + 20);
  } else {
    ctx.fillText(line1, bl.centerX, y0 + 10);
  }
  ctx.restore();
}

// ── Leak tick mark crossing a pipe wall, plus clickable badge ──
// orientation 'h' = tick crosses a vertical pipe (tick drawn horizontal)
// orientation 'v' = tick crosses a horizontal pipe (tick drawn vertical)
function _drawLeakMark(ctx, x, y, halfWidth, leak, leakHitZones, orientation) {
  ctx.save();
  const fixed = leak.fixed;
  const tickHalf = halfWidth + 3;

  ctx.strokeStyle = fixed ? '#9aa7b3' : CONFIG.LEAK_COLOR;
  ctx.lineWidth = 3;

  if (orientation === 'v') {
    ctx.beginPath(); ctx.moveTo(x - 2, y - tickHalf); ctx.lineTo(x + 2, y + tickHalf); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 6, y - tickHalf); ctx.lineTo(x + 10, y + tickHalf); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(x - tickHalf, y - 2); ctx.lineTo(x + tickHalf, y + 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - tickHalf, y + 6); ctx.lineTo(x + tickHalf, y + 10); ctx.stroke();
  }

  const badgeX = orientation === 'v' ? x : x + tickHalf + 10;
  const badgeY = orientation === 'v' ? y - tickHalf - 10 : y;
  _drawLeakDot(ctx, badgeX, badgeY, leak);
  leakHitZones.push({ type: 'leak', leak, x: badgeX, y: badgeY, r: 9 });
  ctx.restore();
}

function _drawLeakDot(ctx, x, y, leak) {
  ctx.save();
  const fixed  = leak.fixed;
  const radius = 6.5;
  const t      = Date.now();

  if (fixed) {
    ctx.fillStyle = 'rgba(150,160,170,0.75)';
    ctx.strokeStyle = '#8a97a3';
    ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#c3ccd4';
    ctx.lineWidth = 0.8;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
      ctx.beginPath();
      ctx.moveTo(x + (radius - 3) * Math.cos(a), y + (radius - 3) * Math.sin(a));
      ctx.lineTo(x + radius * Math.cos(a + 0.3), y + radius * Math.sin(a + 0.3));
      ctx.stroke();
    }
  } else {
    const pulse = 0.55 + 0.2 * Math.sin(t * 0.005);
    ctx.fillStyle = `rgba(169, 105, 95, ${pulse})`;
    ctx.strokeStyle = CONFIG.LEAK_COLOR;
    ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', x, y);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
}

// ── Ground: a literal pool where leaked droplets settle ───────
function _drawGround(ctx, layout) {
  ctx.save();
  const surfaceY = layout.ground;
  const waveT = Date.now() * 0.0025;

  const wavePoints = [];
  for (let x = 0; x <= layout.width; x += 12) {
    wavePoints.push({ x, y: surfaceY + Math.sin(x * 0.03 + waveT) * 3 });
  }

  const grad = ctx.createLinearGradient(0, layout.height, 0, surfaceY);
  grad.addColorStop(0, 'rgba(91, 122, 153, 0.34)');
  grad.addColorStop(1, 'rgba(91, 122, 153, 0.14)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, surfaceY);
  wavePoints.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(layout.width, layout.height);
  ctx.lineTo(0, layout.height);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(91, 122, 153, 0.6)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  wavePoints.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.stroke();

  ctx.fillStyle = '#455563';
  ctx.font = '9px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('Most people who leak from the pipeline settle here and exit the field', 16, surfaceY + 20);
  ctx.restore();
}

// ── Entry-channel tooltip (drawn on canvas) ───────────────────
function drawChannelTooltip(ctx, seg, mx, my, canvasWidth) {
  const pad = 10;
  const lh  = 13;
  ctx.save();
  const w = 230;
  ctx.font = 'bold 10px "Inter", sans-serif';
  const titleLines = _wrapTextSimple(ctx, seg.fullLabel, w - pad * 2);
  ctx.font = '9px "Inter", sans-serif';
  const exLines = _wrapTextSimple(ctx, seg.examples, w - pad * 2 - 10);
  const h = pad * 2 + titleLines.length * 14 + 4 + exLines.length * lh;

  let tx = mx + 14;
  let ty = my - h / 2;
  if (tx + w > canvasWidth - 10) tx = mx - w - 8;
  if (ty < 5) ty = 5;

  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.strokeStyle = 'rgba(159,176,192,0.8)';
  ctx.lineWidth = 1.3;
  _roundRect(ctx, tx, ty, w, h, 7);
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = '#33414f';
  ctx.font = 'bold 10px "Inter", sans-serif';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  let lineY = ty + pad;
  titleLines.forEach(line => { ctx.fillText(line, tx + pad, lineY); lineY += 14; });

  ctx.fillStyle = '#5b6b7a';
  ctx.font = '8.5px "Inter", sans-serif';
  lineY += 4;
  exLines.forEach(line => {
    ctx.fillText(line, tx + pad, lineY);
    lineY += lh;
  });
  ctx.restore();
}

// ── Shared helpers ────────────────────────────────────────────
function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

function _wrapTextSimple(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = []; let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}
