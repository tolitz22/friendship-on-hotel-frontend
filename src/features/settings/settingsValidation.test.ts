import {describe,it,expect} from 'vitest';
import {sampleHotelSettings} from '../../api/mock/settingsFixtures';
import {validateSettings} from './settingsValidation';
describe('settings mock configuration',()=>{
 it('accepts the initial property details',()=>expect(validateSettings(sampleHotelSettings.data.property).success).toBe(true));
 it('rejects an invalid time',()=>expect(validateSettings({...sampleHotelSettings.data.property,checkInTime:'25:88'}).success).toBe(false));
 it('rejects a missing property name',()=>expect(validateSettings({...sampleHotelSettings.data.property,name:''}).success).toBe(false));
 it('rejects an invalid contact email',()=>expect(validateSettings({...sampleHotelSettings.data.property,contactEmail:'not-an-email'}).success).toBe(false));
 it('keeps room counts in the sample room inventory consistent',()=>{
  const {roomTypes,floors}=sampleHotelSettings.data;
  expect(roomTypes.reduce((sum,item)=>sum+item.roomCount,0)).toBe(floors.reduce((sum,item)=>sum+item.roomCount,0));
 });
});
