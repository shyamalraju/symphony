# Symphony

A Playwright extension for performance testing and benchmarking requests and responses.

## Features

- Automatic request/response tracking
- Performance metrics collection
- Detailed timing information
- Request/response size tracking
- Status code monitoring
- Web Vitals and rendering metrics
- JSON report generation

## Installation

```bash
npm install @symphony/playwright
```

## Usage

### Basic Usage

Simply import and enable Symphony in your test:

```typescript
import { test } from '@playwright/test';
import { symphony } from '@symphony/playwright';

test('my test', async ({ page }) => {
  // Enable Symphony for this page
  await symphony.enable(page);
  
  // Your test code here
  await page.goto('https://example.com');
  
  // Get request timing metrics
  const metrics = symphony.getMetrics();
  console.log('Performance metrics:', metrics);

  // Get rendering metrics
  const renderingMetrics = await symphony.getRenderingMetrics();
  console.log('Rendering metrics:', renderingMetrics);
});
```

### Enable for Multiple Tests

Use `beforeEach` to enable Symphony for all tests in a file:

```typescript
import { test } from '@playwright/test';
import { symphony } from '@symphony/playwright';

test.beforeEach(async ({ page }) => {
  await symphony.enable(page);
});

test('first test', async ({ page }) => {
  await page.goto('https://example.com');
});

test('second test', async ({ page }) => {
  await page.goto('https://example.org');
});
```

### Optional Configuration

You can configure Symphony in your `playwright.config.ts`. First, make sure to import the types:

```typescript
import { defineConfig } from '@playwright/test';
import '@symphony/playwright/playwright'; // This imports the type declarations

export default defineConfig({
  use: {
    // Your existing Playwright config
  },
  // Symphony configuration
  symphony: {
    outputDir: 'symphony-metrics', // Directory to store metrics
    enabled: true,                 // Enable/disable Symphony
    verbose: true,                 // Enable detailed logging
    collectRenderingMetrics: true  // Enable web vitals collection
  }
});
```

## Metrics

### Network Metrics

Symphony collects the following metrics for each request:

- URL
- Method
- Start time
- End time
- Duration
- Status code
- Request size
- Response size
- Headers
- Detailed timing information:
  - DNS lookup
  - Connection establishment
  - SSL/TLS negotiation
  - Request/response timing

### Rendering Metrics

Symphony also collects Web Vitals and other rendering metrics:

- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Time to Interactive (TTI)
- DOM Content Loaded
- Page Load Time
- First Paint
- First Input Delay (FID)
- Cumulative Layout Shift (CLS)
- Total Blocking Time (TBT)
- Speed Index

## Reports

Symphony generates detailed JSON reports in the configured output directory (`symphony-metrics` by default). Each test run creates a new session directory with:

- Individual test metrics
- Test summaries
- Session summary
- README with environment information

## API

### Symphony Instance

```typescript
interface Symphony {
  enable(page: Page): Promise<void>;
  getMetrics(): RequestMetrics[];
  getSummary(): MetricsSummary;
  getRenderingMetrics(): Promise<RenderingMetrics>;
}
```

### Configuration Options

```typescript
interface SymphonyConfig {
  outputDir?: string;    // Directory to store metrics
  enabled?: boolean;     // Enable/disable Symphony
  verbose?: boolean;     // Enable detailed logging
  collectRenderingMetrics?: boolean; // Enable web vitals collection
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
