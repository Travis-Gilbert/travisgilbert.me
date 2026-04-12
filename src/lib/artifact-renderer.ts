/**
 * Generates a self-contained HTML string for an evidence map artifact.
 *
 * Loads Graphology + Sigma.js from CDN. Embeds graph data, node/edge
 * styling, click-to-inspect, confidence scores, and source list.
 *
 * Uses system font stack for portability (no external fonts required).
 * Total size target: under 500KB for 20-50 evidence nodes.
 */

interface ArtifactNode {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  color: string;
  object_type?: string;
  claims?: string[];
  gradual_strength?: number;
}

interface ArtifactEdge {
  id: string;
  source: string;
  target: string;
  color: string;
  size: number;
  edge_type?: string;
  strength?: number;
}

export interface ArtifactData {
  query: string;
  confidence: number;
  nodes: ArtifactNode[];
  edges: ArtifactEdge[];
  sources: Array<{
    title: string;
    object_type: string;
    gradual_strength: number;
  }>;
  created_at: string;
}

// Theseus color palette
const COLORS = {
  ground: '#1C1A17',
  panel: '#242220',
  teal: '#2D5F6B',
  terracotta: '#C4503C',
  amber: '#C49A4A',
  paper: '#F4F3F0',
  border: 'rgba(255,255,255,0.08)',
  textPrimary: '#F4F3F0',
  textSecondary: '#b5b0a8',
  textDim: '#7a7670',
};

export function renderEvidenceMapArtifact(data: ArtifactData): string {
  const nodesJson = JSON.stringify(data.nodes);
  const edgesJson = JSON.stringify(data.edges);
  const sourcesJson = JSON.stringify(data.sources);
  const queryEscaped = escapeHtml(data.query);
  const confidencePercent = Math.round(data.confidence * 100);

  // The artifact HTML is self-contained. All data is pre-serialized and
  // rendered via safe DOM methods (textContent, createElement) in the
  // embedded script. No user-generated HTML is injected via innerHTML.
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Evidence Map: ${queryEscaped}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${COLORS.ground};color:${COLORS.textPrimary};font-family:system-ui,-apple-system,sans-serif;overflow:hidden}
.artifact-container{display:flex;height:100vh;width:100vw}
.artifact-graph{flex:1;position:relative}
.artifact-panel{width:320px;flex-shrink:0;background:${COLORS.panel};border-left:1px solid ${COLORS.border};display:flex;flex-direction:column;overflow:hidden}
.artifact-header{padding:16px;border-bottom:1px solid ${COLORS.border}}
.artifact-query{font-size:14px;color:${COLORS.textPrimary};line-height:1.5;margin-bottom:8px}
.artifact-meta{font-size:11px;font-family:monospace;color:${COLORS.textDim};display:flex;gap:12px}
.artifact-confidence{color:${COLORS.teal};font-weight:600}
.artifact-sources{flex:1;overflow-y:auto;padding:12px 16px}
.artifact-source{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid ${COLORS.border}}
.artifact-source-bar{height:4px;border-radius:2px;background:${COLORS.teal}}
.artifact-source-title{font-size:12px;color:${COLORS.textSecondary};flex:1}
.artifact-source-score{font-size:11px;font-family:monospace;color:${COLORS.teal}}
.artifact-inspect{padding:16px;border-top:1px solid ${COLORS.border};display:none}
.artifact-inspect.is-open{display:block}
.artifact-inspect-title{font-size:13px;font-weight:600;color:${COLORS.textPrimary};margin-bottom:6px}
.artifact-inspect-type{font-size:10px;font-family:monospace;color:${COLORS.textDim};text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px}
.artifact-inspect-claims{font-size:12px;color:${COLORS.textSecondary};line-height:1.5}
.sigma-container{width:100%;height:100%}
@media(max-width:768px){
  .artifact-container{flex-direction:column}
  .artifact-graph{height:50vh}
  .artifact-panel{width:100%;height:50vh;border-left:none;border-top:1px solid ${COLORS.border}}
}
</style>
</head>
<body>
<div class="artifact-container">
  <div class="artifact-graph" id="graph-container"></div>
  <div class="artifact-panel">
    <div class="artifact-header">
      <div class="artifact-query">${queryEscaped}</div>
      <div class="artifact-meta">
        <span class="artifact-confidence">${confidencePercent}% confidence</span>
        <span>${data.nodes.length} nodes</span>
      </div>
    </div>
    <div class="artifact-sources" id="sources-list"></div>
    <div class="artifact-inspect" id="inspect-panel">
      <div class="artifact-inspect-title" id="inspect-title"></div>
      <div class="artifact-inspect-type" id="inspect-type"></div>
      <div class="artifact-inspect-claims" id="inspect-claims"></div>
    </div>
  </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/graphology/0.25.4/graphology.umd.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/sigma.js/3.0.0-beta.8/sigma.min.js"><\/script>
