import {describe,expect,it} from 'vitest';
import {pushPromptState} from './pushPrompt';
const base={admin:true,supported:true,configured:true,registered:false,permission:'default' as NotificationPermission,decision:null,now:1000};
describe('administrator notification permission prompt',()=>{
 it('offers opt-in when permission is undecided or already granted but hotel is not registered',()=>{
  expect(pushPromptState(base)).toBe('enable');
  expect(pushPromptState({...base,permission:'granted'})).toBe('enable');
 });
 it('does not prompt on an already registered permitted device',()=>{
  expect(pushPromptState({...base,registered:true,permission:'granted'})).toBeNull();
 });
 it('explains blocked permission and allows explicit repair after permission resets',()=>{
  expect(pushPromptState({...base,permission:'denied'})).toBe('blocked');
  expect(pushPromptState({...base,registered:true})).toBe('repair');
 });
 it('respects explicit opt-out, snooze, role, browser and deployment configuration',()=>{
  for(const changes of [{admin:false},{supported:false},{configured:false},{decision:'disabled' as const},{decision:1001}]){
   expect(pushPromptState({...base,...changes})).toBeNull();
  }
  expect(pushPromptState({...base,decision:999})).toBe('enable');
 });
});
