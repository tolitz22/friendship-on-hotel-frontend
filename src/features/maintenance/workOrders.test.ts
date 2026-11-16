import {describe,expect,it} from 'vitest';
import {applyWorkOrderDrafts,priorityRank,roomImpact,stages} from './workOrders';
import {maintenanceOrders} from '../../api/mock/maintenanceFixtures';
import {rooms} from '../../api/mock/fixtures';
describe('maintenance preview',()=>{
 it('has explicit lifecycle states',()=>expect(stages.map(x=>x.status)).toEqual(['open','in_progress','resolved','closed'])),
 it('prioritizes urgent work',()=>expect(priorityRank('urgent')).toBeLessThan(priorityRank('medium'))),
 it('reports room impact without treating it as automatic blocking',()=>{
  const order=maintenanceOrders.find(x=>x.id==='wo-004')!;
  const room=rooms.find(x=>x.id===order.roomId);
  expect(roomImpact(order,room)).toContain('Work order flagged as potentially affecting the room');
  expect(roomImpact(order,room)).toContain('Room currently occupied — coordinate with front desk');
 }),
 it('keeps mock fixtures unchanged when draft edits are applied',()=>{
  const source=maintenanceOrders[0];
  const result=applyWorkOrderDrafts([source],{[source.id]:{status:'resolved',assignedTo:'Sam Torres',note:'Preview only'}});
  expect(result[0].status).toBe('resolved');
  expect(source.status).toBe('in_progress');
 })
});
