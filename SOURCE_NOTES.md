# Узел тоски по миру

Russian-language literature and creative-writing course with a voluntary Orthodox Christian perspective.

## Current edition — 2026-10-09

544 pages: 27 detailed workshops, 187 thematic school blocks with separate reading pages, 272 supplementary literary articles, 11 philosophical essays, 21 human-made artworks and 3 attributed film stills, 8 music records and 26 verified spiritual quotation fragments. Creative examination routes, textbook comparisons, reading lists and source pages remain part of the site.

198 new supplementary articles address the previously uncovered catalogue. They are bounded readings of a named work, chapter or accessible excerpt. 232 of 236 catalogue positions now lead to an analysis; four explicitly await a primary text. A grouped bibliography position is not a claim that all its books have been read. Three actual textbook recommendation lists have 46 corresponding articles; no claim of having processed every textbook edition.

The established corpus underwent editorial reading across 16 content modules (532 heterogeneous records, including cards and expansions). Targeted factual corrections and plainer wording are recorded in `editorial_applied.json`; scope and limitations are in `editorial_audit.json`. Style follows the user's visible conversational voice, not an invented personal biography or an unavailable long-form writing sample.

## Source and build

- `build.py`: templates, original three workshops, home and about pages.
- `content_extra.py`: 24 additional workshops and primary-source links.
- `reading_depth.py`, `depth_primary.py`, `depth_middle.py`, `depth_senior.py`: 374 individually written analytical paragraphs (13,884 additional whitespace-counted words) covering all 187 existing blocks. `reading_pages.py` renders their full pages with direct-source spiritual quotations and links to writing routes.
- `exam_cases.py`: original source passage and six worked writing/speaking examples, explicitly distinguished from official FIPI tasks.
- `school_data.py`, `school_primary.py`, `school_middle.py`, `school_senior.py`: original card content; `school.py`: grade-page rendering.
- `course.py`, `site_sections.py`: existing thematic map, catalogue and editorial page.
- `textbooks.py`: transparent comparison of actual samples from Korovina (grade 5, 2024), Lanin (grade 8, 2022), Kurdyumova (grade 5, 2011), Lanin teacher-guide preview (grade 10, 2024) and publisher description of Klimanova's primary reading line. No claim of full-text access to every line.
- `quote_sources.py`: 26 quotation fragments transcribed from the user-approved source, now displayed through a shared component whose text and attribution link directly to the appropriate biblioteka3.ru topic page; `EDITORIAL_RULES.md`: source restrictions.
- `artworks.json`, `art_library.json`, `illustrations.py`, `art_library.py`: artwork metadata, sources, full-composition reproductions and descriptive captions.
- `music.py`: human compositions and performances linked to official recording pages. No audio copied or generated.
- `philosophy_essays.py`, `philosophy_continued.py`, `philosophy.py`: eleven original general philosophical essays and their index at `/filosofiya/`. Each separates Christian interpretation from scientific claims and conditional models, includes human art and linked recordings, and offers a writing prompt with two literary anchors. Nesterov’s *The Philosophers* accompanies the lead essay; Aivazovsky’s *The Ninth Wave* accompanies hope.
- `exams.py`: six creative routes, including the December final essay in grade 11. The OGE, EGE and oral interview formats are based on FIPI 2027 projects checked 2026-10-02; final essay requirements use 2026/27 materials.
- `dist/assets/style.css`: responsive reading theme; `dist/assets/app.js`: visible draft editing, approximate word count, download and optional WebMCP.
- Run `python build.py`. `dist/` is the deployed static output, tracked with source.

## Editorial principles

Spiritual quotations come only from http://www.biblioteka3.ru/biblioteka/citaty/ and its indexed topic pages. Preserve exact wording and attribution, identify omissions, distinguish original interpretation from quotation. Literary and biblical primary texts are separate sources. Do not infer direct influence from thematic similarity or ascribe Orthodoxy to writers of other traditions.

Only open-ended creative work is rendered. Multiple-choice checks were removed at the user's request. The source retains historical question data but does not display it. Religious agreement is never graded. Exposition preserves the source author's thought; optional spiritual discussion is separate. Each examination genre has its own instructions and evidence requirements.

## Publication and verification

Preserve owner-only access and the existing project ID in `.openai/hosting.json`. Do not publish deferred family photographs or the compiler-permission story. The site contains no generated images or music.