<script>
(function(){
  var nodes = ${nodesJson};
  var edges = ${edgesJson};
  var sources = ${sourcesJson};

  var graph = new graphology.Graph({multi:true,type:'undirected'});
  nodes.forEach(function(n){
    graph.addNode(n.id,{label:n.label,x:n.x,y:n.y,size:n.size,color:n.color,object_type:n.object_type,claims:n.claims||[]});
  });
  edges.forEach(function(e){
    try{graph.addEdge(e.source,e.target,{color:e.color,size:e.size});}catch(err){}
  });

  var container = document.getElementById('graph-container');
  var renderer = new sigma.Sigma(graph,container,{
    labelColor:{color:'${COLORS.textPrimary}'},
    labelFont:'monospace',
    labelSize:11,
    defaultNodeColor:'#9a958d',
    defaultEdgeColor:'rgba(255,255,255,0.06)',
    renderEdgeLabels:false,
    zIndex:true
  });

  // Source list: built with safe DOM methods
  var sl = document.getElementById('sources-list');
  sources.sort(function(a,b){return b.gradual_strength-a.gradual_strength;});
  sources.forEach(function(s){
    var row = document.createElement('div');
    row.className='artifact-source';
    var bar = document.createElement('div');
    bar.className='artifact-source-bar';
    bar.style.width=Math.round(s.gradual_strength*100)+'%';
    var title = document.createElement('span');
    title.className='artifact-source-title';
    title.textContent=s.title;
    var score = document.createElement('span');
    score.className='artifact-source-score';
    score.textContent=Math.round(s.gradual_strength*100)+'%';
    row.appendChild(bar);
    row.appendChild(title);
    row.appendChild(score);
    sl.appendChild(row);
  });

  // Click to inspect: uses textContent (safe)
  var inspectEl = document.getElementById('inspect-panel');
  var titleEl = document.getElementById('inspect-title');
  var typeEl = document.getElementById('inspect-type');
  var claimsEl = document.getElementById('inspect-claims');

  renderer.on('clickNode',function(e){
    var attrs = graph.getNodeAttributes(e.node);
    titleEl.textContent = attrs.label || e.node;
    typeEl.textContent = attrs.object_type || '';
    // Build claims as text nodes
    while(claimsEl.firstChild) claimsEl.removeChild(claimsEl.firstChild);
    (attrs.claims||[]).forEach(function(c){
      var p = document.createElement('div');
      p.style.marginBottom='4px';
      p.textContent=c;
      claimsEl.appendChild(p);
    });
    inspectEl.className = 'artifact-inspect is-open';
  });

  renderer.on('clickStage',function(){
    inspectEl.className = 'artifact-inspect';
  });
})();
<\/script>
</body>
</html>`;
}

/* ─────────────────────────────────────────────────
   Tension Report Artifact
   ───────────────────────────────────────────────── */

export interface TensionReportData {
  query: string;
  agreement_groups: Array<{
    label: string;
    claims: Array<{ text: string; entrenchment: number }>;
    mean_entrenchment: number;
    source_independence: number;
  }>;
  tension_zones: Array<{
    title: string;
    claim_a: { text: string; entrenchment: number };
    claim_b: { text: string; entrenchment: number };
    severity: 'low' | 'medium' | 'high' | 'critical';
    bridging_objects: string[];
  }>;
  blind_spots: Array<{
    description: string;
    detection_method: string;
    suggested_query: string;
  }>;
  created_at: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  low: COLORS.amber,
  medium: COLORS.terracotta,
  high: '#CC3333',
  critical: '#FF2222',
};

export function renderTensionReportArtifact(data: TensionReportData): string {
  const queryEscaped = escapeHtml(data.query);

  const agreementHtml = data.agreement_groups.map((g) => `
    <div class="tr-section">
      <h3 class="tr-zone-title">${escapeHtml(g.label)}</h3>
      <div class="tr-meta">Entrenchment: ${Math.round(g.mean_entrenchment * 100)}% | Source independence: ${Math.round(g.source_independence * 100)}%</div>
      ${g.claims.map((c) => `<div class="tr-claim">${escapeHtml(c.text)}</div>`).join('')}
    </div>
  `).join('');

  const tensionHtml = data.tension_zones.map((t) => {
    const color = SEVERITY_COLORS[t.severity] ?? COLORS.amber;
    return `
    <div class="tr-tension" style="border-left: 3px solid ${color}">
      <div class="tr-tension-title">${escapeHtml(t.title)}</div>
      <div class="tr-tension-severity" style="color:${color}">${t.severity.toUpperCase()}</div>
      <div class="tr-vs">
        <div class="tr-side">
          <div class="tr-claim-text">${escapeHtml(t.claim_a.text)}</div>
          <div class="tr-entrenchment">${Math.round(t.claim_a.entrenchment * 100)}% entrenchment</div>
        </div>
        <div class="tr-vs-label">vs</div>
        <div class="tr-side">
          <div class="tr-claim-text">${escapeHtml(t.claim_b.text)}</div>
          <div class="tr-entrenchment">${Math.round(t.claim_b.entrenchment * 100)}% entrenchment</div>
        </div>
      </div>
    </div>`;
  }).join('');

  const blindSpotHtml = data.blind_spots.map((b) => `
    <div class="tr-blindspot">
      <div class="tr-blindspot-desc">${escapeHtml(b.description)}</div>
      <div class="tr-blindspot-method">${escapeHtml(b.detection_method)}</div>
      <button class="tr-blindspot-query" onclick="window.parent.postMessage({type:'theseus:navigate-ask',query:'${escapeHtml(b.suggested_query)}'},'*')">${escapeHtml(b.suggested_query)}</button>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tension Report: ${queryEscaped}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${COLORS.ground};color:${COLORS.textPrimary};font-family:system-ui,-apple-system,sans-serif;overflow-y:auto;padding:24px}
