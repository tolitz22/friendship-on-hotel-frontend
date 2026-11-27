import type {CapacityResource} from '../api/subscriptionCapacity';
import './SubscriptionCapacityMeter.css';
export function SubscriptionCapacityMeter({label,resource,enforced}:{label:string;resource:CapacityResource;enforced:boolean}){
 const {used,limit,state}=resource;
 const text=state==='over'?'Over limit':state==='full'?'Limit reached':state==='near'?'Near limit':limit===null?'Unlimited':'Available';
 return <div className={'capacity-meter capacity-'+state}><div className="capacity-meter-label"><strong>{label}</strong><span>{used.toLocaleString()} / {limit===null?'Unlimited':limit.toLocaleString()}</span></div>{limit!==null&&<progress aria-label={label+' usage'} value={Math.min(used,limit)} max={limit}/>}<small>{text}{!enforced&&limit!==null?' · Advisory only':''}</small></div>;
}
