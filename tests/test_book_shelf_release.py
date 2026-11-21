"""Independent regression checks for the built family checker. Run after build.py."""
import base64
import importlib.util
import json
from pathlib import Path
from urllib.parse import urlsplit
import re
import tempfile
import unittest
from unittest.mock import Mock
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "dist/k-sochineniyu/itogovoe/pomoshchnik"
FIXTURE = Path(__file__).parent / "fixtures/essay-review-reading-cases.json"


def read_catalog(html):
    match = re.search(r'<script\b[^>]*\bid="ew-catalog"[^>]*>(.*?)</script>', html, re.S)
    if not match:
        raise AssertionError("No workshop catalogue in the built page")
    return json.loads(match[1])


class BookShelfReleaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.page = (ASSETS / "proverka-sochineniya.html").read_text(encoding="utf-8")
        cls.catalog = read_catalog((ASSETS / "index.html").read_text(encoding="utf-8"))
        with ZipFile(ASSETS / "proverka-gigachat.zip") as download:
            cls.launcher = download.read("full_review_server.py")
            cls.method = json.loads(download.read("method.json"))
        folder = tempfile.TemporaryDirectory()
        cls.addClassCleanup(folder.cleanup)
        exported = Path(folder.name) / "full_review_server.py"
        exported.write_bytes(cls.launcher)
        spec = importlib.util.spec_from_file_location("downloaded_essay_review", exported)
        cls.server = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.server)

    def test_site_html_and_downloads_share_catalogue_and_method(self):
        with ZipFile(ASSETS / "proverka-gigachat.zip") as download:
            self.assertEqual(download.read("essay-check.html").decode(), self.page)
            self.assertEqual(read_catalog(download.read("practice.html").decode()), self.catalog)
        encoded = base64.b64encode(self.launcher).decode()
        self.assertIn(encoded, self.page, "Single-page launcher differs from the family ZIP")
        self.assertEqual(self.method, json.loads((ROOT / "essay_workshop/full-review/method.json").read_text(encoding="utf-8")))
        self.assertEqual(self.server.RESOURCES["method"]["version"], self.method["version"])
        match = re.search(r'const reviewBundle\s*=\s*', self.page)
        self.assertIsNotNone(match)
        browser_bundle, _ = json.JSONDecoder().raw_decode(self.page[match.end():])
        self.assertEqual(browser_bundle["method"], self.method)
        for key in ("materialsId", "systemPrompt", "cards", "sceneCards"):
            self.assertEqual(browser_bundle[key], self.server.RESOURCES[key])
        api_output, chat_output = (self.method["formats"][k] for k in ("api", "chat"))
        api, chat = browser_bundle["systemPrompt"], browser_bundle["manualPrompt"]
        self.assertTrue(api.endswith(api_output) and chat.endswith(chat_output))
        self.assertEqual(api[:-len(api_output)], chat[:-len(chat_output)])
        self.assertEqual(self.server.STATUS["materialsId"], browser_bundle["materialsId"])
        for line in self.method["instructions"]:
            self.assertIn(line, api)
            self.assertIn(line, chat)
        expected = [{k: book[k] for k in ("id", "title", "fact", "url")} for book in self.catalog["works"]]
        self.assertEqual(browser_bundle["cards"], expected)
        public = self.catalog["publicTopics"]
        match = re.search(r'const topicMenu\s*=\s*', self.page)
        self.assertIsNotNone(match)
        menu, _ = json.JSONDecoder().raw_decode(self.page[match.end():])
        sources = {s["id"]: s["url"] for s in public["sources"]}
        expected_topics = [(t["title"], sources[t["source"]]) for t in public["topics"]]
        expected_topics.extend((t["title"], "") for t in self.catalog["topics"])
        lessons = json.loads((ROOT / "essay_workshop/theme_practice/lessons.json").read_text(encoding="utf-8"))
        planner = [task for lesson in lessons for task in lesson["tasks"]]
        expected_topics.extend((task["title"], "") for task in planner)
        self.assertEqual([(title, menu["sources"][i]["url"]) for title, i in menu["topics"]], expected_topics)
        self.assertEqual(len(menu["routesByTopic"]), len(expected_topics))
        # A title may occur under several sources. Keep each row and its own ordered book choices.
        catalog_topics = public["topics"] + self.catalog["topics"]
        for row, item in enumerate(catalog_topics):
            self.assertEqual(menu["routesByTopic"][row], item["bookRoutes"])
            for key in item["bookRoutes"]:
                route = self.catalog["bookRoutes"][key]
                linked = menu["bookRoutes"][key]
                self.assertEqual((linked["work"], linked["why"]), (route["work"], route["why"]))
                self.assertEqual(linked.get("card"), route.get("card"))
                self.assertTrue(route["why"].strip())
                base = self.server.CARD_BY_ID[route["work"]]
                selected = self.server.CARD_BY_ID[linked.get("card", linked["work"])]
                self.assertEqual(selected["title"], route.get("title", base["title"]))
                self.assertEqual(selected["fact"], route.get("scene", base["fact"]))
                self.assertEqual(selected["url"], route.get("url", base["url"]))
        for row, task in enumerate(planner, start=len(catalog_topics)):
            routes = [menu["bookRoutes"][key] for key in menu["routesByTopic"][row]]
            self.assertEqual([(r["work"], r["why"]) for r in routes],
                             [(s["work"], s["why"]) for s in task["bookSuggestions"]])
            for route, suggestion in zip(routes, task["bookSuggestions"]):
                selection = self.server.CARD_BY_ID[route.get("card", route["work"])]
                base = self.server.CARD_BY_ID[route["work"]]
                self.assertEqual(selection["id"], suggestion["work"])
                self.assertEqual(selection["title"], suggestion.get("title", base["title"]))
                self.assertEqual(selection["url"], suggestion.get("url", base["url"]))
                self.assertEqual(selection["fact"], suggestion.get("scene", base["fact"]))
        with ZipFile(ASSETS / "trenazher-gigachat.zip") as download:
            downloaded_catalog = json.loads(download.read("catalog.json"))
            for group in ("works", "topics", "readings", "publicTopics", "bookRoutes"):
                self.assertEqual(downloaded_catalog[group], self.catalog[group])
            self.assertEqual(read_catalog(download.read("index.html").decode()), self.catalog)

    def test_rechecked_doctor_passage_keeps_the_corridor_reply_and_two_money_episodes(self):
        reading = next(r for r in self.catalog["readings"] if r["id"] == "doctor")
        self.assertIn("из другого конца коридора", reading["context"])
        self.assertIn("имени не называет", reading["context"])
        self.assertNotIn("Доктор уже ушёл", reading["context"])
        # These two facts must also reach the card sent by the family checker.
        card = self.server.CARD_BY_ID["doctor"]["fact"]
        self.assertIn("три рубля на еду", card)
        self.assertRegex(card, r"под чайным блюдцем.*крупные кредитные билеты")

    def test_rechecked_bykov_card_and_linked_article_include_the_guard(self):
        card = self.server.CARD_BY_ID["shelf-senior-010"]
        self.assertRegex(card["fact"], r"часовой.*до приезда комиссара его не выпустят")
        topic = next(t for t in self.catalog["topics"] if t["work"] == card["id"])
        self.assertIn("под охраной", topic["title"])
        article = (ROOT / "dist/chtenie/razbory/senior-010/index.html").read_text(encoding="utf-8")
        self.assertIn("рядом стоит часовой", article)
        self.assertIn("до приезда комиссара его не выпустят", article)
        for old_claim in ("ничто не мешает уйти", "внутренним решением ждать"):
            self.assertNotIn(old_claim, article + json.dumps(topic, ensure_ascii=False))

    def test_rechecked_adamovich_card_and_linked_article_recognize_the_comrades(self):
        card = self.server.CARD_BY_ID["shelf-senior-001"]
        self.assertRegex(card["fact"], r"узнаёт голоса партизан своего отряда")
        topic = next(t for t in self.catalog["topics"] if t["work"] == card["id"])
        self.assertIn("голоса товарищей", topic["title"])
        article = (ROOT / "dist/chtenie/razbory/senior-001/index.html").read_text(encoding="utf-8")
        self.assertIn("зовут по имени", article)
        self.assertIn("узнаёт голоса партизан своего отряда", article)
        for old_claim in ("пассажиры видят в незнакомце", "Как случайная встреча"):
            self.assertNotIn(old_claim, article + json.dumps(topic, ensure_ascii=False))

    def test_shortlists_follow_the_actual_prompt_including_its_restrictions(self):
        catalog = self.catalog
        public = catalog["publicTopics"]
        works = {w["id"]: w for w in catalog["works"]}
        by_id = {t["id"]: t for t in public["topics"]}

        def recommendations(topic):
            return [catalog["bookRoutes"][key] for key in topic["bookRoutes"]]

        for topic in [*public["topics"], *catalog["topics"]]:
            with self.subTest(topic=topic["id"]):
                choices = recommendations(topic)
                books = [r["work"] for r in choices]
                self.assertIn(len(choices), (1, 2, 3))
                self.assertEqual(len(set(books)), len(books))
                for choice in choices:
                    book = works[choice["work"]]
                    self.assertTrue(choice["why"].strip())
                    self.assertTrue((choice.get("scene") or book["fact"]).strip())
                    self.assertEqual(urlsplit(choice.get("url") or book["url"]).scheme, "https")
                title = topic["title"].lower()
                if "лермонтов" in title and ("(по одному" in title or title.startswith("произведение м.")):
                    self.assertTrue(all("Лермонтов" in works[k]["title"] for k in books))

        original = by_id["pub-archive-2025-02-05-e40468797e7b-12"]
        restricted = by_id["pub-archive-2015-05-06-a1819476a5f0-9"]
        self.assertIn(original["title"], restricted["title"])
        self.assertNotEqual(original["bookRoutes"], restricted["bookRoutes"])
        self.assertEqual(public["stats"]["positions"], len(public["topics"]))
        for first, second_code in [(11, "241"), (32, "441"), (53, "641")]:
            first_id = f"pub-archive-2026-04-08-264015a9d01d-{first}"
            second = by_id[f"{first_id}-code{second_code}"]
            self.assertEqual(second["code"], second_code)
            self.assertNotEqual(by_id[first_id]["bookRoutes"], second["bookRoutes"])
            self.assertNotIn(second["title"], by_id[first_id]["title"])

    def test_every_work_has_a_distinct_exercise_and_valid_source(self):
        books = {w["id"]: w for w in self.catalog["works"]}
        readings = {r["id"]: r for r in self.catalog["readings"]}
        topics = {t["id"] for t in self.catalog["topics"]}
        self.assertGreaterEqual(len(books), 100)
        self.assertEqual(len(books), len(self.catalog["works"]))
        self.assertEqual(len(readings), len(self.catalog["readings"]))
        self.assertEqual(set(books), set(readings))
        for book_id, book in books.items():
            with self.subTest(book=book_id):
                r = readings[book_id]
                self.assertIn(r["topic"], topics)
                self.assertTrue(urlsplit(book["url"]).hostname)
                self.assertEqual(urlsplit(book["url"]).scheme, "https")
                self.assertTrue(book["sections"] and set(book["sections"]) <= {1, 2, 3})
                self.assertTrue(all(r[key].strip() for key in ("context", "secular", "orthodox")))
                if r.get("kind") == "scene":
                    self.assertFalse(r.get("quote"))
                else:
                    self.assertTrue(r.get("quote", "").strip())

    def test_optional_cards_exact_text_and_untrusted_card_quote(self):
        body = "  Моё чтение.\nЯ ещё проверю его по книге. 🖋  "
        topic = "Что слышит читатель?"
        credential = "dummy-authorization-for-test"
        for ids in (None, [], ["doctor"], ["student", "doctor"]):
            with self.subTest(ids=ids):
                data = {"topic": topic, "essay": body, "key": credential}
                if ids is not None:
                    data["cardIds"] = ids
                original = json.dumps(data, ensure_ascii=False)
                fake_quote = self.server.CARD_BY_ID["doctor"]["fact"]
                rows = [{"id": cid, "quote": fake_quote if cid == "K2" else "Моё чтение.",
                         "comment": "Вывод опирается на приведённую выдержку.",
                         "action": "Сверь выбранное место."} for cid in self.server.CRITERIA]
                answer = {"criteria": rows, "priority": "Исправь неподтверждённую цитату из карточки."}
                post = Mock(side_effect=[{"access_token": "mock-local-token"},
                           {"choices": [{"finish_reason": "stop", "message": {
                               "role": "assistant", "content": json.dumps(answer, ensure_ascii=False)}}]}])
                result = self.server.request_review(data, post)
                oauth, chat = [call.args for call in post.call_args_list]
                wire = json.loads(chat[2])
                self.assertEqual(oauth[1]["Authorization"], "Basic " + credential)
                self.assertNotIn(credential, json.dumps(wire))
                self.assertNotIn(credential, json.dumps(result))
                system, user = wire["messages"]
                self.assertEqual(system, {"role": "system", "content": self.server.SYSTEM_PROMPT})
                self.assertEqual(user["role"], "user")
                expected = {"topic": topic, "essay": body}
                if ids:
                    expected["cards"] = [self.server.CARD_BY_ID[i] for i in ids]
                self.assertEqual(json.loads(user["content"]), expected)
                self.assertEqual(json.dumps(data, ensure_ascii=False), original)
                self.assertEqual(result["unverifiedQuotes"], ["K2"])
                self.assertEqual([r["id"] for r in result["review"]["criteria"]], list(self.server.CRITERIA))
                self.assertEqual(result["review"]["criteria"][1]["quote"], "")
                self.assertNotEqual(result["review"]["priority"], answer["priority"])
                self.assertEqual(result["review"]["criteria"][0]["quote"], "Моё чтение.")

    def test_invalid_selection_is_rejected_before_auth(self):
        for ids in (["student", "doctor", "singers"], ["doctor", "doctor"], ["absent-card"], "doctor"):
            with self.subTest(ids=ids):
                post = Mock()
                with self.assertRaises(self.server.Problem) as caught:
                    self.server.request_review({"topic": "Тема", "essay": "Текст", "key": "demo", "cardIds": ids}, post)
                self.assertEqual(caught.exception.code, "invalid_cards")
                post.assert_not_called()

    def test_editorial_holdout_references_real_books_and_has_two_sided_rubrics(self):
        cases = json.loads(FIXTURE.read_text(encoding="utf-8"))["cases"]
        self.assertEqual(len({c["id"] for c in cases}), len(cases))
        self.assertEqual({len(c["cardIds"]) for c in cases}, {0, 1, 2})
        for case in cases:
            with self.subTest(case=case["id"]):
                self.assertTrue(case["essay"].strip() and case["topic"].strip())
                self.assertTrue(set(case["cardIds"]).issubset(self.server.CARD_BY_ID))
                self.assertTrue(all(case[key] and all(s.strip() for s in case[key])
                                    for key in ("appropriate", "unacceptable")))


if __name__ == "__main__":
    unittest.main()
