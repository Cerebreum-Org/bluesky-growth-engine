<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';

  let container: HTMLDivElement;
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const response = await fetch('/api/graph?limit=100&minFollowers=1000');
      if (!response.ok) throw new Error('Failed to fetch graph data');
      const data = await response.json();
      
      createGraph(data);
      loading = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      loading = false;
    }
  });

  function createGraph(data: { nodes: any[], links: any[] }) {
    const width = container.clientWidth;
    const height = 600;

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height]);

    // Color scale by generation
    const color = d3.scaleOrdinal()
      .domain([0, 1, 2, 3, 4, 5])
      .range(['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']);

    // Force simulation
    const simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(20));

    // Links
    const link = svg.append('g')
      .selectAll('line')
      .data(data.links)
      .join('line')
      .attr('stroke', '#94a3b8')
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', 1);

    // Nodes
    const node = svg.append('g')
      .selectAll('circle')
      .data(data.nodes)
      .join('circle')
      .attr('r', (d: any) => Math.sqrt(d.followers) / 10 + 5)
      .attr('fill', (d: any) => color(d.generation) as string)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .call(drag(simulation) as any);

    // Tooltips
    node.append('title')
      .text((d: any) => `${d.name}\n@${d.handle}\n${d.followers.toLocaleString()} followers`);

    // Labels for larger nodes
    const labels = svg.append('g')
      .selectAll('text')
      .data(data.nodes.filter((d: any) => d.followers > 5000))
      .join('text')
      .text((d: any) => d.handle)
      .attr('font-size', 10)
      .attr('dx', 12)
      .attr('dy', 4)
      .style('pointer-events', 'none')
      .style('fill', '#1f2937');

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);

      labels
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y);
    });
  }

  function drag(simulation: any) {
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  }
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
  <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
    Network Graph
  </h2>
  <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
    Interactive visualization of user connections (users with 1000+ followers)
  </p>
  
  {#if loading}
    <div class="flex items-center justify-center h-96">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  {:else if error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
      Error loading graph: {error}
    </div>
  {:else}
    <div bind:this={container} class="w-full"></div>
  {/if}
</div>
