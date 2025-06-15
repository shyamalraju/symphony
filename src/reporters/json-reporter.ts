import fs from 'fs';
import path from 'path';
import { SymphonyReporter, RequestMetrics, MetricsSummary } from '../types';
import { chromium, firefox, webkit } from 'playwright';

/**
 * Default JSON reporter that saves metrics to files
 */
export class JsonReporter implements SymphonyReporter {
  private outputDir: string;
  private currentTestName: string = 'unknown-test';
  private currentMetrics: RequestMetrics[] = [];
  private testStartTime: number = Date.now();
  private sessionDir: string | null = null;
  private sessionMetrics: Map<string, { metrics: RequestMetrics[], summary: MetricsSummary }> = new Map();

  constructor(outputDir: string = 'symphony-metrics') {
    // Convert to absolute path
    this.outputDir = path.resolve(process.cwd(), outputDir);
    this.ensureOutputDir();
    console.log('[JsonReporter] Initialized with output directory:', this.outputDir);
  }

  private ensureOutputDir() {
    try {
      if (!fs.existsSync(this.outputDir)) {
        console.log('[JsonReporter] Creating output directory:', this.outputDir);
        fs.mkdirSync(this.outputDir, { recursive: true });
      }
      // Verify we can write to the directory
      const testFile = path.join(this.outputDir, '.test-write');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      console.log('[JsonReporter] Directory is writable');
    } catch (error) {
      console.error('[JsonReporter] Error ensuring output directory:', error);
      throw error;
    }
  }

  private ensureSessionDir() {
    if (!this.sessionDir) {
      const now = new Date();
      const sessionName = `test-run_${now.toISOString().replace(/[:.]/g, '-')}`;
      this.sessionDir = path.join(this.outputDir, sessionName);
      fs.mkdirSync(this.sessionDir, { recursive: true });

      // Get environment information
      const envInfo = this.getEnvironmentInfo();

      // Create a README in the session directory
      const readmeContent = `# Test Run Session: ${sessionName}
Started at: ${now.toLocaleString()}

## Environment Information
- Node.js Version: ${envInfo.nodeVersion}
- Operating System: ${envInfo.os}
- Playwright Version: ${envInfo.playwrightVersion}
- Browser: ${envInfo.browser}
- Browser Version: ${envInfo.browserVersion}

## Test Results
This directory contains performance metrics for a single test run session.
Each test will generate two files:
- metrics file: Contains detailed request/response metrics
- summary file: Contains aggregated statistics for the test

## File Naming Format
YYYY-MM-DD_HH-MM-SS_test-{test-name}_duration-{duration}s_{type}.json

## Metrics Information
The metrics files contain the following information:
- Request URL and method
- Start and end times
- Duration
- Status code
- Request and response sizes

## Summary Information
The summary files contain aggregated statistics:
- Total number of requests
- Average, minimum, and maximum durations
- Requests by status code
- Requests by HTTP method
`;
      fs.writeFileSync(path.join(this.sessionDir, 'README.md'), readmeContent);
      console.log('[JsonReporter] Created session directory:', this.sessionDir);
    }
  }

  private getEnvironmentInfo() {
    return {
      nodeVersion: process.version,
      os: `${process.platform} ${process.arch}`,
      playwrightVersion: require('playwright/package.json').version,
      browser: process.env.PLAYWRIGHT_BROWSER || 'chromium',
      browserVersion: this.getBrowserVersion()
    };
  }

  private async getBrowserVersion(): Promise<string> {
    try {
      const browser = process.env.PLAYWRIGHT_BROWSER || 'chromium';
      let browserInstance;

      switch (browser) {
        case 'chromium':
          browserInstance = await chromium.launch();
          break;
        case 'firefox':
          browserInstance = await firefox.launch();
          break;
        case 'webkit':
          browserInstance = await webkit.launch();
          break;
        default:
          return 'unknown';
      }

      const version = browserInstance.version();
      await browserInstance.close();
      return version;
    } catch (error) {
      console.error('[JsonReporter] Error getting browser version:', error);
      return 'unknown';
    }
  }

  public onMetricsCollected(metrics: RequestMetrics[]): void {
    console.log(`[JsonReporter] Storing metrics for test "${this.currentTestName}":`, metrics.length, 'requests');
    this.currentMetrics = metrics;
  }

