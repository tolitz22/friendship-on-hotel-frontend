import {defineConfig,devices} from '@playwright/test';

/**
 * Deliberately separate from the existing read-only staging smoke config.
 * Never run the write suite against a production hotel or database.
 */
function required(key:string):string{
 const value=process.env[key]?.trim();
 if(!value)throw new Error('Phase 43 write acceptance requires '+key);
 return value;
}
if(process.env.PMS_STAGING_WRITE_ENABLED!=='1'
 ||process.env.PMS_STAGING_ISOLATED_DB_ACK!=='isolated-test-db'){
 throw new Error('Phase 43 writes disabled. Require explicit isolated staging DB acknowledgement.');
}
const frontend=new URL(required('PMS_STAGING_URL'));
const api=new URL(required('PMS_STAGING_API_URL'));
for(const [label,target,host] of [
 ['frontend',frontend,required('PMS_STAGING_ALLOWED_HOST')],
 ['API',api,required('PMS_STAGING_ALLOWED_API_HOST')],
] as const){
 if(target.protocol!=='https:'||target.hostname!==host||!host.includes('staging')
  ||target.username||target.password||target.search||target.hash){
  throw new Error('Refusing '+label+' writes: expected exact allowlisted HTTPS staging hostname.');
 }
}
if(frontend.origin===api.origin){
 throw new Error('Require separately identified frontend and API origins for this browser acceptance.');
}
for(const key of [
 'PMS_STAGING_TEST_HOTEL_ID','PMS_STAGING_TEST_ROOM_TYPE_ID',
 'PMS_STAGING_TEST_RATE_PLAN_ID','PMS_STAGING_TEST_ROOM_ID',
 'PMS_STAGING_CHECKOUT_BOOKING_ID','PMS_STAGING_STAFF_EMAIL','PMS_STAGING_STAFF_PASSWORD'
])required(key);

export default defineConfig({
 testDir:'./e2e/staging-write',
 testMatch:'**/*.pw.ts',
 timeout:120_000,
 expect:{timeout:15_000},
 workers:1,
 fullyParallel:false,
 retries:0,
 forbidOnly:true,
 reporter:'list',
 use:{
  baseURL:frontend.origin,
  ...devices['Desktop Chrome'],
  screenshot:'off',trace:'off',video:'off',
 },
});
