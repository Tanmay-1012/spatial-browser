# Spatial Browser History — User Study Runbook

**Purpose:** Step-by-step instructions for preparing, running, and exporting the controlled comparison between Chrome History and Spatial Browser History.

**Approval gate:** This is a ready-to-review pilot protocol, not authorization to recruit or collect human-subject data. Obtain supervisor and institutional approval for consent, recruitment, storage, retention, and analysis first. Do not run participant sessions until that approval is in place.

Use the printable [Researcher Session Sheet](STUDY_SESSION_SHEET.md) to mark prompt timing, resets, deviations, and export checks without duplicating the extension's automatic measurements.

**Recommended pilot:** 10–15 desktop-browser users; aim for 12 so three participants can be assigned to each sequence. The pilot evaluates feasibility and estimates effects. It cannot, by itself, prove that the extension is better for all users or reduce cognitive load in general.

---

## 1. What the study compares

Each participant uses both retrieval tools, once with each of two controlled topic packs:

| Code | Tool used in the retrieval round | Topic pack |
| :--- | :--- | :--- |
| A | Chrome's built-in History page (`Ctrl+H` or `chrome://history`) | Solar Energy or Olympic History |
| B | Spatial Browser History: open the research overview, choose the tree, then use its map | The other topic pack |

The participant browses the pack for 15 minutes, then tries to find one page they saw earlier. Each retrieval attempt is limited to 120 seconds.

**Feasibility point to verify:** Each pack currently contains eight short static pages. The 15-minute browsing interval is inherited from the initial study design; it has not been validated by page count alone. In the researcher dry run, check that the prompt schedule keeps the participant meaningfully engaged, reaches the target near minute 5, and leaves about 10 minutes after first exposure. If the task set is too short, expand both packs in a matched way or revise both setup intervals equally, then update this runbook and obtain any required approval before recruiting. Do not fill a long gap with unstructured waiting or browsing outside the pack.

### Measures

- **Success:** Did the exact target page finish loading within 120 seconds? The CSV stores this in its `outcome` column (`success`, `timeout`, or `abandoned`).
- **Retrieval time:** Milliseconds from pressing **Start retrieval timer** to the target page finishing load. Compare successful attempts; report timeouts and give-ups separately.
- **Workload:** Six NASA-TLX ratings immediately after each attempt. Keep Mental Demand as its own result; also report the six-scale unweighted mean.
- **Incorrect page opens:** Other known pages in the local study pack that finished opening during retrieval. This is an objective proxy; it is **not** a count of every wrong click in Chrome History.
- **Optional researcher notes:** Only note protocol problems or a brief comment if the approved protocol allows it. Do not record names, accounts, screen/audio, or personal browsing.

The extension cannot infer a participant's intent, attention, confusion, or every click inside Chrome's own `chrome://history` page. Do not label its automatic count “misclicks.”

## 2. What you need

### Required

1. **A Windows desktop with Google Chrome** and the current local extension build loaded as an unpacked extension. These UI changes are in the project workspace; the already-published v2.1.0 package does not include them until a later release.
2. **The project folder** at `D:\Projects\HCI Project` for the local study pages.
3. **Python 3** to serve the pages over local HTTP. The extension deliberately ignores `file://` pages.
4. **One dedicated study-only Chrome profile.** Do not sign into a personal or school account, sync personal history, or browse ordinary websites in this profile. The extension's normal map can store page addresses separately from the privacy-limited study export.
5. A participant code list and sequence allocation sheet stored separately from the exported results, if required by the approved study plan.

### No participant downloads are needed

The topic packs are static HTML pages served from this computer. Participants do not download a corpus or install anything. There are no PDF, image, or data-file downloads inside either pack.

The researcher downloads result files after the study. Those exports are `study-trials.csv`, `study-events.json`, and optionally `STUDY_DATA_DICTIONARY.md`.

If the study computer does not already have the needed software, use Google's [Chrome download instructions](https://support.google.com/chrome/answer/16738344?hl=en) and the official [Python for Windows downloads](https://www.python.org/downloads/windows/). To build the extension from source, use the official [Node.js download page](https://nodejs.org/en/download/) as well.

## 3. Prepare the study computer

### A. Build and load the current extension

