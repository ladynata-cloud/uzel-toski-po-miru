"""Run beside server.py with: python -m unittest -v test_server.py"""
import http.client
import importlib.util
import json
import ssl
import threading
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("uzel_personal_bridge", Path(__file__).with_name("server.py"))
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)

BOOK = {"id": "doctor", "title": "Чудесный доктор", "fact": "Деньги под блюдцем.",
        "secular": "Что видит семья?", "orthodox": "Как показано милосердие?"}
TURN = {"version": 1, "stage": "link", "mode": "secular", "topic": "Что значит помочь?",
        "workId": "doctor", "workTitle": "Моё название", "passage": "Врач оставил деньги.", "message": "Что это даёт?"}
RESPONSE = {"choices": [{"finish_reason": "stop", "message": {"role": "assistant", "content": "Почему он уже ушёл?"}}]}
NOW = 1795200000


class FakeAPI:
    def __init__(self, milliseconds=True):
        self.calls = []
        self.now = NOW
        self.tokens = 0
        self.chat_errors = []
        self.auth_status = 200
        self.expiry_offset = 1800
        self.ms = milliseconds
        self.result = RESPONSE

    def __call__(self, url, headers, body):
        self.calls.append((url, headers, body))
        if url == bridge.OAUTH:
            if self.auth_status != 200:
                raise bridge.Problem(self.auth_status, "upstream_http")
            self.tokens += 1
            return {"access_token": "token-" + str(self.tokens),
                    "expires_at": (self.now + self.expiry_offset) * (1000 if self.ms else 1)}
        assert url == "https://api.giga.chat/v1/chat/completions"
        if self.chat_errors:
            raise bridge.Problem(self.chat_errors.pop(0), "upstream_http")
        return self.result


def assistant(fake):
    return bridge.GigaChat("TEST_ONLY", "Самостоятельная правка.", {"works": [BOOK]}, fake, lambda: fake.now)


class AdapterTests(unittest.TestCase):
    def test_payload_and_token_cache(self):
        for milliseconds in (False, True):
            fake = FakeAPI(milliseconds)
            model = assistant(fake)
            self.assertEqual(model.reply(TURN), "Почему он уже ушёл?")
            model.reply(TURN)
            self.assertEqual(fake.tokens, 1)
            url, headers, payload = fake.calls[0]
            self.assertEqual(url, "https://ngw.devices.sberbank.ru:9443/api/v2/oauth")
            self.assertEqual(payload, b"scope=GIGACHAT_API_PERS")
            self.assertEqual(uuid.UUID(headers["RqUID"]).version, 4)
            self.assertEqual(headers["Authorization"], "Basic TEST_ONLY")
            url, headers, payload = fake.calls[-1]
            self.assertEqual(headers["Authorization"], "Bearer token-1")
            model_req = json.loads(payload)
            self.assertEqual(model_req["model"], "GigaChat-2")
            self.assertNotIn(b"TEST_ONLY", payload)
            system, user = model_req["messages"]
            self.assertIn(BOOK["fact"], system["content"])
            self.assertIn(BOOK["secular"], system["content"])
            self.assertNotIn(BOOK["orthodox"], system["content"])
            self.assertNotIn(TURN["passage"], system["content"])
            self.assertEqual(json.loads(user["content"])["workTitle"], BOOK["title"])
            fake.now += 1790
            model.reply({**TURN, "mode": "orthodox", "workId": "", "workTitle": "Своя книга"})
            self.assertEqual(fake.tokens, 2)
            req = json.loads(fake.calls[-1][2])
            self.assertNotIn(BOOK["fact"], req["messages"][0]["content"])
            self.assertIn("Своя книга", req["messages"][1]["content"])

    def test_revoked_and_rejected_tokens(self):
        fake = FakeAPI()
        model = assistant(fake)
        fake.chat_errors = [401]
        self.assertTrue(model.reply(TURN))
        self.assertEqual(fake.tokens, 2)
        fake.chat_errors = [401,401]
        with self.assertRaises(bridge.Problem) as err:
            model.reply(TURN)
        self.assertEqual(err.exception.code, "access_denied")
        self.assertEqual(fake.tokens, 3)
        for status in (402, 429, 503):
            count = len(fake.calls)
            fake.chat_errors = [status]
            with self.assertRaises(bridge.Problem) as err:
                model.reply(TURN)
            self.assertEqual(err.exception.status, status)
            self.assertEqual(len(fake.calls), count+1)

    def test_failed_auth_expiry_malformed_and_cut_off_reply(self):
        fake = FakeAPI()
        model = assistant(fake)
        fake.auth_status = 401
        with self.assertRaisesRegex(bridge.Problem, "authorization_failed"):
            model.reply(TURN)
        self.assertEqual(len(fake.calls), 1)
        fake.auth_status = 200
        fake.expiry_offset = -1
        with self.assertRaisesRegex(bridge.Problem, "expired_token"):
            model.reply(TURN)
        self.assertEqual(len(fake.calls), 2)
        fake.expiry_offset = 1800
        for result in ({}, {"choices": []}, {"choices": [{"finish_reason": "length", "message": {"role": "assistant", "content": "обрыв"}}]}):
            fake.result = result
            with self.assertRaisesRegex(bridge.Problem, "invalid_response"):
                model.reply(TURN)

    def test_tls_validation_and_no_redirect(self):
        with patch("ssl.create_default_context", wraps=ssl.create_default_context) as context:
            bridge.transport()
            self.assertTrue(context.called)
        self.assertIsNone(bridge.NoRedirect().redirect_request(None, None, 302, "", {}, "https://other.invalid/"))


