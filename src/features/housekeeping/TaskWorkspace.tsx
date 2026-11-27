import { useState } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import {
 AlertTriangle, ArrowRight, BedDouble, ChevronRight, ShieldCheck, CalendarClock, CheckCircle2, ClipboardCheck, ClipboardList,
 Clock3, ListTodo, RefreshCcw, Search, SlidersHorizontal, UserRound, X,
} from 'lucide-react';
import type { HousekeepingList, HousekeepingSummary, LiveHousekeepingTask } from '../../api/liveHousekeeping';
import { QueryFeedback } from '../../components/QueryFeedback';
import { dueLabel, taskNames, taskStage } from './taskDisplay';

export type TaskView = 'all' | 'mine' | 'active' | 'arrival_today' | 'todo' | 'in_progress'
 | 'pending_inspection' | 'completed' | 'completed_today' | 'overdue' | 'unassigned' | 'done';

export type WorkspaceFilters = {
 view: TaskView;
 own: boolean;
 text: string;
 type: keyof typeof taskNames | '';
 assignee: string;
 floor: string;
 room: string;
 dueDate: string;
};

export const defaultWorkspaceFilters: WorkspaceFilters = {
 view: 'all', own: false, text: '', type: '', assignee: '', floor: '', room: '', dueDate: '',
};

const metrics = [
 { key: 'active', view: 'active', label: 'Active tasks', icon: ClipboardList, tone: 'neutral' },
 { key: 'urgent', view: 'arrival_today', label: 'Urgent arrivals', icon: AlertTriangle, tone: 'urgent' },
 { key: 'todo', view: 'todo', label: 'To do', icon: ListTodo, tone: 'neutral' },
 { key: 'inProgress', view: 'in_progress', label: 'In progress', icon: Clock3, tone: 'working' },
 { key: 'inspectionDue', view: 'pending_inspection', label: 'Inspection due', icon: ClipboardCheck, tone: 'inspection' },
 { key: 'completedToday', view: 'completed_today', label: 'Completed today', icon: CheckCircle2, tone: 'complete' },
 { key: 'overdue', view: 'overdue', label: 'Overdue', icon: CalendarClock, tone: 'urgent' },
] as const satisfies readonly {
 key: keyof HousekeepingSummary; view: TaskView; label: string; icon: typeof Clock3; tone: string;
}[];

const viewLabels: Record<TaskView, string> = {
 all: 'All tasks', mine: 'My assigned tasks', active: 'Active tasks', arrival_today: 'Urgent arrivals',
 todo: 'To do', in_progress: 'In progress', pending_inspection: 'Inspection due', completed: 'Completed',
 completed_today: 'Completed today', overdue: 'Overdue', unassigned: 'Unassigned', done: 'Cleaning completed',
};

const floorLabel = (floor: number) => floor === 0 ? 'Ground floor' : 'Floor ' + floor;

function emptyCopy(view: TaskView, narrowed: boolean, summary?: HousekeepingSummary) {
 if (narrowed) return 'No tasks match these filters.';
 if (view === 'mine') return 'No tasks are assigned to you. Open All tasks to help the team.';
 if (view === 'pending_inspection') return 'No rooms are waiting for final inspection.';
 if (view === 'active' && summary?.inspectionDue) return 'Cleaning is complete. Final inspections are still due.';
 if (view === 'active') return summary?.completedToday ? 'All cleaning is complete.' : 'No active cleaning tasks.';
 if (view === 'all' && !summary?.active) return 'No active cleaning tasks or task history yet.';
 return 'No tasks match this view.';
}

