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
      <div id="timelineHeader" class="border-b border-gray-800 p-4">
        <h3 class="text-xl font-bold text-gray-300">Request Timeline</h3>
      </div>
      <div class="p-4">
        <canvas id="ganttChart" width="800" height="400" class="w-full border border-gray-700 rounded"></canvas>
        <div id="tooltip" class="absolute bg-gray-800 text-white p-2 rounded shadow-lg text-sm hidden z-10 border border-gray-600"></div>
        <div class="flex justify-center mt-4">
          <button id="expandCollapseBtn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors duration-200">
            View Full Timeline
          </button>
        </div>
        <div class="flex justify-center mt-2">
          <div id="chevronIndicator" class="text-blue-400 text-lg animate-pulse transition-transform duration-300" style="text-shadow: 0 0 8px #3b82f6;">
            ⌄
          </div>
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

  <script>
    // Gantt Chart Implementation
    const canvas = document.getElementById('ganttChart');
    const ctx = canvas.getContext('2d');
    const tooltip = document.getElementById('tooltip');
    
    // Gantt chart expansion state
    let isExpanded = false;
    
    // Set canvas size based on container and expansion state
    function resizeCanvas() {
      const container = canvas.parentElement;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width - 32; // Account for padding
      
      if (isExpanded) {
        canvas.height = Math.max(300, metrics.length * 30 + 80); // Updated for new spacing (26 + 4 padding)
      } else {
        // Show approximately 5 bars when collapsed (doubled from 2.5)
        canvas.height = Math.max(200, 5 * 30 + 80); // Updated for new spacing
      }
    }
    
    // Request data
    const metrics = ${JSON.stringify(metrics.map(m => ({
        url: m.url,
        method: m.method,
        startTime: m.startTime,
        endTime: m.endTime,
        duration: m.duration,
        status: m.status
      })))};
    
    // Chart configuration
    const chartPadding = { top: 80, right: 50, bottom: 50, left: 50 }; // Increased top padding for title and timeline
    let chartWidth, chartHeight;
    let hoveredMetricIndex = -1;
    
    // Calculate time range
    const minTime = Math.min(...metrics.map(m => m.startTime));
    const maxTime = Math.max(...metrics.map(m => m.endTime));
    const timeRange = maxTime - minTime;
    
    // Colors for different HTTP methods
    const methodColors = {
      'GET': '#4CAF50',
      'POST': '#2196F3', 
      'PUT': '#FF9800',
      'DELETE': '#F44336',
      'PATCH': '#9C27B0',
      'HEAD': '#607D8B',
      'OPTIONS': '#795548'
    };
    
    function drawChart() {
      resizeCanvas();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      chartWidth = canvas.width - chartPadding.left - chartPadding.right;
      chartHeight = canvas.height - chartPadding.top - chartPadding.bottom;
      
      // Draw background
      ctx.fillStyle = '#1a202c';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw guiding intervals (vertical grid lines)
      drawGuidingIntervals();
      
      // Draw time axes (top and bottom)
      drawTimeAxis();
      
      // Draw request bars (only visible ones when collapsed)
      metrics.forEach((metric, index) => {
        // In collapsed mode, only draw first few bars that fit in the visible area
        if (isExpanded || index < 6) { // Show first 6 bars when collapsed (so 6th bar is partially visible)
          drawRequestBar(metric, index, index === hoveredMetricIndex);
        }
      });
      
      // Draw gradient overlay in collapsed mode to indicate more content
      if (!isExpanded) {
        const gradient = ctx.createLinearGradient(0, chartPadding.top, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(26, 32, 44, 0.05)'); // 5% opacity at top
        gradient.addColorStop(1, 'rgba(26, 32, 44, 0.8)'); // 80% opacity at bottom
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      // Draw mouse guide line
      drawMouseGuide();
    }
    
    function drawTimeAxis() {
      const bottomY = chartPadding.top + chartHeight + 10;
      const topY = chartPadding.top - 10;
      
      // Draw timeline background (transparent strip)
      ctx.fillStyle = 'rgba(74, 85, 104, 0.1)'; // Very transparent background
      ctx.fillRect(chartPadding.left, topY - 25, chartWidth, 35); // Top timeline background
      // Only draw bottom timeline background when expanded
      if (isExpanded) {
        ctx.fillRect(chartPadding.left, bottomY, chartWidth, 35); // Bottom timeline background
      }
      
      // Draw bottom axis line (only when expanded)
      if (isExpanded) {
        ctx.strokeStyle = '#4a5568';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(chartPadding.left, bottomY);
        ctx.lineTo(chartPadding.left + chartWidth, bottomY);
        ctx.stroke();
      }
      
      // Draw top axis line
      ctx.strokeStyle = '#4a5568';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chartPadding.left, topY);
      ctx.lineTo(chartPadding.left + chartWidth, topY);
      ctx.stroke();
      
      const numTicks = 5;
      for (let i = 0; i <= numTicks; i++) {
        const relativeTime = (timeRange * i / numTicks);
        const x = chartPadding.left + (chartWidth * i / numTicks);
        
        // Draw bottom ticks (only when expanded)
        if (isExpanded) {
          ctx.strokeStyle = '#4a5568';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, bottomY);
          ctx.lineTo(x, bottomY + 5);
          ctx.stroke();
        }
        
        // Draw top ticks
        ctx.strokeStyle = '#4a5568';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, topY);
        ctx.lineTo(x, topY - 5);
        ctx.stroke();
        
        // Create timeline labels (simple text, no background boxes)
        const timeStr = '+' + Math.round(relativeTime) + 'ms';
        
        // Draw bottom timeline labels (only when expanded)
        if (isExpanded) {
          ctx.fillStyle = '#e2e8f0';
          ctx.font = '13px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(timeStr, x, bottomY + 20);
        }
        
        // Draw top timeline labels
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '13px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(timeStr, x, topY - 15);
      }
      
      // Draw test start guideline (yellow)
      ctx.strokeStyle = '#fbbf24'; // Yellow
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(chartPadding.left, chartPadding.top);
      ctx.lineTo(chartPadding.left, chartPadding.top + chartHeight);
      ctx.stroke();
      
      // Draw test end guideline (blue)
      ctx.strokeStyle = '#3b82f6'; // Blue
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(chartPadding.left + chartWidth, chartPadding.top);
      ctx.lineTo(chartPadding.left + chartWidth, chartPadding.top + chartHeight);
      ctx.stroke();
      
      // Reset line dash for other drawings
      ctx.setLineDash([]);
    }
    
    function drawGuidingIntervals() {
      // Draw subtle vertical grid lines at regular intervals
      const numIntervals = 10; // More intervals for finer grid
      ctx.strokeStyle = 'rgba(156, 163, 175, 0.2)'; // Very subtle gray lines
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]); // Dotted lines
      
      for (let i = 1; i < numIntervals; i++) { // Skip first and last (they're the guidelines)
        const x = chartPadding.left + (chartWidth * i / numIntervals);
        ctx.beginPath();
        ctx.moveTo(x, chartPadding.top);
        ctx.lineTo(x, chartPadding.top + chartHeight);
        ctx.stroke();
      }
      
      ctx.setLineDash([]); // Reset line dash
    }
    
    function drawRequestBar(metric, index, isHovered = false) {
      const y = chartPadding.top + (index * 26) + 10; // Reduced spacing from 28 to 26
      const barHeight = 16; // Reduced from 20 to 16 (80% of original)
      const borderRadius = 4;
      
      // Calculate bar position and width
      const startX = chartPadding.left + ((metric.startTime - minTime) / timeRange) * chartWidth;
      const endX = chartPadding.left + ((metric.endTime - minTime) / timeRange) * chartWidth;
      const barWidth = Math.max(endX - startX, 2); // Minimum width of 2px
      
      // Get color based on HTTP method
      const color = methodColors[metric.method] || '#6b7280';
      
      // Adjust opacity based on hover state
      const baseOpacity = isHovered ? 'FF' : 'A6'; // 100% opacity on hover, 65% normally (increased from 54% to 65%)
      
      // Draw rounded bar background
      ctx.fillStyle = color + baseOpacity;
      drawRoundedRect(ctx, startX, y, barWidth, barHeight, borderRadius, true, false);
      
      // Draw rounded bar border (darker on hover)
      ctx.strokeStyle = isHovered ? color : color + 'CC'; // Full opacity on hover, slightly transparent normally
      ctx.lineWidth = isHovered ? 2 : 1; // Thicker border on hover
      drawRoundedRect(ctx, startX, y, barWidth, barHeight, borderRadius, false, true);
      
      // No left panel labels - all info available in tooltip
      
      // Store bar info for hover detection
      metric._barInfo = { x: startX, y, width: barWidth, height: barHeight };
    }
    
    // Helper function to draw rounded rectangles
    function drawRoundedRect(ctx, x, y, width, height, radius, fill, stroke) {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      
      if (fill) {
        ctx.fill();
      }
      if (stroke) {
        ctx.stroke();
      }
    }
    

    
    // Mouse event handlers
    let mouseGuideX = -1;
    
    function drawMouseGuide() {
      if (mouseGuideX >= chartPadding.left && mouseGuideX <= chartPadding.left + chartWidth) {
        // Draw vertical white guide line (solid)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mouseGuideX, chartPadding.top);
        ctx.lineTo(mouseGuideX, chartPadding.top + chartHeight);
        ctx.stroke();
      }
    }
    
    // Create timeline tooltip
    const timelineTooltip = document.createElement('div');
    timelineTooltip.style.position = 'absolute';
    timelineTooltip.style.background = 'linear-gradient(135deg, #4b5563, #374151)'; // Dark gray gradient from lighter to darker
    timelineTooltip.style.color = '#ffffff'; // white text
    timelineTooltip.style.padding = '8px 12px';
    timelineTooltip.style.borderRadius = '6px';
    timelineTooltip.style.fontSize = '12px';
    timelineTooltip.style.fontFamily = 'monospace';
    timelineTooltip.style.border = '1px solid #374151';
    timelineTooltip.style.pointerEvents = 'none';
    timelineTooltip.style.zIndex = '1001';
    timelineTooltip.style.display = 'none';
    timelineTooltip.style.whiteSpace = 'nowrap';
    timelineTooltip.style.transition = 'none'; // Remove any transitions
    
    // Create animated pointer
    const timelinePointer = document.createElement('div');
    timelinePointer.style.position = 'absolute';
    timelinePointer.style.color = '#ffffff'; // White color
    timelinePointer.style.fontSize = '16px';
    timelinePointer.style.pointerEvents = 'none';
    timelinePointer.style.zIndex = '1000';
    timelinePointer.style.display = 'none';
    timelinePointer.style.textAlign = 'center';
    timelinePointer.style.width = '20px';
    timelinePointer.style.marginLeft = '-10px'; // Center the pointer
    timelinePointer.innerHTML = '▼';
    
    // Keep pointer simple without animations
    timelinePointer.style.opacity = '0.8';
    
    document.body.appendChild(timelineTooltip);
    document.body.appendChild(timelinePointer);
    
    // Get expand/collapse button and add click handler
    const expandCollapseBtn = document.getElementById('expandCollapseBtn');
    const chevronIndicator = document.getElementById('chevronIndicator');
    const timelineHeader = document.getElementById('timelineHeader');
    expandCollapseBtn.addEventListener('click', () => {
      isExpanded = !isExpanded;
      expandCollapseBtn.textContent = isExpanded ? 'Collapse Timeline' : 'View Full Timeline';
      // Rotate chevron 180 degrees when expanded
      chevronIndicator.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
      // Hide/show timeline header border based on expansion state
      timelineHeader.style.borderBottom = isExpanded ? '1px solid #374151' : 'none';
      drawChart(); // Redraw with new size
    });
    
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Always update mouse guide position
      mouseGuideX = mouseX;
      
      let hoveredMetric = null;
      let newHoveredIndex = -1;
      
      // Check if mouse is over any visible request bar
      metrics.forEach((metric, index) => {
        // Only check hover for visible bars
        if ((isExpanded || index < 6) && metric._barInfo) {
          const { x, y, width, height } = metric._barInfo;
          if (mouseX >= x && mouseX <= x + width && mouseY >= y && mouseY <= y + height) {
            hoveredMetric = metric;
            newHoveredIndex = index;
          }
        }
      });
      
      // Show timeline tooltip only when hovering over a Gantt bar
      if (hoveredMetric && hoveredMetric._barInfo) {
        // Calculate the time at mouse position with high precision
        const relativeTime = ((mouseX - chartPadding.left) / chartWidth) * timeRange;
        const absoluteTime = minTime + relativeTime;
        
        // Format relative duration (rounded to nearest millisecond)
        const relativeDuration = Math.round(relativeTime);
        const relativeDurationStr = \`+\${relativeDuration}ms\`;
        
        // Format absolute time with millisecond precision (time only, no date)
        const formatTimeWithMs = (ts) => {
          const d = new Date(ts);
        const ms = d.getMilliseconds().toString().padStart(3, '0');
          return d.toLocaleTimeString().replace(/(\\d+:\\d+:\\d+)/, \`$1.\${ms}\`);
        };
        
        const formattedAbsoluteTime = formatTimeWithMs(absoluteTime);
        
        // Combine both formats
        const combinedTime = \`\${relativeDurationStr}, \${formattedAbsoluteTime}\`;
        
        // Show timeline tooltip and pointer
        timelineTooltip.style.display = 'block';
        timelinePointer.style.display = 'block';
        timelineTooltip.textContent = combinedTime;
        
        // Position pointer with small padding above the hovered bar
        const pointerTop = rect.top + hoveredMetric._barInfo.y - 18; // Position with 2px padding above bar top
        timelinePointer.style.left = e.pageX + 'px';
        timelinePointer.style.top = (pointerTop + window.scrollY) + 'px';
        
        // Center tooltip above the pointer
        const tooltipWidth = timelineTooltip.offsetWidth || 150; // Estimate width if not measured
        const tooltipTop = pointerTop - 35 + window.scrollY; // 35px above pointer
        timelineTooltip.style.left = (e.pageX - tooltipWidth / 2) + 'px'; // Center on mouse
        timelineTooltip.style.top = tooltipTop + 'px';
      } else {
        timelineTooltip.style.display = 'none';
        timelinePointer.style.display = 'none';
      }
      
      // Always redraw to update mouse guide
      if (newHoveredIndex !== hoveredMetricIndex) {
        hoveredMetricIndex = newHoveredIndex;
      }
      drawChart();
      
      if (hoveredMetric) {
        // Show tooltip just below the gantt bar with padding
        tooltip.style.display = 'block';
        const rect = canvas.getBoundingClientRect();
        const barBottom = rect.top + hoveredMetric._barInfo.y + hoveredMetric._barInfo.height + 10; // 10px padding below bar
        tooltip.style.left = (e.pageX + 10) + 'px';
        tooltip.style.top = (barBottom + window.scrollY) + 'px';
        
        // Format timestamps with millisecond precision (same as formatLocalTime method)
        const formatTimeWithMs = (ts) => {
          const d = new Date(ts);
          const ms = d.getMilliseconds().toString().padStart(3, '0');
          return d.toLocaleString().replace(/(\\d+:\\d+:\\d+)/, \`$1.\${ms}\`);
        };
        
        const startTime = formatTimeWithMs(hoveredMetric.startTime);
        const endTime = formatTimeWithMs(hoveredMetric.endTime);
        tooltip.innerHTML = \`
          <div class="font-bold">\${hoveredMetric.method} \${hoveredMetric.status}</div>
          <div class="mt-1">\${hoveredMetric.url}</div>
          <div class="mt-1 text-xs text-gray-300">
            <div>Duration: \${hoveredMetric.duration}ms</div>
            <div>Start: \${startTime}</div>
            <div>End: \${endTime}</div>
          </div>
        \`;
        
        canvas.style.cursor = 'pointer';
      } else {
        // Hide tooltip
        tooltip.style.display = 'none';
        canvas.style.cursor = 'default';
      }
    });
    
    canvas.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
      timelineTooltip.style.display = 'none';
      timelinePointer.style.display = 'none';
      canvas.style.cursor = 'default';
      mouseGuideX = -1; // Clear mouse guide
      if (hoveredMetricIndex !== -1) {
        hoveredMetricIndex = -1;
        drawChart();
      }
    });
    
    // Initial draw
    window.addEventListener('load', () => {
      // Set initial border state for collapsed view
      if (timelineHeader) {
        timelineHeader.style.borderBottom = 'none'; // Start collapsed
      }
      drawChart();
    });
    window.addEventListener('resize', drawChart);
  </script>
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

  private formatLocalTime(ts: number): string {
    const d = new Date(ts);
    const ms = d.getMilliseconds().toString().padStart(3, '0');
    return d.toLocaleString().replace(/(\d+:\d+:\d+)/, `$1.${ms}`);
  }
} 