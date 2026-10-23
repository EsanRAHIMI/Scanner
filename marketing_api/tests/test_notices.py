import unittest

from core.notices import human_notice


class NoticeTests(unittest.TestCase):
    def test_raw_api_bodies_become_separate_sentences(self):
        pinterest = human_notice(
            "Pinterest campaigns",
            'Pinterest campaigns 401: {"code":2,"message":"Authentication failed.","status":"failure"}',
        )
        tiktok = human_notice(
            "TikTok campaigns",
            "TikTok campaigns: Permission error: The access token lacks the required scope for endpoint '/campaign/get/'.",
        )
        ads = human_notice(
            "Google Ads campaigns",
            '{ "error": { "code": 400, "message": "Request contains an invalid argument.", "status": "INVALID_ARGUMENT" } }',
        )
        odoo = human_notice("Odoo CRM", "Odoo credentials are not set.", "unconfigured")
        self.assertNotIn("{", pinterest)
        self.assertNotIn("{", tiktok)
        self.assertNotIn("{", ads)
        self.assertIn("Pinterest rejected the token", pinterest)
        self.assertIn("Reconnect TikTok", tiktok)
        self.assertIn("customer id", ads)
        self.assertIn("disconnected", odoo)


if __name__ == "__main__":
    unittest.main()
