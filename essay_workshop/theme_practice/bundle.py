"""Embed the workshop's original topic-comparison lessons in each edition."""
import json
from pathlib import Path


def planner_script():
    directory = Path(__file__).resolve().parent
    groups = json.loads((directory / "lessons.json").read_text(encoding="utf-8"))
    data = json.dumps(groups, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    return (directory / "planner.js").read_text(encoding="utf-8").replace("/*LESSONS_JSON*/[]", data)
