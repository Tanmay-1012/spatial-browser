# Spatial Browser History — Comparative Retrieval Study Plan

**Status:** Lead study design for Task 18. Run the pilot only after the study supervisor/institution has approved the participant procedure and the Task 18 readiness gates pass.

## 1. Study question

When people must find a page they visited earlier in a short research session, does the Spatial Browser History tree map help them retrieve it more successfully, quickly, and with less perceived workload than Chrome's built-in History page?

This is a comparison of two retrieval interfaces in the same browser. It is not a claim about all browsing, all users, or every Chrome version.

### Outcomes and hypotheses

- **Primary performance outcome:** Whether the participant reaches the exact target page within 120 seconds.
- **Primary efficiency outcome:** Time from the standardized retrieval instruction to the target page finishing load, among successful trials. Report failures separately; do not pretend a timed-out trial took exactly 120 seconds to succeed.
- **Primary workload outcome:** NASA-TLX Mental Demand rating immediately after retrieval. This directly asks about perceived mental/perceptual effort rather than inferring cognitive load from speed alone.
- **Secondary outcomes:** Other NASA-TLX ratings and raw overall score, number of incorrect task-corpus pages opened during retrieval, participant's preferred tool, and short optional comments.

Pre-register the hypotheses and analysis before participant recruitment: Spatial History will improve success and/or retrieval time and lower Mental Demand. Treat page-open errors and preference as secondary evidence. Define a smallest practically useful time/workload change with the study supervisor rather than choosing the threshold after seeing results.

## 2. Design

Use a **within-subject, counterbalanced comparison**. Each participant uses both tools, so each person serves as their own comparison. Use two different but matched research topic packs so participants do not retrieve the same page twice from memory.

| Condition | Tool | Topic |
| :--- | :--- | :--- |
| A | Standard Chrome History (`Ctrl+H`) | Topic pack X or Y |
| B | Spatial Browser History overview and selected tree | The other topic pack |

Balance both tool order and topic assignment. Use four sequences, assigning participants as evenly as possible (for 12 pilot participants, three per sequence):

1. A/X, then B/Y
2. B/Y, then A/X
3. A/Y, then B/X
4. B/X, then A/Y