.tr-header{max-width:800px;margin:0 auto 32px;text-align:center}
.tr-query{font-size:18px;margin-bottom:8px}
.tr-date{font-size:11px;font-family:monospace;color:${COLORS.textDim}}
.tr-grid{max-width:800px;margin:0 auto;display:flex;flex-direction:column;gap:24px}
.tr-section-title{font-size:14px;font-family:monospace;text-transform:uppercase;letter-spacing:0.06em;color:${COLORS.textDim};margin-bottom:12px;border-bottom:1px solid ${COLORS.border};padding-bottom:8px}
.tr-section{background:${COLORS.panel};border:1px solid ${COLORS.border};border-radius:8px;padding:16px;margin-bottom:12px}
.tr-zone-title{font-size:14px;margin-bottom:8px}
.tr-meta{font-size:11px;font-family:monospace;color:${COLORS.textDim};margin-bottom:12px}
.tr-claim{font-size:13px;color:${COLORS.textSecondary};padding:6px 0;border-bottom:1px solid ${COLORS.border};line-height:1.5}
.tr-tension{background:${COLORS.panel};border:1px solid ${COLORS.border};border-radius:8px;padding:16px;margin-bottom:12px}
.tr-tension-title{font-size:14px;font-weight:600;margin-bottom:4px}
.tr-tension-severity{font-size:10px;font-family:monospace;letter-spacing:0.06em;margin-bottom:12px}
.tr-vs{display:flex;gap:16px;align-items:stretch}
.tr-side{flex:1;background:rgba(255,255,255,0.03);border-radius:6px;padding:12px}
.tr-vs-label{display:flex;align-items:center;font-size:12px;font-family:monospace;color:${COLORS.textDim}}
.tr-claim-text{font-size:13px;color:${COLORS.textSecondary};line-height:1.5;margin-bottom:6px}
.tr-entrenchment{font-size:11px;font-family:monospace;color:${COLORS.teal}}
.tr-blindspot{background:${COLORS.panel};border:1px solid ${COLORS.border};border-radius:8px;padding:16px;margin-bottom:12px}
.tr-blindspot-desc{font-size:13px;color:${COLORS.textSecondary};line-height:1.5;margin-bottom:8px}
.tr-blindspot-method{font-size:10px;font-family:monospace;color:${COLORS.textDim};margin-bottom:8px}
.tr-blindspot-query{background:rgba(74,138,150,0.12);color:${COLORS.teal};border:none;border-radius:4px;padding:6px 12px;font-size:12px;cursor:pointer;font-family:monospace}
@media(max-width:768px){.tr-vs{flex-direction:column}}
</style>
</head>
<body>
<div class="tr-header">
  <div class="tr-query">${queryEscaped}</div>
  <div class="tr-date">${escapeHtml(data.created_at)}</div>
