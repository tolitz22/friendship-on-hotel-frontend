import {defineConfig,devices} from '@playwright/test';

/**
 * Manually run against a dedicated staging environment with a test staff account.
 * Does not run on CI push; no mutations, no screenshot/trace of guest records.
 */
const url=process.env.PMS_STAGING_URL;
if(!url)throw new Error('Set PMS_STAGING_URL to the dedicated staging frontend URL.');
if(process.env.PMS_STAGING_READ_ONLY!=='1')
 throw new Error('Explicitly set PMS_STAGING_READ_ONLY=1 for read-only smoke tests.');
const target=new URL(url);
if(target.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(target.hostname))
 throw new Error('Staging frontend must use HTTPS (except localhost).');

export default defineConfig({
 testDir:'./e2e/staging',
 testMatch:'**/*.pw.ts',
 timeout:45_000,
 expect:{timeout:12_000},
 workers:1,
 retries:0,
 reporter:'list',
 use:{
  baseURL:url,
  ...devices['Desktop Chrome'],
  screenshot:'off',trace:'off',video:'off',
 },
});
