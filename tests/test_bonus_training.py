"""Offline budget/transport checks; only temporary, invented credentials are used."""

import contextlib
import io
import json
from pathlib import Path
import tempfile
import types
import unittest
from unittest import mock


RUNNER_PATH = Path(__file__).resolve().parents[1] / "essay_workshop" / "assistant" / "bonus_training.py"
FAKE_KEY = "sk-unit-test-invented-credential-do-not-use"


def load_runner():
    # Execute only the module definitions, without CLI or a bytecode file.
    module = types.ModuleType("bonus_training_offline_test_target")
    module.__file__ = str(RUNNER_PATH)
    exec(compile(RUNNER_PATH.read_text(encoding="utf-8"), str(RUNNER_PATH), "exec"), module.__dict__)
    return module


class BonusTrainingTests(unittest.TestCase):
    def setUp(self):
        self.runner = load_runner()
        directory = tempfile.TemporaryDirectory(prefix="essay-bonus-unit-")
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.run_dir = self.root / "run"
        self.run_dir.mkdir()
        self.key_file = self.root / "invented.env"
        self.key_file.write_text("OPENAI_API_KEY=" + FAKE_KEY + "\n", encoding="utf-8")

        # Even an accidentally unconfigured test must fail before any network I/O.
        self.transport_patch = mock.patch.object(
            self.runner.urllib.request, "build_opener",
            side_effect=AssertionError("No real transport is allowed in this test"),
        )
        self.build_opener = self.transport_patch.start()
        self.addCleanup(self.transport_patch.stop)
        direct_patch = mock.patch.object(
            self.runner.urllib.request, "urlopen",
            side_effect=AssertionError("No real URL opening is allowed in this test"),
        )
        direct_patch.start()
        self.addCleanup(direct_patch.stop)

    @staticmethod
    def receipt():
        return {
            "id": "resp_unit_test",
            "status": "completed",
            "model": "gpt-4.1",
            "usage": {"input_tokens": 50, "output_tokens": 10},
            "output": [],
        }

    def install_transport(self, side_effect):
        opener = mock.Mock()
        opener.open.side_effect = side_effect
        self.build_opener.side_effect = None
        self.build_opener.return_value = opener
        return opener

    def call(self, name="example", user_input="Придумай учебные обращения", run_dir=None):
        return self.runner.request(
            run_dir or self.run_dir, self.key_file, name, "gpt-4.1",
            "Ответ должен быть JSON.", user_input, 100,
        )

    def ledger(self, run_dir=None):
        return json.loads(((run_dir or self.run_dir) / "ledger.json").read_text(encoding="utf-8"))

    def test_fixed_endpoint_nonstored_json_input_and_redirect_block(self):
        captured = {}

        def send(request, timeout):
            captured["request"] = request
            captured["payload"] = json.loads(request.data)
            self.assertEqual(timeout, 60)
            return io.BytesIO(json.dumps(self.receipt()).encode("utf-8"))

        self.install_transport(send)
        with contextlib.redirect_stdout(io.StringIO()):
            self.call(user_input="В этой исходной строке формат не указан")

        request, payload = captured["request"], captured["payload"]
        self.assertEqual(request.full_url, "https://api.openai.com/v1/responses")
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(request.get_header("Authorization"), "Bearer " + FAKE_KEY)
        self.assertIs(payload["store"], False)
        self.assertEqual(payload["service_tier"], "default")
        self.assertEqual(payload["text"]["format"], {"type": "json_object"})
        # Having JSON only in instructions caused the real validation failure.
        self.assertIn("JSON", payload["input"])
        self.assertIn("В этой исходной строке формат не указан", payload["input"])
        self.build_opener.assert_called_once_with(self.runner.NoRedirect)

        with self.assertRaises(self.runner.urllib.error.HTTPError):
            self.runner.NoRedirect().redirect_request(
                request, None, 307, "Moved", {}, "https://example.invalid/collect"
            )

    def test_durable_reserve_precedes_send_and_next_request_cannot_exceed_cap(self):
        observed_reserve = []

        def send(request, timeout):
            ledger = self.ledger()
            self.assertEqual(len(ledger["requests"]), 1)
            reservation = ledger["requests"][0]
            self.assertEqual(reservation["status"], "reserved")
            self.assertNotIn("cost_usd", reservation)
            self.assertGreater(reservation["reserve_usd"], 0)
            self.assertLessEqual(reservation["reserve_usd"], ledger["cap_usd"])
            self.assertTrue((self.run_dir / "example.request.json").is_file())
            observed_reserve.append(reservation["reserve_usd"])
            return io.BytesIO(json.dumps(self.receipt()).encode("utf-8"))

        opener = self.install_transport(send)
        with contextlib.redirect_stdout(io.StringIO()):
            self.call()
        self.assertEqual(len(observed_reserve), 1)
        self.assertEqual(self.ledger()["requests"][0]["status"], "completed")
        self.assertEqual(self.runner.CAP_USD, 0.44)
        self.assertLessEqual(self.runner.CAP_USD + 0.056876, 0.50)

        exhausted = self.root / "exhausted"
        exhausted.mkdir()
        exhausted_ledger = {
            "cap_usd": self.runner.CAP_USD,
            "requests": [{"name": "earlier", "status": "completed",
                          "reserve_usd": self.runner.CAP_USD - 0.0001,
                          "cost_usd": self.runner.CAP_USD - 0.0001}],
        }
        ledger_path = exhausted / "ledger.json"
        ledger_path.write_text(json.dumps(exhausted_ledger), encoding="utf-8")
        before = ledger_path.read_bytes()
        with mock.patch.object(self.runner, "load_key", side_effect=AssertionError("No key read after cap")):
            with self.assertRaisesRegex(ValueError, "exceed.*budget"):
                self.call(name="too-much", run_dir=exhausted)
        self.assertEqual(ledger_path.read_bytes(), before)
        self.assertFalse((exhausted / "too-much.request.json").exists())
        opener.open.assert_called_once()

    def test_uncertain_timeout_retains_reserve_and_prevents_any_retry(self):
        opener = self.install_transport(TimeoutError("Invented transport timeout"))
        with self.assertRaisesRegex(RuntimeError, "no automatic retry"):
            self.call()
        reservation = self.ledger()["requests"][0]
        self.assertEqual(reservation["status"], "uncertain")
        self.assertEqual(reservation["error_type"], "TimeoutError")
        self.assertGreater(reservation["reserve_usd"], 0)
        self.assertNotIn("cost_usd", reservation)
        before = (self.run_dir / "ledger.json").read_bytes()

        for name in ("example", "different-name"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                self.call(name=name)
        self.assertEqual((self.run_dir / "ledger.json").read_bytes(), before)
        opener.open.assert_called_once()

    def test_completed_cache_avoids_key_and_transport_but_rejects_changed_input(self):
        receipt = self.receipt()
        opener = self.install_transport(
            lambda request, timeout: io.BytesIO(json.dumps(receipt).encode("utf-8"))
        )
        with contextlib.redirect_stdout(io.StringIO()):
            first = self.call()
        before = (self.run_dir / "ledger.json").read_bytes()
        with mock.patch.object(self.runner, "load_key", side_effect=AssertionError("Cached calls must not read keys")):
            self.assertEqual(self.call(), first)
            with self.assertRaisesRegex(ValueError, "different input.*no retry"):
                self.call(user_input="Другая просьба")
        self.assertEqual(first, receipt)
        self.assertEqual((self.run_dir / "ledger.json").read_bytes(), before)
        opener.open.assert_called_once()
        self.build_opener.assert_called_once()

    def test_missing_usage_receipt_keeps_cost_reserved_and_halts(self):
        receipt = self.receipt()
        del receipt["usage"]
        opener = self.install_transport(
            lambda request, timeout: io.BytesIO(json.dumps(receipt).encode("utf-8"))
        )
        with self.assertRaisesRegex(RuntimeError, "reserve retained.*no automatic retry"):
            self.call()
        reservation = self.ledger()["requests"][0]
        self.assertEqual(reservation["status"], "uncertain")
        self.assertGreater(reservation["reserve_usd"], 0)
        self.assertNotIn("cost_usd", reservation)
        self.assertTrue((self.run_dir / "example.response.json").is_file())
        with self.assertRaisesRegex(ValueError, "unresolved request"):
            self.call(name="must-not-follow")
        opener.open.assert_called_once()

    def test_unexpected_accounting_cannot_be_reused_as_completed_cache(self):
        receipt = self.receipt()
        # An unexpected usage receipt exceeds the conservative reservation,
        # while still being below the overall cap: the halt must not rely on cap alone.
        receipt["usage"]["input_tokens"] = 100_000
        opener = self.install_transport(
            lambda request, timeout: io.BytesIO(json.dumps(receipt).encode("utf-8"))
        )
        with self.assertRaisesRegex(RuntimeError, "no automatic retry"):
            self.call()
        reservation = self.ledger()["requests"][0]
        self.assertEqual(reservation["status"], "accounting_error")
        self.assertGreater(reservation["cost_usd"], reservation["reserve_usd"])
        self.assertLess(reservation["cost_usd"], self.runner.CAP_USD)
        self.assertTrue((self.run_dir / "example.response.json").is_file())
        before = (self.run_dir / "ledger.json").read_bytes()
        for name in ("example", "must-not-follow"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                self.call(name=name)
        self.assertEqual((self.run_dir / "ledger.json").read_bytes(), before)
        opener.open.assert_called_once()

    def test_http_error_does_not_persist_or_print_credential_or_raw_message(self):
        raw_message = "Invented provider message echoed credential " + FAKE_KEY
        body = {"error": {"type": "invalid_request_error", "code": "invalid_api_key",
                          "param": None, "message": raw_message}}
        failure = self.runner.urllib.error.HTTPError(
            "https://api.openai.com/v1/responses", 401, raw_message,
            {"X-Invented-Diagnostic": FAKE_KEY}, io.BytesIO(json.dumps(body).encode("utf-8")),
        )
        opener = self.install_transport(failure)
        output, errors = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
            with self.assertRaises(RuntimeError) as caught:
                self.call()
        reservation = self.ledger()["requests"][0]
        self.assertEqual(reservation["status"], "uncertain")
        self.assertEqual(reservation["http_status"], 401)
        self.assertEqual(reservation["api_error"], {
            "type": "invalid_request_error", "code": "invalid_api_key", "param": None,
        })
        self.assertGreater(reservation["reserve_usd"], 0)
        self.assertNotIn("cost_usd", reservation)
        persisted = "\n".join(path.read_text(encoding="utf-8") for path in self.run_dir.iterdir() if path.is_file())
        for observable in (persisted, output.getvalue(), errors.getvalue(), str(caught.exception)):
            self.assertNotIn(FAKE_KEY, observable)
            self.assertNotIn(raw_message, observable)
        self.assertFalse((self.run_dir / "example.response.json").exists())
        opener.open.assert_called_once()


if __name__ == "__main__":
    unittest.main()
