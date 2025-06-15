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

## Configuration

### 1. Update Playwright Config

Add Symphony to your `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';
import { Symphony } from '@symphony/playwright';

export default defineConfig({
  use: {
    // Your existing Playwright config
  },
  reporter: [
    ['html'],
    ['@symphony/playwright']
  ],
  // Optional: Configure Symphony
  symphony: {
    outputDir: 'symphony-metrics', // Directory to store metrics
    enabled: true,                 // Enable/disable Symphony
    verbose: true                  // Enable detailed logging
  }
});
```

### 2. Enable Symphony in Tests

#### Global Level (Test Spec)
Add this to the top of your test spec file to enable Symphony for all tests in that file:

```typescript
import { test as base } from '@playwright/test';
import { Symphony } from '@symphony/playwright';

// Enable Symphony for all tests in this file
const test = base.extend({
  symphony: async ({}, use) => {
    const symphony = new Symphony();
    await symphony.start();
    await use(symphony);
    await symphony.stop();
  }
});

// Use the enhanced test object
test('my test', async ({ symphony }) => {
  // Your test code here
});
```

#### Test Level
For individual tests, you can enable Symphony directly in the test:

```typescript
import { test } from '@playwright/test';
import { Symphony } from '@symphony/playwright';

test('my test', async ({ page }) => {
  // Start Symphony for this specific test
  const symphony = new Symphony();
  await symphony.start();
  
  // Your test code here
  await page.goto('https://example.com');
  
  // Stop Symphony and get metrics
  await symphony.stop();
  const metrics = symphony.getMetrics();
  console.log('Performance metrics:', metrics);
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

### Symphony Class

```typescript
class Symphony {
  constructor(config?: SymphonyConfig);
  start(): Promise<void>;
  stop(): Promise<void>;
  getMetrics(): RequestMetrics[];
  getSummary(): MetricsSummary;
  setReporter(reporter: SymphonyReporter): void;
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
