# Task 18 — Study Readiness: Repair Visible Branching and Add Private Study Export

**Status:** Assigned — implementation and verification only; participant recruitment is not authorized by this task.  
**Study design:** Follow [`docs/USER_STUDY_PLAN.md`](../../docs/USER_STUDY_PLAN.md) as the lead-approved protocol. Raise a question before changing study measures, privacy boundaries, or task semantics.

## Objective

Prepare the Spatial Browser History extension for a controlled within-subject comparison with Chrome's built-in History. First reproduce and fix the user's report that the map still looks linear. Then add explicit, local-only study instrumentation and downloadable results so a later approved pilot can measure retrieval success, time, workload ratings, and incorrect page opens without screen recordings.

This task does not recruit participants, run a human-subject study, claim that the product is more efficient, or change the published v2.0.0 release.

## Part A — Diagnose and fix the linear-map report

Do not assume this is only a CSS issue. Identify whether the released package produces linear **stored relationships**, or whether valid sibling relationships are being drawn as a line.

1. Build a minimal reproducible navigation scenario using real browser events in a clean profile:
   - Open a research hub page.
   - Open two source/product pages in separate tabs from that same hub.
   - In one tab, navigate hub → Source A → Back to hub → Source B.
   - Include one deeper child under Source A and one completed synthetic download attributed to a source.
2. Record the actual `treeId`, `parentNodeId`, `childNodeIds`, timestamps, and tab associations for each visit. Verify all expected sibling nodes share the correct parent and tree.
3. If the stored graph is wrong, fix the navigation/tracker relationship logic at the actual source. If stored relationships are correct but appear linear, fix graph layout/rendering. Do not synthesize sibling edges for display or alter valid data to make a screenshot look branched.
4. Verify the branch in both desktop horizontal layout and narrow reflow layout. Capture a clean screenshot with the details drawer closed so the complete graph is visible.

## Part B — Build matched study materials

Create two local, synthetic research topic packs (X and Y) described by the study plan. Keep their page counts, link topology, link opportunities, title specificity, target depth, and target-cue difficulty matched. At least one task route must produce multiple children under a shared parent, and another must produce a same-tab sibling branch.

- Serve only local static fixtures; do not depend on public web content, external services, accounts, ads, or network availability.
- Use an allowlist mapping local corpus URLs to opaque page keys. Include a target page reached around minute 5, then a task path that supports about 10 minutes of continued research before retrieval.
- Supply a concise researcher script and participant task cards with equivalent instructions for both packs. Do not reveal target titles or URLs in retrieval prompts.
- Keep the pages realistic enough to resemble research sources, while recording in the report that controlled local content limits generalization to unrestricted web research.

## Part C — Add explicit study mode and trial capture

Implement study mode in the shared extension UI, with Chrome and Firefox parity. Keep it disabled by default and preserve ordinary extension behavior when it is off.

1. Add a researcher-only study controller page/panel with fields for a pseudonymous participant code, one of the four sequences, current period, condition, topic pack, and opaque target key. Keep the target key hidden from the participant-facing retrieval instruction.
2. Add a clear consent/privacy notice, visible “study recording active” indicator, Start, Give up/Stop, Finish Session, Export, and Delete Study Records actions. No name, email, student ID, or free-form personal data field.
3. On Start, record a UTC start timestamp and begin the 120-second deadline. Start is pressed by the researcher immediately after reading the standardized retrieval prompt. Detect successful completion only when a top-level tab reaches the exact target corpus key and reports `status === 'complete'`; record success and end timestamp once. Record explicit give-up and deadline timeout distinctly.
4. During the active timed interval only, record top-level navigations to allowlisted corpus pages and coarse study events. Store event time, trial ID, opaque page key, navigation type/qualifiers, and ephemeral tab key. Do not capture arbitrary URLs, query strings, fragments, page content, typed search terms, mouse coordinates, or navigation outside the allowlisted corpus.
5. Define and label the error metric exactly as the plan does: **incorrect task-corpus page opens**, not “misclicks.” Count each qualifying top-level open of a corpus page other than the target during retrieval; collapse redirect intermediates; ignore reloads and same-document/hash changes; retain Back/Forward destination events. Exclude Chrome internal pages and extension control pages. Include event evidence so the researcher can audit the count.
6. Capture the six NASA-TLX ratings with the official scale anchors after each trial. Store each subscale and compute the Raw TLX summary according to the plan. Do not replace the workload measure with the earlier custom three-word semantic differential.
7. Keep study records in a separate, versioned storage key from the normal history graph. Clearing the map or resetting Chrome browsing history between rounds must not erase study rows. Do not add permissions or network code.

