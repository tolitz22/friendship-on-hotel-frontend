import {getJson,requestJson} from './http';
export interface PlanFields{name:string;description:string|null;monthlyMinor:number;annualMinor:number;roomLimit:number|null;staffLimit:number|null;isActive:boolean}
export interface PlatformPlan extends PlanFields{id:string;code:string;currency:'PHP';revision:number;updatedAt:string|null}
export interface PlanRevision{revision:number;actorId:string|null;createdAt:string;snapshot:PlatformPlan}
export interface Paginated<T>{data:T[];meta:{page:number;lastPage:number;total:number}}
export type PlanStatus='all'|'active'|'inactive';
const path='/platform/subscription-plans';
export function fetchPlatformPlans(status:PlanStatus,page:number,signal?:AbortSignal){return getJson<Paginated<PlatformPlan>>(path,{status,page},signal);}
export function createPlatformPlan(input:PlanFields&{code:string}){return requestJson<{data:PlatformPlan}>(path,{method:'POST',body:input});}
export function updatePlatformPlan(id:string,input:PlanFields&{revision:number}){return requestJson<{data:PlatformPlan}>(path+'/'+encodeURIComponent(id),{method:'PUT',body:input});}
export function fetchPlanHistory(id:string,page:number,signal?:AbortSignal){return getJson<Paginated<PlanRevision>>(path+'/'+encodeURIComponent(id)+'/history',{page},signal);}
