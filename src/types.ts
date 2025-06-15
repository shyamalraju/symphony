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
} 