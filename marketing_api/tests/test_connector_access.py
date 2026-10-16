import unittest
from datetime import date
import httpx
from core.sync import latest_monthly_snapshots
from core.config import Settings
from core.connectors import sync_google_ads, sync_search


class AccessTests(unittest.IsolatedAsyncioTestCase):
    async def test_search_uses_accessible_domain_property(self):
        requests = []
        def handle(request):
            requests.append(request)
            if request.method == 'GET':
                return httpx.Response(200, json={'siteEntry': [
                    {'siteUrl': 'sc-domain:lorenzolighting.com', 'permissionLevel': 'siteOwner'}]})
            return httpx.Response(200, json={'rows': [{'clicks': 3, 'impressions': 10}]})
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            result = await sync_search(client, Settings(_env_file=None), 'test-token', date(2026, 10, 16))
        self.assertIn('sc-domain%3Alorenzolighting.com', str(requests[-1].url))
        self.assertEqual(result['clicks'], 3)

    def test_monthly_totals_do_not_sum_cumulative_snapshots(self):
        rows = [
            {'channel': 'Meta', 'period_start': '2026-10-01', 'snapshot_date': '2026-10-15', 'spend': 90},
            {'channel': 'Meta', 'period_start': '2026-10-01', 'snapshot_date': '2026-10-16', 'spend': 100},
            {'channel': 'Google Ads', 'period_start': '2026-10-01', 'snapshot_date': '2026-10-16', 'spend': 20},
            {'channel': 'Meta', 'period_start': '2026-09-01', 'snapshot_date': '2026-09-30', 'spend': 70},
        ]
        latest = latest_monthly_snapshots(list(reversed(rows)))
        self.assertEqual(sum(r['spend'] for r in latest if r['period_start'] == '2026-10-01'), 120)
        self.assertEqual(len(latest), 3)

    async def test_ads_sends_configured_credentials(self):
        def handle(request):
            self.assertEqual(request.headers['developer-token'], 'test-developer')
            self.assertEqual(request.headers['login-customer-id'], '1234567890')
            return httpx.Response(200, json={'results': [{'metrics': {'costMicros': '2500000'}}]})
        settings = Settings(_env_file=None, google_ads_developer_token='test-developer',
                            google_ads_login_customer_id='123-456-7890')
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            result = await sync_google_ads(client, settings, date(2026, 10, 16), 'test-token')
        self.assertEqual(result['records'][0]['spend'], 2.5)


if __name__ == '__main__':
    unittest.main()
