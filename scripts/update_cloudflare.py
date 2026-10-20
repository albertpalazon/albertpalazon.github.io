"""Collect public Cloudflare outages and BGP events with one CI secret."""
import argparse
import base64
import getpass
import ipaddress
import json
import os
import re
import ssl
import sys
import tempfile
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from context_fields import COUNTRIES
MAX_BYTES=4*1024*1024
class FeedError(Exception):pass
class NoRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):raise FeedError('Redirect refused')

ROOT=Path(__file__).resolve().parents[1]
PATHS={'outages':'annotations/outages','hijacks':'bgp/hijacks/events','leaks':'bgp/leaks/events'}

def now():return datetime.now(timezone.utc).isoformat()
def text(value,limit=1000):return ''.join(c for c in str(value or '') if c.isprintable() or c=='\n')[:limit]
def number(value):
    if isinstance(value,bool):raise FeedError('Invalid ASN')
    n=int(value)
    if not 0<n<=4294967295:raise FeedError('Invalid ASN')
    return n
def date(value,nullable=False,bgp=False):
    if value is None and nullable:return None
    if not isinstance(value,str):raise FeedError('Invalid date')
    parsed=datetime.fromisoformat(value.replace('Z','+00:00'))
    # Radar's BGP timestamps are documented as UTC but may omit a suffix.
    if parsed.tzinfo is None:
        if not bgp:raise FeedError('Timezone missing')
        return parsed.replace(tzinfo=timezone.utc).isoformat()
    return parsed.isoformat()
def countries(values):return sorted({v for v in values if isinstance(v,str) and v in COUNTRIES})
def fetch(token,kind,scope='GLOBAL',window='7d'):
    if kind not in PATHS or scope!='GLOBAL' or window!='7d':raise FeedError('Unsupported query')
    params={'dateRange':window,'format':'json'}
    if kind=='outages':params['limit']='100'
    else:params.update(per_page='100',sortBy='ID',sortOrder='DESC')
    request=urllib.request.Request('https://api.cloudflare.com/client/v4/radar/'+PATHS[kind]+'?'+urllib.parse.urlencode(params),headers={'Authorization':'Bearer '+token,'Accept':'application/json','User-Agent':'AlbertPalazon-PublicIntelMonitor/1.0'})
    opener=urllib.request.build_opener(NoRedirects(),urllib.request.HTTPSHandler(context=ssl.create_default_context()))
    with opener.open(request,timeout=30) as response:body=response.read(MAX_BYTES+1)
    if len(body)>MAX_BYTES or token.encode() in body:raise FeedError('Invalid response')
    return normalize(json.loads(body),kind,scope,window)

def normalize(raw,kind,scope='GLOBAL',window='7d'):
    if not isinstance(raw,dict) or raw.get('success') is not True:raise FeedError('API unsuccessful')
    result=raw['result']
    rows=[];asn_info={number(a['asn']):a for a in result.get('asn_info',[]) if isinstance(a,dict) and a.get('asn')}
    if kind=='outages':
        entries=result['annotations']
        if not isinstance(entries,list):raise FeedError('Missing events')
        for item in entries:
            if item.get('eventType')!='OUTAGE':continue
            identifier=text(item.get('id'),100)
            start=date(item['startDate']);end=date(item.get('endDate'),nullable=True)
            location=countries(item.get('locations') or [])
            related=countries((a.get('location') or {}).get('code') for a in item.get('asnsDetails',[]) if isinstance(a,dict))
            if not identifier:identifier=start+'|'+','.join(location)
            rows.append({'id':identifier,'start':start,'end':end,'countries':location,'asnCountries':related,'asns':[number(a) for a in item.get('asns',[])][:100],
                'cause':text((item.get('outage') or {}).get('outageCause'),100) or 'UNKNOWN','type':text((item.get('outage') or {}).get('outageType'),100) or 'UNKNOWN',
                'scope':text(item.get('scope'),300),'description':text(item.get('description'),3000)})
    else:
        entries=result['events']
        if not isinstance(entries,list):raise FeedError('Missing BGP events')
        for item in entries:
            hijack=kind=='hijacks';actor=number(item['hijacker_asn' if hijack else 'leak_asn'])
            other=[number(a) for a in item.get('victim_asns' if hijack else 'leak_seg',[])][:100]
            involved=sorted(set([actor,*other]))
            geo=countries([asn_info[a].get('country_code') for a in involved if a in asn_info])
            geo=countries([*geo,*(item.get('victim_countries') or []),item.get('hijacker_country')]) if hijack else countries([*geo,*(item.get('countries') or [])])
            prefixes=[]
            for prefix in (item.get('prefixes') or [])[:100]:
                try:prefixes.append(str(ipaddress.ip_network(prefix,strict=False)))
                except ValueError:continue
            score=item.get('confidence_score') if hijack else None
            if score is not None and (isinstance(score,bool) or not isinstance(score,(int,float)) or not -100<=score<=100):raise FeedError('Invalid score')
            rows.append({'id':str(number(item['id'])),'kind':kind,'start':date(item['min_hijack_ts' if hijack else 'min_ts'],bgp=True),
                'lastSeen':date(item['max_msg_ts' if hijack else 'max_ts'],bgp=True),'countries':geo,'actorAsn':actor,'otherAsns':other,
                'organizations':[{'asn':a,'name':text(asn_info.get(a,{}).get('org_name'),200)} for a in involved],
                'confidence':score,'prefixes':prefixes,'finished':None if hijack else item.get('finished') if isinstance(item.get('finished'),bool) else None,
                'tags':[text(t.get('name'),100) for t in (item.get('tags') or [])[:30] if isinstance(t,dict)]})
    rows.sort(key=lambda r:r['start'],reverse=True)
    return {'kind':kind,'window':window,'fetchedAt':now(),'limit':100,'rows':rows}

def write(path,data,token):
    payload=json.dumps(data,ensure_ascii=False,separators=(',',':'))
    if token and any(t in payload for t in [token,base64.b64encode(token.encode()).decode()]):raise FeedError('Credential echo')
    with tempfile.NamedTemporaryFile(mode='w',dir=path.parent,delete=False) as output:output.write(payload);temporary=output.name
    os.replace(temporary,path)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--stdin-token',action='store_true');args=parser.parse_args()
    token=getpass.getpass('Radar token (hidden): ') if args.stdin_token else os.environ.get('CLOUDFLARE_RADAR_TOKEN','')
    if not token:
        print('Cloudflare not updated: secret is not configured. Existing snapshots preserved.');return 2
    if not re.fullmatch(r'[A-Za-z0-9_.-]{16,512}',token):print('Invalid token format. Existing snapshots preserved.');return 1
    signals_path=ROOT/'dist/data/radar-signals.json'
    try:old=json.loads(signals_path.read_text())['datasets']
    except Exception:old=[]
    signals={d['kind']:d for d in old if d.get('kind') in PATHS}
    jobs=list(PATHS)
    success=failed=0
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures={pool.submit(fetch,token,kind):kind for kind in jobs}
        for future in as_completed(futures):
            kind=futures[future]
            try:result=future.result()
            except Exception:failed+=1;continue
            signals[kind]=result;success+=1
    try:
        write(signals_path,{'source':'Cloudflare Radar','datasets':list(signals.values())},token)
    except Exception:print('Cloudflare export failed. No credential or response body is logged.');return 1
    print(f'Cloudflare: {success} queries updated; {failed} unavailable. Existing per-dataset timestamps preserved.');return 0 if success else 1

if __name__=='__main__':sys.exit(main())
