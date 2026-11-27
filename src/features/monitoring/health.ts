import type {HealthState} from '../../api/platformHealth';
export type ObservationState=HealthState|'unknown';
export interface HealthObservation{at:number;state:ObservationState;database:ObservationState;cache:ObservationState;grafana:ObservationState}
export function appendHealthObservation(history:HealthObservation[],observation:HealthObservation){
 return [...history.filter(h=>h.at!==observation.at),observation].sort((a,b)=>b.at-a.at).slice(0,20);
}
export function formatDatabaseSize(bytes:number|null){
 if(bytes===null||!Number.isFinite(bytes)||bytes<0)return 'Unavailable';
 if(bytes<1024)return bytes+' B';
 const units=['KiB','MiB','GiB','TiB','PiB'];
 const i=Math.min(units.length-1,Math.floor(Math.log(bytes)/Math.log(1024))-1);
 return (bytes/1024**(i+1)).toLocaleString(undefined,{maximumFractionDigits:1})+' '+units[i];
}