</div>
<div class="tr-grid">
  <div><div class="tr-section-title">Agreement Zones</div>${agreementHtml || '<div class="tr-section"><div class="tr-claim">No agreement zones found.</div></div>'}</div>
  <div><div class="tr-section-title">Tension Zones</div>${tensionHtml || '<div class="tr-section"><div class="tr-claim">No tensions found.</div></div>'}</div>
  <div><div class="tr-section-title">Blind Spots</div>${blindSpotHtml || '<div class="tr-section"><div class="tr-claim">No blind spots detected.</div></div>'}</div>
</div>
</body>
</html>`;
}

/* ─────────────────────────────────────────────────
   Hypothesis Document Artifact
   ───────────────────────────────────────────────── */

export interface HypothesisDocData {
  query: string;
  hypotheses: Array<{
    title: string;
    description: string;
    confidence: number;
    structural_basis: string;
    supporting_objects: Array<{ id: string; title: string }>;
    validation_status: string;
    search_queries?: string[];
  }>;
  created_at: string;
}

const VALIDATION_COLORS: Record<string, string> = {
  unvalidated: COLORS.textDim,
  validating: COLORS.amber,
  supported: '#5A8A5E',
  refuted: COLORS.terracotta,
};

export function renderHypothesisDocArtifact(data: HypothesisDocData): string {
  const queryEscaped = escapeHtml(data.query);

  const hypothesesHtml = data.hypotheses.map((h) => {
    const badgeColor = VALIDATION_COLORS[h.validation_status] ?? COLORS.textDim;
    const confidencePercent = Math.round(h.confidence * 100);
    return `
    <div class="hd-hypothesis">
      <div class="hd-header">
        <h3 class="hd-title">${escapeHtml(h.title)}</h3>
        <span class="hd-badge" style="color:${badgeColor};border-color:${badgeColor}">${escapeHtml(h.validation_status)}</span>
      </div>
      <p class="hd-desc">${escapeHtml(h.description)}</p>
      <div class="hd-confidence">
        <div class="hd-confidence-bar" style="width:${confidencePercent}%"></div>
        <span class="hd-confidence-label">${confidencePercent}% confidence</span>
      </div>
      <div class="hd-basis">
        <div class="hd-basis-label">Structural basis</div>
        <p class="hd-basis-text">${escapeHtml(h.structural_basis)}</p>
      </div>
      <div class="hd-objects">
        <div class="hd-basis-label">Supporting objects</div>
        ${h.supporting_objects.map((o) => `<span class="hd-object-chip">${escapeHtml(o.title)}</span>`).join('')}
      </div>
      ${h.search_queries?.length ? `<div class="hd-queries"><div class="hd-basis-label">Validation queries</div>${h.search_queries.map((q) => `<div class="hd-query">${escapeHtml(q)}</div>`).join('')}</div>` : ''}
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hypotheses: ${queryEscaped}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${COLORS.ground};color:${COLORS.textPrimary};font-family:system-ui,-apple-system,sans-serif;overflow-y:auto;padding:24px}
.hd-header-section{max-width:700px;margin:0 auto 32px;text-align:center}
.hd-query{font-size:18px;margin-bottom:8px}
.hd-list{max-width:700px;margin:0 auto;display:flex;flex-direction:column;gap:20px}
.hd-hypothesis{background:${COLORS.panel};border:1px solid ${COLORS.border};border-radius:8px;padding:20px}
.hd-header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}
.hd-title{font-size:16px;font-weight:600}
.hd-badge{font-size:10px;font-family:monospace;text-transform:uppercase;letter-spacing:0.06em;border:1px solid;border-radius:4px;padding:2px 8px;flex-shrink:0}
.hd-desc{font-size:13px;color:${COLORS.textSecondary};line-height:1.6;margin-bottom:16px}
.hd-confidence{position:relative;height:20px;background:rgba(255,255,255,0.04);border-radius:4px;margin-bottom:16px;overflow:hidden}
.hd-confidence-bar{position:absolute;top:0;left:0;height:100%;background:${COLORS.teal};border-radius:4px;transition:width 0.3s}
.hd-confidence-label{position:absolute;top:0;right:8px;height:100%;display:flex;align-items:center;font-size:10px;font-family:monospace;color:${COLORS.textPrimary}}
.hd-basis{margin-bottom:12px}
.hd-basis-label{font-size:10px;font-family:monospace;color:${COLORS.textDim};text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px}
.hd-basis-text{font-size:12px;color:${COLORS.textSecondary};line-height:1.5}
.hd-objects{margin-bottom:12px;display:flex;flex-wrap:wrap;gap:6px}
.hd-object-chip{font-size:11px;background:rgba(74,138,150,0.12);color:${COLORS.teal};border-radius:4px;padding:3px 8px;font-family:monospace}
.hd-queries{margin-top:8px}
.hd-query{font-size:12px;color:${COLORS.textSecondary};padding:4px 0;font-family:monospace}
</style>
</head>
<body>
<div class="hd-header-section">
  <div class="hd-query">${queryEscaped}</div>
