import { Page, Request, Response } from 'playwright';
import { RequestMetrics, MetricsSummary, SymphonyConfig, SymphonyReporter } from './types';
import { JsonReporter } from './reporters/json-reporter';
import { HtmlReporter } from './reporters/html-reporter';

/**
 * Symphony - A performance testing extension for Playwright
 * Automatically collects request/response timing metrics
 */
export class Symphony {
  private static instance: Symphony;
  private config: SymphonyConfig;
  private metrics: RequestMetrics[] = [];
  private jsonReporter: JsonReporter;
  private htmlReporter: HtmlReporter;
  private requestMap: Map<string, RequestMetrics> = new Map();
  private currentTestName: string = 'unknown-test';
  private sessionDir: string | null = null;
  private currentTestInfo: any;

  private constructor(config: SymphonyConfig = {}) {
    this.config = {
      outputDir: 'symphony-metrics',
      ...config
    };
    console.log('[Symphony] Initializing with config:', this.config);
    this.htmlReporter = new HtmlReporter(this.config.outputDir);
    this.jsonReporter = new JsonReporter(this.config.outputDir, (dir) => {
      this.sessionDir = dir;
      this.htmlReporter.setSessionDir(dir);
    });
  }

  /**
   * Get the singleton instance of Symphony
   */
  public static getInstance(config: SymphonyConfig = {}): Symphony {
    if (!Symphony.instance) {
      Symphony.instance = new Symphony(config);
    }
    return Symphony.instance;
  }

  public setCurrentTestName(testName: string) {
    this.currentTestName = testName;
    this.jsonReporter.setCurrentTestName(testName);
    this.htmlReporter.setCurrentTestName(testName);
  }

  public setSessionDir(sessionDir: string) {
    this.sessionDir = sessionDir;
    this.jsonReporter.sessionDir = sessionDir;
    this.htmlReporter.setSessionDir(sessionDir);
  }

  public onMetricsCollected(metrics: RequestMetrics[]): void {
    this.metrics = metrics;
    this.jsonReporter.onMetricsCollected(metrics);
    this.htmlReporter.onMetricsCollected(metrics);
  }

  public onTestComplete(summary: MetricsSummary): void {
    this.jsonReporter.onTestComplete(summary);
    this.htmlReporter.onTestComplete(summary, this.currentTestInfo);
  }

  /**
   * Enable Symphony for a specific page
   */
  public async enable(page: Page, testInfo: any): Promise<void> {
    console.log('[Symphony] Enabling for page');

    if (testInfo) {
      this.currentTestName = testInfo.title;
      if (this.jsonReporter instanceof JsonReporter) {
        this.jsonReporter.setCurrentTestInfo(testInfo);
      }
      if (this.htmlReporter instanceof HtmlReporter) {
        this.htmlReporter.setCurrentTestInfo(testInfo);
      }
      this.currentTestInfo = testInfo;
      console.log('[Symphony] Test Info:', testInfo);
    }

    // Set up request listener
    page.on('request', (request: Request) => {
      const url = request.url();
      console.log('[Symphony] Tracking request start:', url);

      // Only add a new metric if the URL is not already in the requestMap
      if (!this.requestMap.has(url)) {
        const metric: RequestMetrics = {
          url,
          method: request.method(),
          startTime: Date.now(),
          endTime: 0,
          duration: 0,
          status: 0,
          requestSize: 0,
          responseSize: 0
        };
        this.requestMap.set(url, metric);
        this.metrics.push(metric);
      }
    });

    // Set up response listener
    page.on('response', async (response: Response) => {
      const url = response.url();
      console.log('[Symphony] Tracking request end:', url);

      const metric = this.requestMap.get(url);
      if (metric) {
        metric.endTime = Date.now();
        metric.duration = metric.endTime - metric.startTime;
        metric.status = response.status();

        // Get response size from headers
        const contentLength = response.headers()['content-length'];
        if (contentLength) {
          metric.responseSize = parseInt(contentLength, 10);
        }

        console.log('[Symphony] Request completed:', {
          url: metric.url,
          duration: metric.duration,
          status: metric.status,
          responseSize: metric.responseSize
        });

        // Report metrics after each request
        this.onMetricsCollected(this.getMetrics());
      }
    });

    // Set up page close listener to ensure we get the summary
    page.on('close', () => {
      console.log('[Symphony] Page closed, getting final summary');
      this.getSummary();
    });
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
    this.onTestComplete(summary);
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
}

export const symphony = Symphony.getInstance(); 