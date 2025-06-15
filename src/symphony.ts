import { Page, Request, Response } from 'playwright';
import { RequestMetrics, MetricsSummary, SymphonyConfig } from './types';

/**
 * Symphony - A performance testing extension for Playwright
 * Automatically collects request/response timing metrics
 */
export class Symphony {
  private metrics: Map<string, RequestMetrics> = new Map();
  private config: SymphonyConfig;
  private static instance: Symphony;

  private constructor(config: SymphonyConfig = {}) {
    this.config = {
      enabled: true,
      trackRequestSize: false,
      trackResponseSize: false,
      ...config
    };
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
   * Enable Symphony for a specific page
   */
  public async enable(page: Page): Promise<void> {
    if (!this.config.enabled) return;

    // Set up request listener
    page.on('request', (request: Request) => {
      this.trackRequestStart(request);
    });

    // Set up response listener
    page.on('response', (response: Response) => {
      this.trackRequestEnd(response);
    });
  }

  /**
   * Track the start of a request
   */
  private trackRequestStart(request: Request): void {
    const key = this.getRequestKey(request);
    const contentLength = request.headers()['content-length'];
    this.metrics.set(key, {
      url: request.url(),
      method: request.method(),
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      status: 0,
      requestSize: this.config.trackRequestSize && contentLength ? parseInt(contentLength, 10) : undefined
    });
  }

  /**
   * Track the end of a request
   */
  private trackRequestEnd(response: Response): void {
    const key = this.getRequestKey(response.request());
    const metrics = this.metrics.get(key);

    if (metrics) {
      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      metrics.status = response.status();
      if (this.config.trackResponseSize) {
        const contentLength = response.headers()['content-length'];
        if (contentLength) {
          metrics.responseSize = parseInt(contentLength, 10);
        }
      }
    }
  }

  /**
   * Get a unique key for a request
   */
  private getRequestKey(request: Request): string {
    return `${request.method()}-${request.url()}-${Date.now()}`;
  }

  /**
   * Get all collected metrics
   */
  public getMetrics(): RequestMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get metrics for a specific URL
   */
  public getMetricsForUrl(url: string): RequestMetrics[] {
    return this.getMetrics().filter(metric => metric.url === url);
  }

  /**
   * Get a summary of all metrics
   */
  public getSummary(): MetricsSummary {
    const metrics = this.getMetrics();
    const summary: MetricsSummary = {
      totalRequests: metrics.length,
      averageDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      requestsByStatus: {},
      requestsByMethod: {}
    };

    metrics.forEach(metric => {
      // Update duration stats
      summary.averageDuration += metric.duration;
      summary.minDuration = Math.min(summary.minDuration, metric.duration);
      summary.maxDuration = Math.max(summary.maxDuration, metric.duration);

      // Update status counts
      summary.requestsByStatus[metric.status] = (summary.requestsByStatus[metric.status] || 0) + 1;

      // Update method counts
      summary.requestsByMethod[metric.method] = (summary.requestsByMethod[metric.method] || 0) + 1;
    });

    // Calculate average
    if (metrics.length > 0) {
      summary.averageDuration /= metrics.length;
    }

    return summary;
  }

  /**
   * Clear all collected metrics
   */
  public clearMetrics(): void {
    this.metrics.clear();
  }
} 