`python verify_site.py` checks all generated routes, local fragment targets, local assets, unique IDs, image alternative text, one H1 per page, catalogue coverage and direct spiritual-source links. `verification_report.json` records the final counts. `quote_verification.json` records exact text and attribution checks against the eight approved source pages after whitespace normalization. Python compilation, JavaScript syntax and git whitespace checks are part of publication validation. New artwork reproductions were visually inspected. External-player playback and browser rendering were not audited in this runtime.

Drafts remain in the visible page, with no server submission or browser-storage saving. Download before leaving. Browser rendering and live WebMCP QA are unavailable for this plain static project in the managed preview infrastructure; optional WebMCP is feature-detected.


## Reading lists added 2026-10-02

`/chtenie/` and seven subpages connect official and editorial reading to the course.
`reading_lists_data.json` retains all 48 OGE table-3 entries and all 66 EGE entries
(OSH1–OSH10 and 1–56), with exact codes, source scope, levels/grades and explicit
workshop choices. `reading_lists_sources.json` records current official archive
URLs and SHA-256 hashes of the freshly downloaded codifiers. Both remain labelled
2027 projects. The Chekhov entry crossing a PDF page was joined; word-break
hyphens were removed while the San-Francisco name hyphen was preserved.

`reading_lists.py` includes 11 final-essay thematic subsections, 12 Russian-language
reading recommendations, oral practice and other creative activities. These
selections are labelled editorial, not official mandatory reading. Seven bounded
additions in `reading_list_extras.py` extend the base course. The Doctor Zhivago
item analyses its beginning; the Tikhon item is a critical reading protocol based
on bibliographic identification, not a claim to have read the full book.
The Smolensk Library poem page was identified through its indexed primary text;
live direct fetching returned HTTP 502 during this pass. No full-book rehosting.

Each codifier entry links to prepared teaching material; corresponding school
readings link back to the exact codifier entry. Coverage of an open author group
means a curated route, not analysis of every work in that group's bibliography.
All 259 pages and local fragment links passed validation after integration;
114 codifier IDs and all 11 thematic IDs were checked. No quiz/radio inputs.

## Supplementary reading added 2026-10-02

`extra_reading.py` publishes 78 supplementary pages (337 total): a 1–11 supplementary
reading hub, a textbook-list hub, three textbook-list pages, three stage-based
catalogues, and 70 scoped close-reading articles. The existing reading hub,
textbook page, school hub, home page and related school units link into this work.

`extra_reading_data.json` contains all 236 bibliographic positions of the official
List 2 for supplementary reading: 69 primary, 105 middle, 62 senior. Source
spelling and age marks are preserved. This is a catalogue, not 236 full analyses.
`extra_reading_sources.json` records its URL, download hash and the actual scope.
Other official lists and every possible textbook edition are not claimed covered.

`textbook_reading_data.py` contains 46 individual directions and creative tasks
from three fully extracted recommendation rubrics: Klimanova grade 4 parts 1–2
(2015, pp. 216–217 and 219) and Lanin grade 5 part 2 (2022, p. 301). The guides
are original, not copied textbook exercises. These older editions are identified
as sources, not presented as the current mandatory curriculum. Uncertain OCR of
a Tolkien title and ambiguity between Turgenev's two texts titled “The Dog” are
explicitly noted. Links to school units indicate related methods, not guaranteed
identity or complete coverage of every work named in a guide.

`extra_reading_essays.py` and `orthodox_textbook_data.py` contain 46 articles,
one per selected textbook-list position. Each explicitly identifies whether it
analyzes a complete short work, several works, selected chapters or an excerpt.
Grouped or anthology entries are not claimed exhaustively read. Primary text,
translation and official author-estate references are linked. Ushinsky's existing
article now also covers “The Postman's Bag”, preserving its established URL.
Georgiev's two selected stories were checked on pp. 7–9 of the photographed 2001
edition; photographs were not copied into the Site. Odoevsky's obsolete medical
assertion retains its WHO correction. Existing human artworks and music are
reused; no generated images, generated audio or new film frames were added.
Ten exact overlaps in the official catalogue link to the relevant article,
with a label limiting coverage to the named work.

Nine spiritual quotations, including three additions, were checked against
saved HTML from the same user-approved biblioteka3.ru topic pages. Every quote
and attribution links directly to its topic page. Leading/trailing omissions
are marked. This verifies fidelity to the chosen web compilation, not to a
critical print edition. Workshop interpretation is separately labelled.

