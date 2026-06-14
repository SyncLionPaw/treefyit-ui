import { ref, watch, type Ref } from 'vue'
import * as d3 from 'd3'
import type { FlatNode, LinkData } from '../types'
import { universeNodeColor } from '../utils/colorPalette'

interface SimNode extends d3.SimulationNodeDatum {
  id: string
  title: string
  color: string
  tokenCount: number
  depth: number
  source: string
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
}

interface ForceGraphOptions {
  hoveredNodeId?: Ref<string | null>
  selectedNodeId?: Ref<string | null>
  showLabels?: Ref<boolean>
  onHover?: (id: string | null) => void
  onSelect?: (id: string | null) => void
}

export function useForceGraph(
  svgRef: Ref<SVGSVGElement | null>,
  nodes: Ref<FlatNode[]>,
  links: Ref<LinkData[]>,
  options: ForceGraphOptions = {}
) {
  let simulation: d3.Simulation<SimNode, SimLink> | null = null
  let svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null
  let g: d3.Selection<SVGGElement, unknown, null, undefined> | null = null
  let nodeSel: d3.Selection<SVGGElement, SimNode, SVGGElement, unknown> | null = null
  let linkSel: d3.Selection<SVGLineElement, SimLink, SVGGElement, unknown> | null = null
  let resizeTimer = 0

  const hoveredNodeId = ref<string | null>(null)

  function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value))
  }

  function layoutSettings(count: number) {
    const density = clamp((count - 18) / 110, 0, 1)
    return {
      density,
      linkDistance: Math.round(88 - density * 42),
      charge: -190 + density * 112,
      collidePadding: 14 - density * 8,
      nodeScale: 1 - density * 0.34,
      centerStrength: 0.07 + density * 0.05,
      axisStrength: 0.018 + density * 0.052,
      alphaDecay: 0.007 + density * 0.01,
      labelMaxDepth: count > 70 ? 0 : count > 38 ? 1 : 99,
    }
  }

  function init() {
    if (!svgRef.value) return
    destroy()

    const bounds = svgRef.value.getBoundingClientRect()
    const width = bounds.width || window.innerWidth
    const height = bounds.height || window.innerHeight
    const settings = layoutSettings(nodes.value.length)

    svg = d3.select(svgRef.value)
    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)

    // Main group for zoom
    g = svg.append('g')

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g?.attr('transform', event.transform)
      })
    svg.call(zoom)

    // Create simulation nodes
    const simNodes: SimNode[] = nodes.value.map(n => ({
      id: n.id,
      title: n.title,
      color: universeNodeColor(n),
      tokenCount: n.tokenCount,
      depth: n.depth,
      source: n.source,
      x: width / 2 + (Math.random() - 0.5) * Math.min(80, width * 0.08),
      y: height / 2 + (Math.random() - 0.5) * Math.min(80, height * 0.08),
    }))

    const nodeMap = new Map(simNodes.map(n => [n.id, n]))
    const simLinks: SimLink[] = links.value
      .filter(l => nodeMap.has(l.source) && nodeMap.has(l.target))
      .map(l => ({
        source: l.source,
        target: l.target,
      }))

    simulation = d3.forceSimulation<SimNode>(simNodes)
      .force('center', d3.forceCenter(width / 2, height / 2).strength(settings.centerStrength))
      .force('x', d3.forceX<SimNode>(width / 2).strength(settings.axisStrength))
      .force('y', d3.forceY<SimNode>(height / 2).strength(settings.axisStrength))
      .force('charge', d3.forceManyBody().strength(settings.charge))
      .force('link', d3.forceLink<SimNode, SimLink>(simLinks)
        .id(d => d.id)
        .distance(settings.linkDistance)
        .strength(0.38 + settings.density * 0.2)
      )
      .force('collide', d3.forceCollide<SimNode>().radius(d => radius(d) + settings.collidePadding).strength(0.72))
      .alpha(1)
      .alphaDecay(settings.alphaDecay)
      .on('tick', ticked)

    // Subtle node shadow, aligned with Build diagram nodes rather than a neon glow.
    const defs = svg.append('defs')
    const filter = defs.append('filter').attr('id', 'universe-node-shadow')
    filter
      .append('feDropShadow')
      .attr('dx', '0')
      .attr('dy', '4')
      .attr('stdDeviation', '2')
      .attr('flood-color', 'rgba(0, 0, 0, 0.32)')

    // Draw links
    linkSel = g.append('g').attr('class', 'links')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', 'rgba(255,255,255,0.12)')
      .attr('stroke-width', 1)

    // Draw nodes
    nodeSel = g.append('g').attr('class', 'nodes')
      .selectAll<SVGGElement, SimNode>('g')
      .data(simNodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, SimNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation?.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulation?.alphaTarget(0)
          d.fx = null
          d.fy = null
        })
      )

    // Glow circle
    nodeSel.append('circle')
      .attr('class', 'glow')
      .attr('r', d => radius(d) + 5)
      .attr('fill', d => d.color)
      .attr('opacity', 0.1)

    // Core circle
    nodeSel.append('circle')
      .attr('class', 'core')
      .attr('r', d => radius(d))
      .attr('fill', d => d.color)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .attr('filter', 'url(#universe-node-shadow)')

    // Label
    nodeSel.append('text')
      .attr('class', 'label')
      .attr('dy', d => -radius(d) - 8)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(255,255,255,0.78)')
      .attr('font-size', '10px')
      .attr('font-weight', 700)
      .text(d => d.depth <= settings.labelMaxDepth
        ? (d.title.length > 16 ? `${d.title.slice(0, 16)}…` : d.title)
        : ''
      )

    // Hover events
    nodeSel
      .on('mouseenter', (_, d) => {
        hoveredNodeId.value = d.id
        options.onHover?.(d.id)
      })
      .on('mouseleave', () => {
        hoveredNodeId.value = null
        options.onHover?.(null)
      })
      .on('click', (event, d) => {
        event.stopPropagation()
        options.onSelect?.(d.id)
      })

    svg.on('click', () => options.onSelect?.(null))

    function ticked() {
      linkSel!
        .attr('x1', d => (d.source as SimNode).x!)
        .attr('y1', d => (d.source as SimNode).y!)
        .attr('x2', d => (d.target as SimNode).x!)
        .attr('y2', d => (d.target as SimNode).y!)

      nodeSel!.attr('transform', d => `translate(${d.x},${d.y})`)
    }

    syncVisualState()
    syncLabelState()
  }

  function radius(node: SimNode): number {
    const settings = layoutSettings(nodes.value.length)
    const buildLikeDiameter = Math.max(16, 34 - node.depth * 4)
    return Math.max(5, (buildLikeDiameter * settings.nodeScale) / 2)
  }

  function destroy() {
    simulation?.stop()
    simulation = null
    svg?.selectAll('*').remove()
    g = null
    nodeSel = null
    linkSel = null
  }

  function syncVisualState() {
    const hoverId = options.hoveredNodeId?.value ?? hoveredNodeId.value
    const selectedId = options.selectedNodeId?.value ?? null
    const focusId = hoverId || selectedId

    nodeSel
      ?.classed('is-hovered', d => d.id === hoverId)
      .classed('is-selected', d => d.id === selectedId)
      .classed('is-dimmed', d => Boolean(focusId) && d.id !== focusId)
      .select<SVGCircleElement>('circle.core')
      .attr('transform', d => d.id === hoverId ? 'scale(1.3)' : d.id === selectedId ? 'scale(1.15)' : 'scale(1)')

    nodeSel
      ?.select<SVGCircleElement>('circle.glow')
      .attr('opacity', d => d.id === hoverId ? 0.24 : d.id === selectedId ? 0.18 : 0.1)

    linkSel
      ?.attr('stroke', d => {
        const source = d.source as SimNode
        const target = d.target as SimNode
        return focusId && (source.id === focusId || target.id === focusId)
          ? 'rgba(255,255,255,0.45)'
          : 'rgba(255,255,255,0.12)'
      })
      .attr('stroke-width', d => {
        const source = d.source as SimNode
        const target = d.target as SimNode
        return focusId && (source.id === focusId || target.id === focusId) ? 1.6 : 1
      })
  }

  function syncLabelState() {
    const labelsVisible = options.showLabels?.value ?? true
    const labelSel = nodeSel?.select<SVGTextElement>('text.label')
    if (!labelSel) return
    labelSel
      .style('display', labelsVisible ? '' : 'none')
      .attr('aria-hidden', labelsVisible ? 'false' : 'true')
  }

  const stopDataWatch = watch(
    () => [svgRef.value, nodes.value.length, links.value.length],
    () => {
      if (svgRef.value && nodes.value.length) init()
    },
    { flush: 'post' }
  )

  const stopStateWatch = watch(
    () => [options.hoveredNodeId?.value, options.selectedNodeId?.value, hoveredNodeId.value],
    syncVisualState
  )

  const stopLabelWatch = watch(
    () => options.showLabels?.value,
    syncLabelState
  )

  function handleResize() {
    window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(() => {
      if (svgRef.value && nodes.value.length) init()
    }, 120)
  }

  window.addEventListener('resize', handleResize)

  function teardown() {
    window.removeEventListener('resize', handleResize)
    window.clearTimeout(resizeTimer)
    stopDataWatch()
    stopStateWatch()
    stopLabelWatch()
    destroy()
  }

  return { init, destroy, teardown, hoveredNodeId }
}
