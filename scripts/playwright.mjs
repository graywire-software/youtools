import { createRequire } from 'node:module';
import { join } from 'node:path';

// Google Drive streaming volumes may fail to extract npm packages. Keep test
// tooling off that volume when YOUTOOLS_TOOLING is set; the extension has no deps.
const require = createRequire(process.env.YOUTOOLS_TOOLING
  ? join(process.env.YOUTOOLS_TOOLING, 'package.json')
  : import.meta.url);
export const { chromium } = require('playwright');
