import { expect, test, type Page } from '@playwright/test';
import type { HousekeepingEvent, LiveHousekeepingTask } from '../../src/api/liveHousekeeping';

const origin = 'http://127.0.0.1:5174';
const date = '2026-11-27';
const instant = date + 'T04:00:00Z';
const checklist = [
 { key: 'trash', label: 'Remove trash', checkedAt: null, checkedBy: null },
 { key: 'linens', label: 'Replace bed linens', checkedAt: null, checkedBy: null },
];
const common: Omit<LiveHousekeepingTask, 'id' | 'roomId' | 'roomNumber'> = {
 hotelId: '1', roomType: 'Standard', floor: 2, type: 'checkout_clean', status: 'todo',
 assignedTo: null, assignedUserId: null, dueAt: date + ' 14:00:00', completedAt: null, revision: 1, createdAt: instant, checklist,
};
const room = (id: string, details: Partial<LiveHousekeepingTask> = {}): LiveHousekeepingTask => ({
 ...common, id, roomId: id, roomNumber: '20' + id, ...details,
});
const team = [
 room('1', { arrivalToday: true }),
 room('2', { assignedName: 'Demo Teammate', assignedUserId: '3', status: 'in_progress', overdue: true }),
 room('3', { assignedName: 'Demo Cleaner', assignedUserId: '2', type: 'stayover' }),
 room('4', { status: 'done', pendingInspection: true, completedAt: instant }),
 room('5', { status: 'done', pendingInspection: false, completedAt: instant }),
];