</div>
<div class="hd-list">
  ${hypothesesHtml || '<div class="hd-hypothesis"><p class="hd-desc">No hypotheses generated.</p></div>'}
</div>
</body>
</html>`;
}

/* ─────────────────────────────────────────────────
   Knowledge Diff Artifact
   ───────────────────────────────────────────────── */

export interface KnowledgeDiffData {
  from_date: string;
  to_date: string;
  added_objects: Array<{ id: string; title: string; object_type: string }>;
  removed_objects: Array<{ id: string; title: string; object_type: string }>;
  new_tensions: Array<{ claim_a_text: string; claim_b_text: string; severity: number }>;
  resolved_tensions: Array<{ claim_a_text: string; claim_b_text: string }>;
  summary: string;
  created_at: string;
}

export function renderKnowledgeDiffArtifact(data: KnowledgeDiffData): string {
  const addedHtml = data.added_objects.map((o) =>
    `<div class="kd-item kd-added"><span class="kd-dot" style="background:#5A8A5E"></span><span class="kd-item-title">${escapeHtml(o.title)}</span><span class="kd-item-type">${escapeHtml(o.object_type)}</span></div>`
  ).join('');

  const removedHtml = data.removed_objects.map((o) =>
    `<div class="kd-item kd-removed"><span class="kd-dot" style="background:${COLORS.terracotta}"></span><span class="kd-item-title" style="text-decoration:line-through">${escapeHtml(o.title)}</span><span class="kd-item-type">${escapeHtml(o.object_type)}</span></div>`
  ).join('');

  const newTensionsHtml = data.new_tensions.map((t) =>
    `<div class="kd-item kd-tension"><span class="kd-dot" style="background:${COLORS.amber}"></span><span class="kd-item-title">${escapeHtml(t.claim_a_text)} vs ${escapeHtml(t.claim_b_text)}</span></div>`
  ).join('');

  const resolvedHtml = data.resolved_tensions.map((t) =>
    `<div class="kd-item kd-resolved"><span style="margin-right:6px">&#10003;</span><span class="kd-item-title">${escapeHtml(t.claim_a_text)} vs ${escapeHtml(t.claim_b_text)}</span></div>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Knowledge Diff: ${escapeHtml(data.from_date)} to ${escapeHtml(data.to_date)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${COLORS.ground};color:${COLORS.textPrimary};font-family:system-ui,-apple-system,sans-serif;overflow-y:auto;padding:24px}
