import {AlertTriangle} from 'lucide-react';
export function QueryFeedback({loading,error,empty=false}:{loading:boolean;error:Error|null;empty?:boolean}){
 if(loading)return <div className="query-feedback" role="status">Loading records…</div>;
 if(error)return <div className="query-feedback error" role="alert"><AlertTriangle size={18}/> {error.message}</div>;
 if(empty)return <div className="query-feedback">No matching records found.</div>;
 return null;
}