async function interceptHotel(page: Page, allowed = true) {
 const tasks = structuredClone(team);
 const writes: { method: string; path: string; body: Record<string, unknown> }[] = [];
 const activity: HousekeepingEvent[] = [];
 let blockInspection = false;
 let conflict = false;
 let failList = false;
 let registered = false;
 await page.addInitScript(() => {
  sessionStorage.setItem('foh.staff.bearer.v1', 'housekeeping-test');
  sessionStorage.setItem('foh.staff.hotel.v1', '1');
  localStorage.setItem('foh-theme', 'light');
 });
 const meta = (total: number) => ({ page: 1, perPage: 20, totalPages: 1, total });
 await page.route('**/api/v1/**', async route => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  const method = route.request().method();
  const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });
  const task = tasks.find(item => path.includes('/housekeeping-tasks/' + item.id) || false);
  if (method !== 'GET') {
   const body = route.request().postDataJSON() as Record<string, unknown>;
   writes.push({ method, path, body });
   if (method === 'PATCH' && task) {
    if (conflict) {
     conflict = false;
     task.revision++;
     task.checklist = task.checklist?.map(item => item.key === 'linens' ? { ...item, checkedAt: instant, checkedBy: '3' } : item);
     return json({ message: 'This task was updated by another employee. Reload before saving.' }, 409);
    }
    const before = { status: task.status, checkedItems: task.checklist?.filter(item => item.checkedAt).map(item => item.key) };
    expect(body.expectedRevision).toBe(task.revision);
    expect(body).not.toHaveProperty('assignedUserId');
    task.revision++;
    if (typeof body.status === 'string') task.status = body.status as LiveHousekeepingTask['status'];
    if (Array.isArray(body.checkedItems)) {
     const keys = body.checkedItems;
     task.checklist = task.checklist?.map(item => keys.includes(item.key)
      ? { ...item, checkedAt: item.checkedAt ?? instant, checkedBy: item.checkedBy ?? '2' }
      : { ...item, checkedAt: null, checkedBy: null });
    }
    if (task.status === 'done') { task.completedAt = instant; task.pendingInspection = task.type === 'checkout_clean'; }
    activity.unshift({ id: String(activity.length + 1), actorId: '2', actorName: 'Demo Cleaner', action: 'updated',
     before, after: { status: task.status, checkedItems: body.checkedItems }, note: body.note as string | null, createdAt: instant });
    return json({ data: task });
   }
   if (path.endsWith('/final-inspection') && task) {
    expect(body.expectedRevision).toBe(task.revision);
    task.pendingInspection = false;
    task.revision++;
    activity.unshift({ id: String(activity.length + 1), actorId: '2', actorName: 'Demo Cleaner', action: 'inspection_completed',
     before: { status: 'done' }, after: { status: 'done', inspectionStatus: 'approved' }, note: String(body.note), createdAt: instant });
    return json({ data: task });
   }
   if (path.endsWith('/maintenance-report') && task) return json({ data: {
    id: '81', hotelId: '1', roomId: task.roomId, roomNumber: task.roomNumber, housekeepingTaskId: task.id, title: body.title, description: body.description,
    status: 'open', priority: body.priority, affectsRoom: false, assignedTo: null, assignedUserId: null,
    revision: 1, reportedAt: instant, resolvedAt: null,
   } }, 201);
   if (path.endsWith('/lost-found')) {
    registered = true;
    return json({ data: { id: '91', hotelId: '1', roomId: body.roomId, roomNumber: '202', description: body.description,
     storageLocation: body.storageLocation, reportedBy: '2', status: 'stored', revision: 1, reportedAt: instant, updatedAt: instant } }, 201);
   }
   return json({ message: 'Unexpected write in fixture' }, 400);
  }
  if (path.endsWith('/auth/me')) return json({ data: { id: '2', name: 'Demo Cleaner', email: 'demo@example.test',
   hotels: [{ id: '1', name: 'Synthetic QA Hotel', role: 'housekeeping', permissions: allowed ? ['housekeeping.assigned'] : [] }] } });
  if (path.endsWith('/housekeeping/notifications')) return json({ data: { hotelId: '1', notifications: [], hasMore: false } });
  if (path.endsWith('/housekeeping/my-assignments')) return json({ data: [], meta: {
   limitedTo: 5, inAppPollingOnly: true, externalNotificationsConfigured: false,
  } });
  if (path.endsWith('/housekeeping-tasks')) {
   if (failList) return json({ message: 'Test service failure' }, 503);
   let list = tasks;
   const search = url.searchParams;
   if (search.has('mine')) list = list.filter(task => task.assignedUserId === '2');
   if (search.has('room')) list = list.filter(task => task.roomNumber === search.get('room'));
   if (search.has('floor')) list = list.filter(task => String(task.floor) === search.get('floor'));
   if (search.has('assignee')) list = list.filter(task => task.assignedUserId === search.get('assignee'));
   if (search.has('type')) list = list.filter(task => task.type === search.get('type'));
   if (search.has('due_date')) list = list.filter(task => task.dueAt?.slice(0, 10) === search.get('due_date'));
   if (search.has('status')) list = list.filter(task => task.status === search.get('status'));
   if (search.has('q')) list = list.filter(task => task.roomNumber.includes(search.get('q') ?? ''));
   if (search.get('queue') === 'arrival_today') list = list.filter(task => task.arrivalToday && task.status !== 'done');
   if (search.get('queue') === 'pending_inspection') list = list.filter(task => task.pendingInspection);
   if (search.get('queue') === 'completed') list = list.filter(task => task.status === 'done' && !task.pendingInspection);
   const todo = tasks.filter(task => task.status === 'todo').length;
   const inProgress = tasks.filter(task => task.status === 'in_progress').length;
   const summary = { active: todo + inProgress, urgent: 1, todo, inProgress,
    inspectionDue: tasks.filter(task => task.pendingInspection).length, completedToday: 0, overdue: 1 };
   return json({ data: list, meta: { ...meta(list.length), determinesRoomReadiness: false, pastDueCount: 1,
    pendingInspectionCount: summary.inspectionDue, summary, floors: [2], assignees: [
     { id: '2', name: 'Demo Cleaner' }, { id: '3', name: 'Demo Teammate' },
    ] } });
  }
  if (path.endsWith('/history') && task) return json({ data: activity, meta: meta(activity.length) });
  if (task) return json({ data: task });
  if (path.endsWith('/readiness')) return json({ data: { hotelId: '1', roomId: path.split('/').at(-2),
   inspection: null, advisoryReady: false, enforcedAtCheckIn: true, inventoryGuaranteed: false,
   blockers: { activeInventoryBlockToday: blockInspection, activeRoomImpactMaintenance: false, latestTurnoverIncomplete: false,
    newTurnoverSinceInspection: false, unfinishedHousekeeping: false, newRoomWorkSinceInspection: false },
  } });
  if (path.endsWith('/lost-found')) return json({ data: [], meta: { ...meta(0), hotelId: '1' } });
  return json({ message: 'Outside housekeeping fixture' }, 404);
 });
 return {
  writes, conflict: () => { conflict = true; }, block: (blocked: boolean) => { blockInspection = blocked; },
  failList: (failed: boolean) => { failList = failed; }, registered: () => registered,
 };
}

const card = (page: Page, number: number) => page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Room ' + number }) });

