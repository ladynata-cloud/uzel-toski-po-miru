import importlib.util
import json
import unittest
from pathlib import Path
from unittest.mock import Mock


server_path = Path(__file__).resolve().parents[1] / "essay_workshop/full-review/full_review_server.py"
spec = importlib.util.spec_from_file_location("full_essay_review", server_path)
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

IDS = ("K1", "K2", "K3", "K4", "K5")
EXCERPT = "Герой вернулся."


def review(ids=IDS):
    return {"criteria": [{"id": cid, "quote": EXCERPT, "comment": "Видно действие героя.",
                          "action": "Проверь его связь с тезисом."} for cid in ids],
            "priority": "Перечитай свой вывод."}


class FullEssayReviewTests(unittest.TestCase):
    def setUp(self):
        self.data = {"topic": "Почему герой вернулся?", "essay": EXCERPT, "key": "fake-auth-key"}

    def test_entire_essay_sent_to_chat_without_authorization_key(self):
        self.data["essay"] = "\n" + "Сцена и вывод. " * 1200 + "\n" + EXCERPT + "  "
        reply = {"choices": [{"finish_reason": "stop", "message": {
            "role": "assistant", "content": json.dumps(review(), ensure_ascii=False)}}]}
        post = Mock(side_effect=[{"access_token": "fake-access-token"}, reply])
        result = server.request_review(self.data, post)
        self.assertEqual(result["unverifiedQuotes"], [])
        oauth, chat = [call.args for call in post.call_args_list]
        self.assertEqual((oauth[0], chat[0]), (server.OAUTH, server.CHAT))
        self.assertEqual(oauth[1]["Authorization"], "Basic fake-auth-key")
        self.assertEqual(chat[1]["Authorization"], "Bearer fake-access-token")
        self.assertNotIn(self.data["key"].encode(), chat[2])
        user, = [m for m in json.loads(chat[2])["messages"] if m["role"] == "user"]
        self.assertEqual(json.loads(user["content"]), {"topic": self.data["topic"], "essay": self.data["essay"]})

    def test_selected_lens_goes_to_model_and_unknown_lens_never_sends(self):
        for mode in ("orthodox", "secular"):
            with self.subTest(mode=mode):
                response = {"choices": [{"finish_reason": "stop", "message": {"role": "assistant", "content": json.dumps(review())}}]}
                post = Mock(side_effect=[{"access_token": "test"}, response])
                server.request_review({**self.data, "mode": mode}, post)
                user = json.loads(post.call_args.args[2])["messages"][1]["content"]
                self.assertEqual(json.loads(user)["mode"], mode)
        post = Mock()
        with self.assertRaises(server.Problem):
            server.request_review({**self.data, "mode": "unknown"}, post)
        post.assert_not_called()

    def test_unmatched_quote_and_dependent_feedback_are_removed(self):
        response = review()
        bad = response["criteria"][1]
        bad.update(quote="Герой Вернулся.", comment="Недостоверное наблюдение.", action="Спорная правка.")
        result = server.verified_review(response, EXCERPT)
        self.assertEqual(result["unverifiedQuotes"], ["K2"])
        rows = result["review"]["criteria"]
        self.assertEqual([r["id"] for r in rows], list(IDS))
        self.assertEqual(rows[1]["quote"], "")
        for key in ("comment", "action"):
            self.assertTrue(rows[1][key].strip())
            self.assertNotEqual(rows[1][key], bad[key])
        self.assertEqual(rows[0], response["criteria"][0])
        self.assertNotEqual(result["review"]["priority"], response["priority"])

    def test_distinct_scene_stays_selected_when_topic_is_replaced(self):
        scene_id, = (key for key, scene in server.RESOURCES["sceneCards"].items()
                     if scene["id"] == "classic-inspector" and scene["url"].endswith("0085-01.htm"))
        self.data["cardIds"] = [scene_id]
        reply = {"choices": [{"finish_reason": "stop", "message": {
            "role": "assistant", "content": json.dumps(review(), ensure_ascii=False)}}]}
        post = Mock(side_effect=[{"access_token": "test"}, reply])
        server.request_review(self.data, post)
        body = json.loads(post.call_args_list[-1].args[2])
        material = json.loads(body["messages"][1]["content"])
        self.assertEqual(material["topic"], self.data["topic"])
        self.assertEqual(material["cards"], [server.CARD_BY_ID[scene_id]])
        self.assertNotEqual(material["cards"][0]["fact"], server.CARD_BY_ID["classic-inspector"]["fact"])
        self.assertTrue(material["cards"][0]["url"].endswith("0085-01.htm"))
        for invalid in ([scene_id, "classic-inspector"], [scene_id + "-unknown"]):
            with self.subTest(invalid=invalid), self.assertRaises(server.Problem) as error:
                server.check_input({**self.data, "cardIds": invalid})
            self.assertEqual(error.exception.code, "invalid_cards")

    def test_all_five_distinct_criteria_required(self):
        for ids in (IDS[:-1], IDS + ("K6",), IDS[:-1] + ("K1",), IDS[:-1] + ("K6",)):
            with self.subTest(ids=ids), self.assertRaises(server.Problem) as error:
                server.verified_review(review(ids), EXCERPT)
            self.assertEqual(error.exception.code, "invalid_response")

    def test_provider_error_does_not_repeat_oauth_or_chat(self):
        for phase in ("oauth", "chat"):
            with self.subTest(phase=phase):
                failure = server.Problem(429, "provider_http")
                replies = [failure] if phase == "oauth" else [{"access_token": "fake-access-token"}, failure]
                post = Mock(side_effect=replies)
                with self.assertRaises(server.Problem) as error:
                    server.request_review(self.data, post)
                self.assertEqual(error.exception.code, "rate_limit")
                expected = [server.OAUTH] if phase == "oauth" else [server.OAUTH, server.CHAT]
                self.assertEqual([call.args[0] for call in post.call_args_list], expected)


if __name__ == "__main__":
    unittest.main()
