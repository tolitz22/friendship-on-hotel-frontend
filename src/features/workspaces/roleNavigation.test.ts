import {describe,expect,it} from 'vitest';
import {canDisplayAction,navigationForRole,selectedRole} from './roleNavigation';

const hotels=[
 {id:'1',name:'Manager Property',role:'admin'},
 {id:'2',name:'Reception Property',role:'front_desk'},
 {id:'3',name:'Cleaning Property',role:'housekeeping'},
 {id:'4',name:'Maintenance Property',role:'maintenance'},
];
describe('Phase 49 hotel role workspaces',()=>{
 it('uses only the role from the selected hotel',()=>{
  expect(selectedRole(hotels,'1')).toBe('admin');
  expect(selectedRole(hotels,'2')).toBe('front_desk');
  expect(selectedRole(hotels,'3')).toBe('housekeeping');
  expect(selectedRole(hotels,'4')).toBe('maintenance');
  expect(selectedRole(hotels,'99')).toBeNull();
 });
 it('keeps management, audit and advanced tools out of staff navigation',()=>{
  for(const role of ['front_desk','housekeeping','maintenance'] as const){
   const nav=navigationForRole(role);
   expect(nav.daily).toContain('/');
   expect(nav.management).not.toContain('/staff');
   expect(nav.management).not.toContain('/operational-exceptions');
   expect(nav.advanced).toHaveLength(0);
  }
  expect(navigationForRole('admin').management).toContain('/operational-exceptions');
  expect(navigationForRole('admin').management).toContain('/manager-approvals');
  expect(navigationForRole('admin').daily).toContain('/cashier-shifts');
  expect(navigationForRole('admin').daily).toContain('/occupancy-verification');
  expect(navigationForRole('admin').daily).toContain('/occupancy-coverage');
  expect(navigationForRole('front_desk').daily).not.toContain('/occupancy-coverage');
  expect(navigationForRole('housekeeping').daily).not.toContain('/occupancy-coverage');
  expect(navigationForRole('maintenance').daily).not.toContain('/occupancy-coverage');
  expect(navigationForRole('housekeeping').daily).toContain('/occupancy-verification');
  expect(navigationForRole('front_desk').daily).not.toContain('/occupancy-verification');
  expect(navigationForRole('maintenance').daily).not.toContain('/occupancy-verification');
  expect(navigationForRole('front_desk').daily).toContain('/cashier-shifts');
  expect(navigationForRole('housekeeping').daily).not.toContain('/cashier-shifts');
  expect(navigationForRole('maintenance').daily).not.toContain('/cashier-shifts');
  expect(navigationForRole('front_desk').management).not.toContain('/manager-approvals');
 });
 it('shows only supported administrative actions',()=>{
  expect(canDisplayAction('front_desk','new_reservation')).toBe(true);
  expect(canDisplayAction('front_desk','assign_room')).toBe(true);
  expect(canDisplayAction('housekeeping','assign_room')).toBe(false);
  expect(canDisplayAction('maintenance','manage_staff')).toBe(false);
  expect(canDisplayAction('housekeeping','update_assigned_housekeeping')).toBe(true);
  expect(canDisplayAction('admin','assign_room')).toBe(true);
 });
 it('does not infer privileges from an unsupported role',()=>{
  expect(selectedRole([{id:'1',name:'Hotel',role:'unknown'}],'1')).toBeNull();
  expect(navigationForRole(null).daily).toEqual(['/']);
 });
});