for (const width of [320, 390, 430, 768, 1440]) {
 test('renders the shared task workspace and editor at ' + width + 'px', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== (width < 768 ? 'mobile-chromium' : 'desktop-chromium'), 'Viewport project');
  await page.setViewportSize({ width, height: 850 });
  await interceptHotel(page);
  await page.goto(origin + '/housekeeping');
  await expect(page.getByRole('heading', { name: 'My Tasks' })).toBeVisible();
  const workload = page.getByRole('region', { name: 'Team workload' });
  await expect(workload.getByRole('button', { name: '3 Active tasks' })).toBeVisible();
  await expect(workload.getByRole('button', { name: '0 Completed today' })).toHaveAttribute('data-tone', 'neutral');
  await expect(card(page, 201)).toContainText('Arrival today');
  await expect(card(page, 202)).toContainText('Demo Teammate');
  if (width < 768) {
   await page.getByRole('button', { name: 'Open navigation' }).click();
   await page.getByRole('link', { name: 'My tasks', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const open = card(page, 201).getByRole('button', { name: 'Start cleaning' });
  await open.click();
  const editor = page.getByRole('dialog', { name: 'Room 201' });
  await expect(editor).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Close task' })).toBeFocused();
  await expect(editor.getByRole('combobox')).toHaveCount(0);
  await expect(editor.getByRole('region', { name: 'Task information' })).toContainText('Unassigned');
  expect(await editor.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  const bounds = await editor.boundingBox();
  if (width < 768) expect(bounds?.width).toBe(width);
  const finish = await editor.getByRole('button', { name: 'Complete cleaning' }).boundingBox();
  expect(finish?.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Escape');
  await expect(editor).toBeHidden();
  await expect(open).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
 });
}

test('filters team work and distinguishes zero results from request failure', async ({ page }, testInfo) => {
 test.skip(testInfo.project.name !== 'desktop-chromium');
 const api = await interceptHotel(page);
 await page.goto(origin + '/housekeeping');
 await expect(page.locator('.hk-work-card')).toHaveCount(5);
 await page.getByRole('button', { name: 'My assigned tasks', exact: true }).click();
 await expect(page.locator('.hk-work-card')).toHaveCount(1);
 await expect(card(page, 203)).toBeVisible();
 await page.getByRole('button', { name: '1 Urgent arrivals' }).click();
 await expect(page.locator('.hk-work-card')).toHaveCount(1);
 await expect(card(page, 201)).toBeVisible();
 await page.getByRole('button', { name: '1 Inspection due' }).click();
 await expect(card(page, 204)).toBeVisible();
 await expect(page.locator('.hk-work-card')).toHaveCount(1);
 await page.getByRole('button', { name: 'Completed', exact: true }).click();
 await expect(card(page, 205).getByRole('button', { name: 'View details' })).toBeVisible();
 await page.getByRole('button', { name: 'All tasks', exact: true }).click();
 await page.getByRole('button', { name: 'Filters', exact: true }).click();
 await page.getByRole('combobox', { name: 'Assigned employee', exact: true }).selectOption('3');
 await expect(card(page, 202)).toBeVisible();
 await page.getByLabel('Room number', { exact: true }).fill('999');
 await expect(page.getByText('No tasks match these filters.')).toBeVisible();
 await page.getByRole('button', { name: 'Reset filters' }).click();
 await expect(page.locator('.hk-work-card')).toHaveCount(5);
 api.failList(true);
 await page.getByRole('button', { name: 'Refresh tasks' }).click();
 await expect(page.getByText('Team totals are unavailable.')).toBeVisible();
 await expect(page.getByText('Hotel service temporarily unavailable')).toBeVisible();
 await expect(page.getByText('0 tasks', { exact: true })).toHaveCount(0);
 api.failList(false);
 await page.getByRole('button', { name: 'Refresh tasks' }).click();
 await expect(page.locator('.hk-work-card')).toHaveCount(5);
});

test('starts unassigned work, recovers a teammate draft, inspects, audits and files reports', async ({ page }, testInfo) => {
 test.skip(testInfo.project.name !== 'mobile-chromium');
 const api = await interceptHotel(page);
 await page.goto(origin + '/housekeeping');
 await card(page, 201).getByRole('button', { name: 'Start cleaning' }).click();
 let editor = page.getByRole('dialog', { name: 'Room 201' });
 await editor.getByRole('button', { name: 'Start cleaning' }).click();
 await expect(editor.getByText('Cleaning started.')).toBeVisible();
 await editor.getByRole('button', { name: 'Close task' }).click();
 await expect(card(page, 201).getByRole('button', { name: 'Continue cleaning' })).toBeVisible();
 await card(page, 202).getByRole('button', { name: 'Continue cleaning' }).click();
 editor = page.getByRole('dialog', { name: 'Room 202' });
 await editor.getByRole('checkbox', { name: 'Remove trash' }).check();
 await editor.getByLabel('Handover note').fill('Please check the spare towels.');
 await page.evaluate(() => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
  window.dispatchEvent(new Event('offline'));
 });
 await expect(editor.getByRole('button', { name: 'Save progress' })).toBeDisabled();
 await expect(editor.getByLabel('Handover note')).toHaveValue('Please check the spare towels.');
 await page.evaluate(() => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
  window.dispatchEvent(new Event('online'));
 });
 api.conflict();
 await editor.getByRole('button', { name: 'Save progress' }).click();
 await expect(editor.getByText('Another employee updated this task.', { exact: false })).toBeVisible();
 await editor.getByRole('button', { name: 'Check latest task' }).click();
 await editor.getByRole('button', { name: 'Keep my draft on latest task' }).click();
 await expect(editor.getByRole('checkbox', { name: 'Replace bed linens' })).toBeChecked();
 await expect(editor.getByRole('checkbox', { name: 'Remove trash' })).toBeChecked();
 await expect(editor.getByLabel('Handover note')).toHaveValue('Please check the spare towels.');
 await editor.getByRole('button', { name: 'Save progress' }).click();
 await expect(editor.getByText('Task updates saved.')).toBeVisible();
 api.block(true);
 await editor.getByRole('button', { name: 'Complete cleaning', exact: true }).click();
 await expect(editor.getByText('Clear these blockers before inspecting')).toBeVisible();
 for (const label of ['Room and bathroom are clean', 'Safety, lighting and fixtures checked', 'Amenities and supplies checked']) {
  await editor.getByRole('checkbox', { name: new RegExp(label) }).check();
 }
 await editor.getByLabel('Inspection notes (required)').fill('Verified the room in person.');
 const inspect = editor.getByRole('button', { name: 'Complete final inspection' });
 await expect(inspect).toBeDisabled();
 api.block(false);
 await editor.getByRole('button', { name: 'Recheck restrictions' }).click();
 await inspect.click();
 await expect(editor.getByText('Final inspection recorded')).toBeVisible();
 await editor.getByRole('button', { name: 'Activity history' }).click();
 await expect(editor.getByText('Completed final room inspection')).toBeVisible();
 await expect(editor.getByText('Demo Cleaner', { exact: false }).first()).toBeVisible();
 await expect(editor.getByText('Please check the spare towels.', { exact: false })).toBeVisible();
 await expect(editor.getByText('Physical checks verified')).toBeVisible();
 await editor.getByRole('button', { name: 'Report maintenance issue' }).click();
 await editor.getByLabel('Issue title').fill('Synthetic maintenance report');
 await editor.getByLabel('Details', { exact: true }).fill('Loose cabinet handle');
 await editor.getByRole('button', { name: 'Submit work order' }).click();
 await expect(editor.getByText('Work order #81 recorded.', { exact: false })).toBeVisible();
 await editor.getByRole('link', { name: 'Register found item' }).click();
 await page.getByLabel('Item description').fill('Synthetic umbrella');
 await page.getByLabel('Secure storage location').fill('Locker A');
 await page.getByRole('button', { name: 'Register item', exact: true }).click();
 await expect(page.getByText('Item LF-91 registered.', { exact: false })).toBeVisible();
 expect(api.registered()).toBe(true);
 expect(api.writes.some(write => write.path.endsWith('/claim'))).toBe(false);
 expect(api.writes.at(-1)?.body.roomId).toBe('2');
});

test('disallows writes and assignment controls for revoked housekeeping access', async ({ page }, testInfo) => {
 test.skip(testInfo.project.name !== 'desktop-chromium');
 const api = await interceptHotel(page, false);
 await page.goto(origin + '/housekeeping');
 await card(page, 201).getByRole('button', { name: 'View details' }).click();
 const editor = page.getByRole('dialog', { name: 'Room 201' });
 await expect(editor.getByText('Read-only task.', { exact: false })).toBeVisible();
 await expect(editor.getByRole('checkbox', { name: 'Remove trash' })).toBeDisabled();
 await expect(editor.getByRole('button', { name: 'Start cleaning' })).toHaveCount(0);
 await expect(editor.getByRole('combobox')).toHaveCount(0);
 expect(api.writes).toHaveLength(0);
});
