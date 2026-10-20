import {matchesContext} from './context.mjs';
export function normalizePosts(data){
  if(!data||!Array.isArray(data.posts)||!data.fetchedAt)throw Error('Invalid feed');
  const seen=new Set();
  const posts=data.posts.map(r=>{
    if(!r||typeof r.id!=='string'||seen.has(r.id)||typeof r.entity!=='string'||!r.entity||typeof r.group!=='string'||typeof r.discovered!=='string'||!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(r.discovered)||r.classification!=='unverified_claim')throw Error('Invalid post');
    seen.add(r.id);return r;
  }).sort((a,b)=>b.discovered.localeCompare(a.discovered));
  return {...data,count:posts.length,posts};
}
export function filterPosts(posts,{query='',group='',country='',sector='',sort='new'}={}){
  const q=query.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  return posts.filter(r=>(!group||r.group===group)&&matchesContext(r.country,country)&&matchesContext(r.sector,sector)&&(!q||[r.entity,r.group,r.description].join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(q))).sort((a,b)=>sort==='old'?a.discovered.localeCompare(b.discovered):sort==='group'?a.group.localeCompare(b.group):b.discovered.localeCompare(a.discovered));
}
export function sourceDate(s){return typeof s==='string'?s.slice(0,16).replace('T',' '):'—';}
export function postsCSV(posts){
  const fields=['entity','group','country','sector','countryRaw','sectorRaw','contextSource','discovered','classification','description'];
  const quote=v=>'"'+String(v??'').replace(/^(\s*[=+\-@]|[\t\r])/,"'$&").replaceAll('"','""')+'"';
  return '\uFEFF'+[fields,...posts.map(p=>fields.map(f=>p[f]))].map(r=>r.map(quote).join(',')).join('\r\n');
}
