# Spatial Browser History — User Study Protocol & Researcher Script

**Status:** Study protocol for Task 18 readiness. Follow this standardized procedure for the within-subject comparison pilot once supervisor/institutional approval is granted. Do not recruit participants or execute human-subject sessions under Task 18.

---

## 1. Study Materials & Four-Sequence Counterbalancing

Each participant evaluates both retrieval interfaces across two matched research topic packs:
* **Tool A:** Standard Chrome History (`Ctrl+H` / `chrome://history`)
* **Tool B:** Spatial Browser History (Overview cards & Detail tree view)
* **Topic Pack X:** Solar Energy Technology (Local synthetic corpus `px_*`)
* **Topic Pack Y:** Olympic Games History (Local synthetic corpus `py_*`)

To eliminate order, tool, and topic confound effects, participants are allocated across four counterbalanced Latin-square sequences:

| Sequence | Period 1 | Period 2 |
| :---: | :---: | :---: |
| **Seq 1** | Condition A (Chrome) / Pack X | Condition B (Spatial) / Pack Y |
| **Seq 2** | Condition B (Spatial) / Pack Y | Condition A (Chrome) / Pack X |
| **Seq 3** | Condition A (Chrome) / Pack Y | Condition B (Spatial) / Pack X |
| **Seq 4** | Condition B (Spatial) / Pack X | Condition A (Chrome) / Pack Y |

The Study Controller automatically derives and locks the assigned Condition and Topic Pack upon selecting the Sequence and Period.

---

## 2. Standardized Researcher Script & Instructions

### Step 1: Participant Consent & Familiarization (5 minutes)
1. Provide the approved information sheet and consent form. Confirm no personal browsing data, names, or credentials will be collected.
2. Open the designated disposable browser profile. Ensure browser history and Spatial History map are empty.
3. **Familiarization Script (Read verbatim):**
   > *"Welcome. Today you will explore two small research archives to find specific information. In one round you will retrieve a previously viewed page using Chrome's standard History tab, and in another round you will use the Spatial Browser History map. Neither tool is being graded on you; we are evaluating how the interfaces support research retracing. We will give you a brief look at both tools now."*
4. Show how to open `chrome://history` (`Ctrl+H` or menu) and how to open the Spatial History tab from the extension toolbar. Demonstrate only search and navigation. Do not coach any retrieval strategy.

---

### Step 2: Research Round 1 Setup (15 minutes)
1. Hand the participant the **Task Card** for the assigned topic pack (Pack X or Y).
2. The participant opens the local portal `http://127.0.0.1:PORT/study/fixtures/pack_x/index.html` (or Pack Y).
3. The participant works through the 5 fact-finding prompts at their own pace.
4. **Target Page Milestone (Around Minute 5):** Prompt 2 guides them along a Depth 2 traversal (`Hub → Sibling Listing → Target`) to the pre-selected target page (`materials.html` via `perovskite.html` in Pack X; `modern1896.html` via `antiquity.html` in Pack Y). The participant reads the information, closes the tab or navigates away, and continues with Prompts 3, 4, and 5 for the remaining 10 minutes.
5. The researcher observes silently without giving hints.

---

### Step 3: Timed Retrieval Window (Maximum 120 seconds)
1. At the 15-minute mark, the researcher stops the participant.
2. In the Study Controller panel, the researcher selects the Participant Code (format `P01`–`P999`), Sequence (`seq_1`–`seq_4`), and Period (`1` or `2`). Condition and Topic Pack are derived automatically.
3. **Standardized Retrieval Prompt (Read verbatim):**
   * **For Pack X:**
     > *"Using [Chrome History / Spatial Browser History], please find the exact page from earlier that mentioned the specific certified laboratory efficiency record achieved for tandem perovskite-silicon cells in late 2023."*
   * **For Pack Y:**
     > *"Using [Chrome History / Spatial Browser History], please find the exact page from earlier that mentioned the exact number of athletes and competing nations at the inaugural 1896 Athens Olympic Games."*
4. The researcher presses **"Start Timed Retrieval"** immediately upon finishing the last word.
5. The participant searches for and opens the page.
6. **Automatic Stop:** When the exact target page finishes loading in the browser (`webNavigation.onCompleted` / `status === 'complete'`), the extension automatically stops the timer, records the elapsed milliseconds, and flags `success`.
7. **Timeout / Abandonment:**
   * If 120 seconds elapse without reaching the target, the timer expires and logs `timeout`.
   * If the participant explicitly gives up before 120 seconds, the researcher clicks **"Give Up / Stop"**, logging `abandoned`.

