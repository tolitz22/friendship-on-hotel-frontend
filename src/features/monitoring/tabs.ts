export const monitoringTabs=['overview','health','workers','logs'] as const;
export type MonitoringTab=typeof monitoringTabs[number];
export function monitoringQueryScope(tab:MonitoringTab){
 return {metrics:tab==='overview',events:tab==='logs',health:tab==='health',workers:tab==='workers'};
}
export function nextMonitoringTab(tab:MonitoringTab,key:string):MonitoringTab|null{
 const i=monitoringTabs.indexOf(tab);
 if(key==='Home')return monitoringTabs[0];
 if(key==='End')return monitoringTabs[monitoringTabs.length-1];
 if(key==='ArrowRight')return monitoringTabs[(i+1)%monitoringTabs.length];
 if(key==='ArrowLeft')return monitoringTabs[(i+monitoringTabs.length-1)%monitoringTabs.length];
 return null;
}
