/**
 * Collector Performance Metrics
 * 
 * Monitors if collector is keeping up with firehose and losing data
 */

let metrics = {
  eventsReceived: 0,
  eventsProcessed: 0,
  eventsDropped: 0,
  flushCount: 0,
  flushErrors: 0,
  backpressureEvents: 0,
  lastBackpressureTime: 0,
  queueSizeMax: 0,
  queueSizeCurrent: 0,
  processingTimeMs: [] as number[],
  flushTimeMs: [] as number[],
  startTime: Date.now(),
};

export function recordEventReceived() {
  metrics.eventsReceived++;
}

export function recordEventProcessed(processingTimeMs: number) {
  metrics.eventsProcessed++;
  metrics.processingTimeMs.push(processingTimeMs);
  // Keep only last 1000 samples
  if (metrics.processingTimeMs.length > 1000) {
    metrics.processingTimeMs.shift();
  }
}

export function recordEventDropped() {
  metrics.eventsDropped++;
}

export function recordBackpressure(queueSize: number) {
  metrics.backpressureEvents++;
  metrics.lastBackpressureTime = Date.now();
  if (queueSize > metrics.queueSizeMax) {
    metrics.queueSizeMax = queueSize;
  }
}

export function recordFlush(timeMs: number, success: boolean, queueSize: number) {
  metrics.flushCount++;
  if (!success) metrics.flushErrors++;
  metrics.flushTimeMs.push(timeMs);
  if (metrics.flushTimeMs.length > 100) {
    metrics.flushTimeMs.shift();
  }
  metrics.queueSizeCurrent = queueSize;
}

function avg(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function max(arr: number[]): number {
  return arr.length > 0 ? Math.max(...arr) : 0;
}

export function getHealthStatus() {
  const uptimeSeconds = Math.floor((Date.now() - metrics.startTime) / 1000);
  const eventsPerSecond = metrics.eventsReceived / Math.max(uptimeSeconds, 1);
  const processedPerSecond = metrics.eventsProcessed / Math.max(uptimeSeconds, 1);
  const dropRate = metrics.eventsReceived > 0 
    ? (metrics.eventsDropped / metrics.eventsReceived) * 100 
    : 0;
  
  const avgProcessingTime = avg(metrics.processingTimeMs);
  const maxProcessingTime = max(metrics.processingTimeMs);
  const avgFlushTime = avg(metrics.flushTimeMs);
  const maxFlushTime = max(metrics.flushTimeMs);
  
  const timeSinceBackpressure = metrics.lastBackpressureTime 
    ? Math.floor((Date.now() - metrics.lastBackpressureTime) / 1000)
    : null;
  
  // Health assessment
  const isHealthy = dropRate === 0 && 
                   avgProcessingTime < 100 && 
                   avgFlushTime < 5000;
  
  const warnings = [];
  if (dropRate > 0) warnings.push(`⚠️  DROPPING EVENTS: ${dropRate.toFixed(2)}% drop rate!`);
  if (avgProcessingTime > 50) warnings.push(`⚠️  Slow processing: ${avgProcessingTime.toFixed(0)}ms avg`);
  if (avgFlushTime > 3000) warnings.push(`⚠️  Slow DB writes: ${avgFlushTime.toFixed(0)}ms avg`);
  if (metrics.backpressureEvents > 0 && timeSinceBackpressure !== null && timeSinceBackpressure < 60) {
    warnings.push(`⚠️  Backpressure active ${timeSinceBackpressure}s ago`);
  }
  if (metrics.queueSizeCurrent > 75000) {
    warnings.push(`⚠️  Queue at ${metrics.queueSizeCurrent} items (75% capacity)`);
  }
  
  return {
    healthy: isHealthy,
    warnings,
    stats: {
      uptime: uptimeSeconds,
      eventsReceived: metrics.eventsReceived,
      eventsProcessed: metrics.eventsProcessed,
      eventsDropped: metrics.eventsDropped,
      dropRate: dropRate.toFixed(2) + '%',
      eventsPerSecond: eventsPerSecond.toFixed(1),
      processedPerSecond: processedPerSecond.toFixed(1),
      avgProcessingTimeMs: avgProcessingTime.toFixed(1),
      maxProcessingTimeMs: maxProcessingTime.toFixed(0),
      avgFlushTimeMs: avgFlushTime.toFixed(0),
      maxFlushTimeMs: maxFlushTime.toFixed(0),
      flushCount: metrics.flushCount,
      flushErrors: metrics.flushErrors,
      backpressureEvents: metrics.backpressureEvents,
      timeSinceBackpressureSeconds: timeSinceBackpressure,
      queueSizeCurrent: metrics.queueSizeCurrent,
      queueSizeMax: metrics.queueSizeMax,
    }
  };
}

export function printHealthReport() {
  const health = getHealthStatus();
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 COLLECTOR HEALTH REPORT');
  console.log('='.repeat(60));
  
  console.log(`\n🟢 Status: ${health.healthy ? 'HEALTHY' : '🔴 DEGRADED'}`);
  
  if (health.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    health.warnings.forEach(w => console.log(`   ${w}`));
  }
  
  console.log('\n📈 Performance:');
  console.log(`   Uptime:           ${health.stats.uptime}s`);
  console.log(`   Events received:  ${health.stats.eventsReceived} (${health.stats.eventsPerSecond}/s)`);
  console.log(`   Events processed: ${health.stats.eventsProcessed} (${health.stats.processedPerSecond}/s)`);
  console.log(`   Events dropped:   ${health.stats.eventsDropped} (${health.stats.dropRate})`);
  
  console.log('\n⚡ Timing:');
  console.log(`   Processing: ${health.stats.avgProcessingTimeMs}ms avg, ${health.stats.maxProcessingTimeMs}ms max`);
  console.log(`   Flush:      ${health.stats.avgFlushTimeMs}ms avg, ${health.stats.maxFlushTimeMs}ms max`);
  
  console.log('\n💾 Database:');
  console.log(`   Flushes:        ${health.stats.flushCount}`);
  console.log(`   Flush errors:   ${health.stats.flushErrors}`);
  
  console.log('\n🚦 Backpressure:');
  console.log(`   Events:         ${health.stats.backpressureEvents}`);
  console.log(`   Last occurred:  ${health.stats.timeSinceBackpressureSeconds !== null ? health.stats.timeSinceBackpressureSeconds + 's ago' : 'never'}`);
  console.log(`   Queue current:  ${health.stats.queueSizeCurrent}`);
  console.log(`   Queue peak:     ${health.stats.queueSizeMax}`);
  
  console.log('\n' + '='.repeat(60) + '\n');
}

// Print report every 60 seconds
export function startHealthMonitoring() {
  setInterval(() => {
    printHealthReport();
  }, 60000); // Every 60 seconds
}
