import { Page, Request, Response } from 'playwright';
import { RequestMetrics, MetricsSummary, SymphonyConfig, SymphonyReporter, RenderingMetrics } from './types';
import { JsonReporter } from './reporters/json-reporter';

declare global {
  interface Window {
    __symphony_metrics?: Record<string, number>;
  }
}

/**
 * Symphony - A performance testing extension for Playwright
 * Automatically collects request/response timing metrics
 */
export class Symphony {
  private static instance: Symphony;
  private config: SymphonyConfig;
  private metrics: RequestMetrics[] = [];
  private reporter: SymphonyReporter;
  private requestMap: Map<string, RequestMetrics> = new Map();
  private currentTestName: string = 'unknown-test';
  private testStartTime: number = Date.now();
  private enabled: boolean = false;
  private page: Page | null = null;

  private constructor(config: SymphonyConfig = {}) {
    this.config = {
      outputDir: 'symphony-metrics',
      enabled: true,
      verbose: false,
      collectRenderingMetrics: true,
      ...config
    };
    console.log('[Symphony] Initializing with config:', this.config);
    this.reporter = new JsonReporter(this.config.outputDir);
  }

  /**
   * Get the singleton instance of Symphony
   */
  public static getInstance(config?: SymphonyConfig): Symphony {
    if (!Symphony.instance) {
      Symphony.instance = new Symphony(config);
    }
    return Symphony.instance;
  }

  /**
   * Set a custom reporter
   */
  public setReporter(reporter: SymphonyReporter): void {
    console.log('[Symphony] Setting new reporter');
    this.reporter = reporter;
  }

  /**
   * Enable Symphony for a specific page
   */
  public async enable(page: Page, testName?: string): Promise<void> {
    if (this.enabled) {
      console.log('[Symphony] Already enabled');
      return;
    }

    console.log('[Symphony] Enabling performance tracking');
    this.enabled = true;
    this.metrics = [];
    this.testStartTime = Date.now();
    this.page = page;

    if (testName) {
      this.currentTestName = testName;
      if (this.reporter instanceof JsonReporter) {
        this.reporter.setCurrentTestName(testName);
      }
    }

    // Track requests
    page.on('request', (request: Request) => this.trackRequestStart(request));
    page.on('response', (response: Response) => this.trackRequestEnd(response));

    // Set up performance observer for rendering metrics
    if (this.config.collectRenderingMetrics) {
      await this.setupPerformanceObserver(page);
    }

    // Set up page close listener to ensure we get the summary
    page.on('close', () => {
      console.log('[Symphony] Page closed, getting final summary');
      this.getSummary();
    });
  }

