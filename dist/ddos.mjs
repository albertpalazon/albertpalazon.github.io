import {normalizeIncidents,selectIncidents,incidentsCSV} from './ddos-core.mjs';
const $=id=>document.getElementById(id),tr=(es,en)=>document.documentElement.lang==='en'?en:es,node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const params=new URLSearchParams(location.search);let data=null,filtered=[],selected=null,page=1,initialized=false,failed=false;const size=20;
const status=value=>({resolved:tr('Resuelta','Resolved'),postmortem:tr('Informe posterior','Postmortem'),monitoring:tr('En observación','Monitoring'),identified:tr('Identificada','Identified'),investigating:tr('En investigación','Investigating')})[value]||tr('Sin estado','Unknown');
const date=value=>value?value.slice(0,16).replace('T',' ')+' UTC':'—';
$('ddos-query').value=(params.get('q')||'').slice(0,200);
function options(){
 for(const field of ['entity','status']){
  const select=$('ddos-'+field),value=initialized?select.value:(params.get(field)||'');select.replaceChildren(new Option(field==='entity'?tr('Todas las entidades','All entities'):tr('Todos los estados','All statuses'),''));
  [...new Set(data.incidents.map(r=>r[field]))].sort().forEach(v=>select.add(new Option(field==='status'?status(v):v,v)));
  if([...select.options].some(o=>o.value===value))select.value=value;
 }initialized=true;
}
function render(reset=false){
 if(!data)return;if(reset)page=1;
 filtered=selectIncidents(data.incidents,{query:$('ddos-query').value,entity:$('ddos-entity').value,status:$('ddos-status').value,sort:$('ddos-sort').value});
 const pages=Math.max(1,Math.ceil(filtered.length/size));page=Math.min(page,pages);$('ddos-body').replaceChildren();
 for(const r of filtered.slice((page-1)*size,page*size)){
  const row=node('tr'),entity=node('td'),button=node('button',r.entity,'cve-link entity-name');button.type='button';button.addEventListener('click',()=>open(r));entity.append(button,node('small',tr('Referencia: ','Reference: ')+r.referenceDomain,'domain-reference'));
  const action=node('td'),detail=node('button','↗','detail-button');detail.type='button';detail.setAttribute('aria-label',tr('Ver aviso de ','View report for ')+r.entity);detail.addEventListener('click',()=>open(r));action.append(detail);
  const cells=[entity,node('td',r.components.join(' · ')||tr('Alcance en el aviso original','See scope in original notice')),node('td',date(r.startedAt),'date-cell'),node('td',status(r.status)),node('td',tr('Reportado por proveedor','Provider report'),'claim-label'),action];
  const labels=[tr('Entidad','Entity'),tr('Servicio','Service'),tr('Inicio de incidencia','Incident start'),tr('Estado de la incidencia','Incident status'),tr('Evidencia','Evidence'),tr('Ficha','Record')];cells.forEach((td,i)=>{td.dataset.label=labels[i];row.append(td);});$('ddos-body').append(row);
 }
 $('ddos-total').textContent=data.incidents.length;$('ddos-entities').textContent=new Set(data.incidents.map(r=>r.entity)).size;$('ddos-source-count').textContent=data.sources.length;
 $('ddos-latest').textContent=data.incidents.length?data.incidents.map(r=>r.reportedAt).sort().at(-1).slice(0,10):'—';
 $('ddos-count').textContent=filtered.length+' '+tr('avisos en la copia','notices in snapshot');$('ddos-empty').hidden=!!filtered.length;$('ddos-export').disabled=!filtered.length;
 $('ddos-page').textContent=page+' / '+pages;$('ddos-prev').disabled=page===1;$('ddos-next').disabled=page===pages;
 const stale=data.sources.some(s=>s.state!=='ok'||!s.fetchedAt||Date.now()-Date.parse(s.fetchedAt)>48*3600000);$('ddos-status-box').classList.toggle('warning',stale||failed);
 $('ddos-feed-status').textContent=(failed?tr('No se pudo recargar. ','Reload failed. '):'')+tr('Fuentes actualizadas: ','Sources refreshed: ')+data.sources.filter(s=>s.state==='ok').length+'/'+data.sources.length+' · '+tr('Copia preparada: ','Snapshot prepared: ')+date(data.builtAt)+(stale?tr(' · Hay fuentes pendientes o antiguas.',' · Some sources are unavailable or stale.'):'');
 $('ddos-sources').replaceChildren(...data.sources.map(s=>{const p=node('p'),a=node('a',s.entity+' ↗');a.href=s.url;a.target='_blank';a.rel='noopener';p.append(a,node('span',' · '+(s.fetchedAt?date(s.fetchedAt):tr('Sin copia disponible','No snapshot available'))+' · '+s.matches+' '+tr('avisos','notices')+(s.state!=='ok'?tr(' · No se pudo actualizar',' · Update failed'):'')));return p;}));
 const u=new URL(location.href);u.search='';for(const [k,v]of [['q',$('ddos-query').value.trim()],['entity',$('ddos-entity').value],['status',$('ddos-status').value]])if(v)u.searchParams.set(k,v);history.replaceState(null,'',u);
 if(selected)fill(selected);
}
function fill(r){
 $('ddos-title').textContent=r.entity;$('ddos-reference').textContent=tr('Dominio de referencia de la entidad: ','Entity reference domain: ')+r.referenceDomain;
 $('ddos-detail').textContent=[tr('Servicios indicados: ','Listed services: ')+(r.components.join(' · ')||tr('Consulta el aviso original.','See original notice.')),tr('Inicio de la incidencia: ','Incident start: ')+date(r.startedAt),tr('Primera actualización que menciona DDoS: ','First update mentioning DDoS: ')+date(r.reportedAt),tr('Última actualización: ','Last update: ')+date(r.updatedAt),tr('Estado comunicado: ','Reported status: ')+status(r.status),tr('Copia obtenida: ','Snapshot retrieved: ')+date(r.fetchedAt)].join('\n\n');$('ddos-source-link').href=r.sourceUrl;
}
function open(r){selected=r;fill(r);$('ddos-dialog').showModal();}
$('ddos-close').addEventListener('click',()=>$('ddos-dialog').close());
$('ddos-dialog').addEventListener('click',e=>{if(e.target===$('ddos-dialog')){const r=$('ddos-dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('ddos-dialog').close();}});
$('ddos-query').addEventListener('input',()=>render(true));for(const id of ['entity','status','sort'])$('ddos-'+id).addEventListener('change',()=>render(true));$('ddos-filters').addEventListener('submit',e=>e.preventDefault());
$('ddos-clear').addEventListener('click',()=>{for(const id of ['query','entity','status'])$('ddos-'+id).value='';$('ddos-sort').value='new';render(true);});
$('ddos-prev').addEventListener('click',()=>{page--;render();});$('ddos-next').addEventListener('click',()=>{page++;render();});
$('ddos-export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([incidentsCSV(filtered)],{type:'text/csv;charset=utf-8'})),a=node('a');a.href=url;a.download='ddos-provider-reports.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});
async function load(){
 $('ddos-reload').disabled=true;
 try{const response=await fetch('./data/ddos-incidents.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error();data=normalizeIncidents(await response.json());failed=false;options();render();}
 catch{failed=true;if(data)render();else{$('ddos-status-box').classList.add('warning');$('ddos-feed-status').textContent=tr('No se pudieron cargar los avisos.','Could not load incident notices.');$('ddos-export').disabled=true;}}
 finally{$('ddos-reload').disabled=false;}
}
$('ddos-reload').addEventListener('click',load);window.addEventListener('languagechange',()=>{if(data){options();render();}});load();
