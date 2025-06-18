
/**
 * HtmlReporter
 *
 * Generates a human-friendly HTML report for each test, including:
 * - A table of all requests with URL, method, status, duration (ms), start/end times (local)
 * - Times are shown in milliseconds and as local time strings
 * - The HTML file is saved in the same folder as the corresponding JSON reports
 *
 * Usage: Used by Symphony to generate HTML reports alongside JSON metrics
 */
import fs from 'fs';
import path from 'path';
import { SymphonyReporter, RequestMetrics, MetricsSummary } from '../types';

export class HtmlReporter implements SymphonyReporter {
  private outputDir: string;
  private sessionDir: string | null = null;
  private currentTestName: string = 'unknown-test';
  private currentMetrics: RequestMetrics[] = [];
  private testStartTime: number = Date.now();

  constructor(outputDir: string = 'symphony-metrics') {
    this.outputDir = path.resolve(process.cwd(), outputDir);
  }

  setSessionDir(sessionDir: string) {
    this.sessionDir = sessionDir;
  }

  setCurrentTestName(testName: string) {
    this.currentTestName = testName;
    this.testStartTime = Date.now();
  }

  setCurrentTestInfo(testInfo: any) {
    this.currentTestName = testInfo.title;
    this.testStartTime = Date.now(); // Reset the test start time
    // Store additional testInfo properties as needed
  }

  onMetricsCollected(metrics: RequestMetrics[]): void {
    this.currentMetrics = metrics;
  }

  onTestComplete(summary: MetricsSummary, testInfo: any): void {
    if (!this.sessionDir || this.currentMetrics.length === 0) return;

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const readableTestName = this.currentTestName
      .replace(/[^a-z0-9]/gi, '-')
      .replace(/-+/g, '-')
      .toLowerCase()
      .replace(/^-|-$/g, '');
    const testDuration = Date.now() - this.testStartTime;
    const durationStr = `${Math.round(testDuration / 1000)}s`;
    const htmlFilePath = path.join(
      this.sessionDir,
      `${dateStr}_${timeStr}_test-${readableTestName}_duration-${durationStr}_report.html`
    );
    const html = this.generateHtmlReport(this.currentMetrics, summary, testInfo);
    fs.writeFileSync(htmlFilePath, html);
  }

