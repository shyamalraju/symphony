# symphony
A performance testing extension for Playwright that enables request/response benchmarking.

## Overview

Symphony extends Playwright with performance testing capabilities, starting with precise request/response timing and benchmarking. It provides a simple yet powerful way to measure the performance of your web applications at the network level.

## Current Features

- Request/response timing and benchmarking
  - Precise timing of network requests
  - Response time measurements
  - Request/response size tracking
  - Basic performance metrics collection

## Planned Features

- Load generation and virtual user simulation
- Real-time performance monitoring
- Comprehensive reporting and analysis
- CI/CD integration capabilities

## Installation

```bash
npm install @symphony/playwright
```

## Quick Start

Symphony can be enabled either globally for all tests or per individual test:

```typescript
import { test } from '@playwright/test';
import { symphony } from '@symphony/playwright';

// Option 1: Enable globally for all tests
symphony.enable();

// Your tests will automatically collect metrics
test('first test', async ({ page }) => {
  await page.goto('https://example.com');
});

test('second test', async ({ page }) => {
  await page.goto('https://example.org');
});

// Option 2: Enable per test
test('specific test', async ({ page }) => {
  await symphony.enable(page);
  await page.goto('https://example.com');
});

// Get metrics at any time
const metrics = symphony.getMetrics();
console.log('Performance metrics:', metrics);
```

## Current Metrics

Symphony currently captures the following metrics for each request:

- **Request Timing**: 
  - Start time
  - End time
  - Total duration
- **Request Details**:
  - URL
  - Method
  - Status code
  - Request/response sizes

## Documentation

- [Architecture Overview](ARCHITECTURE.md) - Detailed architecture and implementation roadmap
- [Getting Started](docs/getting-started.md) - Coming soon
- [API Reference](docs/api.md) - Coming soon

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) for details
