"""Check both editorial perspectives in each family of generated study pages."""
import re
import unittest
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

SITE = Path(__file__).resolve().parents[1] / "dist"
EXAM_ROUTES = {"sobesedovanie", "oge-russkiy", "oge-literatura", "itogovoe", "ege-russkiy", "ege-literatura"}


class LensMarkup(HTMLParser):
    def __init__(self):
        super().__init__()
        self.pickers = 0
        self.scripts = []
        self.alternatives = Counter()
        self.initially_hidden = Counter()

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "select" and "data-reading-lens-picker" in attrs:
            self.pickers += 1
        if tag == "script" and "src" in attrs:
            self.scripts.append(attrs["src"])
        mode = attrs.get("data-reading-lens-only")
        if mode:
            self.alternatives[mode] += 1
            if "hidden" in attrs:
                self.initially_hidden[mode] += 1


class ReadingLensReleaseTest(unittest.TestCase):
    def test_study_page_families_expose_both_perspectives_to_the_reader(self):
        families = Counter()
        for index in SITE.glob("**/index.html"):
            route = index.parent.relative_to(SITE).as_posix()
            if re.fullmatch(r"shkola/\d+", route):
                family = "grade"
            elif re.fullmatch(r"shkola/\d+/(?:unit|tema)-\d+", route):
                family = "lesson"
            elif re.fullmatch(r"masterskaya/[^/]+", route):
                family = "workshop"
            elif route.removeprefix("k-sochineniyu/") in EXAM_ROUTES and route.startswith("k-sochineniyu/"):
                family = "exam"
            elif re.fullmatch(r"filosofiya/[^/]+", route):
                family = "philosophy"
            elif route.startswith("chtenie/razbory/"):
                family = "reading"
            elif route in {"kurs", "praktika-chteniya", "poisk-po-pamyati"}:
                family = route
            else:
                continue
            html = index.read_text(encoding="utf-8")
            if family == "reading" and 'class="reading-prompt"' not in html:
                continue
            if family == "philosophy" and 'id="writing"' not in html:
                continue
            with self.subTest(route=route):
                markup = LensMarkup()
                markup.feed(html)
                self.assertGreater(markup.pickers, 0, "Give the pupil a way to choose the perspective")
                self.assertEqual(sum(src.endswith("/assets/reading-lens.js") for src in markup.scripts), 1)
                self.assertGreater(markup.alternatives["secular"], 0)
                self.assertGreater(markup.alternatives["orthodox"], 0)
                self.assertEqual(markup.initially_hidden["orthodox"], markup.alternatives["orthodox"])
                self.assertEqual(markup.initially_hidden["secular"], 0)
            families[family] += 1
        for group in ["grade", "lesson", "workshop", "exam", "philosophy", "reading",
                      "kurs", "praktika-chteniya", "poisk-po-pamyati"]:
            self.assertGreater(families[group], 0, group)
        self.assertEqual(families["exam"], len(EXAM_ROUTES))


if __name__ == "__main__":
    unittest.main()