  private async setupPerformanceObserver(page: Page): Promise<void> {
    await page.evaluate(() => {
      // Create a performance observer for web vitals
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          // Store the metrics in window.__symphony_metrics
          if (!window.__symphony_metrics) {
            window.__symphony_metrics = {};
          }
          window.__symphony_metrics[entry.name] = entry.startTime;
        });
      });

      // Observe various performance metrics
      observer.observe({
        entryTypes: [
          'paint',
          'largest-contentful-paint',
          'first-input',
          'layout-shift',
          'element'
        ]
      });
    });
  }

  async getRenderingMetrics(): Promise<RenderingMetrics> {
    if (!this.enabled || !this.page) {
      throw new Error('Symphony is not enabled');
    }

    const metrics = await this.page.evaluate(() => {
      const perf = performance;
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      const lcp = performance.getEntriesByType('largest-contentful-paint')[0];
      const fid = performance.getEntriesByType('first-input')[0];
      const cls = performance.getEntriesByType('layout-shift')
        .reduce((sum, entry) => sum + (entry as any).value, 0);

      return {
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        largestContentfulPaint: lcp?.startTime || 0,
        timeToInteractive: nav.domInteractive - nav.fetchStart,
        domContentLoaded: nav.domContentLoadedEventEnd - nav.fetchStart,
        load: nav.loadEventEnd - nav.fetchStart,
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
        firstInputDelay: fid?.duration || 0,
        cumulativeLayoutShift: cls,
        totalBlockingTime: this.calculateTotalBlockingTime(),
        speedIndex: this.calculateSpeedIndex()
      };
    });

    return metrics;
  }

  private calculateTotalBlockingTime(): number {
    const longTasks = performance.getEntriesByType('longtask');
    return longTasks.reduce((sum, task) => sum + task.duration, 0);
  }

  private calculateSpeedIndex(): number {
    const paint = performance.getEntriesByType('paint');
    const firstPaint = paint.find(p => p.name === 'first-paint')?.startTime || 0;
    const lastPaint = paint[paint.length - 1]?.startTime || 0;
    return lastPaint - firstPaint;
  }

  private trackRequestStart(request: Request): void {
    if (!this.enabled) return;

    const timing = request.timing();
    this.metrics.push({
      url: request.url(),
      method: request.method(),
      startTime: timing.startTime,
      endTime: 0,
      duration: 0,
      status: 0,
      requestSize: 0,
      responseSize: 0,
      headers: request.headers(),
      timing: {
        dnsStart: timing.domainLookupStart,
        dnsEnd: timing.domainLookupEnd,
        connectStart: timing.connectStart,
        connectEnd: timing.connectEnd,
        sslStart: timing.secureConnectionStart,
        sslEnd: timing.connectEnd,
        requestStart: timing.requestStart,
        requestEnd: timing.responseStart,
        responseStart: timing.responseStart,
        responseEnd: timing.responseEnd
      }
    });
  }

  private trackRequestEnd(response: Response): void {
    if (!this.enabled) return;

    const request = response.request();
    const timing = request.timing();
    const metric = this.metrics.find(m => m.url === request.url() && m.method === request.method());

    if (metric) {
      metric.endTime = timing.responseEnd;
      metric.duration = timing.responseEnd - timing.startTime;
      metric.status = response.status();
      metric.requestSize = request.postData()?.length || 0;
      metric.responseSize = response.headers()['content-length'] ?
        parseInt(response.headers()['content-length']) : 0;
    }

    // Report metrics when request completes
    this.reporter.onMetricsCollected(this.metrics);
  }

  /**
   * Get all collected metrics
   */
  public getMetrics(): RequestMetrics[] {
    return this.metrics;
  }

  /**
   * Get a summary of all metrics
   */
  public getSummary(): MetricsSummary {
    console.log('[Symphony] Generating summary for test:', this.currentTestName);

    const summary = {
      totalRequests: this.metrics.length,
      averageDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      requestsByStatus: {} as Record<number, number>,
      requestsByMethod: {} as Record<string, number>
    };

    let completedRequests = 0;

    this.metrics.forEach(metric => {
      if (metric.duration > 0) {  // Only include completed requests
        completedRequests++;
        // Duration stats
        summary.averageDuration += metric.duration;
        summary.minDuration = Math.min(summary.minDuration, metric.duration);
        summary.maxDuration = Math.max(summary.maxDuration, metric.duration);

        // Status counts
        summary.requestsByStatus[metric.status] = (summary.requestsByStatus[metric.status] || 0) + 1;

        // Method counts
        summary.requestsByMethod[metric.method] = (summary.requestsByMethod[metric.method] || 0) + 1;
      }
    });

    if (completedRequests > 0) {
      summary.averageDuration = Math.round(summary.averageDuration / completedRequests);
    }

    console.log('[Symphony] Generated summary:', summary);
    this.reporter.onTestComplete(summary);
    return summary;
  }

  /**
   * Clear all collected metrics
   */
  public clearMetrics(): void {
    console.log('[Symphony] Clearing metrics');
    this.metrics.length = 0;
    this.requestMap.clear();
  }

  public setCurrentTestName(testName: string): void {
    this.currentTestName = testName;
    this.testStartTime = Date.now();
    if (this.reporter instanceof JsonReporter) {
      this.reporter.setCurrentTestName(testName);
    }
  }
}

export const symphony = Symphony.getInstance(); 