import {useSyncExternalStore} from 'react';
function subscribe(listener:()=>void){
 window.addEventListener('online',listener);window.addEventListener('offline',listener);
 return ()=>{window.removeEventListener('online',listener);window.removeEventListener('offline',listener);};
}
const online=()=>navigator.onLine;
export function useNetworkStatus(){return useSyncExternalStore(subscribe,online,()=>true);}