function TaskCard({ task, hotelDate, assignee, editable, open }: {
 task: LiveHousekeepingTask; hotelDate: string; assignee: string; editable: boolean; open: () => void;
}) {
 const total = task.checklist?.length ?? 0;
 const checked = task.checklist?.filter(item => item.checkedAt !== null).length ?? 0;
 const operational = editable && (task.status !== 'done' || task.pendingInspection);
 const action = !editable ? 'View details' : task.pendingInspection ? 'Complete final inspection'
  : task.status === 'todo' ? 'Start cleaning' : task.status === 'in_progress' ? 'Continue cleaning' : 'View details';
 const priority = task.arrivalToday ? 'arrival' : task.overdue ? 'overdue' : '';
 return <article className="hk-work-card" data-priority={priority} data-task-stage={task.pendingInspection?'inspection':task.status}>
  <span className="hk-mobile-room-icon" aria-hidden="true">{task.pendingInspection?<ShieldCheck size={22}/>:<BedDouble size={22}/>}</span>
  <div className="hk-card-heading">
   <div>
    <h4>Room {task.roomNumber}</h4>
    {task.roomType && <p>{task.roomType}</p>}
   </div>
   <span className="hk-work-stage" data-stage={task.pendingInspection ? 'inspection' : task.status}>{taskStage(task)}</span>
  </div>
  <p className="hk-card-type">{taskNames[task.type]}</p>
  {(task.arrivalToday || task.overdue) && <div className="hk-card-flags">
   {task.arrivalToday && <span><AlertTriangle size={14} aria-hidden="true"/> Arrival today</span>}
   {task.overdue && <span><Clock3 size={14} aria-hidden="true"/> Overdue</span>}
  </div>}
  <div className="hk-card-meta">
   <span><UserRound size={15} aria-hidden="true"/>{assignee}</span>
   <span><Clock3 size={15} aria-hidden="true"/>{task.dueAt ? 'Due ' : ''}{dueLabel(task.dueAt, hotelDate)}</span>
  </div>
  {total > 0 && <div className="hk-card-progress">
   <span>Saved checklist</span><strong>{checked}/{total}</strong>
   <progress max={total} value={checked} aria-label={`Room ${task.roomNumber} saved checklist`}/>
  </div>}
  <footer className="hk-card-footer">
   <small>HK-{task.id}</small>
   <button className={operational ? 'btn-primary' : 'btn-inline'} type="button" onClick={open}>
    <span className="hk-task-action-label">{action}</span><ArrowRight className="hk-desktop-task-arrow" size={16} aria-hidden="true"/><ChevronRight className="hk-mobile-task-arrow" size={20} aria-hidden="true"/>
   </button>
  </footer>
 </article>;
}

