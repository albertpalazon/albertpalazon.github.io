import unittest
from datetime import datetime,timezone
from update_ddos_incidents import normalize,mentions_ddos,NoRedirects,SOURCES

NOW=datetime(2026,10,20,tzinfo=timezone.utc)
SOURCE=SOURCES[0]
def incident(body,identifier='abc123def456',start='2026-10-10T10:00:00+02:00'):
    return {'id':identifier,'name':'Availability incident','status':'resolved','started_at':start,'created_at':start,'updated_at':'2026-10-11T12:00:00Z','resolved_at':'2026-10-11T12:00:00Z','components':[{'name':'API'}], 'incident_updates':[{'body':body,'created_at':start}], 'shortlink':'https://untrusted.example/', 'private':'omit'}

class IncidentTests(unittest.TestCase):
    def test_only_explicit_ddos_mentions(self):
        self.assertFalse(mentions_ddos('Database maintenance caused an outage.'))
        self.assertFalse(mentions_ddos('This was not a DDoS attack.'))
        self.assertTrue(mentions_ddos('Disruption caused by a distributed denial-of-service attack.'))
        rows=normalize({'incidents':[incident('This disruption was caused by DDoS.')]},SOURCE,NOW)
        self.assertEqual(len(rows),1);self.assertEqual(rows[0]['entity'],'Jottacloud')
        self.assertEqual(rows[0]['components'],['API']);self.assertEqual(rows[0]['startedAt'],'2026-10-10T08:00:00+00:00')

    def test_old_incidents_and_duplicates_excluded(self):
        raw={'incidents':[incident('DDoS'),incident('DDoS'),incident('DDoS','old123abc456','2017-10-10T10:00:00Z')]}
        self.assertEqual(len(normalize(raw,SOURCE,NOW)),1)

    def test_reference_domain_is_not_attacked_host_attribution(self):
        row=normalize({'incidents':[incident('DDoS targeted our services.')]},SOURCE,NOW)[0]
        self.assertEqual(row['referenceDomain'],'jottacloud.com')
        self.assertNotIn('attackedDomains',row);self.assertNotIn('country',row);self.assertNotIn('actor',row)
        self.assertNotIn('private',row);self.assertNotIn('body',row)
        self.assertEqual(row['sourceUrl'],'https://status.jottacloud.com/incidents/abc123def456')

    def test_redirect_refused(self):
        with self.assertRaises(ValueError):NoRedirects().redirect_request(None,None,None,None,None,'https://untrusted.example')

if __name__=='__main__':unittest.main()