## Part D — Export and reset

Provide an explicit local export action producing:

- `study-trials.csv`: one row per condition trial with the plan's participant/sequence/period/tool/topic/target codes, timestamps, elapsed milliseconds, success/timeout/abandonment, target-revisit and protocol-deviation flags, incorrect-page-open count, six TLX ratings, and Raw TLX summary.
- `study-events.json`: event-level trace with trial ID, elapsed time, event type, opaque corpus page key, navigation type/qualifiers, and coarse extension actions.
- A data dictionary either embedded in a README included with export or linked from the controller.

No exported raw URLs, titles, participant identifiers, input text, user profile paths, or unrelated browsing records. Do not transmit or upload study data. Add an explicit delete action with confirmation. Provide a safe between-round reset checklist that clears Chrome History manually through the browser and clears the normal map while preserving study records; do not request the Chrome `history` permission.

## Constraints

- Do not modify the declared minimum versions, permissions, release tag, normal history schema, download provenance contract, or normal-mode capture behavior unless a concrete requirement is brought to the lead first.
- Do not add telemetry, remote services, auto-upload, video/audio capture, or collection outside an explicitly active study trial.
- Do not describe incorrect page opens as exact misclicks. Chrome does not expose every interaction inside `chrome://history` to the extension.
- Do not recruit participants, use real personal browsing histories, or call any result evidence of efficacy. Participant work begins only after the lead separately approves the supervisor/institution requirements and protocol readiness gates.
- Work on a dedicated `codex/task-18-user-study` branch. Do not merge to `main`, tag, or publish a release before lead review.

## Required Verification

1. Add tests for graph parent/child correctness, same-tree siblings, sibling layout coordinates, and visible branch rendering in horizontal and reflow modes.
2. Add tests for study mode default-off, consent/start state, start/stop/timeout/abandon behavior, exact target detection, wrong-page-open classification, redirect/reload/hash exclusions, Back/Forward events, and session reset without deleting study rows.
3. Add privacy tests proving no study capture when inactive and no raw URL/title/query/search text or non-corpus page appears in exports.
4. Verify CSV escaping, JSON structure, TLX scoring, data dictionary, and delete confirmation with sample synthetic data.
5. Run build/tests and isolated-profile runtime checks in current verified Chrome 157 and Firefox 160. In each, exercise the branch fixture, study controller, both conditions' timer behavior, report export/download contents, inter-round reset, and final cleanup. Clearly report any unavailable scenario; source-level tests do not replace browser runtime checks.
6. Inspect screenshots from the actual released-package baseline before/after fix. For the fixed branch fixture, visually confirm the hub has at least two sibling branches and Source A has a descendant; don't rely on a linear six-node test alone.

## Deliverables

- Source code for the verified graph correction, matched local topic packs, opt-in study controller/capture/export, and tests.
- Build outputs and checksums generated by the normal build.
- Browser E2E logs, pre/post error audits, and branch screenshots for Chrome and Firefox.
- A concise protocol/script/manual reset sheet under `docs/` linked to [`docs/USER_STUDY_PLAN.md`](../../docs/USER_STUDY_PLAN.md), with no invented ethics approval or results.
- `../task-18-output.md` summarizing changes, exact test totals, browser versions, exported sample fields, privacy audit, the user's linear-map reproduction and root cause, screenshots/log paths, limitations, and any step not run.
- Update README and task indexes only to reflect implemented study readiness after evidence exists. Keep the stable v2.0.0 tag and release notes historically accurate.

## Acceptance Criteria

- The reproducible hub → Source A/B scenario stores the correct same-tree sibling relationships, and the shipped map visibly presents those branches in Chrome and Firefox at desktop and narrow widths.
- The two synthetic topic packs create matched, verified target paths and the protocol maps each of the four sequences to the correct condition/topic assignment.
- Study mode captures no data when off; when explicitly active it records the timed trial and allowlisted events only, stops on exact target load or a correctly marked failure, and keeps records separate from normal history.
- The controller gathers the exact NASA-TLX ratings; the downloadable CSV and JSON are complete, parseable, privacy-minimal, and consistent with their data dictionary.
- “Incorrect task-corpus page opens” is operationally defined and tested; no part of the product or report calls it literal misclick count.
- Reset between conditions clears only the expected browser history/map state, preserves the study log, and requires no additional permission.
- Current Chrome/Firefox browser runs, automated tests, both packages, and evidence pass; no participant study is run as part of this task.
- The developer submits the matching output report in the overview folder and waits for lead review before proceeding.
