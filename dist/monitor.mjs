import {FEED,normalize,selectRows,csv,prettyDate} from './core.mjs';
const $=id=>document.getElementById(id);
let vendorInitialized=false;
let data=null,filtered=[],page=1,lang=document.documentElement.lang,mode='loading',checkedAt='',selected=null,busy=false;
const pageSize=20;
const initial=new URLSearchParams(location.search);
$('query').value=(initial.get('cve')||initial.get('q')||'').slice(0,200);
$('ransomware').checked=initial.get('ransom')==='1';
if(['new','old','vendor'].includes(initial.get('sort'))) $('sort').value=initial.get('sort');
const tr=(es,en)=>lang==='en'?en:es;
const fmt=v=>prettyDate(v,lang);
function create(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
function vendorOptions(){
  const old=vendorInitialized ? $('vendor').value : (initial.get('vendor') || '');
  vendorInitialized=true;
  $('vendor').replaceChildren(new Option(tr('Todos los fabricantes','All vendors'),''));
  [...new Set(data.vulnerabilities.map(r=>r.vendorProject))].sort((a,b)=>a.localeCompare(b)).forEach(v=>$('vendor').add(new Option(v,v)));
  if([...$('vendor').options].some(o=>o.value===old)) $('vendor').value=old;
}
function status(){
  const snapshot=mode==='snapshot';
  $('status-box').classList.toggle('warning',snapshot||mode==='error');
  if(mode==='live') $('feed-status').textContent=tr('Fuente oficial consultada','Official source checked')+' · '+fmt(checkedAt)+' · '+tr('versión','version')+' '+data.catalogVersion;
  else if(snapshot) $('feed-status').textContent=tr('Fuente remota no disponible. Mostrando copia consultada el ','Remote source unavailable. Showing snapshot retrieved on ')+fmt(data.fetchedAt)+'.';
  else if(mode==='error') $('feed-status').textContent=tr('No se ha podido cargar el catálogo. Puedes consultar la fuente oficial al final de la página.','The catalog could not be loaded. You can consult the official source at the bottom of the page.');
  else $('feed-status').textContent=tr('Consultando la fuente oficial…','Checking the official source…');
}
function stats(){
  if(!data)return;
  $('stat-total').textContent=new Intl.NumberFormat(lang).format(data.count);
  $('stat-vendors').textContent=new Set(data.vulnerabilities.map(r=>r.vendorProject)).size;
  $('stat-ransom').textContent=data.vulnerabilities.filter(r=>r.knownRansomwareCampaignUse==='Known').length;
  $('stat-latest').textContent=fmt(data.vulnerabilities[0].dateAdded);
  $('source-version').textContent=tr('Versión del catálogo: ','Catalog version: ')+(data.catalogVersion||'—')+' · '+tr('publicada: ','released: ')+fmt(data.dateReleased);
  $('snapshot-time').textContent=tr('Consulta de datos: ','Data retrieved: ')+fmt(checkedAt||data.fetchedAt);
}
function urlState(){
  const u=new URL(location.href);u.search='';
  if($('query').value.trim())u.searchParams.set('q',$('query').value.trim());
  if($('vendor').value)u.searchParams.set('vendor',$('vendor').value);
  if($('ransomware').checked)u.searchParams.set('ransom','1');
  if($('sort').value!=='new')u.searchParams.set('sort',$('sort').value);
  history.replaceState(null,'',u);
}
function render(reset=false){
  if(!data)return;
  if(reset)page=1;
  filtered=selectRows(data.vulnerabilities,{query:$('query').value,vendor:$('vendor').value,ransomware:$('ransomware').checked,sort:$('sort').value});
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize));page=Math.min(page,pages);
  $('feed-body').replaceChildren();
  filtered.slice((page-1)*pageSize,page*pageSize).forEach(r=>{
    const row=create('tr');
    const id=create('td'),b=create('button',r.cveID,'cve-link');b.type='button';b.addEventListener('click',()=>openDetail(r));id.append(b);
    const name=create('td');name.append(create('strong',r.vendorProject+' / '+r.product,'vendor-name'),create('span',r.vulnerabilityName,'vuln-name'));
    const date=create('td',fmt(r.dateAdded),'date-cell');
    const ransom=create('td');ransom.append(create('span',r.knownRansomwareCampaignUse==='Known'?tr('Conocido','Known'):tr('Desconocido','Unknown'),r.knownRansomwareCampaignUse==='Known'?'ransom-badge':'ransom-unknown'));
    const action=create('td'),detail=create('button','↗','detail-button');detail.type='button';detail.setAttribute('aria-label',tr('Ver ficha de ','View record for ')+r.cveID);detail.addEventListener('click',()=>openDetail(r));action.append(detail);row.append(id,name,date,ransom,action);$('feed-body').append(row);
  });
  $('empty').hidden=filtered.length!==0;
  $('empty').textContent=tr('No hay registros que coincidan con estos filtros.','No records match these filters.');
  $('result-count').textContent=new Intl.NumberFormat(lang).format(filtered.length)+' '+tr('resultados','results');
  $('page-count').textContent=tr('Página ','Page ')+page+' / '+pages;
  $('prev').disabled=page<=1;$('next').disabled=page>=pages;
  $('export').disabled=!filtered.length;
  urlState();
}
function fillDetail(r){
  $('detail-cve').textContent=r.cveID;
  $('detail-title').textContent=r.vulnerabilityName;
  $('detail-tags').replaceChildren();
  [r.vendorProject,r.product,...(Array.isArray(r.cwes)?r.cwes:[])].filter(Boolean).forEach(t=>$('detail-tags').append(create('span',t)));
  $('detail-meta').textContent=tr('Alta en KEV: ','Added to KEV: ')+fmt(r.dateAdded)+' · '+tr('Uso en ransomware: ','Ransomware use: ')+(r.knownRansomwareCampaignUse==='Known'?tr('conocido','known'):tr('desconocido','unknown'));
  $('detail-description').textContent=r.shortDescription;
  $('detail-action').textContent=r.requiredAction;
  $('detail-due').textContent=tr('Plazo BOD para agencias federales de EE. UU.: ','BOD deadline for US federal agencies: ')+fmt(r.dueDate);
  $('detail-nvd').href='https://nvd.nist.gov/vuln/detail/'+encodeURIComponent(r.cveID);
  $('close-dialog').setAttribute('aria-label',tr('Cerrar ficha','Close record'));
}
function openDetail(r){selected=r;fillDetail(r);$('detail-dialog').showModal();}
$('close-dialog').addEventListener('click',()=>$('detail-dialog').close());
$('detail-dialog').addEventListener('click',e=>{if(e.target===$('detail-dialog')){const rect=$('detail-dialog').getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)$('detail-dialog').close();}});
$('filters').addEventListener('submit',e=>{e.preventDefault();render(true);});
$('query').addEventListener('input',()=>render(true));
for(const name of ['vendor','ransomware','sort'])$(name).addEventListener('change',()=>render(true));
$('clear').addEventListener('click',()=>{$('query').value='';$('vendor').value='';$('ransomware').checked=false;$('sort').value='new';render(true);$('query').focus();});
$('prev').addEventListener('click',()=>{page--;render();});$('next').addEventListener('click',()=>{page++;render();});
$('export').addEventListener('click',()=>{
  const blob=new Blob([csv(filtered)],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=create('a');a.href=url;a.download='cisa-kev-'+new Date().toISOString().slice(0,10)+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
async function loadJSON(url){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);return normalize(await r.json());}
async function refresh(){
  if(busy)return;busy=true;$('refresh').disabled=true;mode='loading';status();
  try {const next=await loadJSON(FEED);data=next;checkedAt=new Date().toISOString();data.fetchedAt=checkedAt;mode='live';vendorOptions();stats();render();}
  catch {mode=data?'snapshot':'error';if(!data){$('result-count').textContent=tr('Catálogo no disponible','Catalog unavailable');$('empty').hidden=false;$('empty').textContent=tr('No se ha podido cargar el catálogo. Inténtalo de nuevo.','The catalog could not be loaded. Please try again.');$('export').disabled=true;$('prev').disabled=true;$('next').disabled=true;}}
  finally {status();busy=false;$('refresh').disabled=false;}
}
$('refresh').addEventListener('click',refresh);
window.addEventListener('languagechange',e=>{lang=e.detail;if(data){vendorOptions();stats();render();if(selected)fillDetail(selected);}status();});
async function init(){
  try{data=await loadJSON('./data/kev.json');mode='snapshot';vendorOptions();stats();render();}
  catch{}
  await refresh();
  const id=initial.get('cve');if(id&&data){const r=data.vulnerabilities.find(r=>r.cveID===id);if(r)openDetail(r);}
}
init();
setInterval(()=>{if(document.visibilityState==='visible')refresh();},30*60*1000);
