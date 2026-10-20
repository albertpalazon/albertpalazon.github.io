"""Fetch recent RansomLook posts. Only public metadata, never leak content."""
import json
import os
import sys
import tempfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from context_fields import post_context

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://www.ransomlook.io/api/recent'

def normalize(raw):
    if not isinstance(raw, list) or not raw:
        raise ValueError('Missing or empty post list')
    records, seen = [], set()
    for r in raw:
        if not isinstance(r, dict) or r.get('private') is True:
            continue
        title, group, date = r.get('post_title'), r.get('group_name'), r.get('discovered')
        if not all(isinstance(v, str) and v.strip() for v in [title, group, date]):
            raise ValueError('Missing title, group or discovery date')
        # Source timestamps do not contain an explicit timezone. Preserve them verbatim.
        datetime.fromisoformat(date)
        key = str(r.get('misp_uuid') or f'{group}|{title}|{date}')
        if key in seen:
            continue
        seen.add(key)
        records.append({'id':key,'entity':title[:500],'group':group[:160],
                        'discovered':date,'description':str(r.get('description') or '')[:6000],
                        'classification':'unverified_claim', **post_context(r)})
    if not records:
        raise ValueError('No public records')
    records.sort(key=lambda r:r['discovered'], reverse=True)
    return {'source':'RansomLook','sourceUrl':SOURCE,'attribution':'RansomLook — https://www.ransomlook.io/',
            'license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/',
            'fetchedAt':datetime.now(timezone.utc).isoformat(),'latestDiscovered':records[0]['discovered'],
            'count':len(records),'posts':records}

def main():
    if len(sys.argv)>1:
        raw=json.loads(Path(sys.argv[1]).read_text())
    else:
        req=urllib.request.Request(SOURCE,headers={'User-Agent':'AlbertPalazon-PublicIntelMonitor/1.0','Accept':'application/json'})
        with urllib.request.urlopen(req,timeout=30)as response:
            raw=json.load(response)
    data=normalize(raw)
    target=ROOT/'dist/data/ransomware.json';target.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w',dir=target.parent,delete=False)as f:
        json.dump(data,f,ensure_ascii=False,separators=(',',':'));temporary=f.name
    os.replace(temporary,target)
    print(f"RansomLook: {data['count']} public posts, latest source date {data['latestDiscovered']}")

if __name__=='__main__':main()
