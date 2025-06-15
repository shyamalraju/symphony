import * as fs from 'fs';
import * as path from 'path';
import { SymphonyReporter, RequestMetrics, MetricsSummary } from '../types';

/**
 * Default JSON reporter that saves metrics to files
 */
export class JsonReporter implements SymphonyReporter {
  private outputDir: string;

  constructor(outputDir: string = 'symphony-metrics') {
    this.outputDir = outputDir;
    this.ensureOutputDir();
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  public onMetricsCollected(metrics: RequestMetrics[]): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(this.outputDir, `metrics-${timestamp}.json`);

    fs.writeFileSync(filePath, JSON.stringify(metrics, null, 2));
  }

  public onTestComplete(summary: MetricsSummary): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(this.outputDir, `summary-${timestamp}.json`);

    fs.writeFileSync(filePath, JSON.stringify(summary, null, 2));
  }
} 