.kd-header{max-width:800px;margin:0 auto 24px;text-align:center}
.kd-dates{font-size:14px;font-family:monospace;color:${COLORS.teal};margin-bottom:8px}
.kd-summary{font-size:14px;color:${COLORS.textSecondary};line-height:1.6;max-width:600px;margin:0 auto 24px}
.kd-grid{max-width:800px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:24px}
.kd-column{display:flex;flex-direction:column;gap:12px}
.kd-section-title{font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.06em;color:${COLORS.textDim};padding-bottom:8px;border-bottom:1px solid ${COLORS.border}}
.kd-item{display:flex;align-items:center;gap:8px;padding:8px 12px;background:${COLORS.panel};border:1px solid ${COLORS.border};border-radius:6px}
.kd-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.kd-item-title{font-size:12px;color:${COLORS.textPrimary};flex:1}
.kd-item-type{font-size:10px;font-family:monospace;color:${COLORS.textDim}}
.kd-resolved{color:#5A8A5E}
.kd-scrubber{max-width:800px;margin:0 auto 32px;display:flex;align-items:center;gap:12px}
.kd-scrubber input[type=date]{background:${COLORS.panel};border:1px solid ${COLORS.border};border-radius:4px;padding:6px 10px;color:${COLORS.textPrimary};font-family:monospace;font-size:12px}
@media(max-width:768px){.kd-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="kd-header">
  <div class="kd-dates">${escapeHtml(data.from_date)} &rarr; ${escapeHtml(data.to_date)}</div>
</div>
<div class="kd-summary">${escapeHtml(data.summary)}</div>
<div class="kd-grid">
  <div class="kd-column">
    <div class="kd-section-title">Added (${data.added_objects.length})</div>
    ${addedHtml || '<div class="kd-item"><span class="kd-item-title" style="color:' + COLORS.textDim + '">No objects added</span></div>'}
    <div class="kd-section-title" style="margin-top:16px">New Tensions (${data.new_tensions.length})</div>
    ${newTensionsHtml || '<div class="kd-item"><span class="kd-item-title" style="color:' + COLORS.textDim + '">No new tensions</span></div>'}
  </div>
  <div class="kd-column">
    <div class="kd-section-title">Removed (${data.removed_objects.length})</div>
    ${removedHtml || '<div class="kd-item"><span class="kd-item-title" style="color:' + COLORS.textDim + '">No objects removed</span></div>'}
    <div class="kd-section-title" style="margin-top:16px">Resolved Tensions (${data.resolved_tensions.length})</div>
    ${resolvedHtml || '<div class="kd-item"><span class="kd-item-title" style="color:' + COLORS.textDim + '">No tensions resolved</span></div>'}
  </div>
</div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
