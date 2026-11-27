import {describe,it,expect} from 'vitest';
import {accessTransitions} from './platformHotelAccess';
describe('hotel access transitions',()=>{it('requires restriction before suspension',()=>{expect(accessTransitions('active')).toEqual(['restricted']);expect(accessTransitions('restricted')).toContain('suspended');expect(accessTransitions('suspended')).toContain('active');});});
