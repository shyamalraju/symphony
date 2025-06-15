# Symphony

A Playwright extension for performance testing and benchmarking requests and responses.

## Features

- Automatic request/response tracking
- Performance metrics collection
- Detailed timing information
- Request/response size tracking
- Status code monitoring
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
});
```

### Global Usage

To enable Symphony for all tests in a file:

```typescript
import { test } from '@playwright/test';
import { symphony } from '@symphony/playwright';

// Enable Symphony for all tests in this file
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

You can configure Symphony in your `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Your existing Playwright config
  symphony: {
    outputDir: 'symphony-metrics', // Directory to store metrics
    enabled: true,                 // Enable/disable Symphony
    verbose: true                  // Enable detailed logging
  }
});
```

## Metrics

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
- Timing information

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
}
```

### Configuration Options

```typescript
interface SymphonyConfig {
  outputDir?: string;    // Directory to store metrics
  enabled?: boolean;     // Enable/disable Symphony
  verbose?: boolean;     // Enable detailed logging
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
