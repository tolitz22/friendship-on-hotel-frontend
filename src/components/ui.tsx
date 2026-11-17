import {dataMode} from '../api';
import type {ReactNode} from 'react';
export function DemoNotice(){return <div className="notice"><strong>Design preview</strong> · {dataMode === 'mock' ? 'Sample data only. No live reservations, guests, or payments.' : 'This screen uses sample data for illustration; it does not load or modify live hotel records. Use the operational pages for real actions.'}</div>}
export function Heading({title,description,action}:{title:string;description:string;action?:ReactNode}){return <div className="heading"><div><h2>{title}</h2><p>{description}</p></div>{action}</div>}
export function Panel({title,action,children}:{title:string;action?:ReactNode;children:ReactNode}){return <section className="panel"><div className="panel-title"><h3>{title}</h3>{action}</div>{children}</section>}
export function Status({value}:{value:string}){return <span className={'status status-'+value.toLowerCase().replaceAll(' ','-')}>{value}</span>}
export function Stat({label,value,detail,icon}:{label:string;value:string;detail:string;icon:ReactNode}){return <article className="stat"><div className="stat-header"><span>{label}</span><div className="stat-icon">{icon}</div></div><strong>{value}</strong><small>{detail}</small></article>}
