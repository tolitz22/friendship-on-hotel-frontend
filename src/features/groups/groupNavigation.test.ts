import {describe,expect,it} from 'vitest';
import {parseGroupDetailTab} from './groupNavigation';

describe('group workflow return navigation',()=>{
 it('retains each supported detail tab',()=>{
  expect(parseGroupDetailTab('rooms')).toBe('rooms');
  expect(parseGroupDetailTab('billing')).toBe('billing');
  expect(parseGroupDetailTab('activity')).toBe('activity');
 });
 it('does not allow unexpected URL values to select a privileged screen',()=>{
  for(const value of [null,undefined,'payments','admin','../billing',{},42,'']) {
   expect(parseGroupDetailTab(value)).toBeUndefined();
  }
 });
});
