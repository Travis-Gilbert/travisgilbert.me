const FEATURE_ORDER = [
  "claim_specificity",
  "root_depth",
  "source_independence",
  "external_support_ratio",
  "temporal_spread",
  "consensus_alignment",
  "source_tier",
  "rhetorical_red_flags",
  "citation_chain_closure",
  "claim_falsifiability",
];

const AXIS_LABELS = ["SPEC", "ROOT", "IND", "EXT", "TIME", "CONS", "TIER", "FLAG", "CHAIN", "FALSE"];

export const HEALTHY_CLAIM_REFERENCE = {
  claim_specificity: 0.75,
  root_depth: 0.75,
  source_independence: 0.75,
  external_support_ratio: 0.75,
  temporal_spread: 0.75,
  consensus_alignment: 0.75,
  source_tier: 0.75,
  rhetorical_red_flags: 0.75,
  citation_chain_closure: 0.75,
  claim_falsifiability: 0.75,
};

const COLORS = {
  teal: "#4A8A96",
  gold: "#C49A4A",
  terracotta: "#C4503C",
  ink: "#1A1A1A",
  stone: "#F4F3F0",
  slate: "#7B8EA0",
};

function featureValue(value) {
  return value == null ? 0.5 : Number(value);
}

function point(cx, cy, radius, angle) {
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
}

