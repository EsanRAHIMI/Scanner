import unittest

from core import runtime


class ReadyGateTests(unittest.TestCase):
    def setUp(self):
        runtime.ready = False
        runtime.failed = False

    def tearDown(self):
        runtime.ready = False
        runtime.failed = False

    def test_data_routes_wait_while_booting(self):
        self.assertTrue(runtime.blocks_until_ready("/api/v1/overview"))
        self.assertTrue(runtime.blocks_until_ready("/api/v1/timeline/live"))

    def test_health_stays_open(self):
        self.assertFalse(runtime.blocks_until_ready("/health"))
        self.assertFalse(runtime.blocks_until_ready("/docs"))

    def test_open_after_ready_or_failed(self):
        runtime.ready = True
        self.assertFalse(runtime.blocks_until_ready("/api/v1/overview"))
        runtime.ready = False
        runtime.failed = True
        self.assertFalse(runtime.blocks_until_ready("/api/v1/overview"))
