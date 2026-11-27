import {useState} from 'react';
import {PlatformPlansPanel} from './PlatformPlansPanel';
import {PlatformHotelSubscriptionsPanel} from './PlatformHotelSubscriptionsPanel';
export function PlatformSubscriptionsWorkspace({userId}:{userId:string}){
 const [view,setView]=useState<'agreements'|'catalog'>('agreements');
 return <section aria-label="Subscriptions workspace"><div className="platform-tabs platform-subscription-tabs" role="group" aria-label="Subscription section"><button type="button" aria-pressed={view==='agreements'} aria-selected={view==='agreements'} onClick={()=>setView('agreements')}>Hotel subscriptions</button><button type="button" aria-pressed={view==='catalog'} aria-selected={view==='catalog'} onClick={()=>setView('catalog')}>Plan catalog</button></div>{view==='agreements'?<PlatformHotelSubscriptionsPanel userId={userId}/>:<PlatformPlansPanel userId={userId}/>}</section>;
}