  public onTestComplete(summary: MetricsSummary): void {
    console.log(`[JsonReporter] Test "${this.currentTestName}" completed. Saving files...`);

    if (this.currentMetrics.length === 0) {
      console.log('[JsonReporter] No metrics to save');
      return;
    }

    // Create session directory only when we have metrics to save
    this.ensureSessionDir();

    // Store metrics and summary for session summary
    this.sessionMetrics.set(this.currentTestName, {
      metrics: [...this.currentMetrics],
      summary
    });

    // Format the timestamp for the filename
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS

    // Create a readable test name
    const readableTestName = this.currentTestName
      .replace(/[^a-z0-9]/gi, '-') // Replace special chars with hyphens
      .replace(/-+/g, '-')         // Replace multiple hyphens with single hyphen
      .toLowerCase()
      .replace(/^-|-$/g, '');      // Remove leading/trailing hyphens

    // Calculate test duration
    const testDuration = Date.now() - this.testStartTime;
    const durationStr = `${Math.round(testDuration / 1000)}s`;

    // Save detailed metrics
    const metricsFilePath = path.join(
      this.sessionDir!,
      `${dateStr}_${timeStr}_test-${readableTestName}_duration-${durationStr}_metrics.json`
    );

    try {
      console.log(`[JsonReporter] Writing metrics to: ${metricsFilePath}`);
      const metricsContent = JSON.stringify(this.currentMetrics, null, 2);
      fs.writeFileSync(metricsFilePath, metricsContent);
      console.log('[JsonReporter] Metrics file saved successfully');
    } catch (error) {
      console.error('[JsonReporter] Error saving metrics:', error);
      // Try to get more error details
      if (error instanceof Error) {
        console.error('[JsonReporter] Error details:', {
          message: error.message,
          stack: error.stack,
          code: (error as NodeJS.ErrnoException).code
        });
      }
    }

    // Save summary
    const summaryFilePath = path.join(
      this.sessionDir!,
      `${dateStr}_${timeStr}_test-${readableTestName}_duration-${durationStr}_summary.json`
    );

    try {
      console.log(`[JsonReporter] Writing summary to: ${summaryFilePath}`);
      const summaryContent = JSON.stringify(summary, null, 2);
      fs.writeFileSync(summaryFilePath, summaryContent);
      console.log('[JsonReporter] Summary file saved successfully');
    } catch (error) {
      console.error('[JsonReporter] Error saving summary:', error);
      // Try to get more error details
      if (error instanceof Error) {
        console.error('[JsonReporter] Error details:', {
          message: error.message,
          stack: error.stack,
          code: (error as NodeJS.ErrnoException).code
        });
      }
    }

    // Generate session summary
    this.generateSessionSummary();
  }

  private generateSessionSummary() {
    if (!this.sessionDir) return;

    const sessionSummary = {
      totalTests: this.sessionMetrics.size,
      totalRequests: 0,
      averageDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      requestsByStatus: {} as Record<number, number>,
      requestsByMethod: {} as Record<string, number>,
      testResults: [] as Array<{
        testName: string,
        totalRequests: number,
        averageDuration: number,
        minDuration: number,
        maxDuration: number,
        requestsByStatus: Record<number, number>,
        requestsByMethod: Record<string, number>
      }>
    };

    let totalDuration = 0;
    let totalCompletedRequests = 0;

    this.sessionMetrics.forEach((data, testName) => {
      const { summary } = data;
      sessionSummary.totalRequests += summary.totalRequests;

      if (summary.averageDuration > 0) {
        totalDuration += summary.averageDuration;
        totalCompletedRequests++;
      }

      sessionSummary.minDuration = Math.min(sessionSummary.minDuration, summary.minDuration);
      sessionSummary.maxDuration = Math.max(sessionSummary.maxDuration, summary.maxDuration);

      // Merge status counts
      Object.entries(summary.requestsByStatus).forEach(([status, count]) => {
        const statusCode = parseInt(status);
        sessionSummary.requestsByStatus[statusCode] = (sessionSummary.requestsByStatus[statusCode] || 0) + count;
      });

      // Merge method counts
      Object.entries(summary.requestsByMethod).forEach(([method, count]) => {
        sessionSummary.requestsByMethod[method] = (sessionSummary.requestsByMethod[method] || 0) + count;
      });

      // Add test result
      sessionSummary.testResults.push({
        testName,
        totalRequests: summary.totalRequests,
        averageDuration: summary.averageDuration,
        minDuration: summary.minDuration,
        maxDuration: summary.maxDuration,
        requestsByStatus: summary.requestsByStatus,
        requestsByMethod: summary.requestsByMethod
      });
    });

    if (totalCompletedRequests > 0) {
      sessionSummary.averageDuration = Math.round(totalDuration / totalCompletedRequests);
    }

    // Save session summary
    const sessionSummaryPath = path.join(this.sessionDir, 'session-summary.json');
    try {
      fs.writeFileSync(sessionSummaryPath, JSON.stringify(sessionSummary, null, 2));
      console.log('[JsonReporter] Session summary saved successfully');
    } catch (error) {
      console.error('[JsonReporter] Error saving session summary:', error);
    }
  }

  setCurrentTestName(testName: string) {
    console.log(`[JsonReporter] Setting current test name to: ${testName}`);
    this.currentTestName = testName;
    this.testStartTime = Date.now(); // Reset the test start time
  }
} 