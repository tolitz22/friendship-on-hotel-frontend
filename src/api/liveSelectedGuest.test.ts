import {describe,expect,it} from 'vitest';
import {parseSelectedGuest} from './liveSelectedGuest';

const guest={data:{
 id:'250',hotelId:'7',firstName:'Late',lastName:'Directory',
 email:null,phone:null,nationality:null,createdAt:'2026-11-17T12:00:00Z',
}};

describe('Phase 40 exact linked guest validation',()=>{
 it('accepts a guest even when absent from the first directory page',()=>{
  expect(parseSelectedGuest(guest,'7','250').firstName).toBe('Late');
 });
 it('refuses guest profile from another hotel',()=>{
  expect(()=>parseSelectedGuest(guest,'8','250')).toThrow(/active hotel/);
 });
 it('refuses another guest ID in the same hotel',()=>{
  expect(()=>parseSelectedGuest(guest,'7','251')).toThrow(/active hotel/);
 });
 it('refuses missing and malformed identity fields',()=>{
  expect(()=>parseSelectedGuest({data:{...guest.data,firstName:''}},'7','250')).toThrow();
  expect(()=>parseSelectedGuest({data:{...guest.data,id:'guest'}},'7','250')).toThrow();
 });
});
