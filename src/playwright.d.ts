import { SymphonyConfig } from './types';

declare module '@playwright/test' {
  interface PlaywrightTestOptions {
    symphony?: SymphonyConfig;
  }
} 