import { Request, Response } from 'playwright';

/**
 * Represents the metrics collected for a single request
 */
export interface RequestMetrics {
  url: string;
  method: string;
  startTime: number;
  endTime: number;
  duration: number;
  status: number;
  requestSize?: number;
  responseSize?: number;
}

/**
 * Represents a summary of all collected metrics
 */
export interface MetricsSummary {
  totalRequests: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  requestsByStatus: Record<number, number>;
  requestsByMethod: Record<string, number>;
}

/**
 * Configuration options for the Symphony extension
 */
export interface SymphonyConfig {
  enabled?: boolean;
  trackRequestSize?: boolean;
  trackResponseSize?: boolean;
  outputDir?: string;
}

/**
 * Interface for custom reporters
 */
export interface SymphonyReporter {
  onMetricsCollected(metrics: RequestMetrics[]): void;
  onTestComplete(summary: MetricsSummary, testInfo: any): void;
}

/**
 * Represents the test information passed to Symphony
 */
export interface TestInfo {
  title: string;
  fileName?: string;
  project?: string;
  tags?: string[];
  annotations?: Record<string, any>;
  status?: string;
  duration?: number;
} 