  private generateHtmlReport(metrics: RequestMetrics[], summary: MetricsSummary, testInfo: any): string {
    // Calculate total execution time with millisecond precision
    // Use testInfo.duration if available, otherwise calculate from metrics
    const totalExecutionTime = testInfo.duration || Math.abs(
      metrics[metrics.length - 1].endTime - metrics[0].startTime
    );

    // Calculate requests per second with higher precision
    const requestsPerSecond = totalExecutionTime > 0
      ? (metrics.length / (totalExecutionTime / 1000)).toFixed(3)
      : '0.000';

    // Format requests per second with smart handling of small numbers
    const formatRequestsPerSecond = (value: string): string => {
      const num = parseFloat(value);
      if (num === 0) return '0.000';
      if (num < 0.001) return num.toExponential(3);
      return num.toFixed(3);
    };

    // Calculate percentiles
    const sortedDurations = [...metrics].sort((a, b) => a.duration - b.duration);
    const p50 = sortedDurations[Math.floor(sortedDurations.length * 0.5)]?.duration || 0;
    const p90 = sortedDurations[Math.floor(sortedDurations.length * 0.9)]?.duration || 0;
    const p95 = sortedDurations[Math.floor(sortedDurations.length * 0.95)]?.duration || 0;
    const p99 = sortedDurations[Math.floor(sortedDurations.length * 0.99)]?.duration || 0;

    // Format duration with millisecond precision
    const formatDuration = (ms: number): string => {
      // Handle edge cases and bounds checking
      if (!ms || ms < 0 || !isFinite(ms)) return '0ms';
      if (ms > 24 * 60 * 60 * 1000) return 'Invalid duration'; // More than 24 hours is likely an error

      const totalMs = Math.floor(ms);
      const seconds = Math.floor(totalMs / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const remainingMs = totalMs % 1000;

      if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s ${remainingMs}ms`;
      }
      if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s ${remainingMs}ms`;
      }
      if (seconds > 0) {
        return `${seconds}s ${remainingMs}ms`;
      }
      return `${remainingMs}ms`;
    };

    const successRate = metrics.length > 0
      ? ((metrics.filter(m => m.status >= 200 && m.status < 300).length / metrics.length) * 100).toFixed(1)
      : '0.0';

    const errorRate = metrics.length > 0
      ? ((metrics.filter(m => m.status >= 400).length / metrics.length) * 100).toFixed(1)
      : '0.0';

    const rows = metrics.map(m => `
      <tr class="hover:bg-gray-800">
        <td class="px-4 py-2 text-gray-300 text-sm">${m.method}</td>
        <td class="px-4 py-2">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style="background-color: ${this.getStatusColor(m.status)}20; color: ${this.getStatusColor(m.status)}">
            ${m.status}
          </span>
        </td>
        <td class="px-4 py-2 text-gray-300 text-sm">${m.url}</td>
        <td class="px-4 py-2 text-gray-300 text-sm">${m.duration} ms</td>
        <td class="px-4 py-2 text-gray-300 text-sm">${this.formatLocalTime(m.startTime)}</td>
        <td class="px-4 py-2 text-gray-300 text-sm">${this.formatLocalTime(m.endTime)}</td>
      </tr>
    `).join('');

    // Extract filename from the file path
    const fileName = testInfo.file ? testInfo.file.split('/').pop() : 'N/A';

    // Extract browser and user agent information from the project
    const browser = testInfo.project?.use?.defaultBrowserType || 'N/A';
    const userAgent = testInfo.project?.use?.userAgent || 'N/A';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Symphony Test Report</title>
  <link rel="stylesheet" href="https://unpkg.com/tailwindcss@2.2.19/dist/tailwind.min.css"/>
  <style>
    .bg-black-alt { background: #191919; }
    .text-black-alt { color: #191919; }
    .border-black-alt { border-color: #191919; }
    .header-title { font-size: 2.5rem; font-weight: bold; color: #f5f5f5; text-align: center; margin-bottom: 1rem; }
    .header-subtitle { font-size: 1.5rem; color: #b0b0b0; text-align: center; margin-bottom: 2rem; }
  </style>
</head>
<body class="bg-black-alt font-sans leading-normal tracking-normal">
  <div class="container mx-auto px-4 py-8">
    <header class="mb-8">
      <h1 class="header-title">Symphony Test Report</h1>
      <div class="bg-gray-900 border border-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
        <div class="overflow-x-auto">
          <table class="w-full">
                        <tbody class="divide-y divide-gray-800">
               <tr>
                 <td class="px-4 py-2 text-gray-300 text-base font-bold">Test Name</td>
                 <td class="px-4 py-2 text-gray-300 text-sm">${this.currentTestName}</td>
               </tr>
               <tr>
                 <td class="px-4 py-2 text-gray-300 text-base font-bold">File</td>
                 <td class="px-4 py-2 text-gray-300 text-sm">${fileName}</td>
               </tr>
               <tr>
                 <td class="px-4 py-2 text-gray-300 text-base font-bold">Browser</td>
                 <td class="px-4 py-2 text-gray-300 text-sm">${browser.charAt(0).toUpperCase() + browser.slice(1)}</td>
               </tr>
               <tr>
                 <td class="px-4 py-2 text-gray-300 text-base font-bold">Status</td>
                 <td class="px-4 py-2 text-sm font-medium" style="color: ${this.getTestStatusColor(testInfo.status)}">
                   ${testInfo.status ? testInfo.status.charAt(0).toUpperCase() + testInfo.status.slice(1) : 'N/A'}
                 </td>
               </tr>
               <tr>
                 <td class="px-4 py-2 text-gray-300 text-base font-bold">Total Duration</td>
                 <td class="px-4 py-2 text-gray-300 text-sm">${testInfo.duration || 'N/A'} ms</td>
               </tr>
               <tr>
                 <td class="px-4 py-2 text-gray-300 text-base font-bold">Tags</td>
                 <td class="px-4 py-2 text-gray-300 text-sm">${testInfo.tags && testInfo.tags.length > 0 ? testInfo.tags.join(', ') : 'None'}</td>
               </tr>
               <tr>
                 <td class="px-4 py-2 text-gray-300 text-base font-bold">Environment</td>
                 <td class="px-4 py-2 text-gray-300 text-sm">Node.js ${process.version}, ${process.platform} ${process.arch}</td>
               </tr>
               <tr>
                 <td class="px-4 py-2 text-gray-300 text-base font-bold">Test Start Time</td>
                 <td class="px-4 py-2 text-gray-300 text-sm">${metrics[0] && metrics[0].startTime ? this.formatLocalTime(metrics[0].startTime) : 'N/A'}</td>
               </tr>
               <tr>
                 <td class="px-4 py-2 text-gray-300 text-base font-bold">Test End Time</td>
                 <td class="px-4 py-2 text-gray-300 text-sm">${(() => {
        if (metrics.length === 0) return 'N/A';
        // Find the latest completed request (with endTime > 0)
        const completedMetrics = metrics.filter(m => m.endTime && m.endTime > 0);
        if (completedMetrics.length === 0) return 'N/A';
        const latestMetric = completedMetrics.reduce((latest, current) =>
          current.endTime > latest.endTime ? current : latest
        );
        return this.formatLocalTime(latestMetric.endTime);
      })()}</td>
               </tr>
            </tbody>
          </table>
        </div>
      </div>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="bg-gray-900 border border-gray-800 rounded-lg shadow-lg p-4">
        <div class="flex items-center">
          <div class="flex-shrink pr-4">
            <div class="rounded p-3 bg-blue-600">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
              </svg>
            </div>
          </div>
          <div class="flex-1 text-right">
            <h5 class="text-sm font-bold uppercase text-gray-400 mb-1">Total Requests</h5>
            <h3 class="text-2xl font-bold text-gray-300">${summary.totalRequests}</h3>
          </div>
        </div>
      </div>

      <div class="bg-gray-900 border border-gray-800 rounded-lg shadow-lg p-4">
        <div class="flex items-center">
          <div class="flex-shrink pr-4">
            <div class="rounded p-3 bg-green-600">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
          </div>
          <div class="flex-1 text-right">
            <h5 class="text-sm font-bold uppercase text-gray-400 mb-1">Success Rate</h5>
            <h3 class="text-2xl font-bold text-gray-300">${successRate}%</h3>
          </div>
        </div>
      </div>

      <div class="bg-gray-900 border border-gray-800 rounded-lg shadow-lg p-4">
        <div class="flex items-center">
          <div class="flex-shrink pr-4">
            <div class="rounded p-3 bg-yellow-600">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
            </div>
          </div>
          <div class="flex-1 text-right">
            <h5 class="text-sm font-bold uppercase text-gray-400 mb-1">Requests/sec</h5>
            <h3 class="text-2xl font-bold text-gray-300">${formatRequestsPerSecond(requestsPerSecond)}</h3>
          </div>
        </div>
      </div>

      <div class="bg-gray-900 border border-gray-800 rounded-lg shadow-lg p-4">
        <div class="flex items-center">
          <div class="flex-shrink pr-4">
            <div class="rounded p-3 bg-red-600">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
          </div>
          <div class="flex-1 text-right">
            <h5 class="text-sm font-bold uppercase text-gray-400 mb-1">Error Rate</h5>
            <h3 class="text-2xl font-bold text-gray-300">${errorRate}%</h3>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="bg-gray-900 border border-gray-800 rounded-lg shadow-lg p-4">
        <div class="flex items-center">
          <div class="flex-shrink pr-4">
            <div class="rounded p-3 bg-purple-600">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
          </div>
          <div class="flex-1 text-right">
            <h5 class="text-sm font-bold uppercase text-gray-400 mb-1">Test Duration</h5>
            <h3 class="text-2xl font-bold text-gray-300">${formatDuration(totalExecutionTime)}</h3>
            <p class="text-xs text-gray-500 mt-1">(Total test time)</p>
          </div>
        </div>
      </div>

      <div class="bg-gray-900 border border-gray-800 rounded-lg shadow-lg p-4">
        <div class="flex items-center">
          <div class="flex-shrink pr-4">
            <div class="rounded p-3 bg-indigo-600">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            </div>
          </div>
          <div class="flex-1 text-right">
            <h5 class="text-sm font-bold uppercase text-gray-400 mb-1">Avg Duration</h5>
            <h3 class="text-2xl font-bold text-gray-300">${formatDuration(summary.averageDuration)}</h3>
          </div>
        </div>
      </div>

      <div class="bg-gray-900 border border-gray-800 rounded-lg shadow-lg p-4">
        <div class="flex items-center">
          <div class="flex-shrink pr-4">
            <div class="rounded p-3 bg-pink-600">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            </div>
          </div>
          <div class="flex-1 text-right">
            <h5 class="text-sm font-bold uppercase text-gray-400 mb-1">P95 Duration</h5>
            <h3 class="text-2xl font-bold text-gray-300">${formatDuration(p95)}</h3>
          </div>
        </div>
      </div>

      <div class="bg-gray-900 border border-gray-800 rounded-lg shadow-lg p-4">
        <div class="flex items-center">
          <div class="flex-shrink pr-4">
            <div class="rounded p-3 bg-teal-600">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            </div>
          </div>
          <div class="flex-1 text-right">
            <h5 class="text-sm font-bold uppercase text-gray-400 mb-1">P99 Duration</h5>
            <h3 class="text-2xl font-bold text-gray-300">${formatDuration(p99)}</h3>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-gray-900 border border-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
      <div class="border-b border-gray-800 p-4">
        <h3 class="text-xl font-bold text-gray-300">Request Timeline</h3>
        <p class="text-sm text-gray-400 mt-1">Visual timeline of HTTP requests showing start times, durations, and overlaps</p>
      </div>
      <div class="p-4">
        <div id="gantt-chart" class="w-full overflow-x-auto">
          ${this.generateGanttChart(metrics)}
        </div>
      </div>
    </div>

    <div class="bg-gray-900 border border-gray-800 rounded-lg shadow-lg overflow-hidden">
      <div class="border-b border-gray-800 p-4">
        <h3 class="text-xl font-bold text-gray-300">Request Details</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="bg-gray-800">
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Method</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">URL</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Duration</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Start Time</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">End Time</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800">
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  private getStatusColor(status: number): string {
    if (status >= 200 && status < 300) return '#4cd964'; // Green for success
    if (status >= 300 && status < 400) return '#5ac8fa'; // Blue for redirect
    if (status >= 400 && status < 500) return '#ff9500'; // Orange for client error
    if (status >= 500) return '#ff3b30'; // Red for server error
    return '#f5f5f7'; // Default color
  }

  private getTestStatusColor(status: string): string {
    if (status === 'passed') return '#4cd964'; // Green for passed
    if (status === 'failed') return '#ff3b30'; // Red for failed
    if (status === 'skipped') return '#ff9500'; // Orange for skipped
    if (status === 'timedOut') return '#ff6b6b'; // Light red for timeout
    return '#f5f5f7'; // Default color for unknown status
  }

  private getLighterStatusColor(status: number): string {
    if (status >= 200 && status < 300) return '#7dd87f'; // Lighter green for success
    if (status >= 300 && status < 400) return '#8dd3f7'; // Lighter blue for redirect
    if (status >= 400 && status < 500) return '#ffb366'; // Lighter orange for client error
    if (status >= 500) return '#ff7a7a'; // Lighter red for server error
    return '#f5f5f7'; // Default color
  }

  private formatLocalTime(ts: number): string {
    const d = new Date(ts);
    const ms = d.getMilliseconds().toString().padStart(3, '0');
    return d.toLocaleString().replace(/(\d+:\d+:\d+)/, `$1.${ms}`);
  }

  private generateGanttChart(metrics: RequestMetrics[]): string {
    if (metrics.length === 0) {
      return '<div class="text-gray-400 text-center py-8">No requests to display</div>';
    }

    // Filter out incomplete requests and sort by start time
    const completedMetrics = metrics.filter(m => m.endTime && m.endTime > 0 && m.startTime).sort((a, b) => a.startTime - b.startTime);

    if (completedMetrics.length === 0) {
      return '<div class="text-gray-400 text-center py-8">No completed requests to display</div>';
    }

    const minTime = Math.min(...completedMetrics.map(m => m.startTime));
    const maxTime = Math.max(...completedMetrics.map(m => m.endTime));
    const totalDuration = maxTime - minTime;

    // Chart dimensions - use full available width
    const leftMargin = 50;
    const rightMargin = 50;
    const topMargin = 50; // More space for timeline
    const bottomMargin = 30;
    const barHeight = 21; // 70% of original 30px
    const rowHeight = 28; // Reduced spacing between bars
    const chartHeight = completedMetrics.length * rowHeight + 80; // Adjusted for new dimensions
    const previewHeight = Math.ceil(2.5 * rowHeight) + 80; // Height for 2.5 bars preview

    // Use 100% width, will be constrained by container
    const chartWidth = 1000; // Base width for calculations
    const availableWidth = chartWidth - leftMargin - rightMargin;

    // Generate time scale markers
    const timeMarkers = [];
    const markerCount = 10;
    for (let i = 0; i <= markerCount; i++) {
      const time = minTime + (totalDuration * i / markerCount);
      const x = leftMargin + (availableWidth * i / markerCount);
      timeMarkers.push({ time, x, label: `+${Math.round((time - minTime))}ms` });
    }

    // Generate request bars
    const requestBars = completedMetrics.map((metric, index) => {
      const startX = leftMargin + ((metric.startTime - minTime) / totalDuration) * availableWidth;
      const width = ((metric.endTime - metric.startTime) / totalDuration) * availableWidth;
      const y = topMargin + index * rowHeight;
      const color = this.getLighterStatusColor(metric.status);

      return {
        x: startX,
        y,
        width: Math.max(width, 2), // Minimum 2px width for visibility
        height: barHeight,
        color,
        metric,
        index
      };
    });

    return `
      <div id="gantt-container" style="position: relative; width: 100%; background: #1a202c; border-radius: 8px; overflow: hidden; min-width: 100%;">
        <!-- Fixed Timeline Header -->
        <div style="position: relative; width: 100%; height: 40px; background: #1a202c; border-bottom: 1px solid #374151;">
          <svg width="100%" height="40" viewBox="0 0 ${chartWidth} 40" style="width: 100%; height: 100%;">
            <!-- Time axis labels -->
            ${timeMarkers.map(marker => `
              <text x="${marker.x}" y="25" fill="#9CA3AF" font-size="12" text-anchor="middle">
                ${marker.label}
              </text>
            `).join('')}
            <!-- Start guideline (yellow) -->
            <line x1="${leftMargin}" y1="0" x2="${leftMargin}" y2="40" 
                  stroke="#fbbf24" stroke-width="2" opacity="0.8"/>
            <!-- End guideline (blue) -->
            <line x1="${leftMargin + availableWidth}" y1="0" x2="${leftMargin + availableWidth}" y2="40" 
                  stroke="#3b82f6" stroke-width="2" opacity="0.8"/>
          </svg>
        </div>
        
        <!-- Chart Content -->
        <div id="gantt-chart-content" style="position: relative; width: 100%; height: ${previewHeight}px; overflow: hidden; transition: height 0.3s ease;">
          <svg width="100%" height="${chartHeight}" viewBox="0 0 ${chartWidth} ${chartHeight}" style="width: 100%;">
            <!-- Background grid lines -->
            ${timeMarkers.map(marker => `
              <line x1="${marker.x}" y1="0" x2="${marker.x}" y2="${chartHeight}" 
                    stroke="#374151" stroke-width="1" opacity="0.3"/>
            `).join('')}
            
            <!-- Start guideline (yellow) -->
            <line x1="${leftMargin}" y1="0" x2="${leftMargin}" y2="${chartHeight}" 
                  stroke="#fbbf24" stroke-width="2" opacity="0.8"/>
            <!-- End guideline (blue) -->
            <line x1="${leftMargin + availableWidth}" y1="0" x2="${leftMargin + availableWidth}" y2="${chartHeight}" 
                  stroke="#3b82f6" stroke-width="2" opacity="0.8"/>
            
            <!-- Request bars -->
            ${requestBars.map(bar => `
              <rect x="${bar.x}" y="${bar.y - topMargin + 10}" width="${bar.width}" height="${bar.height}" 
                    fill="${bar.color}" opacity="0.6" rx="4" 
                    data-tooltip="true"
                    data-method="${bar.metric.method}"
                    data-status="${bar.metric.status}"
                    data-url="${bar.metric.url}"
                    data-duration="${bar.metric.duration}"
                    data-start="${this.formatLocalTime(bar.metric.startTime)}"
                    data-end="${this.formatLocalTime(bar.metric.endTime)}"
                    style="cursor: pointer; transition: opacity 0.2s;"
                    onmouseover="this.style.opacity='0.9'; window.showTooltip(event, this);"
                    onmouseout="this.style.opacity='0.6'; window.hideTooltip();"
                    />
            `).join('')}
          </svg>
        </div>
        
        <!-- Toggle Button -->
        <div style="text-align: center; padding: 10px; border-top: 1px solid #374151;">
          <button id="gantt-toggle" onclick="window.toggleGantt()" 
                  style="background: #374151; color: #e5e7eb; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; transition: background 0.2s;">
            View Full Timeline
          </button>
        </div>
        
        <!-- Tooltip -->
        <div id="gantt-tooltip" style="position: absolute; background: #374151; color: white; padding: 8px 12px; border-radius: 6px; font-size: 12px; pointer-events: none; opacity: 0; transition: opacity 0.2s; z-index: 10; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
        </div>
      </div>
      
      <script>
        window.showTooltip = function(event, element) {
          const tooltip = document.getElementById('gantt-tooltip');
          if (!tooltip) return;
          
          const method = element.getAttribute('data-method');
          const status = element.getAttribute('data-status');
          const url = element.getAttribute('data-url');
          const duration = element.getAttribute('data-duration');
          const start = element.getAttribute('data-start');
          const end = element.getAttribute('data-end');
          
          tooltip.innerHTML = 
            '<div><strong>' + method + ' ' + url + '</strong></div>' +
            '<div>Status: ' + status + '</div>' +
            '<div>Duration: ' + duration + 'ms</div>' +
            '<div>Start: ' + start + '</div>' +
            '<div>End: ' + end + '</div>';
          
          // Show tooltip first to get dimensions
          tooltip.style.opacity = '1';
          
          const container = tooltip.parentElement;
          const containerRect = container.getBoundingClientRect();
          const tooltipRect = tooltip.getBoundingClientRect();
          
          // Calculate position with padding below the bar and edge detection
          let left = event.clientX - containerRect.left;
          let top = event.clientY - containerRect.top + 40; // 40px below cursor
          
          // Prevent horizontal clipping
          if (left + tooltipRect.width > containerRect.width) {
            left = containerRect.width - tooltipRect.width - 10;
          }
          if (left < 10) {
            left = 10;
          }
          
          // Prevent vertical clipping
          if (top + tooltipRect.height > containerRect.height) {
            top = event.clientY - containerRect.top - tooltipRect.height - 10; // Show above cursor
          }
          if (top < 10) {
            top = 10;
          }
          
          tooltip.style.left = left + 'px';
          tooltip.style.top = top + 'px';
        }
        
        window.hideTooltip = function() {
          const tooltip = document.getElementById('gantt-tooltip');
          if (tooltip) {
            tooltip.style.opacity = '0';
          }
        }
        
        window.toggleGantt = function() {
          const content = document.getElementById('gantt-chart-content');
          const button = document.getElementById('gantt-toggle');
          if (!content || !button) return;
          
          const isExpanded = content.style.height !== '${previewHeight}px';
          
          if (isExpanded) {
            // Collapse
            content.style.height = '${previewHeight}px';
            button.textContent = 'View Full Timeline';
            button.style.background = '#374151';
          } else {
            // Expand
            content.style.height = '${chartHeight}px';
            button.textContent = 'Hide Full Timeline';
            button.style.background = '#4f46e5';
          }
        }
        
        // Hover effect for button
        document.addEventListener('DOMContentLoaded', function() {
          const button = document.getElementById('gantt-toggle');
          if (button) {
            button.addEventListener('mouseenter', function() {
              if (this.textContent === 'View Full Timeline') {
                this.style.background = '#4b5563';
              } else {
                this.style.background = '#5b21b6';
              }
            });
            button.addEventListener('mouseleave', function() {
              if (this.textContent === 'View Full Timeline') {
                this.style.background = '#374151';
              } else {
                this.style.background = '#4f46e5';
              }
            });
          }
        });
      </script>
    `;
  }
} 