import {defineConfig,devices} from '@playwright/test';

/**
 * Phase 42: local mock-mode browser checks. This suite never writes to the
 * Laravel API and must not depend on a hotel login or production credentials.
 */
export default defineConfig({
 testDir:'./e2e/mock',
 testMatch:'**/*.pw.ts',
 timeout:30_000,
 expect:{timeout:8_000},
 fullyParallel:true,
 forbidOnly:!!process.env.CI,
 retries:process.env.CI?1:0,
 reporter:process.env.CI?[['list'],['html',{open:'never',outputFolder:'playwright-report'}]]:'list',
 outputDir:'test-results',
 use:{
  baseURL:'http://127.0.0.1:5173',
  trace:'retain-on-failure',
  screenshot:'only-on-failure',
  video:'retain-on-failure',
 },
 projects:[
  {name:'desktop-chromium',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}},
  {name:'mobile-chromium',use:{...devices['iPhone 13'],browserName:'chromium'}},
 ],
 webServer:[{
  command:'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
  url:'http://127.0.0.1:5173/',
  reuseExistingServer:!process.env.CI,
  timeout:60_000,
  env:{VITE_DATA_SOURCE:'mock'},
 },{
  command:'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',
  url:'http://127.0.0.1:5174/',
  reuseExistingServer:false,
  env:{VITE_DATA_SOURCE:'api',VITE_AUTH_MODE:'bearer',VITE_API_URL:'http://127.0.0.1:5174/api/v1'},
 },{
  command:'npm run dev -- --host 127.0.0.1 --port 5175 --strictPort',
  url:'http://127.0.0.1:5175/',
  reuseExistingServer:false,
  timeout:60_000,
  env:{VITE_DATA_SOURCE:'api',VITE_AUTH_MODE:'bearer',VITE_API_URL:'http://127.0.0.1:5175/api/v1',VITE_STAFF_REALTIME_KEY:'qa-key',VITE_STAFF_REALTIME_WS_URL:'wss://realtime.example.test'},
 }],
});