function pointsForValues(values, cx, cy, maxRadius) {
  const points = [];
  for (let idx = 0; idx < values.length; idx += 1) {
    const angle = -Math.PI / 2 + (2 * Math.PI * idx) / values.length;
    const [x, y] = point(cx, cy, maxRadius * values[idx], angle);
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join(" ");
}

function nullMarkers(featureData, cx, cy, maxRadius) {
  const markers = [];
  for (let idx = 0; idx < FEATURE_ORDER.length; idx += 1) {
    const key = FEATURE_ORDER[idx];
    if (featureData[key] != null) {
      continue;
    }
    const angle = -Math.PI / 2 + (2 * Math.PI * idx) / FEATURE_ORDER.length;
    const [x, y] = point(cx, cy, maxRadius * 0.5, angle);
    markers.push(
      `  <line class="null-mark" x1="${(x - 2.0).toFixed(2)}" y1="${(y - 2.0).toFixed(2)}" x2="${
        (x + 2.0).toFixed(2)
      }" y2="${(y + 2.0).toFixed(2)}" />`,
    );
    markers.push(
      `  <line class="null-mark" x1="${(x - 2.0).toFixed(2)}" y1="${(y + 2.0).toFixed(2)}" x2="${
        (x + 2.0).toFixed(2)
      }" y2="${(y - 2.0).toFixed(2)}" />`,
    );
  }
  return markers;
}

function tierColor(tier) {
  if (tier <= 1) {
    return [COLORS.teal, 1.0];
  }
  if (tier === 2) {
    return [COLORS.teal, 0.7];
  }
  if (tier === 3) {
    return [COLORS.gold, 1.0];
  }
  if (tier === 4) {
    return [COLORS.slate, 1.0];
  }
  return [COLORS.terracotta, 1.0];
}

function syntheticTiers(sourceTier, sourceIndependence) {
  let sequence;
  if (sourceTier >= 0.85) {
    sequence = [1, 1, 2, 1, 2, 1, 2, 2];
  } else if (sourceTier >= 0.65) {
    sequence = [1, 2, 2, 3, 2, 3, 2, 3];
  } else if (sourceTier >= 0.45) {
    sequence = [2, 3, 3, 4, 3, 4, 4, 3];
  } else {
    sequence = [3, 4, 4, 5, 4, 5, 5, 4];
  }

  let count;
  if (sourceIndependence < 0.25) {
    count = 4;
  } else if (sourceIndependence < 0.5) {
    count = 5;
  } else if (sourceIndependence < 0.7) {
    count = 6;
  } else if (sourceIndependence < 0.85) {
    count = 7;
  } else {
    count = 8;
  }

  return sequence.slice(0, count);
}

function spreadFactor(sourceIndependence) {
  if (sourceIndependence <= 0.4) {
    return 0.3;
  }
  if (sourceIndependence >= 0.7) {
    return 1.0;
  }
  const step = (sourceIndependence - 0.4) / 0.3;
  return 0.3 + step * 0.7;
}

function claimColor(verdict) {
  if (verdict === "trustworthy") {
    return COLORS.teal;
  }
  if (verdict === "mixed") {
    return COLORS.gold;
  }
  return COLORS.terracotta;
}

function descText(claim) {
  const values = claim.feature_breakdown;
  const ranked = FEATURE_ORDER.map((key) => [key, values[key] == null ? 0.5 : Number(values[key])]).sort(
    (a, b) => a[1] - b[1],
  );
  const low = ranked.slice(0, 2).map((item) => item[0]).join(", ");
  const high = ranked.slice(-2).map((item) => item[0]).join(", ");
  return `High in ${high}; low in ${low}.`;
}

export function renderClaimMiniGraph(claim, referenceSignature = HEALTHY_CLAIM_REFERENCE) {
  const claimData = claim.feature_breakdown;
  const referenceData = referenceSignature;

  const claimValues = FEATURE_ORDER.map((key) => featureValue(claimData[key]));
  const referenceValues = FEATURE_ORDER.map((key) => featureValue(referenceData[key]));

  const cx = 160.0;
  const cy = 65.0;
  const maxRadius = 48.0;

  const gridlines = [];
  for (const r of [0.25, 0.5, 0.75]) {
    gridlines.push(`  <circle class="grid" cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(maxRadius * r).toFixed(2)}" />`);
  }

  const axes = [];
  const labels = [];
  for (let idx = 0; idx < AXIS_LABELS.length; idx += 1) {
    const label = AXIS_LABELS[idx];
    const angle = -Math.PI / 2 + (2 * Math.PI * idx) / AXIS_LABELS.length;
    const [x2, y2] = point(cx, cy, maxRadius, angle);
    const [lx, ly] = point(cx, cy, maxRadius + 12.0, angle);
    axes.push(
      `  <line class="axis" x1="${cx.toFixed(2)}" y1="${cy.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" />`,
    );
    labels.push(`  <text class="axis-label" x="${lx.toFixed(2)}" y="${ly.toFixed(2)}">${label}</text>`);
  }

  const markers = nullMarkers(claimData, cx, cy, maxRadius);

  const sourceIndependence = featureValue(claimData.source_independence);
  const sourceTier = featureValue(claimData.source_tier);
  const tiers = syntheticTiers(sourceTier, sourceIndependence);
  const spread = spreadFactor(sourceIndependence);

  let evidenceEdges = [];
  let sourceNodes = [];
  const count = tiers.length;
  for (let idx = 0; idx < tiers.length; idx += 1) {
    const tier = tiers[idx];
    const baseX = count === 1 ? 160.0 : 40.0 + idx * (240.0 / (count - 1));
    const x = 160.0 + (baseX - 160.0) * spread;
    const yMap = { 1: 150.0, 2: 156.0, 3: 162.0, 4: 168.0, 5: 175.0 };
    const y = yMap[tier] || 170.0;
    const [color, opacity] = tierColor(tier);
    const nodeId = `s${String(idx).padStart(2, "0")}`;

    evidenceEdges.push([
      nodeId,
      `  <line class="edge" x1="160.00" y1="210.00" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" stroke="${color}" />`,
    ]);

    sourceNodes.push([
      nodeId,
      `  <circle class="source-node" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="4.00" fill="${color}" fill-opacity="${
        opacity.toFixed(2)
      }" />`,
    ]);
  }

  evidenceEdges = evidenceEdges.sort((a, b) => a[0].localeCompare(b[0])).map((item) => item[1]);
  sourceNodes = sourceNodes.sort((a, b) => a[0].localeCompare(b[0])).map((item) => item[1]);

  const cColor = claimColor(claim.verdict);
  const title = `Mini-graph for claim ${claim.id}: verdict ${claim.verdict}, score ${Number(claim.score).toFixed(6)}.`;

  const style =
    "  <style>\n" +
    "    .bg{fill:#F4F3F0;}\n" +
    "    .grid{fill:none;stroke:#7B8EA0;stroke-width:1;opacity:0.2;}\n" +
    "    .axis{stroke:#7B8EA0;stroke-width:1;opacity:0.4;}\n" +
    "    .axis-label{fill:#1A1A1A;font-family:ui-sans-serif,system-ui,sans-serif;font-size:8px;text-anchor:middle;dominant-baseline:middle;}\n" +
    "    .reference-poly{fill:none;stroke:#C49A4A;stroke-width:1.5;stroke-dasharray:3 2;opacity:0.6;}\n" +
    "    .claim-poly{stroke-width:2;fill-opacity:0.25;}\n" +
    "    .null-mark{fill:none;stroke:#7B8EA0;stroke-width:1;stroke-dasharray:2 2;}\n" +
    "    .divider{stroke:#7B8EA0;stroke-width:1;opacity:0.35;}\n" +
    "    .edge{fill:none;stroke-width:1;opacity:0.5;}\n" +
    "    .source-node{stroke:#1A1A1A;stroke-width:0.5;}\n" +
    "    .claim-node{stroke:#1A1A1A;stroke-width:1;}\n" +
    "    .score-label{fill:#1A1A1A;font-family:ui-sans-serif,system-ui,sans-serif;font-size:9px;text-anchor:middle;}\n" +
    "  </style>";

  const lines = [
    '<svg viewBox="0 0 320 240" xmlns="http://www.w3.org/2000/svg">',
    `  <title>${title}</title>`,
    `  <desc>${descText(claim)}</desc>`,
    '  <rect class="bg" x="0" y="0" width="320" height="240" />',
    style,
    ...gridlines,
    ...axes,
    ...labels,
    `  <polygon class="reference-poly" points="${pointsForValues(referenceValues, cx, cy, maxRadius)}" />`,
    `  <polygon class="claim-poly" points="${pointsForValues(claimValues, cx, cy, maxRadius)}" stroke="${cColor}" fill="${cColor}" />`,
    ...markers,
    '  <line class="divider" x1="16.00" y1="135.00" x2="304.00" y2="135.00" />',
    ...evidenceEdges,
    ...sourceNodes,
    `  <circle class="claim-node" cx="160.00" cy="210.00" r="6.00" fill="${cColor}" />`,
    `  <text class="score-label" x="160.00" y="222.00">${Number(claim.score).toFixed(6)}</text>`,
    "</svg>",
  ];

  return lines.join("\n");
}
