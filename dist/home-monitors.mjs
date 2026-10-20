import {normalize,prettyDate} from './core.mjs';
import {normalizePosts} from './ransom-core.mjs';
import {normalizeMalware} from './malware-core.mjs';
import {normalizeIncidents,selectIncidents} from './ddos-core.mjs';
import {normalizeSignals,signalRows} from './radar-signals-core.mjs';

const oldest=values=>values.filter(v=>typeof v==='string'&&Number.isFinite(Date.parse(v))).sort((a,b)=>Date.parse(a)-Date.parse(b))[0]||null;
// All counts and excerpts come from the same published snapshots as the monitors.
export function homePreview(key,input,lang='es'){
 const en=lang==='en';let rows,checked;
 if(key==='vulns'){
  const d=normalize(input);checked=d.fetchedAt;
  rows=d.vulnerabilities.map(r=>({title:r.cveID,detail:r.vulnerabilityName,when:r.dateAdded,cve:r.cveID}));
 }else if(key==='ransom'){
  const d=normalizePosts(input);checked=d.fetchedAt;
  rows=d.posts.map(r=>({title:r.entity,detail:(en?'Claim · ':'Reivindicación · ')+r.group,when:r.discovered}));
 }else if(key==='malware'){
  const d=normalizeMalware(input);checked=d.fetchedAt;
  rows=d.samples.map(r=>({title:r.family||r.tags.find(t=>t.toLowerCase()!==r.fileType?.toLowerCase())||(en?'Unlabelled family':'Familia sin etiqueta'),detail:r.sha256.slice(0,16)+'… · '+(r.fileType||'—'),when:r.firstSeen}));
 }else if(key==='ddos'){
  const d=normalizeIncidents(input);checked=oldest(d.sources.map(s=>s.fetchedAt));
  rows=selectIncidents(d.incidents).map(r=>({title:r.entity,detail:r.components.join(' · ')||(en?'Provider notice':'Aviso del proveedor'),when:r.startedAt}));
 }else if(key==='outages'||key==='bgp'){
  const d=normalizeSignals(input);const kinds=key==='bgp'?['hijacks','leaks']:['outages'];
  checked=oldest(d.datasets.filter(v=>kinds.includes(v.kind)).map(v=>v.fetchedAt));
  rows=signalRows(d,key).map(r=>key==='outages'?{
   title:r.countries.length?r.countries.join(' · '):r.asns?.length?r.asns.map(a=>'AS'+a).slice(0,2).join(' · '):(en?'Connectivity disruption':'Interrupción de conectividad'),detail:r.description||(en?'Connectivity event':'Evento de conectividad'),when:r.start
  }:{title:(r.kind==='hijacks'?(en?'Potential hijack':'Posible hijack'):(en?'Route leak':'Fuga de rutas'))+(r.actorAsn?' · AS'+r.actorAsn:''),detail:r.prefixes?.length?r.prefixes.slice(0,2).join(' · '):r.organizations?.map(o=>o.name).filter(Boolean).join(' · ')||(en?'Routing event':'Evento de enrutamiento'),when:r.start});
 }else throw Error('Unknown monitor');
 return {count:rows.length,checked,rows:rows.slice(0,3)};
}

if(typeof document!=='undefined'){
 const files={vulns:'kev',ransom:'ransomware',malware:'malware',ddos:'ddos-incidents',outages:'radar-signals',bgp:'radar-signals'};
 const requests=new Map(),snapshots=new Map(),failed=new Set();
 const language=()=>document.documentElement.lang==='en'?'en':'es';
 function render(card){
  const key=card.dataset.homeMonitor,lang=language(),en=lang==='en';
  const count=card.querySelector('[data-feed-count]'),date=card.querySelector('[data-feed-date]'),root=card.querySelector('[data-feed-rows]');
  if(failed.has(key)){
   count.textContent='—';date.textContent=en?'Snapshot unavailable':'Copia no disponible';root.replaceChildren();
   const p=document.createElement('p');p.className='preview-loading';p.textContent=en?'Open the monitor to check its data and source.':'Abre el monitor para consultar sus datos y fuente.';root.append(p);return;
  }
  if(!snapshots.has(key))return;
  const data=homePreview(key,snapshots.get(key),lang);
  count.textContent=new Intl.NumberFormat(en?'en-GB':'es-ES').format(data.count);
  if(data.checked){
   const stamp=new Intl.DateTimeFormat(en?'en-GB':'es-ES',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC',hourCycle:'h23'}).format(new Date(data.checked));
   date.textContent=(en?'Checked: ':'Consulta: ')+stamp+' UTC';
  }else date.textContent=en?'No check date':'Consulta sin fecha';
  root.replaceChildren();
  for(const row of data.rows){
   const a=document.createElement('a');a.className='preview-item';a.href=card.querySelector('.button').getAttribute('href')+(row.cve?'?cve='+encodeURIComponent(row.cve):'');
   const title=document.createElement('strong');title.textContent=row.title;title.title=row.title;
   const when=document.createElement('time');when.dateTime=row.when.slice(0,10);when.textContent=prettyDate(row.when.slice(0,10),lang);
   const detail=document.createElement('p');detail.textContent=row.detail;detail.title=row.detail;
   a.append(title,when,detail);root.append(a);
  }
  if(!data.rows.length){const p=document.createElement('p');p.className='preview-loading';p.textContent=en?'No records in this snapshot.':'Sin registros en esta copia.';root.append(p);}
 }
 const cards=[...document.querySelectorAll('[data-home-monitor]')];
 for(const card of cards){
  const key=card.dataset.homeMonitor,file=files[key];
  if(!requests.has(file))requests.set(file,fetch('./data/'+file+'.json').then(r=>{if(!r.ok)throw Error('Snapshot unavailable');return r.json();}));
  requests.get(file).then(input=>{homePreview(key,input);snapshots.set(key,input);render(card);}).catch(()=>{failed.add(key);render(card);});
 }
 window.addEventListener('languagechange',()=>cards.forEach(render));
}
