"""Collect factual metadata from selected providers' public status APIs."""
import json
import os
import re
import ssl
import sys
import tempfile
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
# Reference domains identify the provider, not a list of attacked hosts.
SOURCES=[
    ('jottacloud','Jottacloud','status.jottacloud.com','jottacloud.com'),
    ('teamsupport','TeamSupport','status.teamsupport.com','teamsupport.com'),
    ('17hats','17hats','17hats.statuspage.io','17hats.com'),
    ('cloudflare','Cloudflare','www.cloudflarestatus.com','cloudflare.com'),
    ('proton','Proton','status.proton.me','proton.me'),
    ('render','Render','status.render.com','render.com'),
    ('discord','Discord','status.discord.com','discord.com'),
]
DDOS=re.compile(r'\bddos\b|distributed\s+denial[\s-]+of[\s-]+service',re.I)
NEGATED=re.compile(r'(?:\bnot\b|\bno\b|\bwithout\b)[^.!?\n]{0,35}(?:\bddos\b|distributed\s+denial)',re.I)
MAX_BYTES=6*1024*1024

class NoRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):raise ValueError('Redirect refused')

def stamp(value):
    if not isinstance(value,str) or len(value)>50:raise ValueError('Missing timestamp')
    parsed=datetime.fromisoformat(value.replace('Z','+00:00'))
    if parsed.tzinfo is None:raise ValueError('Missing timezone')
    return parsed.astimezone(timezone.utc).isoformat()

def clean(value,limit=150):
    return ''.join(c for c in str(value or '') if c.isprintable()).strip()[:limit]

def mentions_ddos(value):
    # Remove negative clauses before matching. Do not label every outage a DDoS.
    return bool(DDOS.search(NEGATED.sub('',str(value or ''))))

def normalize(raw,source,now=None):
    if not isinstance(raw,dict) or not isinstance(raw.get('incidents'),list):raise ValueError('Invalid status response')
    source_id,entity,host,reference=source;now=now or datetime.now(timezone.utc);cutoff=now-timedelta(days=90)
    rows=[];seen=set();retrieved=now.isoformat()
    for item in raw['incidents']:
        if not isinstance(item,dict):raise ValueError('Invalid incident')
        incident_id=str(item.get('id',''))
        if not re.fullmatch(r'[a-z0-9]{6,40}',incident_id):continue
        started=stamp(item.get('started_at') or item.get('created_at'))
        if datetime.fromisoformat(started)<cutoff or datetime.fromisoformat(started)>now+timedelta(days=1):continue
        updates=item.get('incident_updates') or []
        matched=[u for u in updates if isinstance(u,dict) and mentions_ddos(u.get('body'))]
        if not matched and not mentions_ddos(item.get('name')):continue
        key=source_id+':'+incident_id
        if key in seen:continue
        seen.add(key)
        components=[]
        for component in item.get('components') or []:
            if isinstance(component,dict) and clean(component.get('name')):components.append(clean(component['name']))
        for update in updates:
            for component in (update.get('affected_components') or []) if isinstance(update,dict) else []:
                if isinstance(component,dict) and component.get('code') and clean(component.get('name')):components.append(clean(component['name']))
        reported=min([stamp(u.get('created_at') or u.get('updated_at')) for u in matched] or [started])
        status=item.get('status') if item.get('status') in ['investigating','identified','monitoring','resolved','postmortem'] else 'unknown'
        rows.append({'id':key,'entity':entity,'referenceDomain':reference,'sourceId':source_id,
            'sourceUrl':'https://'+host+'/incidents/'+incident_id,'evidence':'provider_mentions_ddos',
            'startedAt':started,'reportedAt':reported,'updatedAt':stamp(item.get('updated_at') or item.get('created_at')),
            'resolvedAt':stamp(item['resolved_at']) if item.get('resolved_at') else None,'status':status,
            'components':sorted(set(components))[:20],'fetchedAt':retrieved})
    return rows

def fetch(source):
    request=urllib.request.Request('https://'+source[2]+'/api/v2/incidents.json',headers={'Accept':'application/json','User-Agent':'AlbertPalazon-PublicIntelMonitor/1.0'})
    opener=urllib.request.build_opener(NoRedirects(),urllib.request.HTTPSHandler(context=ssl.create_default_context()))
    with opener.open(request,timeout=25) as response:body=response.read(MAX_BYTES+1)
    if len(body)>MAX_BYTES:raise ValueError('Response too large')
    return normalize(json.loads(body),source)

def main():
    target=ROOT/'dist/data/ddos-incidents.json'
    try:old=json.loads(target.read_text())
    except Exception:old={'incidents':[],'sources':[]}
    rows=[];sources=[];success=0;attempt=datetime.now(timezone.utc).isoformat();cutoff=datetime.now(timezone.utc)-timedelta(days=90)
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures={pool.submit(fetch,source):source for source in SOURCES}
        for future in as_completed(futures):
            source=futures[future];source_id,entity,host,_=source
            try:records=future.result();success+=1;fetched=attempt;state='ok'
            except Exception:
                records=[r for r in old.get('incidents',[]) if r.get('sourceId')==source_id and datetime.fromisoformat(r['startedAt'])>=cutoff]
                previous=next((s for s in old.get('sources',[]) if s.get('id')==source_id),{})
                fetched=previous.get('fetchedAt');state='unavailable'
            rows.extend(records);sources.append({'id':source_id,'entity':entity,'url':'https://'+host,'fetchedAt':fetched,'state':state,'matches':len(records)})
    if not success:print('DDoS status sources unavailable. Existing snapshot preserved.');return 1
    rows.sort(key=lambda r:r['startedAt'],reverse=True);sources.sort(key=lambda s:s['entity'])
    data={'source':'Selected providers’ public status pages','windowDays':90,'builtAt':attempt,'sources':sources,'incidents':rows}
    with tempfile.NamedTemporaryFile(mode='w',dir=target.parent,delete=False) as output:json.dump(data,output,ensure_ascii=False,separators=(',',':'));temporary=output.name
    os.replace(temporary,target)
    print(f'DDoS: {len(rows)} provider-reported incident records; {success}/{len(SOURCES)} status sources refreshed.');return 0

if __name__=='__main__':sys.exit(main())