class BrowserTests(unittest.TestCase):
    def setUp(self):
        self.fake = FakeAPI()
        self.server = bridge.make_server(b"<p>workshop</p>", assistant(self.fake))
        self.thread = threading.Thread(target=self.server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
        self.thread.start()
        self.host = "127.0.0.1:" + str(self.server.server_port)
        self.origin = "http://" + self.host

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(2)

    def request(self, method="POST", path="/v1/essay/turn", turn=None, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=2)
        base = {"Origin": self.origin, "Content-Type": "application/json"}
        base.update(headers or {})
        try:
            conn.request(method, path, bridge.json_bytes(TURN if turn is None else turn) if method=="POST" else None, base)
            res = conn.getresponse()
            self.assertIsNone(res.getheader("Access-Control-Allow-Origin"))
            return res.status, res.read()
        finally:
            conn.close()

    def test_website_and_one_explicit_turn(self):
        for path in ("/", "/index.html"):
            self.assertEqual(self.request("GET", path), (200, b"<p>workshop</p>"))
        for path in ("/server.py", "/system.ru.md", "/catalog.json", "/overshare"):
            self.assertEqual(self.request("GET", path)[0], 404)
        self.assertEqual(self.fake.calls, [])
        status, body = self.request()
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {"version": 1, "reply": "Почему он уже ушёл?"})

    def test_host_origin_limits_and_fields(self):
        for headers, expected in [
            ({"Host": "localhost:8765"}, 403), ({"Origin": "null"}, 403),
            ({"Origin": "https://evil.invalid"}, 403), ({"Content-Type": "text/plain"}, 415)
        ]:
            self.assertEqual(self.request(headers=headers)[0], expected)
        for turn in ({**TURN, "extra": "черновик"}, {**TURN, "version": True}, {**TURN, "workId": "unknown"},
                     {**TURN, "passage": "🐈"*601}, {**TURN, "mode": []}):
            self.assertEqual(self.request(turn=turn)[0], 400)
        self.assertEqual(self.request(turn={**TURN, "message":"x"*32000})[0], 413)
        self.assertEqual(self.fake.calls, [])


if __name__ == "__main__":
    unittest.main()
