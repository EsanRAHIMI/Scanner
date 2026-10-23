import unittest
from datetime import date
import httpx
from core.aggregate import later_day
from core.sync import latest_monthly_snapshots, months_to_publish, seconds_until_next
from core.config import Settings
from core.connectors import newest_reviews, review_record, search_query_rows, sync_google_ads, sync_search


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
        self.assertEqual(result['queries'], [])

    def test_review_keeps_stars_reply_and_text(self):
        row = review_record({
            'name': 'accounts/1/locations/2/reviews/abc',
            'reviewer': {'displayName': 'Nora'},
            'starRating': 'FOUR',
            'comment': 'The showroom was clear.',
            'createTime': '2026-10-02T08:00:00Z',
            'reviewReply': {'comment': 'Thank you'},
        })
        self.assertEqual(row['id'], 'abc')
        self.assertEqual(row['stars'], 4)
        self.assertEqual(row['text'], 'The showroom was clear.')
        self.assertTrue(row['replied'])
        self.assertEqual(row['reviewer'], 'Nora')
        self.assertIsNone(review_record({'comment': 'no id'}))
        self.assertEqual(search_query_rows({'rows': [{'keys': ['lorenzo chandelier'], 'clicks': 2, 'impressions': 9, 'position': 3.2}]})[0]['query'], 'lorenzo chandelier')
        ordered = newest_reviews([
            {'id': 'old', 'created': '2026-01-02'},
            {'id': 'new', 'created': '2026-10-20'},
            {'id': 'blank', 'created': ''},
        ])
        self.assertEqual([row['id'] for row in ordered], ['new', 'old', 'blank'])

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

    def test_sync_is_due_twice_a_day_and_publishes_the_open_month(self):
        interval = 12 * 60 * 60
        self.assertEqual(seconds_until_next(None, interval), 0)
        self.assertEqual(seconds_until_next(interval, interval), 0)
        self.assertEqual(seconds_until_next(interval - 1, interval), 1)
        months = months_to_publish('2026-09', ['2026-09'], '2026-10')
        self.assertIn('2026-10', months)
        self.assertEqual(later_day('2026-10-01', '2026-10-19'), '2026-10-19')
        self.assertEqual(later_day(None, '2026-10-19'), '2026-10-19')


if __name__ == '__main__':
    unittest.main()
