import {describe,expect,it} from 'vitest';
import {linkedTaskKey,shouldOpenLinkedTask} from './linkedTaskSelection';

describe('Phase 41 linked-task editor stability',()=>{
 it('opens a task once for a specific hotel and task ID',()=>{
  const opened=linkedTaskKey('4','82');
  expect(opened).toBe('4:82');
  expect(shouldOpenLinkedTask(null,'4','82')).toBe(true);
  expect(shouldOpenLinkedTask(opened,'4','82')).toBe(false);
 });
 it('does not re-open the same task when a background refetch completes',()=>{
  expect(shouldOpenLinkedTask('4:82','4','82')).toBe(false);
 });
 it('requires a new editor for a different hotel or task',()=>{
  expect(shouldOpenLinkedTask('4:82','5','82')).toBe(true);
  expect(shouldOpenLinkedTask('4:82','4','83')).toBe(true);
 });
 it('does not attempt to open invalid or unselected tasks',()=>{
  expect(shouldOpenLinkedTask(null,null,'82')).toBe(false);
  expect(shouldOpenLinkedTask(null,'4',null)).toBe(false);
  expect(shouldOpenLinkedTask(null,'4','not-a-task')).toBe(false);
  expect(shouldOpenLinkedTask(null,'0','82')).toBe(false);
 });
});
