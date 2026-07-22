import unittest
import pathlib
import importlib.util
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / 'app.py'

spec = importlib.util.spec_from_file_location('airbrake_app', MODULE_PATH)
app_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app_module)

class GetBreakDetailTests(unittest.TestCase):
    def test_get_break_detail_uses_hash_candidates_and_md5_fallback(self):
        called = {'query': []}

        def fake_query(sql, params=None):
            called['query'].append((sql, params))
            if 'FROM projects_data' in sql and "row_type = 'log'" in sql:
                return [{
                    'project_name': 'ScholarFinder',
                    'error_message': 'ValueError: Boom!',
                    'error_detail': 'Traceback\n  File "x.py"\nValueError: Boom!',
                    'error_hash': 'ba92a948b9e7446f3b3da2e14eb46269',
                    'failure_count': 3,
                    'timestamp': __import__('datetime').datetime.now(__import__('datetime').timezone.utc),
                    'error_status': 'open',
                    'reopened_at': None,
                    'file_name': 'x.py',
                }]
            return []

        app_module.query = fake_query
        client = app_module.app.test_client()
        response = client.get('/api/breaks/detail/ba92a948b9e7446f3b3da2e14eb46269?project_name=ScholarFinder')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIsNotNone(data)
        self.assertEqual(data['project_name'], 'ScholarFinder')
        self.assertEqual(data['error_hash'], 'ba92a948b9e7446f3b3da2e14eb46269')
        self.assertGreaterEqual(len(called['query']), 1)
        self.assertIn('row_type = \'log\'', called['query'][0][0])
        self.assertIn('MD5(LOWER(TRIM(error))) = %s', called['query'][0][0])

    def test_get_break_detail_returns_debug_on_not_found_when_enabled(self):
        def fake_query(sql, params=None):
            if 'COUNT(*)' in sql:
                return [{'cnt': 0}]
            return []

        app_module.query = fake_query
        app_module.DEBUG_BREAK_DETAIL = True
        client = app_module.app.test_client()
        response = client.get('/api/breaks/detail/doesnotexist?project_name=ScholarFinder')
        self.assertEqual(response.status_code, 404)
        data = response.get_json()
        self.assertIsNotNone(data)
        self.assertIn('debug', data)
        self.assertEqual(data['debug']['stage'], 'query_returned_zero_rows')
        self.assertEqual(data['debug']['project_name'], 'ScholarFinder')

if __name__ == '__main__':
    unittest.main()
