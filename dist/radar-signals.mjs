import {normalizeSignals,signalRows,signalsCSV} from './radar-signals-core.mjs';
import {countryName} from './context.mjs';
const $=id=>document.getElementById(id),tr=(es,en)=>document.documentElement.lang==='en'?en:es;
const mode=document.body.dataset.signal,params=new URLSearchParams(location.search),size=20;
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
let data=null,filtered=[],page=1,initialized=false,selected=null,failed=false;
const labels={POWER_OUTAGE:['Corte eléctrico','Power outage'],MAINTENANCE:['Mantenimiento','Maintenance'],CABLE_CUT:['Corte de cable','Cable cut'],NATURAL_DISASTER:['Desastre natural','Natural disaster'],WEATHER:['Meteorología','Weather'],GOVERNMENT_DIRECTED:['Orden gubernamental','Government directed'],MILITARY_ACTION:['Acción militar','Military action'],TECHNICAL_PROBLEM:['Problema técnico','Technical issue'],UNKNOWN:['Sin causa indicada','Cause unspecified'],NATIONWIDE:['Nacional','Nationwide'],REGIONAL:['Regional','Regional'],NETWORK:['Red / operador','Network / provider']};
const label=v=>labels[v]?.[document.documentElement.lang==='en'?1:0]||v||'—',fmt=v=>v?v.slice(0,16).replace('T',' ')+' UTC':'—';
const geo=values=>values.length?values.map(v=>countryName(v)).join(' · '):tr('Sin país indicado','No country supplied');
function option(id,values,all,display=v=>v){
 const select=$(id),value=initialized?select.value:(params.get(id.slice(7))||'');select.replaceChildren(new Option(all,''));
 [...new Set(values.filter(Boolean))].sort((a,b)=>display(a).localeCompare(display(b))).forEach(v=>select.add(new Option(display(v),v)));
 if([...select.options].some(o=>o.value===value))select.value=value;
 select.closest('.field').hidden=select.options.length<2;
}
function options(){
 if(!data)return;
 const all=signalRows(data,mode,{});
 option('signal-country',all.flatMap(r=>r.countries),tr('Todos los países','All countries'),v=>v==='GLOBAL'?tr('Global','Global'):countryName(v));
 option('signal-cause',mode==='outages'?all.map(r=>r.cause):[],tr('Todas las causas','All causes'),label);
 $('signal-kind').closest('.field').hidden=mode!=='bgp';
 $('signal-query').closest('.field').hidden=false;$('signal-score').closest('.field').hidden=mode!=='bgp'||$('signal-kind').value!=='hijacks';
 initialized=true;
}
function render(reset=false){
 if(!data)return;if(reset)page=1;
 const score=mode==='bgp'&&$('signal-kind').value==='hijacks'?Number($('signal-score').value):0;
 filtered=signalRows(data,mode,{country:$('signal-country').value,query:$('signal-query').value,kind:$('signal-kind').value,cause:$('signal-cause').value,score});
 const pages=Math.max(1,Math.ceil(filtered.length/size));page=Math.min(page,pages);$('signal-body').replaceChildren();
 const headings=mode==='outages'?[tr('Inicio / UTC','Start / UTC'),tr('País del corte','Outage country'),tr('Causa y ámbito','Cause & scope'),tr('Fin informado','Reported end'),tr('Ficha','Record')]:[tr('Inicio / UTC','Start / UTC'),tr('Países de ASN implicados','Countries of involved ASNs'),tr('Tipo / ASN','Type / ASN'),tr('Confianza de la detección','Detection confidence'),tr('Ficha','Record')];
 $('signal-head').replaceChildren(...headings.map(h=>node('th',h)));
 for(const r of filtered.slice((page-1)*size,page*size)){
  const row=node('tr');let cells;
  {

   const title=mode==='outages'?label(r.cause)+(r.scope?' · '+r.scope:'')+' · '+label(r.type):(r.kind==='hijacks'?tr('Posible hijack','Potential hijack'):tr('Fuga de rutas','Route leak'))+' · AS'+r.actorAsn;
   const state=mode==='outages'?(r.end?fmt(r.end):tr('Sin fin informado','No end reported')):r.kind==='leaks'?tr('No aplica','Not applicable'):r.confidence===null?tr('Sin puntuación','No score'):r.confidence+' · '+(r.confidence>=8?tr('Alta','High'):r.confidence>=4?tr('Media','Medium'):tr('Baja','Low'));
   const action=node('td'),button=node('button','↗','detail-button');button.type='button';button.setAttribute('aria-label',tr('Ver evento ','View event ')+r.id);button.addEventListener('click',()=>open(r));action.append(button);
   cells=[node('td',fmt(r.start),'date-cell'),node('td',geo(r.countries)),node('td',title),node('td',state,'date-cell'),action];
  }
  cells.forEach((td,i)=>{td.dataset.label=headings[i];row.append(td);});$('signal-body').append(row);
 }
 const ds=data.datasets.filter(d=>mode==='bgp'?['hijacks','leaks'].includes(d.kind):d.kind===mode),has=ds.length>0,old=ds.some(d=>Date.now()-Date.parse(d.fetchedAt)>48*3600000);
 $('signal-status-box').classList.toggle('warning',!has||old||failed);$('signal-status').textContent=!has?tr('La fuente no ha devuelto datos todavía.','The source has not returned data yet.'):(failed?tr('No se pudo recargar. ','Reload failed. '):old?tr('Hay copias de más de 48 horas. ','Some snapshots are over 48 hours old. '):'')+tr('Copias obtenidas de Cloudflare Radar. Las fechas de cada conjunto se indican abajo.','Snapshots retrieved from Cloudflare Radar. Per-dataset dates are shown below.');
 $('signal-count').textContent=filtered.length+' '+tr('resultados en las copias publicadas','results in published snapshots');$('signal-empty').hidden=!!filtered.length;$('signal-empty').textContent=tr('No hay coincidencias en la copia publicada. No implica ausencia de actividad.','No matches in the published snapshot. This does not imply no activity.');
 $('signal-total').textContent=has?signalRows(data,mode,{}).length:'—';$('signal-countries').textContent=has?new Set(signalRows(data,mode,{}).flatMap(r=>r.countries).filter(v=>v!=='GLOBAL')).size:'—';
 $('signal-retrieved').textContent=ds.length?ds.map(d=>d.fetchedAt).sort()[0].slice(0,16).replace('T',' '):'—';
 $('signal-page').textContent=page+' / '+pages;$('signal-prev').disabled=page===1;$('signal-next').disabled=page===pages;$('signal-export').disabled=!filtered.length;
 $('signal-dates').replaceChildren(...ds.map(d=>node('p',d.kind+' · '+tr('Consulta: ','Retrieved: ')+fmt(d.fetchedAt)+(d.start?' · '+fmt(d.start)+' → '+fmt(d.end):' · '+tr('Ventana solicitada: 7 días · máximo ','Requested window: 7 days · maximum ')+d.limit))));
 const u=new URL(location.href);u.search='';for(const id of ['country','query','kind','cause','score']){const el=$('signal-'+id);if(el.value&&!el.closest('.field').hidden)u.searchParams.set(id,el.value);}history.replaceState(null,'',u);
 if(selected)fill(selected);
}
function fill(r){
 $('signal-title').textContent=(mode==='outages'?tr('Corte de Internet','Internet outage'):r.kind==='hijacks'?tr('Posible secuestro BGP','Potential BGP hijack'):tr('Fuga de rutas BGP','BGP route leak'))+' / '+r.id;
 const lines=mode==='outages'?[geo(r.countries),label(r.cause)+' · '+label(r.type),r.scope,r.description,'AS: '+r.asns.join(', '),r.asnCountries.length?tr('Países de ASN asociados (no ubicación confirmada del corte): ','Associated ASN countries (not confirmed outage location): ')+geo(r.asnCountries):'',tr('Inicio: ','Start: ')+fmt(r.start),tr('Fin informado: ','Reported end: ')+fmt(r.end)]:[geo(r.countries),tr('ASN señalado por la detección: AS','ASN flagged by the detector: AS')+r.actorAsn,tr('Otros ASN implicados: ','Other involved ASNs: ')+r.otherAsns.map(a=>'AS'+a).join(', '),...r.organizations.map(a=>'AS'+a.asn+' · '+a.name),tr('Puntuación de confianza: ','Confidence score: ')+(r.confidence??tr('No aplica','Not applicable')),r.prefixes.join('\n'),r.tags.join(' · '),tr('Primera observación: ','First observation: ')+fmt(r.start),tr('Última observación: ','Last observation: ')+fmt(r.lastSeen)];
 $('signal-detail').textContent=lines.filter(Boolean).join('\n\n');$('signal-detail-retrieved').textContent=tr('Consulta de la fuente: ','Source retrieved: ')+fmt(r.fetchedAt);
}
function open(r){selected=r;fill(r);$('signal-dialog').showModal();}
$('signal-close').addEventListener('click',()=>$('signal-dialog').close());
$('signal-dialog').addEventListener('click',e=>{if(e.target===$('signal-dialog')){const r=$('signal-dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('signal-dialog').close();}});
for(const id of ['country','cause','kind','score'])$('signal-'+id).addEventListener('change',()=>{if(id==='kind')options();render(true);});
$('signal-query').value=(params.get('query')||'').slice(0,200);for(const id of ['kind','score'])if([...$('signal-'+id).options].some(o=>o.value===params.get(id)))$('signal-'+id).value=params.get(id);
$('signal-query').addEventListener('input',()=>render(true));$('signal-filters').addEventListener('submit',e=>e.preventDefault());
$('signal-clear').addEventListener('click',()=>{for(const id of ['country','query','kind','cause','score'])$('signal-'+id).value='';options();render(true);});
$('signal-prev').addEventListener('click',()=>{page--;render();});$('signal-next').addEventListener('click',()=>{page++;render();});
$('signal-export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([signalsCSV(filtered,mode)],{type:'text/csv;charset=utf-8'})),a=node('a');a.href=url;a.download='cloudflare-radar-'+mode+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});
async function load(){
 $('signal-reload').disabled=true;
 try{const response=await fetch('./data/radar-signals.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error();data=normalizeSignals(await response.json());failed=false;options();render();}
 catch{failed=true;if(data)render();else{$('signal-status-box').classList.add('warning');$('signal-status').textContent=tr('No se pudo cargar la copia.','Could not load the snapshot.');$('signal-export').disabled=true;}}
 finally{$('signal-reload').disabled=false;}
}
$('signal-reload').addEventListener('click',load);window.addEventListener('languagechange',()=>{options();render();});load();