Validation for this extension: all 313 HTML pages passed local path/fragment,
unique-ID, single-H1, image metadata and no-radio-input checks. All 46 textbook
positions have their article links; all 236 official catalogue anchors remain.
Each article has a scope label, a separately labelled workshop interpretation,
and a quotation whose text and attribution both link to biblioteka3.ru.
Nine quote strings and nine attribution strings matched their original saved
source pages after whitespace normalization only. External literary links were
checked; incorrect addresses were replaced with retrieved source addresses.
Build and git whitespace checks passed. No additional browser visual QA claimed.

### Continued catalogue reading, 2 October 2026

`catalogue_reading_essays.py` adds 24 articles: eight primary, ten middle and six
senior recommendations. Each contains four analytical paragraphs, a distinct
workshop interpretation, a verified spiritual quotation, an existing human
artwork with a new comparison, music and an open writing prompt. The catalogue
links to the new articles and each article returns to its exact source row.
There are now 70 supplementary articles and 34 catalogue rows with article links,
including the ten earlier overlaps. This is not full coverage of 236 positions.
Grouped recommendations and selected episodes retain explicit scope labels.

The foreign readings distinguish the original cultural/religious setting from
the workshop's Orthodox interpretation. English originals are linked and readers
are asked to identify their Russian translator before quoting. The new articles
do not reproduce translated passages. Existing human artworks and recordings are
reused without generating media or copying new film frames.

Theophylact's complete quotation on pride was checked with its exact attribution
against the approved `txt06.html` page, bringing the registry to ten entries.
`quote_census.json` records 105 quotation entries across the eight approved topic
pages, the counting method, retrieval date and raw-page hashes. The quote hub
shows the per-topic counts and distinguishes corpus size from quotations used.

All 337 HTML pages passed local URL/fragment, unique-ID, single-H1, image metadata
and no-radio checks. All 236 catalogue anchors and 46 textbook article mappings
remain valid; all 24 new IDs belong to the source catalogue. All ten quotation
texts and attributions matched the retrieved topic HTML after whitespace
normalization. Every supplementary article links both quotation and attribution
directly to its approved source page. Build and git whitespace checks passed.

## Continued catalogue and thematic reading — 2026-10-09

`catalogue_continued_data.json` retains 202 investigated positions, including source URLs, the exact available scope and four unresolved primary-text gaps. `catalogue_continued.py` renders only actual analyses; `catalogue_companions.py` selects existing human art, music and verified quotation fragments. `quote_dialogues.py` adds contextual spiritual reading to selected workshops. `theme_reading.json` places six external essays alongside earlier philosophical themes; these links do not expand the permitted quotation corpus.

Art and music are illustrations and accompaniment, not separate assignments. The site does not generate images or music and does not republish modern book-preview scans. Historical edition notes above retain their original counts and checks.

The former source-reading protocol for Tikhon’s book is now a bounded rhetorical analysis of its authorized introductory excerpt, with the author’s historical claims explicitly distinguished from verified facts.

## Two expanded workshops — 2026-10-09

`workshop_revisions.py` replaces the earlier short treatments of Matryona’s Home and Tolstoy’s A Prisoner in the Caucasus with expanded close readings, direct-source spiritual quotations and literary prompts. Primary text checks are recorded in `matryona_source_review.json` and the linked Tolstoy chapters III, V and VI. Both existing URLs are preserved and featured on the home page; human artwork and music now accompany both.


## Caucasus reading extension — 2026-10-09

`caucasus_reading.py` publishes `/chtenie/tolstoy-kavkaz/`, connecting six finished fictional works: The Prisoner of the Caucasus, The Raid, The Wood-Felling, Meeting a Moscow Acquaintance in the Detachment (The Degraded Officer), The Cossacks and Hadji Murat. Four new full-work close readings were added; The Cossacks and the existing Prisoner workshop were substantially expanded. Diaries, correspondence, drafts and unfinished Caucasian Notes are outside this six-work scope. Sources and reviewed episodes are retained in the individual `caucasus_*.json` files and `prisoner_expanded.json`. Independent editorial review covered every new analytical paragraph and identified corrections now applied.

`village_perspective.json` adds a six-stage account of the different villagers’ positions, with direct chapter links and explicit limits where their responses are not narrated. The settlement is called an aul by Tolstoy but has no stated name and is not identified with Old Atagi.

`prisoner_reading.py` retains the earlier seven themes, restores the observation/inference and cost-of-help questions, and adds Dina's risk, the adult's responsibility, Zhilin's tactics, the mother's perspective, the aul's differing voices and narrative omissions. `caucasus_reception_article.json` distinguishes named critics' interpretations from plot and archival evidence. The documented 1905 Old Atagi letter is not represented as a reaction to the story. The alleged village complaint remains unconfirmed. No new text is represented as a recovery of the user's missing conversation from approximately spring 2025. The repository contains 14 earlier commits but not that dialogue; Personal Context was unavailable.

