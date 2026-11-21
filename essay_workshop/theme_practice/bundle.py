"""Embed the workshop's original topic-comparison lessons in each edition."""
import json
from pathlib import Path

from ..topic_books import scene_selection


def planner_script(catalog):
    directory = Path(__file__).resolve().parent
    groups = json.loads((directory / "lessons.json").read_text(encoding="utf-8"))
    works = {work["id"]: work for work in catalog["works"]}
    for group in groups:
        for task in group["tasks"]:
            for route in task["bookSuggestions"]:
                key, alternate = scene_selection(route, works)
                if alternate:
                    route["card"] = key
    data = json.dumps(groups, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    return (directory / "planner.js").read_text(encoding="utf-8").replace("/*LESSONS_JSON*/[]", data)
