/**
 * research-graph.js
 *
 * D3.js v7 force directed graph for the Studio editor research panel.
 * Renders connections between the current content piece, its sources,
 * backlinks, and related content nodes.
 *
 * Contract: Alpine calls  window.initResearchGraph(containerEl, data)
 * where data = { nodes: [...], edges: [...] } from the research API
 * graph endpoint.
 *
 * Safe DOM construction only (no innerHTML). All text comes from the
 * application's own API responses rendered via textContent or D3 text().
 */
(function () {
  'use strict';

  /* ── Colour maps (matching research_api explorer + brand tokens) ── */

  var SOURCE_TYPE_COLORS = {
    article:     '#E8C547',
    book:        '#B45A2D',
    video:       '#5A7A4A',
    podcast:     '#C49A4A',
    paper:       '#7A5A8A',
    website:     '#2D5F6B',
    social_post: '#D4856A',
    newsletter:  '#6B8A5A',
    talk:        '#8A6B5A',
    tool:        '#5A6B8A',
    dataset:     '#6B5A7A',
    image:       '#8A7A5A',
    other:       '#9E8E7E'
  };

  var CONTENT_COLORS = {
    essay:      '#B45A2D',
    field_note: '#2D5F6B',
    shelf:      '#C49A4A',
    project:    '#5A7A4A',
    toolkit:    '#7A5A8A',
    video:      '#5A7A4A'
  };

  var ROLE_COLORS = {
    primary:     '#E8C547',
    background:  '#9E8E7E',
    inspiration: '#D4856A',
    reference:   '#7A9EAE',
    counterpoint:'#C46A6A',
    related:     '#8AAE7A',
    quoted:      '#AE8A5A'
  };

  /* ── Helpers ── */

  function nodeColor(d) {
    if (d.type === 'source') {
      return SOURCE_TYPE_COLORS[d.sourceType] || SOURCE_TYPE_COLORS.other;
    }
    return CONTENT_COLORS[d.type] || '#9E8E7E';
  }

  function edgeColor(d) {
    return ROLE_COLORS[d.role] || '#9E8E7E';
  }

  function truncate(str, max) {
    if (!str) return '';
    return str.length > max ? str.substring(0, max - 1) + '\u2026' : str;
  }

  /* ── Empty state (safe DOM) ── */

  function showEmptyState(container) {
    var wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col items-center justify-center h-full gap-2';

    var icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('width', '32');
    icon.setAttribute('height', '32');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '1.5');
    icon.setAttribute('class', 'text-cream/20');
    var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '3');
    var path1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    path1.setAttribute('x1', '12'); path1.setAttribute('y1', '3');
    path1.setAttribute('x2', '12'); path1.setAttribute('y2', '9');
    var path2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    path2.setAttribute('x1', '12'); path2.setAttribute('y1', '15');
    path2.setAttribute('x2', '12'); path2.setAttribute('y2', '21');
    var path3 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    path3.setAttribute('x1', '3'); path3.setAttribute('y1', '12');
    path3.setAttribute('x2', '9'); path3.setAttribute('y2', '12');
    var path4 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    path4.setAttribute('x1', '15'); path4.setAttribute('y1', '12');
    path4.setAttribute('x2', '21'); path4.setAttribute('y2', '12');
    icon.appendChild(circle);
    icon.appendChild(path1);
    icon.appendChild(path2);
    icon.appendChild(path3);
    icon.appendChild(path4);

    var msg = document.createElement('p');
    msg.className = 'font-mono text-[11px] text-cream/30 tracking-wide text-center';
    msg.textContent = 'No connections yet.';

    wrapper.appendChild(icon);
    wrapper.appendChild(msg);
    container.appendChild(wrapper);
  }

  /* ── Tooltip (safe DOM) ── */

  function createTooltip(container) {
    var tip = document.createElement('div');
    tip.className = 'absolute pointer-events-none z-50 px-3 py-2 rounded-brand '
      + 'bg-dark-surface border border-white/10 shadow-warm-sm '
      + 'font-mono text-[11px] text-cream/80 tracking-wide '
      + 'transition-opacity duration-150 opacity-0';
    tip.style.display = 'none';

    var label = document.createElement('div');
    label.className = 'font-semibold text-cream mb-0.5';
    label.dataset.role = 'label';

    var typeLine = document.createElement('div');
    typeLine.className = 'text-cream/50 text-[10px]';
    typeLine.dataset.role = 'type';

    tip.appendChild(label);
    tip.appendChild(typeLine);
    container.appendChild(tip);
    return tip;
  }

  function showTooltip(tip, d, x, y) {
    var label = tip.querySelector('[data-role="label"]');
    var typeLine = tip.querySelector('[data-role="type"]');
    label.textContent = truncate(d.label || d.slug || d.id, 40);

    var typeText = d.type === 'source'
      ? (d.sourceType || 'source').replace(/_/g, ' ')
      : d.type.replace(/_/g, ' ');
    typeLine.textContent = typeText;

    tip.style.left = (x + 12) + 'px';
    tip.style.top = (y - 8) + 'px';
    tip.style.display = 'block';
    /* Force reflow before opacity change */
    tip.offsetHeight; // eslint-disable-line no-unused-expressions
    tip.style.opacity = '1';
  }

  function hideTooltip(tip) {
    tip.style.opacity = '0';
    setTimeout(function () { tip.style.display = 'none'; }, 150);
  }

  /* ── Main graph renderer ── */

  window.initResearchGraph = function (container, data) {
    if (!data || !data.nodes || data.nodes.length === 0) {
      /* Clear the loading indicator */
      while (container.firstChild) container.removeChild(container.firstChild);
      showEmptyState(container);
      return;
    }

    /* Clear any prior content (loading text, old graph) */
    while (container.firstChild) container.removeChild(container.firstChild);

    /* Make container position:relative for tooltip placement */
    container.style.position = 'relative';

    var nodes = data.nodes.map(function (n) { return Object.assign({}, n); });
    var edges = data.edges.map(function (e) { return Object.assign({}, e); });

    var width = container.clientWidth || 600;
    var height = container.clientHeight || 350;

    /* ── SVG setup ── */
    var svg = d3.select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', '0 0 ' + width + ' ' + height)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    /* Zoom group */
    var g = svg.append('g');

    svg.call(
      d3.zoom()
        .scaleExtent([0.3, 4])
        .on('zoom', function (event) {
          g.attr('transform', event.transform);
        })
    );

    /* ── Tooltip ── */
    var tooltip = createTooltip(container);

    /* ── Adjacency map (for hover dimming) ── */
    var adjacency = {};
    nodes.forEach(function (n) { adjacency[n.id] = new Set(); });
    edges.forEach(function (e) {
      var src = typeof e.source === 'object' ? e.source.id : e.source;
      var tgt = typeof e.target === 'object' ? e.target.id : e.target;
      if (adjacency[src]) adjacency[src].add(tgt);
      if (adjacency[tgt]) adjacency[tgt].add(src);
    });

    /* ── Force simulation ── */
    var simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges)
        .id(function (d) { return d.id; })
        .distance(70))
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(25));

    /* ── Edges ── */
    var linkSel = g.append('g')
      .attr('class', 'edges')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', edgeColor)
      .attr('stroke-opacity', 0.35)
      .attr('stroke-width', 1.5);

    /* ── Nodes ── */
    var nodeSel = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'grab')
      .call(
        d3.drag()
          .on('start', function (event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', function (event, d) {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', function (event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    /* Source nodes: circles */
    nodeSel.filter(function (d) { return d.type === 'source'; })
      .append('circle')
      .attr('r', 8)
      .attr('fill', nodeColor)
      .attr('stroke', '#1a1a18')
      .attr('stroke-width', 1);

    /* Content nodes: rounded rects */
    nodeSel.filter(function (d) { return d.type !== 'source'; })
      .append('rect')
      .attr('width', 16)
      .attr('height', 16)
      .attr('x', -8)
      .attr('y', -8)
      .attr('rx', 3)
      .attr('fill', nodeColor)
      .attr('stroke', '#1a1a18')
      .attr('stroke-width', 1);

    /* Labels */
    nodeSel.append('text')
      .text(function (d) { return truncate(d.label || d.slug || '', 18); })
      .attr('x', 12)
      .attr('y', 4)
      .attr('fill', '#F0EBE4')
      .attr('font-size', '10px')
      .attr('font-family', 'Amarna, sans-serif')
      .attr('pointer-events', 'none');

    /* ── Hover interactions ── */
    nodeSel
      .on('mouseenter', function (event, d) {
        var connected = adjacency[d.id] || new Set();

        nodeSel.style('opacity', function (n) {
          return n.id === d.id || connected.has(n.id) ? 1 : 0.15;
        });
        linkSel.style('opacity', function (l) {
          var src = typeof l.source === 'object' ? l.source.id : l.source;
          var tgt = typeof l.target === 'object' ? l.target.id : l.target;
          return src === d.id || tgt === d.id ? 0.6 : 0.05;
        });

        /* Position tooltip relative to the container */
        var rect = container.getBoundingClientRect();
        showTooltip(tooltip, d, event.clientX - rect.left, event.clientY - rect.top);
      })
      .on('mousemove', function (event) {
        var rect = container.getBoundingClientRect();
        tooltip.style.left = (event.clientX - rect.left + 12) + 'px';
        tooltip.style.top = (event.clientY - rect.top - 8) + 'px';
      })
      .on('mouseleave', function () {
        nodeSel.style('opacity', 1);
        linkSel.style('opacity', 0.35);
        hideTooltip(tooltip);
      });

    /* ── Tick handler ── */
    simulation.on('tick', function () {
      linkSel
        .attr('x1', function (d) { return d.source.x; })
        .attr('y1', function (d) { return d.source.y; })
        .attr('x2', function (d) { return d.target.x; })
        .attr('y2', function (d) { return d.target.y; });

      nodeSel
        .attr('transform', function (d) {
          return 'translate(' + d.x + ',' + d.y + ')';
        });
    });

    /* ── Responsive resize ── */
    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function (entries) {
        var entry = entries[0];
        if (!entry) return;
        var w = entry.contentRect.width || 600;
        var h = entry.contentRect.height || 350;
        svg.attr('viewBox', '0 0 ' + w + ' ' + h);
        simulation.force('center', d3.forceCenter(w / 2, h / 2));
        simulation.alpha(0.3).restart();
      });
      ro.observe(container);
    }
  };
})();