export function TaskWorkspace({ filters, change, page, setPage, tasks, overview, online, hotelDate, admin, assignedName, canUpdate, open, canWork }: {
 filters: WorkspaceFilters; change: (next: Partial<WorkspaceFilters>) => void;
 page: number; setPage: (page: number) => void;
 tasks: UseQueryResult<HousekeepingList>; overview: UseQueryResult<HousekeepingList>;
 online: boolean; hotelDate: string; admin: boolean; canWork: boolean;
 assignedName: (task: LiveHousekeepingTask) => string;
 canUpdate: (task: LiveHousekeepingTask) => boolean; open: (task: LiveHousekeepingTask) => void;
}) {
 const [expanded, setExpanded] = useState(false);
 const [mobileFiltersOpen,setMobileFiltersOpen]=useState(false);
 const overviewMeta = online && overview.isSuccess ? overview.data.meta : undefined;
 const summary = overviewMeta?.summary;
 const secondary: { key: keyof WorkspaceFilters; label: string }[] = [];
 if (filters.type) secondary.push({ key: 'type', label: taskNames[filters.type] });
 if (filters.floor) secondary.push({ key: 'floor', label: floorLabel(Number(filters.floor)) });
 if (filters.room.trim()) secondary.push({ key: 'room', label: 'Room ' + filters.room.trim() });
 if (filters.assignee) secondary.push({ key: 'assignee', label: overviewMeta?.assignees?.find(staff => staff.id === filters.assignee)?.name ?? 'Selected employee' });
 if (filters.dueDate) secondary.push({ key: 'dueDate', label: 'Due ' + filters.dueDate });
 const narrowed = !!filters.text.trim() || secondary.length > 0;
 const filtered = narrowed || filters.own || filters.view !== 'all';
 const list = online && tasks.isSuccess ? tasks.data : undefined;
 const refresh = () => { void Promise.all([tasks.refetch(), overview.refetch()]); };

 const mobileViews=[{view:'all',label:'All',count:overviewMeta?.total},{view:'todo',label:'To do',count:summary?.todo},{view:'in_progress',label:'In progress',count:summary?.inProgress},{view:'pending_inspection',label:'Inspection',count:summary?.inspectionDue}] as const;
 const mobileOwn=filters.own||filters.view==='mine';
 const mobileExtraView=!mobileViews.some(item=>item.view===filters.view);
 const mobileFilterCount=secondary.length+Number(!!filters.text.trim())+Number(mobileOwn)+Number(mobileExtraView&&!mobileOwn);
 return <div className="hk-workspace" data-mobile-filters={mobileFiltersOpen?'open':'closed'}>
  <section aria-label="Team workload" className="hk-overview-panel">
   <div className="hk-workspace-heading">
    <h3>Team workload</h3>
    <button className="btn-inline" type="button" onClick={refresh} disabled={!online || tasks.isFetching || overview.isFetching}>
     <RefreshCcw size={16} aria-hidden="true"/>{tasks.isFetching || overview.isFetching ? 'Refreshing…' : 'Refresh tasks'}
    </button>
   </div>
   <div className="hk-overview-grid" role="group" aria-label="Workload filters">
    {metrics.map(({ key, view, label, icon: Icon, tone }) => {
     const count = summary?.[key];
     return <button key={key} type="button" aria-pressed={!filters.own && filters.view === view} data-tone={count ? tone : 'neutral'}
      onClick={() => change({ ...defaultWorkspaceFilters, view })}>
      <Icon size={17} aria-hidden="true"/><strong>{count ?? '—'}</strong><span>{label}</span>
     </button>;
    })}
   </div>
   {online && overview.isPending && <p className="hk-workspace-note" role="status">Loading team totals…</p>}
   {online && !overview.isPending && !summary && <p className="hk-workspace-note" role="status">
    Team totals are unavailable. <button type="button" className="btn-inline" onClick={() => void overview.refetch()}>Retry totals</button>
   </p>}
  </section>

  <section className="hk-work-list" aria-labelledby="hk-queue-title">
   <div className="hk-mobile-task-controls">
    <div className="hk-mobile-task-tabs" role="group" aria-label="Task status filters">
     {mobileViews.map(({view,label,count})=><button key={view} type="button" aria-pressed={filters.view===view} onClick={()=>change({view,own:view==='all'?false:mobileOwn})}>
      <span>{label}</span>{!mobileOwn&&count!==undefined&&<strong>{count}</strong>}
     </button>)}
    </div>
    <div className="hk-mobile-task-tools">
     <span role="status">{list?list.meta.total+' '+(list.meta.total===1?'task':'tasks'):'Tasks'}{mobileOwn?' · My assignments':''}{mobileExtraView&&!mobileOwn?' · '+viewLabels[filters.view]:''}</span>
     <button type="button" className="hk-mobile-tool" aria-label="Refresh tasks" disabled={!online||tasks.isFetching||overview.isFetching} onClick={refresh}><RefreshCcw size={17}/></button>
     <button type="button" className="hk-mobile-tool" aria-expanded={mobileFiltersOpen} aria-controls="hk-task-advanced" onClick={()=>setMobileFiltersOpen(value=>!value)}><SlidersHorizontal size={17}/> Filters{mobileFilterCount?' ('+mobileFilterCount+')':''}</button>
    </div>
   </div>
   <div className="hk-workspace-heading hk-desktop-queue-heading">
    <h3 id="hk-queue-title">Task queue</h3>
    {list && <span role="status">{list.meta.total} {list.meta.total === 1 ? 'task' : 'tasks'}</span>}
   </div>
   <div id="hk-task-advanced" className="hk-work-toolbar">
    <div className="hk-work-views" role="group" aria-label="Task views">
     {(['all', 'mine', 'completed', ...(admin ? ['unassigned'] as const : [])] as const).map(view =>
      <button type="button" key={view} aria-pressed={filters.view === view}
       onClick={() => change({ view, own:false, ...(view === 'mine' || view === 'unassigned' ? { assignee: '' } : {}) })}>
       {viewLabels[view]}
      </button>)}
    </div>
    <div className="hk-mobile-more-views" role="group" aria-label="Other task views">
     {(['arrival_today','overdue','completed_today','active'] as const).map(view=><button key={view} type="button" aria-pressed={filters.view===view} onClick={()=>change({view,own:mobileOwn})}>{viewLabels[view]}</button>)}
     {mobileOwn&&filters.view!=='mine'&&<button type="button" onClick={()=>change({own:false})}>Show all staff</button>}
    </div>
    <div className="hk-work-search">
     <label><Search size={17} aria-hidden="true"/><input aria-label="Search tasks" type="search" maxLength={120}
      value={filters.text} placeholder="Search rooms, tasks or staff" onChange={event => change({ text: event.target.value })}/></label>
     <button type="button" className="btn-inline" aria-expanded={expanded} aria-controls="hk-secondary-filters" onClick={() => setExpanded(value => !value)}>
      <SlidersHorizontal size={16} aria-hidden="true"/> <span className="hk-desktop-filter-label">Filters</span><span className="hk-mobile-filter-label">More filters</span>{secondary.length ? ' (' + secondary.length + ')' : ''}
     </button>
    </div>
    <div id="hk-secondary-filters" className="hk-work-secondary" hidden={!expanded}>
     <label>Task type<select value={filters.type} onChange={event => change({ type: event.target.value as WorkspaceFilters['type'] })}>
      <option value="">All types</option>{Object.entries(taskNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
     </select></label>
     <label>Room number<input value={filters.room} maxLength={32} placeholder="Exact room number" onChange={event => change({ room: event.target.value })}/></label>
     {!!overviewMeta?.floors?.length && <label>Floor<select value={filters.floor} onChange={event => change({ floor: event.target.value })}>
      <option value="">All floors</option>{overviewMeta.floors.map(floor => <option key={floor} value={floor}>{floorLabel(floor)}</option>)}
     </select></label>}
     {!!overviewMeta?.assignees?.length && !(filters.own || filters.view === 'mine' || filters.view === 'unassigned') && <label>Assigned employee<select value={filters.assignee}
      onChange={event => change({ assignee: event.target.value })}>
      <option value="">All employees</option>{overviewMeta.assignees.map(staff => <option value={staff.id} key={staff.id}>{staff.name}</option>)}
     </select></label>}
     <label>Due date<input type="date" value={filters.dueDate} onChange={event => change({ dueDate: event.target.value })}/></label>
    </div>
    {filtered && <div className="hk-active-filters" aria-label="Active filters">
     {filters.own && <span>My assigned tasks</span>}
     {filters.view !== 'all' && <span>{viewLabels[filters.view]}</span>}
     {secondary.map(({ key, label }) => <button type="button" key={key} className="btn-inline" aria-label={'Remove filter ' + label}
      onClick={() => change({ [key]: '' })}>{label}<X size={14} aria-hidden="true"/></button>)}
     <button type="button" className="btn-inline" onClick={() => change(defaultWorkspaceFilters)}>Reset filters</button>
    </div>}
   </div>
   {!online ? <p className="hk-network-alert" role="status">You’re offline. Reconnect to load current tasks.</p> :
    <QueryFeedback loading={tasks.isPending} error={tasks.error} onRetry={() => void tasks.refetch()}/>}
   {list && list.data.length === 0 && <div className="hk-work-empty" role="status">
    <ClipboardList size={22} aria-hidden="true"/><p>{emptyCopy(filters.view, narrowed || filters.own, summary)}</p>
    {filters.view === 'active' && !!summary?.inspectionDue &&
     <button type="button" className="btn-inline" onClick={() => change({ ...defaultWorkspaceFilters, view: 'pending_inspection' })}>Open inspections</button>}
   </div>}
   {list && list.data.length > 0 && <>
    {!canWork && <p className="hk-workspace-note">You have read-only access to housekeeping tasks.</p>}
    <div className="hk-work-cards">
     {list.data.map(task => <TaskCard key={task.id} task={task} hotelDate={hotelDate} assignee={assignedName(task)}
      editable={canUpdate(task)} open={() => open(task)}/>)}
    </div>
   </>}
   {list && list.meta.totalPages > 1 && <div className="hk-queue-pagination">
    <span>Page {list.meta.page} of {list.meta.totalPages}</span>
    <div><button type="button" className="btn-inline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
     <button type="button" className="btn-inline" disabled={page >= list.meta.totalPages} onClick={() => setPage(page + 1)}>Next</button></div>
   </div>}
  </section>
 </div>;
}
