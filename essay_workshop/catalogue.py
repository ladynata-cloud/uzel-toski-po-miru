"""Combine the editorial reading shelves used by the online and downloadable editions."""
import json
from pathlib import Path

HERE = Path(__file__).parent
SECTIONS = (
    "Духовно-нравственные ориентиры в жизни человека",
    "Семья, общество, Отечество в жизни человека",
    "Природа и культура в жизни человека",
)
# The initial selection predates the search by section. Keep its stable work IDs.
ORIGINAL_SECTIONS = {
    "doctor": [1, 2], "student": [1, 3], "relics": [1, 2], "captain": [1, 2],
    "samaritan": [1, 2], "ball": [1, 2], "meadow": [3], "singers": [3],
    "last-leaf": [1, 3], "cave-boat": [1],
}


def load_catalog():
    catalog = json.loads((HERE / "catalog.json").read_text(encoding="utf-8"))
    for name in ("classics_library.json", "shelf_library.json", "named_library.json"):
        extra = json.loads((HERE / name).read_text(encoding="utf-8"))
        for key in ("works", "topics", "readings"):
            catalog[key].extend(extra[key])
    topic_sections = {t["id"]: SECTIONS.index(t["section"]) + 1 for t in catalog["topics"]}
    reading_sections = {r["id"]: [topic_sections[r["topic"]]] for r in catalog["readings"]}
    for w in catalog["works"]:
        if "sections" not in w:
            w["sections"] = ORIGINAL_SECTIONS.get(w["id"]) or reading_sections.get(w["id"])
        if not w["sections"] or not set(w["sections"]) <= {1, 2, 3}:
            raise ValueError("Missing section for work " + w["id"])
    topics_by_work = {}
    for t in catalog["topics"]:
        topics_by_work.setdefault(t["work"], t)
    for w in catalog["works"]:
        book = w["id"]
        if book in reading_sections:
            continue
        if w.get("practiceTheme"):
            subsection = w["practiceSubsection"]
            question = dict(id="theme-" + book, title=w["practiceTheme"],
                            section=SECTIONS[int(subsection[0]) - 1], subsection=subsection,
                            work=book, focus=w["secular"])
            catalog["topics"].append(question)
        else:
            question = topics_by_work[book]
        catalog["readings"].append(dict(id=book, topic=question["id"], kind="scene", quote="",
                                        context=w["fact"], secular=w["secular"], orthodox=w["orthodox"]))
    for key in ("works", "topics", "readings"):
        ids = [record["id"] for record in catalog[key]]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate reading shelf entry in " + key)
    catalog["publicTopics"] = json.loads((HERE / "public_topics.json").read_text(encoding="utf-8"))
    subdivisions = {s["id"] for s in catalog["publicTopics"]["sections"]}
    if {t["subsection"] for t in catalog["topics"]} != subdivisions:
        raise ValueError("Workshop practice must cover every published topic subdivision")
    return catalog
