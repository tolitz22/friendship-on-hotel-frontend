import {useEffect,useState} from 'react';
import {Building2,BedDouble,Clock3,ShieldCheck,RotateCcw,Save,Info,Users} from 'lucide-react';
import {useHotelSettings} from '../api/queries';
import {dataMode} from '../api';
import type {PropertySettings} from '../api/types';
import {DemoNotice,Heading} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {currency} from '../lib/format';
import {demonstrationRules,validateSettings} from '../features/settings/settingsValidation';

type Tab='property'|'inventory'|'operations'|'roles';
const tabs:{id:Tab;label:string;icon:typeof Building2}[]=[
 {id:'property',label:'Property',icon:Building2},{id:'inventory',label:'Rooms & floors',icon:BedDouble},
 {id:'operations',label:'Operations',icon:Clock3},{id:'roles',label:'Staff roles',icon:ShieldCheck}
];
export function Settings(){
 const query=useHotelSettings();
 const config=query.data?.data;
 const [tab,setTab]=useState<Tab>('property');
 const [draft,setDraft]=useState<PropertySettings|null>(null);
 const [confirmed,setConfirmed]=useState(false);
 const [attempted,setAttempted]=useState(false);
 const editable=dataMode==='mock';
 useEffect(()=>{if(config&&!draft)setDraft({...config.property});},[config,draft]);
 const result=draft?validateSettings(draft):null;
 const errors:Record<string,string[]|undefined>=result&&!result.success?result.error.flatten().fieldErrors:{};
 const changed=!!draft&&!!config&&JSON.stringify(draft)!==JSON.stringify(config.property);
 function change<K extends keyof PropertySettings>(key:K,value:PropertySettings[K]){
  if(!editable||!draft)return;
  setConfirmed(false);setDraft({...draft,[key]:value});
 }
 function reset(){if(config)setDraft({...config.property});setConfirmed(false);setAttempted(false);}
 function previewSave(){
  setAttempted(true);
  if(!draft||!result?.success)return;
  setConfirmed(true);
 }
 return <><DemoNotice/>
 <Heading title="Hotel settings" description="Preview property configuration, physical room categories, operational preferences and example staff access roles."/>
 <div className="settings-summary"><div><Building2 size={19}/><span>Property</span><strong>{config?.property.name??'Loading…'}</strong></div><div><BedDouble size={19}/><span>Sample rooms</span><strong>{config?.floors.reduce((sum,f)=>sum+f.roomCount,0)??'—'}</strong></div><div><Users size={19}/><span>Example staff roles</span><strong>{config?.roles.length??'—'}</strong></div></div>
 <QueryFeedback loading={query.isPending} error={query.error}/>
 {config&&draft&&<div className="settings-layout">
  <nav className="settings-nav" aria-label="Settings sections">{tabs.map(({id,label,icon:Icon})=><button type="button" key={id} className={tab===id?'active':''} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}><Icon size={18}/>{label}</button>)}</nav>
  <section className="settings-main">
   {tab==='property'&&<><header><h3>Property information</h3><p>Basic contact details shown in this property preview. Nothing is saved to a server.</p></header>
    <div className="settings-fields">
     <label className="settings-field settings-wide">Hotel name<input value={draft.name} maxLength={120} disabled={!editable} onChange={e=>change('name',e.target.value)}/>{attempted&&errors.name&&<small role="alert">{errors.name[0]}</small>}</label>
     <label className="settings-field settings-wide">Address<textarea value={draft.address} maxLength={300} disabled={!editable} onChange={e=>change('address',e.target.value)}/>{attempted&&errors.address&&<small role="alert">{errors.address[0]}</small>}</label>
     <label className="settings-field">Contact email<input type="email" value={draft.contactEmail} disabled={!editable} onChange={e=>change('contactEmail',e.target.value)}/>{attempted&&errors.contactEmail&&<small role="alert">{errors.contactEmail[0]}</small>}</label>
     <label className="settings-field">Contact phone<input type="tel" value={draft.contactPhone} disabled={!editable} onChange={e=>change('contactPhone',e.target.value)}/></label>
    </div>
   </>}
   {tab==='inventory'&&<><header><h3>Room types and floors</h3><p>Categories and counts are derived from the same fictional room inventory used elsewhere in the UI.</p></header>
    <div className="settings-table-scroll"><table><thead><tr><th>Room type</th><th>Sample rooms</th><th>Max occupants</th><th>Illustrative rate / night</th></tr></thead><tbody>{config.roomTypes.map(type=><tr key={type.id}><td><strong>{type.name}</strong></td><td>{type.roomCount}</td><td>{type.maxOccupancy}</td><td>{currency(type.sampleRate)}</td></tr>)}</tbody></table></div>
    <h4 className="settings-subhead">Physical floors</h4>
    <div className="settings-floor-grid">{config.floors.map(floor=><div key={floor.number}><span>Floor {floor.number}</span><strong>{floor.roomCount} sample room(s)</strong></div>)}</div>
    <p className="settings-readonly"><Info size={15}/> Changing room types or floors may affect existing bookings. These changes must be reviewed and recorded.</p>
   </>}
   {tab==='operations'&&<><header><h3>Operational preferences</h3><p>Example operating times and regional display settings. Not active check-in/check-out policy enforcement.</p></header>
    <div className="settings-fields">
     <label className="settings-field">Example check-in time<input type="time" disabled={!editable} value={draft.checkInTime} onChange={e=>change('checkInTime',e.target.value)}/>{attempted&&errors.checkInTime&&<small role="alert">{errors.checkInTime[0]}</small>}</label>
     <label className="settings-field">Example check-out time<input type="time" disabled={!editable} value={draft.checkOutTime} onChange={e=>change('checkOutTime',e.target.value)}/>{attempted&&errors.checkOutTime&&<small role="alert">{errors.checkOutTime[0]}</small>}</label>
     <label className="settings-field">Hotel time zone<select value={draft.timeZone} disabled><option value="Asia/Manila">Asia/Manila</option></select></label>
     <label className="settings-field">Currency<select value={draft.currency} disabled><option value="PHP">PHP — Philippine Peso</option></select></label>
    </div>
    <p className="settings-readonly"><Info size={15}/> These example time and currency settings cannot be changed here. Operational times shown here do not affect reservations or financial reports.</p>
   </>}
   {tab==='roles'&&<><header><h3>Staff roles and access preview</h3><p>These are display-only role examples, not actual permissions or user accounts.</p></header>
    <div className="settings-roles">{config.roles.map(role=><article key={role.id}><div><ShieldCheck size={19}/><h4>{role.name}</h4><span>{role.staffCount} fictional staff</span></div><p>{role.description}</p><div>{role.permissionLabels.map(label=><span key={label}>{label}</span>)}</div></article>)}</div>
    <p className="settings-readonly"><Info size={15}/> Only authorized staff can access restricted actions. The roles shown here are examples.</p>
   </>}
   {(tab==='property'||tab==='operations')&&<footer className="settings-actions">
    {confirmed&&<span className="settings-saved" role="status">Preview validated. No changes were saved.</span>}
    {editable?<><button className="btn-inline" onClick={reset} disabled={!changed}><RotateCcw size={15}/> Reset preview</button><button className="btn-primary" onClick={previewSave} disabled={!changed}><Save size={16}/> Validate preview</button></>:<span className="settings-readonly">Editing is not available on this page.</span>}
   </footer>}
  </section>
 </div>}
 <section className="settings-guidance"><h3>Configuration boundaries</h3><ul>{demonstrationRules.map(rule=><li key={rule}>{rule}</li>)}</ul></section>
 </>;
}
