# Literary workshop editorial priority

## Identity

- Task: `LITERARY_EDITORIAL_PRIORITY_20261118`
- Owner: repository owner
- Date: 2026-11-18
- Base branch: `main`
- Base SHA: `81a4128156d588eff101384c423a90d2bca34046`
- Planned branch: `codex/uzel-editorial-priority-20261118`
- Review level: `MEDIUM`
- Related ADR: none; existing static publication architecture is preserved.

## Goal

Make the first-priority literary materials clearer and more specific, and place
accurate, directly linked spiritual quotations beside the literary discussion.

## Context and evidence

The 2026-11-18 audit scanned 549 generated pages and closely read twelve diverse
pages. It found abstract school commentary, repeated reading instructions, an
outdated painting source, and one incorrectly marked quotation omission.
All 26 registered spiritual excerpts were compared with the eight topic pages
of the owner's required Biblioteka3 collection. Twenty-four workshop/article
pages need a visible quotation and its own contextual comment.

The owner approved the reported first-priority changes with “выполняй правки
первой очереди”. This is the start authorization for this bounded task.
The separately open homepage PR #6 is not part of this task.

## Approved scope

### In scope

- Correct the complete Macarius excerpt's omission marker.
- Add a verified quotation, exact attribution, direct topic-page link and
  separately labelled literary comment to the six identified workshop pages
  and eighteen newer workshop/article pages.
- Preserve the single approved spiritual source, words, punctuation and
  attribution; avoid assigning every work the same general quotation.
- Replace the identified abstract school passages with specific observations
  and answerable literary questions, preserving age and work boundaries.
- Shorten repeated instructions and optional music descriptions.
- Correct the painting source that no longer matches the peace essay.
- Build and check the existing site for both supported URL configurations.

### Out of scope

- Homepage redesign, exam requirements, new courses, changed learning data,
  changing illustrations/music, or new external source collections.
- Publishing, merging, changing deployment configuration, or requesting search
  engine indexing before an authorized release.

### Files or areas that must not change

- Existing public routes, student answer/download controls and data storage.
- Exact quotation wording, except an explicitly sourced correction.
- Artwork files, unrelated articles and existing repository instructions.

## Acceptance criteria

- [x] All 24 identified materials contain a directly sourced quotation and
      a comment tied to that literary text.
- [x] Registered wording and attribution still match the approved collection.
- [x] The Macarius fragment is no longer presented as an incomplete excerpt.
- [x] Reported abstract passages and the mismatched artwork source are fixed.
- [x] Repeated help stays available without crowding out each work's task.
- [x] Existing builds and site verification pass without weakened gates.
- [x] The final source diff is reviewed; generated deployment output is checked
      without an unrelated bulk update of the archived `dist` directory.

## Checks and gates

- Required tests: `build.py` and `verify_site.py` with the custom domain and the
  default GitHub Pages project path; existing JavaScript syntax checks.
- Required static checks: Python syntax, `git diff --check`, quotation/link
  comparison against the approved source, targeted generated-page inspection.
- Manual checks: contextual fit of all added quotations, school readability,
  attribution and source layout, and representative mobile/desktop rendering.
- Final gate marker: `LITERARY_EDITORIAL_PRIORITY_READY` only after passing.
- Not run: production release and post-release checks before merge permission.

## Review plan

- Medium review because shared templates affect many generated pages.
- Focused independent review of changed source, quotation use and resulting
  page structure; no external-provider verdict is claimed.
- Only public sources and the relevant patch belong in handoffs.

## Risk and rollback

- Main risks: a generic spiritual comparison, lost source attribution,
  generated-link regressions, and excessive collapse of useful help.
- Rollback: revert this task's source commit and rebuild after authorization.
- No route, storage or account compatibility changes.

## Permissions

- Current task start, branch, local commit, push and Draft PR: authorized.
- Merge, auto-merge and deployment: not authorized by the current task start;
  separate explicit owner authorization is required by the instructions supplied
  for this conversation.
- Force operations, reset, rebase and weakened gates: not authorized.

## Execution record

- Actual branch: `codex/uzel-editorial-priority-20261118`
- Actual base SHA: `81a4128156d588eff101384c423a90d2bca34046`
- Independent internal editorial review found no blocking issue; its two wording
  suggestions were incorporated. This is not an external-provider review record.
- Both URL configurations built 549 pages and passed `verify_site.py`: 21,044
  internal links/assets, 272 supplementary articles, 26 quotation fragments;
  zero errors. Both existing JavaScript syntax checks and Python syntax passed.
- All 26 quotation texts, attributions, work links and omission boundaries match
  the eight approved source pages retrieved on 2026-11-18.
- Final generated HTML independently checked: 24/24 new quotation blocks;
  187/187 school and 272/272 supplementary help disclosures. Every new disclosure
  has one leading summary, its specific task outside, and no source link inside.
  Five older source disclosures retain the same 38 links in the same order.
- `git diff --check` passes. Archived `dist` and public routes are unchanged.
- Browser rendering NOT RUN: the local Chromium process exits before any page
  loads (`socket() Operation not permitted`). The connected browser also rejected
  a self-contained preview URL under its protocol policy. No browser protection
  or test was changed. HTML checks do not establish visual layout correctness.
- Static/content validation is complete; the final ready marker is withheld
  until representative desktop/mobile rendering is checked in a suitable
  environment. The branch is suitable for a Draft PR with this limitation.
- Reviewed head and PR are recorded in the completed PR handoff.

## Required handoff

```text
EXECUTIVE STATUS

Task:
PR:
Base:
Head:
Gate:
Tests:
Failures:
Not run:
Scope deviations:
Recommendation:
Next user decision:
```
