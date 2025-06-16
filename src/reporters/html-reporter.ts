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

  onMetricsCollected(metrics: RequestMetrics[]): void {
    this.currentMetrics = metrics;
  }

  onTestComplete(summary: MetricsSummary): void {
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
    const html = this.generateHtmlReport(this.currentMetrics, summary);
    fs.writeFileSync(htmlFilePath, html);
  }

  private generateHtmlReport(metrics: RequestMetrics[], summary: MetricsSummary): string {
    // Calculate total execution time with millisecond precision
    const totalExecutionTime = Math.abs(
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
      // Keep millisecond precision
      const totalMs = ms;
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
  </style>
</head>
<body class="bg-black-alt font-sans leading-normal tracking-normal">
  <div class="container mx-auto px-4 py-8">
    <header class="mb-8">
      <h1 class="text-4xl font-bold text-gray-100 mb-2 text-center">Symphony Test Report</h1>
      <h2 class="text-2xl text-gray-400 mb-8 text-center">${this.currentTestName}</h2>
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
            <h5 class="text-sm font-bold uppercase text-gray-400">Total Requests</h5>
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
            <h5 class="text-sm font-bold uppercase text-gray-400">Success Rate</h5>
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
            <h5 class="text-sm font-bold uppercase text-gray-400">Requests/sec</h5>
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
            <h5 class="text-sm font-bold uppercase text-gray-400">Error Rate</h5>
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
            <h5 class="text-sm font-bold uppercase text-gray-400">Total Duration</h5>
            <h3 class="text-2xl font-bold text-gray-300">${formatDuration(totalExecutionTime)}</h3>
            <p class="text-xs text-gray-500 mt-1">(Request time)</p>
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
            <h5 class="text-sm font-bold uppercase text-gray-400">Avg Duration</h5>
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
            <h5 class="text-sm font-bold uppercase text-gray-400">P95 Duration</h5>
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
            <h5 class="text-sm font-bold uppercase text-gray-400">P99 Duration</h5>
            <h3 class="text-2xl font-bold text-gray-300">${formatDuration(p99)}</h3>
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

  private formatLocalTime(ts: number): string {
    const d = new Date(ts);
    const ms = d.getMilliseconds().toString().padStart(3, '0');
    return d.toLocaleString().replace(/(\d+:\d+:\d+)/, `$1.${ms}`);
  }
} 