This keeps condition, topic, and period from being locked together. Counterbalancing is needed because repeated-measures studies can be affected by sequence and stimulus pairing [Lewis, 1989](https://doi.org/10.1177/154193128903301812).

## 3. Participants and sample size

For the initial run, recruit **10–15 people from the extension's intended audience** (students or researchers who use a desktop browser). Treat this as a **feasibility pilot**, not conclusive proof that the extension is superior. If convenient, use 12 so the four sequences can be balanced evenly. Record only coarse, non-identifying background measures relevant to interpretation: prior Chrome History use and experience with visual maps.

For a confirmatory claim, use the pilot to find procedural problems and estimate variability, set the smallest practically meaningful difference with the supervisor, then run an a priori power analysis for the paired comparison and add expected attrition. Do not select a definitive sample size by rule of thumb or claim that 10–15 participants establish a general effect. G*Power is one established option for planning common behavioral-study tests [Faul et al., 2007](https://doi.org/10.3758/BF03193146).

Get the supervisor's approval for the consent language, recruitment, data handling, and whether institutional review is required **before** collecting participant data. Do not record names, student IDs, browser profiles, or personal browsing histories.

## 4. Task materials

Use two **matched, controlled research mini-sites** rather than live Wikipedia/Amazon pages for the primary comparison. Build stable local pages with realistic titles, short source excerpts, links, and unique facts. This prevents web changes, personalized accounts, ads, and network speed from deciding the result. The task packs can use themes such as solar energy and Olympic history, matching page count, title specificity, link structure, target depth, and target-cue difficulty.

Each pack should contain a landing page and multiple linked source pages that naturally create a visible tree: at least two pages opened from the same parent, one deeper child path, and a same-tab return-and-branch path. The page corpus should include comparable search terms so Chrome History and the extension both get useful search functionality.

Before recruitment, have people outside the study check the two packs for comparable browsing duration and target difficulty. The pack assigned to each tool is counterbalanced. The exact target URL is known to the study controller, but the participant's retrieval prompt identifies it only by a fact or topic cue, not by page title or URL.

## 5. Session procedure

Expected time: about **45–55 minutes** per participant.

1. **Consent and setup (5 minutes).** Use a fresh, disposable Chrome profile with the extension installed and an empty history/map. Close unrelated tabs, sign out of accounts, and use no personal profile. Explain that the study records only pages in the controlled corpus while a study trial is active. Do not use screen/audio recording or think-aloud in the primary study.
2. **Equal familiarization (3–4 minutes).** Give a short practice with unrelated pages in both Chrome History and the Spatial map. Demonstrate only how to open each tool and search. Do not coach a retrieval strategy or point out the study target.
3. **Research round 1 (15 minutes).** Give the assigned topic pack and the same five short fact-finding prompts to every participant. One prompt takes them to the preselected target page around minute 5. After reading it, they close that tab or navigate away and continue the remaining prompts for about 10 minutes. The task script should create branches through ordinary research actions (opening related sources in tabs and following a child page), not by telling them what the map should look like.
4. **Interruption and retrieval (maximum 120 seconds).** At the 15-minute mark, read the same prompt format for everyone: “Using [Chrome History / Spatial Browser History], find the exact page from earlier that mentioned [fact].” Start the study timer immediately after the final word. Stop automatically when the exact target page finishes loading, or record a timeout at 120 seconds. Allow an explicit “give up” action. No hints during the timed period.
5. **Immediate workload rating (about 2 minutes).** Administer the same six NASA-TLX ratings for each condition. Use the standard scale wording and 0–100 ratings; calculate and retain each subscale plus the unweighted Raw TLX summary. The NASA TLX covers Mental Demand, Physical Demand, Temporal Demand, Performance, Effort, and Frustration [NASA TLX](https://www.nasa.gov/human-systems-integration-division/nasa-task-load-index-tlx/). The raw (unweighted) scoring method is described in the [validated human-factors scales repository](https://www.dote.osd.mil/Portals/97/pub/memos/Repository%20of%20Validated%20Scales%20for%20Human%20Factors%20Evaluation_WithCover.pdf?ver=2020-07-02-113412-667). Keep Mental Demand as its own endpoint; do not report only a composite.
6. **Reset (about 4 minutes).** Close the round's pages, clear Chrome History using the browser UI, and clear the extension's normal map while retaining the separate study records. Confirm both tools start the next round empty. This reset must not require adding Chrome's `history` permission.
7. **Research round 2.** Repeat with the other topic pack and other retrieval tool, then administer the workload ratings.
8. **Closeout (3–5 minutes).** Ask one optional tool preference question and one open-ended question about what helped or hindered retrieval. Explain the study purpose and confirm the participant has no remaining questions.

If the target was revisited during the 10-minute interval, mark that trial as protocol-deviant and preserve it in the export. Do not silently discard it; report a sensitivity analysis with and without protocol deviations.

## 6. What can be measured automatically

The current extension already records page visit timestamps, tree IDs, parent/child relationships, tab associations, and download provenance. It does **not** currently provide an explicit study session, task target, timer, trial labels, questionnaire, or study report export.

With an opt-in study mode and the controlled page corpus, the extension can log locally:

- pseudonymous participant code, sequence, period, condition, topic-pack code, and opaque target-page key;
- trial start/end timestamps, elapsed time, success/timeout/abandonment, and whether the target was reopened during the delay;
- top-level navigation events into the known study corpus, with opaque page keys, timestamps, and navigation type/qualifiers;
- count of **incorrect task-corpus page opens** before success, with event details for audit;
- selected Spatial map nodes and coarse map actions (search used, zoom/fit used) during the Spatial condition, without recording search text or mouse coordinates;
- six NASA-TLX ratings and a calculated Raw TLX score.

### Important limit on “misclicks”

The extension cannot see every click made inside Chrome's browser-owned `chrome://history` page, and a page-navigation event does not reveal a person's intent. Therefore, the study must **not** label its automatic count “misclicks.” Call it **incorrect task-corpus page opens**: each top-level load of a known task page other than the target during the timed retrieval window, excluding redirect intermediates, reloads, and same-document/hash changes. Count Back/Forward revisits as page opens and retain the navigation trace. This is an objective, comparable proxy for a wrong result being opened, not a count of every wrong UI click. If literal clicks are essential, a human observer must tally them; this plan intentionally avoids video recording.

The extension can stop the timer when a target tab reports the exact corpus key and finishes loading. It cannot infer attention, confusion, whether someone mentally remembered a path, or whether an unrecorded click was accidental. Those require self-report or observation.

## 7. Export format and privacy

Study mode must be **off by default** and visibly active when enabled. It records no study events until a researcher explicitly starts a session/trial. Store study records separately from ordinary browsing history. Keep all data on-device and provide an explicit local export and delete action; do not send telemetry or automatically upload reports.

Use a fixed corpus allowlist and opaque page keys. Do not export full URLs, query strings, fragments, page contents, names, account IDs, or browser profile paths. Export two local files:

- **`study-trials.csv`** — one row per participant/condition trial, suitable for analysis, with participant code, sequence, period, tool, topic pack, target key, start/end UTC, elapsed milliseconds, success, timeout/abandonment, target revisit flag, incorrect page-open count, six TLX ratings, Raw TLX score, and protocol-deviation flag.
- **`study-events.json`** — event-level audit trace keyed to the same trial, containing elapsed time, event type, opaque page key, navigation type/qualifiers, and coarse extension actions. No raw URL or input text.

Include a short data dictionary in the export or alongside it. Keep an encrypted/approved study copy according to the supervisor's retention instructions; clear local study records after successful export and verification. Study records must not be cleared when the participant clears the ordinary map between rounds.

## 8. Analysis and claims

Freeze the analysis plan before collecting the main pilot. For the 10–15-person pilot:

- report recruitment, sequence balance, protocol deviations, missing trials, and both condition outcomes for every participant using paired plots;
- report success proportions and paired success differences, with uncertainty; keep timeouts distinct from successful retrieval times;
- report median and distribution of successful retrieval times by tool and paired differences for participants successful in both conditions;
- report paired Mental Demand scores and all six TLX subscales, plus the stated Raw TLX summary;
- report incorrect page opens as counts/distributions, not as literal click errors;
- show effect estimates and uncertainty intervals. Do not turn a small pilot's p-value into a broad claim that Spatial History “proves” superiority or reduces cognitive load for everyone.

If the supervisor requires inferential tests for the pilot, preselect them and label results exploratory. For a confirmatory study, plan sample size and analysis in advance based on paired outcomes, handle period/order and topic pack explicitly, define missing/timeout handling, and account for multiple primary outcomes. Usability should be described through task effectiveness, efficiency, and satisfaction in this defined context, consistent with the [ISO 9241-11 framework](https://www.iso.org/standard/63500.html).

## 9. Readiness gates before recruiting

Do not recruit participants until all gates pass:

1. The supplied branch scenario creates actual sibling edges in saved data and the rendered map shows a visible tree, not a line. Verify both the graph model and screenshots; do not paper over a linear graph with decorative lines.
2. Topic packs have equivalent page count, target depth, link opportunities, and pilot difficulty.
3. Study mode is opt-in, corpus-limited, local-only, visibly active, and stores records separately from ordinary history.
4. Retrieval start, target-complete stop, 120-second timeout, abandon, inter-round reset, TLX entry, CSV/JSON export, and deletion have passing tests.
5. The participant-facing script and questionnaire are frozen, supervisor/institution approval is confirmed, and the pilot sequence assignment sheet is prepared.

## References

- NASA, [NASA Task Load Index](https://www.nasa.gov/human-systems-integration-division/nasa-task-load-index-tlx/).
- U.S. Department of Defense, [Validated Scales for Human Factors Evaluation](https://www.dote.osd.mil/Portals/97/pub/memos/Repository%20of%20Validated%20Scales%20for%20Human%20Factors%20Evaluation_WithCover.pdf?ver=2020-07-02-113412-667), Raw TLX procedure.
- Lewis, J. R. (1989), [Pairs of Latin Squares to Counterbalance Sequential Effects and Pairing of Conditions and Stimuli](https://doi.org/10.1177/154193128903301812).
- Faul, F., Erdfelder, E., Lang, A.-G., & Buchner, A. (2007), [G*Power 3: A flexible statistical power analysis program](https://doi.org/10.3758/BF03193146).
- ISO, [ISO 9241-11:2018 — Usability: Definitions and concepts](https://www.iso.org/standard/63500.html).
