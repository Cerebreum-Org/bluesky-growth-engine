<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';

  let { data } = $props<{ data: any[] }>();
  let container: HTMLDivElement;

  onMount(() => {
    if (!data || data.length === 0) return;
    createChart();
  });

  function createChart() {
    const width = container.clientWidth;
    const height = 300;
    const margin = { top: 20, right: 30, bottom: 40, left: 60 };

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    // Parse dates
    const parseDate = d3.timeParse('%Y-%m-%d');
    const chartData = data.map(d => ({
      date: parseDate(d.date) || new Date(),
      newUsers: +d.new_users
    })).reverse();

    // Scales
    const x = d3.scaleTime()
      .domain(d3.extent(chartData, d => d.date) as [Date, Date])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(chartData, d => d.newUsers) || 100])
      .nice()
      .range([height - margin.bottom, margin.top]);

    // Line
    const line = d3.line<any>()
      .x(d => x(d.date))
      .y(d => y(d.newUsers))
      .curve(d3.curveMonotoneX);

    // Area
    const area = d3.area<any>()
      .x(d => x(d.date))
      .y0(height - margin.bottom)
      .y1(d => y(d.newUsers))
      .curve(d3.curveMonotoneX);

    // Draw area
    svg.append('path')
      .datum(chartData)
      .attr('fill', 'url(#gradient)')
      .attr('d', area);

    // Gradient
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'gradient')
      .attr('x1', '0%')
      .attr('x2', '0%')
      .attr('y1', '0%')
      .attr('y2', '100%');

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#3b82f6')
      .attr('stop-opacity', 0.6);

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#3b82f6')
      .attr('stop-opacity', 0.1);

    // Draw line
    svg.append('path')
      .datum(chartData)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .attr('d', line);

    // X axis
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5))
      .selectAll('text')
      .style('fill', '#6b7280');

    // Y axis
    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5))
      .selectAll('text')
      .style('fill', '#6b7280');

    // Y axis label
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', margin.left - 45)
      .attr('x', -(height / 2))
      .attr('text-anchor', 'middle')
      .style('fill', '#6b7280')
      .style('font-size', '12px')
      .text('New Users');
  }
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
  <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
    Growth Trend
  </h2>
  <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
    New users indexed over the last 30 days
  </p>
  <div bind:this={container} class="w-full"></div>
</div>
