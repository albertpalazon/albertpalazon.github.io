import {normalizePosts,filterPosts,sourceDate,postsCSV} from './ransom-core.mjs';
import {countryName,sectorName,contextOptions} from './context.mjs';
const $=id=>document.getElementById(id), tr=(es,en)=>document.documentElement.lang==='en'?en:es;
let groupsInitialized=false;
let data=null,filtered=[],page=1,selected=null,failed=false;
const size=20,params=new URLSearchParams(location.search);
$('post-query').value=(params.get('q')||'').slice(0,200);
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
function groups(){
  const value=groupsInitialized ? $('post-group').value : (params.get('group')||'');
  groupsInitialized=true;
  $('post-group').replaceChildren(new Option(tr('Todos los grupos','All groups'),''));
  [...new Set(data.posts.map(r=>r.group))].sort((a,b)=>a.localeCompare(b)).forEach(g=>$('post-group').add(new Option(g,g)));
  if([...$('post-group').options].some(o=>o.value===value))$('post-group').value=value;
  for(const [field,label]of [['country',countryName],['sector',sectorName]]){const select=$('post-'+field),current=select.dataset.ready?select.value:(params.get(field)||'');contextOptions(select,data.posts.map(r=>r[field]),label,tr(field==='country'?'Todos los países':'Todos los sectores',field==='country'?'All countries':'All sectors'),current);select.dataset.ready='true';select.closest('.field').hidden=!data.posts.some(r=>r[field]);}
}
function render(reset=false){
  if(!data)return;if(reset)page=1;
  const lang=document.documentElement.lang,fmt=new Intl.NumberFormat(lang);
  filtered=filterPosts(data.posts,{query:$('post-query').value,group:$('post-group').value,country:$('post-country').value,sector:$('post-sector').value,sort:$('post-sort').value});
  const pages=Math.max(1,Math.ceil(filtered.length/size));page=Math.min(page,pages);
  $('post-body').replaceChildren();
  filtered.slice((page-1)*size,page*size).forEach(r=>{
    const row=node('tr'),entity=node('td'),button=node('button',r.entity,'cve-link entity-name');button.type='button';button.addEventListener('click',()=>open(r));entity.append(button);
    const group=node('td',r.group),date=node('td',sourceDate(r.discovered),'date-cell'),classification=node('td',tr('Reivindicación','Claim'),'claim-label');
    const action=node('td'),detail=node('button','↗','detail-button');detail.setAttribute('aria-label',tr('Ver ficha: ','View record: ')+r.entity);detail.addEventListener('click',()=>open(r));action.append(detail);const country=node('td',countryName(r.country),'context-cell'),sector=node('td',sectorName(r.sector),'context-cell');country.title=r.countryRaw||tr('La fuente no indica país.','The source does not specify a country.');sector.title=r.sectorRaw||tr('La fuente no indica sector.','The source does not specify a sector.');row.append(entity,group,country,sector,date,classification,action);$('post-body').append(row);
  });
  $('post-total').textContent=fmt.format(data.count);$('post-groups').textContent=new Set(data.posts.map(p=>p.group)).size;
  $('post-latest').textContent=data.latestDiscovered?.slice(0,10)||'—';
  $('post-retrieved').textContent=data.fetchedAt.slice(0,10);
  $('post-count').textContent=fmt.format(filtered.length)+' '+tr('resultados','results');
  $('post-empty').hidden=filtered.length!==0;
  $('post-empty').textContent=tr('No hay publicaciones que coincidan.','No matching posts.');
  $('post-page').textContent=tr('Página ','Page ')+page+' / '+pages;
  $('post-prev').disabled=page===1;$('post-next').disabled=page===pages;$('post-export').disabled=!filtered.length;
  const age=Date.now()-new Date(data.fetchedAt).getTime(),stale=age>48*60*60*1000;
  $('post-status-box').classList.toggle('warning',stale||failed);
  $('post-status').textContent=(failed?tr('No se pudo recargar. Mostrando copia disponible. ','Reload failed. Showing the available snapshot. '):stale?tr('La copia tiene más de 48 horas. ','The snapshot is over 48 hours old. '):'')+tr('Copia de RansomLook obtenida: ','RansomLook snapshot retrieved: ')+data.fetchedAt.slice(0,16).replace('T',' ')+' UTC';
  $('post-source-time').textContent=tr('Fuente: ','Source: ')+data.sourceUrl+' · '+data.count+' '+tr('registros','records');
  const u=new URL(location.href);u.search='';if($('post-query').value.trim())u.searchParams.set('q',$('post-query').value.trim());if($('post-group').value)u.searchParams.set('group',$('post-group').value);for(const k of ['country','sector'])if($('post-'+k).value)u.searchParams.set(k,$('post-'+k).value);history.replaceState(null,'',u);
  if(selected)fill(selected);
}
function fill(r){
  $('post-title').textContent=r.entity;$('post-tags').replaceChildren(node('span',r.group),node('span',tr('Reivindicación no verificada','Unverified claim')));
  $('post-meta').textContent=tr('Detección en la fuente: ','Source discovery date: ')+sourceDate(r.discovered)+tr(' · Zona horaria no especificada por la fuente',' · Timezone not specified by source');
  $('post-context').textContent=tr('País: ','Country: ')+countryName(r.country)+tr(' · Sector: ',' · Sector: ')+sectorName(r.sector)+(r.contextSource?tr(' · Extraído de etiquetas de la fuente; sin verificación independiente.',' · Extracted from source labels; not independently verified.'):'');
  $('post-context-raw').textContent=[r.countryRaw,r.sectorRaw].filter(Boolean).join(' · ');
  $('post-description').textContent=r.description||tr('Sin descripción en la fuente.','No source description.');
  $('post-close').setAttribute('aria-label',tr('Cerrar ficha','Close record'));
}
function open(r){selected=r;fill(r);$('post-dialog').showModal();}
$('post-close').addEventListener('click',()=>$('post-dialog').close());
$('post-dialog').addEventListener('click',e=>{if(e.target===$('post-dialog')){const r=$('post-dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('post-dialog').close();}});
$('post-filters').addEventListener('submit',e=>{e.preventDefault();render(true);});
$('post-query').addEventListener('input',()=>render(true));
for(const f of ['post-group','post-country','post-sector','post-sort'])$(f).addEventListener('change',()=>render(true));
$('post-clear').addEventListener('click',()=>{$('post-query').value='';$('post-group').value='';$('post-country').value='';$('post-sector').value='';$('post-sort').value='new';render(true);$('post-query').focus();});
$('post-prev').addEventListener('click',()=>{page--;render();});$('post-next').addEventListener('click',()=>{page++;render();});
$('post-export').addEventListener('click',()=>{const u=URL.createObjectURL(new Blob([postsCSV(filtered)],{type:'text/csv;charset=utf-8;'})),a=node('a');a.href=u;a.download='ransomlook-public-posts-'+new Date().toISOString().slice(0,10)+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);});
async function load(){
  $('reload-posts').disabled=true;
  try{const r=await fetch('./data/ransomware.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Feed unavailable');data=normalizePosts(await r.json());failed=false;groups();render();}
  catch{failed=true;if(data)render();else{$('post-status-box').classList.add('warning');$('post-status').textContent=tr('Datos no disponibles. Consulta la fuente RansomLook.','Data unavailable. Please consult the RansomLook source.');$('post-export').disabled=true;$('post-prev').disabled=true;$('post-next').disabled=true;}}
  finally{$('reload-posts').disabled=false;}
}
$('reload-posts').addEventListener('click',load);
window.addEventListener('languagechange',()=>{if(data){groups();render();}});
load();