---

### Step 4: Immediate NASA-TLX Workload Assessment (2 minutes)
Immediately following the retrieval attempt, administer the six NASA-TLX rating scales (0–100 in steps of 5):
1. **Mental Demand:** How mentally demanding was the task? (Very Low — Very High)
2. **Physical Demand:** How physically demanding was the task? (Very Low — Very High)
3. **Temporal Demand:** How hurried or rushed was the pace of the task? (Very Low — Very High)
4. **Performance:** How successful were you in accomplishing what you were asked to do? (Perfect — Failure)
5. **Effort:** How hard did you have to work to accomplish your level of performance? (Very Low — Very High)
6. **Frustration:** How insecure, discouraged, irritated, stressed, and annoyed were you? (Very Low — Very High)

Record ratings in the controller; the Raw TLX score (unweighted mean) is computed automatically.

---

### Step 5: Safe Inter-Round Reset Checklist (4 minutes)
To reset between Round 1 and Round 2 without deleting the separate study log:
1. **Close all open study tabs** in the browser.
2. **Clear Chrome History:**
   * Press `Ctrl+Shift+Delete` (Clear browsing data).
   * Time range: **All time**.
   * Check **"Browsing history"** only; click **"Clear data"**.
3. **Clear Spatial History Map:**
   * Open the Spatial History tab.
   * Click **"Clear History Map"** in the top-right header and confirm in the dialog.
   * *Note:* This wipes normal history graph nodes and tabState, but **preserves `spatial_browser_study_data` intact**.
4. Confirm both `chrome://history` and the Spatial History overview show 0 items.

---

### Step 6: Research Round 2 & Debrief (15–20 minutes)
1. Repeat Steps 2–5 with the alternate tool and alternate topic pack according to the participant's assigned sequence.
2. Administer the post-round NASA-TLX assessment.
3. Conduct short structured debrief:
   * Single tool preference question: *"For retracing pages in short research sessions, which tool did you find more helpful overall?"*
   * Open feedback: *"What aspects of the interface helped or hindered your retrieval?"*
4. Click **"Finish Session"** in the Study Controller to finalize the researcher session block and record an auditable timestamp.
5. Click **"Export study-trials.csv"** and **"Export study-events.json"** to download the local data.

---

## 3. Participant Task Cards

### Task Card Pack X — Solar Energy Technology
* **Prompt 1:** Open the Solar Energy Portal. Navigate to the Photovoltaic Physics section and read the theoretical Shockley-Queisser single-junction efficiency limit.
* **Prompt 2 (Depth 2 Target Landmark):** Go to Section 2 (Perovskite Crystal Stability & Materials: `perovskite.html`). Follow the link to the laboratory benchmark efficiency record for tandem perovskite-silicon cells in late 2023 (`materials.html`).
* **Prompt 3:** Explore the deeper sub-topics under Tandem Cells (Silicon ingot growth protocols and crystal wafer slicing).
* **Prompt 4:** Return to the main portal and inspect the Thermal Energy Storage section. Review molten salt transition temperatures.
* **Prompt 5:** Follow the link to Grid Interconnection Standards (IEEE 1547 smart inverter controls) and LCOE financial models.

### Task Card Pack Y — Olympic Games History
* **Prompt 1:** Open the Olympic Historical Archive. Navigate to Section 1 (Winter Games Origins) and review the 1924 Chamonix championships.
* **Prompt 2 (Depth 2 Target Landmark):** Go to Section 2 (Classical Origins & Revival: `antiquity.html`). Follow the link to the inaugural 1896 Summer Olympic Games (`modern1896.html`) to note the exact count of participating athletes and represented nations.
* **Prompt 3:** Explore the deeper sub-topics under the 1896 Games (the origin of the modern marathon race and ancient Panhellenic sacred truce at Olympia).
* **Prompt 4:** Return to the main portal and inspect the Adapted Sports History section. Review the 1948 Stoke Mandeville Games and the birth of the Paralympics.
* **Prompt 5:** Follow the link to the Olympic Torch Relay history and Host City Economic Impact infrastructure analyses.