If a study-only profile does not exist yet, in Chrome open the profile menu at the top right, choose **Add Chrome profile**, give it a neutral name such as **Study**, and continue without a Google account. Google explains how separate profiles isolate history and settings in its [Chrome profiles guide](https://support.google.com/chrome/answer/2364824?hl=en). Do not use Guest or Incognito for this procedure.

From PowerShell, in the project folder:

```powershell
cd "D:\Projects\HCI Project"
npm.cmd run build
```

In the dedicated study Chrome profile:

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. If the project build has not been loaded before, choose **Load unpacked** and select `D:\Projects\HCI Project\outputs\chrome\unpacked`.
4. If it is already loaded from that folder, click its **Reload** button after rebuilding.
5. Click the extension toolbar button once. It opens or focuses the Spatial Browser History page in a regular browser tab.

These steps use Chrome's documented [Load unpacked extension flow](https://support.google.com/chrome/a/answer/2714278?hl=en).

Do not use the public v2.1.0 download for this study run if it still has the old controller screen. The current working-copy build is the version this runbook describes.

### B. Start the local study pages

Open a **second** PowerShell window in the same project folder and run:

```powershell
py -m http.server 8000 --bind 127.0.0.1 --directory study/fixtures
```

Leave this window running for the entire session. It will show page requests as participants browse. Stop it after the study with **Ctrl+C**.

If `py` is not recognized but `python` is available, run:

```powershell
python -m http.server 8000 --bind 127.0.0.1 --directory study/fixtures
```

If port 8000 is already in use, change `8000` to `8001` and replace `:8000` with `:8001` in every link below. The server and Chrome must be on the same computer because the extension accepts only local loopback pages.

### C. Verify the two portals

With the server running, open both links once before participant sessions:

- [Pack X — Solar Energy portal](http://127.0.0.1:8000/pack_x/index.html)
- [Pack Y — Olympic History portal](http://127.0.0.1:8000/pack_y/index.html)

Confirm each page loads and the links open other pages in that same tab. Do not use `file://` links. For a research session, open only the pack assigned to that participant and round.

### D. Clean the dedicated profile before the first participant

1. Close unrelated tabs.
2. Open `chrome://history`, clear **Browsing history** for **All time**.
3. Open Spatial Browser History, choose **Clear Map**, and confirm.
4. Leave the separate **Study Mode** records alone. Do not click **Delete saved study data** during collection.
5. Confirm Chrome History and the extension overview are empty before starting.

Use this profile only for the controlled pages and the two retrieval interfaces. The ordinary map stores visited addresses while the extension is enabled; the research export is more restrictive, but it does not change that separate map behavior.

## 4. Assign the participant's order

Assign one sequence per participant. Keep the order balanced as recruitment proceeds. For a 12-person pilot, assign three participants to each sequence; for 10–15 people, keep the four counts as even as possible and report the final counts.

| Controller choice | Round 1 | Round 2 |
| :--- | :--- | :--- |
| **1** | Chrome History + Pack X (Solar) | Spatial Map + Pack Y (Olympics) |
| **2** | Spatial Map + Pack Y (Olympics) | Chrome History + Pack X (Solar) |
| **3** | Chrome History + Pack Y (Olympics) | Spatial Map + Pack X (Solar) |
| **4** | Spatial Map + Pack X (Solar) | Chrome History + Pack Y (Olympics) |

The Study Mode panel displays the assigned tool and pack after you choose the sequence and round. Do not change the tool or pack independently; they are a matched assignment.

Use unique pseudonymous codes such as `P01`, `P02`, … `P999`. Do not put a name, email, student number, or other identifying text in the extension. Keep any code-to-person list separate and protected according to the approved protocol.

## 5. Session schedule and facilitator script

Plan about **50–60 minutes** per participant. Use the same wording, timing, help policy, and reset for everyone.

### Part 1 — Consent and orientation (about 8 minutes)

1. Obtain consent using the approved materials. Explain that the study compares interfaces, not the participant's ability.
2. Read:

   > “You will browse two small research archives and later find a page you visited earlier. One retrieval round uses Chrome History and one uses Spatial Browser History. We are evaluating the tools, not grading you. Please use only the pages provided. I will not give hints during the timed retrieval. You may stop at any time.”

3. Show how to open Chrome History and how to open Spatial Browser History. For the spatial tool, demonstrate only opening a tree and selecting a page. Do not show the assigned target page, cue, route, or recommended retrieval strategy.
4. Add this consistent navigation instruction: **“Follow only the links named in each task, and use the portal link when I ask you to return. Please do not open other links unless a task asks you to.”** This prevents a cross-link from revealing the target before Task 2.
5. Do not begin the timed retrieval or turn on recording during orientation.

### Part 2 — Configure Round 1 (before browsing)

1. Open the extension's Spatial Browser History tab and choose **Study Mode**.
2. Enter the participant code, choose the allocated order, and leave **Round 1** selected.
3. Read the assignment summary aloud only if needed for the researcher. Give the participant the assigned pack's portal link below.
4. Do **not** press **Start retrieval timer** yet. The 120-second clock is only for the later page-finding attempt.

### Part 3 — Fifteen-minute browsing activity

Use a visible clock. Read one prompt at each time below; do not hand out the later target cue early. Ask the participant to read the relevant page and give a short verbal answer. Keep all browsing inside that round's pack.

| Time from opening portal | What the researcher does |
| :--- | :--- |
| **00:00** | Read Task 1 for the assigned pack. |
| **03:30** | Read Task 2. This leads to the target page; allow the participant to find and read it. Aim for the target to be reached around minute 5. |
| **05:00** | Read Task 3. The participant should navigate away from the target and continue exploring. |
| **08:00** | Read Task 4. |
| **11:00** | Read Task 5. |
| **15:00** | Ask the participant to stop browsing. Begin timed retrieval immediately. |

If a task is finished before the next time cue, say: **“Please re-read the page and check your answer. I will give you the next task at the scheduled time.”** Do not suggest another page or path. Note any substantial idle time as a feasibility problem. If the target has not been reached near minute 5, or the participant opens it again after the first visit, record the issue under **Protocol notes** before starting the timed trial.

### Part 4 — Timed retrieval (maximum 120 seconds)

1. In Study Mode, confirm the participant code, assigned sequence, and current round. The displayed summary must match the tool and pack they just used.
2. Read the retrieval prompt for the target pack (below), inserting the assigned tool name.
3. Immediately after the last word, click **Start retrieval timer (max 2 min)**. The controller closes; the recording banner and timer continue. The participant can now use the assigned retrieval tool.
4. For **Chrome History**, the participant may use `Ctrl+H` / `chrome://history` and its ordinary search and navigation. Do not open the target URL for them.
5. For **Spatial History Map**, open/focus the extension tab, select the research tree for the assigned portal, then let the participant search or explore the map independently.
6. The extension stops automatically when the exact target page finishes loading, and records success and elapsed time. If two minutes pass first, it records a timeout. If the participant says they want to stop earlier, click **Participant gives up** in the active banner or Study Mode panel.
7. Do not count every click. The automatic secondary count is **incorrect page opens** within the known local corpus; it does not see every action inside Chrome History.

**Pack X retrieval prompt:**

> “Using [Chrome History / Spatial Browser History], find the page you visited earlier that reported the certified tandem perovskite-silicon cell efficiency record measured in November 2023.”

**Pack Y retrieval prompt:**

> “Using [Chrome History / Spatial Browser History], find the page you visited earlier that gave the number of athletes and nations represented at the inaugural 1896 Athens Summer Games.”

Do not tell the participant the target page title or URL. The expected target is `materials.html` for Pack X and `modern1896.html` for Pack Y.

### Part 5 — Workload ratings (about 2 minutes)

After success, timeout, or an early give-up, reopen Study Mode if needed. The six ratings appear only when a round has ended. Ask the participant to rate the attempt that just ended, not the browsing activity as a whole. Read these questions neutrally:

1. **Mental Demand:** How mentally demanding was it?
2. **Physical Demand:** How physically demanding was it?
3. **Temporal Demand:** How hurried or rushed did it feel?
4. **Performance:** How successful do you feel you were? The scale runs from **Perfect** to **Failure**.
5. **Effort:** How hard did you have to work?
6. **Frustration:** How insecure, discouraged, irritated, stressed, or annoyed did you feel?

Set each slider to the participant's response from 0 to 100 in steps of 5. The extension resets the visible sliders to the midpoint for the next round; do not treat the midpoint as a default answer. Click **Save ratings** before changing rounds. The Raw TLX mean is calculated automatically.

### Part 6 — Reset before Round 2 (about 4 minutes)

After saving Round 1 ratings:

1. Close the Pack X/Y tabs.
2. In Chrome, press **Ctrl+Shift+Delete**. Choose **All time**, select **Browsing history only**, and clear it. Do not clear cookies/passwords or change other settings.
3. Return to the extension tab, click **Clear Map**, and confirm. This clears ordinary captured page history and tab trails; it does **not** delete the separate Study Mode records.
4. Confirm `chrome://history` and the extension overview are empty.
5. In Study Mode, select **Round 2**. Confirm the summary shows the other tool and the other pack. Open the new pack's portal.
6. Repeat the 15-minute browsing, retrieval, and workload-rating steps using the Round 2 task set.

Do not click **Delete saved study data** as part of the round reset.

### Part 7 — Debrief and finish

After Round 2 ratings have been saved, ask:

- “Which tool felt more helpful for finding a page you had visited earlier?”
- “What helped or made the task harder in either tool?”

Record only brief non-identifying notes if allowed by the approved protocol. In Study Mode, expand **Finish the session or manage saved study data**, then click **Finish session**. The controller prevents finishing while the last round's workload ratings are unsaved.

## 6. Participant task cards and researcher answer key

Read each task at its scheduled time. The bold answers below are for the researcher; do not show the answer key or target filenames to the participant.

### Pack X — Solar Energy Technology

Portal: [http://127.0.0.1:8000/pack_x/index.html](http://127.0.0.1:8000/pack_x/index.html)

| Task | Read to participant | Researcher route / expected answer |
| :--- | :--- | :--- |
| 1 | “Find the theoretical efficiency limit for a single-junction solar cell and the bandgap associated with it.” | Portal → [Photovoltaic limits](http://127.0.0.1:8000/pack_x/efficiency.html). **33.7%; optimal bandgap 1.34 eV.** |
| 2 (target) | “Find the page about perovskite crystal stability, then follow its related link to the tandem-cell laboratory benchmark. Note the certified efficiency and the month/year.” | Portal → [Perovskite stability](http://127.0.0.1:8000/pack_x/perovskite.html) → [Tandem-cell materials](http://127.0.0.1:8000/pack_x/materials.html). **24.4%, November 2023.** Ask them to leave this page after reading. |
| 3 | “Explore the related reports on silicon wafering and perovskite stability. Find one detail about wafer thickness and one about the stability test.” | From the target, follow links to [Silicon wafering](http://127.0.0.1:8000/pack_x/silicon.html) and [Perovskite stability](http://127.0.0.1:8000/pack_x/perovskite.html); use each page's Portal Index link to move on. **Below 130 microns; over 1,000 hours at 85°C.** Avoid returning to the target page after Task 2. |
| 4 | “Return to the portal and inspect thermal storage. Find the operating temperature range for the two-tank nitrate salt system.” | Portal → [Thermal storage](http://127.0.0.1:8000/pack_x/storage.html). **290°C–565°C.** |
| 5 | “From thermal storage, follow the grid standards link, then inspect the financial model page. Find the inverter standard and one LCOE benchmark.” | [Grid standards](http://127.0.0.1:8000/pack_x/grid.html) → [Solar LCOE](http://127.0.0.1:8000/pack_x/economics.html). **IEEE 1547-2018; below $0.035/kWh** in high-irradiance regions. |

Additional direct links for the researcher: [Pack X portal](http://127.0.0.1:8000/pack_x/index.html), [photovoltaic limits](http://127.0.0.1:8000/pack_x/efficiency.html), [perovskite stability](http://127.0.0.1:8000/pack_x/perovskite.html), [tandem materials target](http://127.0.0.1:8000/pack_x/materials.html), [silicon wafering](http://127.0.0.1:8000/pack_x/silicon.html), [thermal storage](http://127.0.0.1:8000/pack_x/storage.html), [grid standards](http://127.0.0.1:8000/pack_x/grid.html), [LCOE](http://127.0.0.1:8000/pack_x/economics.html).

### Pack Y — Olympic Games History

Portal: [http://127.0.0.1:8000/pack_y/index.html](http://127.0.0.1:8000/pack_y/index.html)

| Task | Read to participant | Researcher route / expected answer |
| :--- | :--- | :--- |
| 1 | “Find the number of athletes, nations, and events at the 1924 Chamonix winter sports week.” | Portal → [1924 Chamonix Games](http://127.0.0.1:8000/pack_y/winter.html). **258 athletes, 16 nations, 16 events.** |
| 2 (target) | “Open the page about the ancient Games and follow its link to the inaugural 1896 Athens Games. Note the number of athletes, nations, and events.” | Portal → [Ancient Games](http://127.0.0.1:8000/pack_y/antiquity.html) → [1896 Games records](http://127.0.0.1:8000/pack_y/modern1896.html). **241 athletes, 14 nations, 43 events.** Ask them to leave this page after reading. |
| 3 | “Explore the related pages about the marathon and the ancient truce. Find the marathon distance and one purpose of the truce.” | From the target, visit [Marathon history](http://127.0.0.1:8000/pack_y/marathon.html); visit [Ancient Games](http://127.0.0.1:8000/pack_y/antiquity.html) and return to the portal from there. **About 40 km; safe passage for athletes, heralds, and pilgrims.** Avoid returning to the target page after Task 2. |
| 4 | “Return to the portal, open the Paralympic origins page, then follow its Olympic torch link. Find when the formal torch relay began.” | Portal → [Paralympic origins](http://127.0.0.1:8000/pack_y/paralympic.html) → [Torch relay](http://127.0.0.1:8000/pack_y/torches.html). **1936 Berlin Olympiad.** |
| 5 | “From the torch page, follow the host-city economics link. Find one contrast between Montreal 1976 and Los Angeles 1984.” | [Host-city economics](http://127.0.0.1:8000/pack_y/economics.html). **Montreal debt took 30 years to retire; Los Angeles 1984 produced an operating surplus.** |

Additional direct links for the researcher: [Pack Y portal](http://127.0.0.1:8000/pack_y/index.html), [1924 winter Games](http://127.0.0.1:8000/pack_y/winter.html), [ancient Games](http://127.0.0.1:8000/pack_y/antiquity.html), [1896 target page](http://127.0.0.1:8000/pack_y/modern1896.html), [marathon](http://127.0.0.1:8000/pack_y/marathon.html), [Paralympic origins](http://127.0.0.1:8000/pack_y/paralympic.html), [torch relay](http://127.0.0.1:8000/pack_y/torches.html), [host-city economics](http://127.0.0.1:8000/pack_y/economics.html).

## 7. Study Mode: what to click

The simplified panel is operated by the researcher:

1. Click **Study Mode** in the extension page.
2. Enter the participant code, choose the assigned order, and select **Round 1** or **Round 2**. The blue summary tells you which retrieval tool and topic pack belong to that round.
3. Run the 15-minute browsing activity without starting the timer.
4. At retrieval, read the prompt and press **Start retrieval timer (max 2 min)** immediately after its last word. The panel closes; the recording banner shows the round and remaining seconds. The timer continues if you switch tabs.
5. If the participant gives up, use **Participant gives up**. Otherwise, the extension stops automatically on target load or at two minutes.
6. Reopen **Study Mode**. Enter and save the six workload ratings. You cannot start the next round until these ratings are saved.
7. Repeat for Round 2. After Round 2 ratings, expand **Finish the session or manage saved study data** and click **Finish session**.

The two checkboxes under **Protocol notes** are optional. Mark the target-revisited checkbox if the participant returned to the target after first seeing it during the 15-minute activity. Mark the other checkbox for another deviation and write a short, non-identifying researcher note separately. These flags do not alter or erase a trial.

## 8. Export and protect the results

Do not clear Study Mode data after an individual participant if you are keeping multiple participants in the same dedicated profile. **Start new session** permits the next participant and preserves earlier trials/events. Continue to use unique participant codes. Clear only Chrome browsing history and the ordinary map between rounds and participants.

After the last participant:

1. Expand **Finish the session or manage saved study data**.
2. Click **Download trials CSV**. Chrome saves `study-trials.csv` to its Downloads folder (or its configured download location).
3. Click **Download event log JSON**. Chrome saves `study-events.json`.
4. Optionally click **Download dictionary** for `STUDY_DATA_DICTIONARY.md`. The dictionary is also in the project at [`docs/STUDY_DATA_DICTIONARY.md`](STUDY_DATA_DICTIONARY.md).
5. Open the CSV and confirm there are two trial rows for each completed participant code, both outcomes are present, and each completed round has TLX values. Open the JSON and confirm each trial has a start event and a terminal success, timeout, or abandon event. Preserve timeouts; do not discard them.
6. Move verified exports to the encrypted, institution-approved storage location. Follow the supervisor's retention period. Only after secure copies have been verified should you delete local Study Mode records or remove the dedicated browser profile.

Chrome may append a suffix such as `(1)` if a same-named file already exists. Check the download timestamp and file contents; do not overwrite a prior export without a verified backup. The extension never uploads the files.

### What the export contains—and does not

- **`study-trials.csv`:** One row per retrieval round; pseudonymous code, sequence/round, tool and topic pack, opaque target key, timestamps, elapsed milliseconds, `outcome` (`success`, `timeout`, or `abandoned`), protocol flags, incorrect page opens, six TLX ratings, and Raw TLX mean.
- **`study-events.json`:** Timed-trial events, timestamps, opaque local page keys, navigation type, and coarse extension actions such as search/zoom. It does not include page URLs, page text, search text, query strings, or off-corpus destinations.
- The export does **not** contain clicks inside Chrome History, screen recordings, or evidence that a participant read a page during the 15-minute activity.
- The separate ordinary map is stored independently and contains browsing history used to draw trees. Keep the study profile isolated, clear that map between rounds/participants, and do not treat the map as the study export.

See [`docs/STUDY_DATA_DICTIONARY.md`](STUDY_DATA_DICTIONARY.md) for every field and its meaning.

## 9. Researcher dry-run checklist

Before inviting anyone, run a complete practice session yourself in a fresh test profile with a test code such as `P999`:

- [ ] Current unpacked build loads in Chrome and Study Mode opens cleanly.
- [ ] Both local portals and their links load from the local server.
- [ ] All four sequence/round assignments match the table above.
- [ ] A sample Pack X and Pack Y target retrieval each stop on the correct target load.
- [ ] A wrong local page increments incorrect-page-open count; off-corpus navigation does not appear in study event export.
- [ ] Timeout and participant-gives-up paths produce distinct outcomes.
- [ ] Workload ratings appear after each trial, save once, and are required before the next round or session finish.
- [ ] Clearing Chrome History and **Clear Map** does not delete Study Mode records.
- [ ] Finishing and starting a new participant session preserves prior participant trial rows.
- [ ] CSV and JSON download to the expected folder and contain the expected two rounds for the test code.
- [ ] Pack instructions and timings fit the intended 15-minute browsing period without hints.
- [ ] The self-run shows the target is first reached near minute 5 and the post-target tasks sustain meaningful activity to minute 15; if not, revise both packs or both setup intervals before recruitment.

Delete the test participant records after verifying the export, then reset Chrome History and the map before the first actual participant. This dry run is a procedure check, not human-subject data collection.

## 10. Analysis and interpretation

Freeze the analysis approach with the supervisor before recruitment. For the 10–15-person feasibility pilot:

- Show each participant's paired outcomes for both tools, with sequence counts and protocol deviations.
- Report retrieval success proportion and uncertainty separately from time. Report successful times as distributions/medians; do not treat a timeout as a successful 120-second retrieval.
- Compare paired NASA-TLX Mental Demand ratings, then show the other five subscales and Raw TLX mean.
- Report incorrect page opens as counts/distributions, clearly described as corpus-page opens rather than literal misclicks.
- Preserve all assigned trials in the main table. If a target was revisited during setup or a deviation occurred, report it and optionally add a clearly labeled sensitivity view.
- Describe the pilot as exploratory. Do not make a broad claim that the extension proves superior or reduces cognitive load for everyone.

The wider research plan and readiness gates are in [`docs/USER_STUDY_PLAN.md`](USER_STUDY_PLAN.md). Recruitment and study execution remain subject to institutional approval.