Nesterov's Philosophers now appears on the Philosophy index and no longer illustrates the Prisoner workshop. Three visually inspected, unaltered stills from Giorgi Kalatozishvili's Georgia-film adaptation (1975) illustrate specific discussions. `caucasus_film_stills.json` keeps the gallery source, official credits, unknown timecodes and the absence of an open licence; the frames are limited visual quotations, not labelled public domain. Two public-domain artworks by Lermontov and Gagarin accompany the other readings. Art and music remain illustrations with no separate assessment tasks.

Existing approved spiritual quote IDs are reused. The biblioteka3 endpoint returned 502 during this pass, so this extension does not claim a fresh comparison of quotation wording. Earlier exact-transcription records remain in `quote_verification.json`. Four catalogue primary texts are still awaited; broad editorial limitations of the earlier 198 articles are unchanged. Browser rendering and external audio playback remain unverified.


## Six exam branches — 2026-10-09

`exam_tracks.py` now renders six existing `/k-sochineniyu/` routes as practical branches: oral interview, OGE Russian, OGE Literature, final essay, EGE Russian and EGE Literature. `exam_track_9.json`, `exam_track_literature.json` and `exam_track_11.json` each hold two branches, with six lessons per branch (36 total), six final practices, source documents, observable learning outcomes, hints and a weak/strong response comparison. Direct FIPI 2027 demo/specification packages were read on 9 October; the project designation is retained. Final-essay criteria use the published 2026/27 documents. No multiple-choice training was added. The Russian branches cover the requested creative components, not the full test syllabus.

Correct distinctions include OGE Literature task 2 (another scene in the same work), task 4 (two supplied poems), EGE Literature task 5 (specified works) versus task 10 (a poem by a different author selected by the candidate), and different writing minima. The final essay needs both mandatory requirements, K1 and K2, and at least one of K3–K5. EGE Russian distinguishes a deficient author-position score from full-essay zero conditions. OGE Russian uses two explained examples from the source in each 13.1–13.3 option.

`exam_argumentation.py` adds the shared `/k-sochineniyu/pravoslavnyy-vzglyad/` guide, distinguishing a personal Orthodox reading, the literary author's position, an exact spiritual quotation and the evidence required by each genre. Existing approved quote fragments are reused, not presented as newly re-transcribed. Agreement with religion is never scored. The former artwork-analysis exercise was removed; paintings and music retain their illustrative role.

The seven preserved sample texts in `exam_cases.py` were read and checked for structure and approximate length. The EGE Literature model now accurately treats Masha's appeal as restoration of Grinyov's freedom and innocence, rather than implying that an unreduced death sentence was still in force. The source paragraph numbering and the independent nature of the oral monologue are explicit.

`dist/assets/exam-practice.js` connects lesson buttons to the existing draft editor without erasing text and adds a 5/2/3-minute practice timer to the oral route. Drafts remain in the open page; download is explicit. No recording, transmission, automatic grading or persistent progress is claimed. Timer behavior is checked with Node VM and virtual clocks; browser rendering and live official-resource availability on the learner's device are not verified in this runtime.

## Exam materials integration — 12 October 2026

The page `/k-sochineniyu/materialy/` groups official downloads and external
practice by examination. `exam_resources_data.json` records 20 FIPI sources,
their years, project/archive status, download sizes and hashes. The review
copies already downloaded contain 40 readable PDFs; they are not republished
on the public site. Download buttons point directly to FIPI. Expert manuals
and comparison sets for 2026 are separated from the 2027 projects.

Four Reshu portals are integrated as attributed external links, including nine
selected writing/analysis collections. Every selected URL was found in its
retrieved subject catalogue. The catalogues show 2026; historical tasks are
not presented as verified 2027 exam materials. The source licence prohibits
republishing tasks and solutions, so no problem bank, explanation or solution
was copied into this repository. The collection descriptions are workshop
instructions. The full content of every external task has not been audited.

All six branches now accept the learner's own answer to an external task.
Its source is saved with the browser draft and included in the downloaded
answer and short email. For a long answer it is included in the file which
the learner must attach manually. Existing drafts without the new source
field remain readable. Source metadata does not affect the draft word count.
The site itself does not transmit email or import external platform results.
