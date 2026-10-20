"""Download and validate the official CISA KEV catalog. Standard library only."""
import json
import os
import sys
import tempfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
    'https://raw.githubusercontent.com/cisagov/kev-data/main/known_exploited_vulnerabilities.json',
]
def normalize(catalog, source):
    rows = catalog.get('vulnerabilities')
    if not isinstance(rows, list) or not rows:
        raise ValueError('Empty or invalid KEV catalog')
    seen, result = set(), []
    import re
    for row in rows:
        cve = row.get('cveID', '')
        if not re.fullmatch(r'CVE-\d{4}-\d{4,}', cve) or cve in seen:
            raise ValueError('Invalid or duplicate CVE')
        seen.add(cve)
        datetime.strptime(row['dateAdded'], '%Y-%m-%d')
        result.append({key: row.get(key, '') for key in (
            'cveID', 'vendorProject', 'product', 'vulnerabilityName', 'dateAdded',
            'shortDescription', 'requiredAction', 'dueDate', 'knownRansomwareCampaignUse', 'cwes')})
    result.sort(key=lambda r: (r['dateAdded'], r['cveID']), reverse=True)
    return {'source': 'CISA KEV', 'sourceUrl': source, 'catalogVersion': catalog.get('catalogVersion'),
            'dateReleased': catalog.get('dateReleased'), 'fetchedAt': datetime.now(timezone.utc).isoformat(),
            'count': len(result), 'vulnerabilities': result}

def main():
    if len(sys.argv) > 1:
        catalog = json.loads(Path(sys.argv[1]).read_text())
        result = normalize(catalog, SOURCES[1])
    else:
        errors = []
        for url in SOURCES:
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'AlbertPalazon-IntelMonitor/1.0', 'Accept': 'application/json'})
                with urllib.request.urlopen(req, timeout=30) as response:
                    result = normalize(json.load(response), url)
                break
            except Exception as error:
                errors.append(f'{url}: {error}')
        else:
            raise RuntimeError('All KEV sources failed; previous snapshot preserved. ' + '; '.join(errors))
    target = ROOT / 'dist' / 'data' / 'kev.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', dir=target.parent, delete=False) as out:
        json.dump(result, out, ensure_ascii=False, separators=(',', ':'))
        temporary = out.name
    os.replace(temporary, target)
    print(f"KEV: {result['count']} records; source version {result['catalogVersion']}")

if __name__ == '__main__':
    main()
