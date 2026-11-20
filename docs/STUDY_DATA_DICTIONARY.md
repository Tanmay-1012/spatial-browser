# Spatial Browser History — Study Data Dictionary

**Document Version:** 1.0.0  
**Associated Files:** `study-trials.csv`, `study-events.json`  
**Storage Key:** `spatial_browser_study_data` (local-only, separate from `spatial_browser_history_data`)

---

## 1. `study-trials.csv` Schema

Each row corresponds to one condition trial evaluated by a participant.

| Column Name | Type | Description | Valid Values / Format |
| :--- | :---: | :--- | :--- |
| `participant_id` | String | Pseudonymous participant code | `P01` through `P99` |
| `sequence` | String | Counterbalanced sequence identifier | `seq_1`, `seq_2`, `seq_3`, `seq_4` |
| `period` | Integer | Study session block index | `1` or `2` |
| `condition` | String | Experimental retrieval interface condition | `A` (Chrome History) or `B` (Spatial History) |
| `tool` | String | Descriptive name of retrieval tool | `chrome_history` or `spatial_history` |
| `topic_pack` | String | Assigned synthetic topic corpus | `pack_x` (Solar) or `pack_y` (Olympics) |
| `target_key` | String | Opaque allowlisted target page identifier | `px_materials` or `py_modern1896` |
| `start_time_utc` | String | UTC timestamp when retrieval timer started | ISO 8601 string (e.g. `2026-11-20T10:15:00.000Z`) |
| `end_time_utc` | String | UTC timestamp when retrieval trial concluded | ISO 8601 string (e.g. `2026-11-20T10:15:28.450Z`) |
| `elapsed_ms` | Integer | Total elapsed trial duration in milliseconds | Integer $\ge 0$, capped at $120000$ |
| `outcome` | String | Concluding status of retrieval attempt | `success`, `timeout` ($>120$s), `abandoned` |
| `target_revisited_delay` | Boolean | Whether participant revisited target during the 10-minute setup interval | `true` or `false` |
| `protocol_deviation` | Boolean | Whether an experimental deviation occurred during trial | `true` or `false` |
| `incorrect_page_opens` | Integer | Count of non-target allowlisted corpus pages loaded during the timed interval | Integer $\ge 0$ (does not include reloads, hash updates, or redirects) |
| `tlx_mental_demand` | Number | NASA-TLX Mental Demand subscale rating | $0$ to $100$ |
| `tlx_physical_demand` | Number | NASA-TLX Physical Demand subscale rating | $0$ to $100$ |
| `tlx_temporal_demand` | Number | NASA-TLX Temporal Demand subscale rating | $0$ to $100$ |
| `tlx_performance` | Number | NASA-TLX Performance subscale rating ($0=$ Perfect, $100=$ Failure) | $0$ to $100$ |
| `tlx_effort` | Number | NASA-TLX Effort subscale rating | $0$ to $100$ |
| `tlx_frustration` | Number | NASA-TLX Frustration subscale rating | $0$ to $100$ |
| `raw_tlx` | Number | Unweighted arithmetic mean across all six NASA-TLX subscales | Float $0.0$ to $100.0$ |

---

## 2. `study-events.json` Schema

An array of JSON audit objects capturing chronological events during active timed retrieval windows.

```json
[
  {
    "trial_id": "trial_P01_period1",
    "timestamp_utc": "2026-11-20T10:15:00.120Z",
    "elapsed_ms": 0,
    "event_type": "trial_start",
    "page_key": null,
    "navigation_type": null,
    "qualifiers": null,
    "tab_ephemeral_key": null
  },
  {
    "trial_id": "trial_P01_period1",
    "timestamp_utc": "2026-11-20T10:15:12.340Z",
    "elapsed_ms": 12220,
    "event_type": "corpus_navigation",
    "page_key": "px_efficiency",
    "navigation_type": "link",
    "qualifiers": [],
    "tab_ephemeral_key": "tab_1"
  },
  {
    "trial_id": "trial_P01_period1",
    "timestamp_utc": "2026-11-20T10:15:28.450Z",
    "elapsed_ms": 28330,
    "event_type": "trial_success",
    "page_key": "px_materials",
    "navigation_type": "link",
    "qualifiers": [],
    "tab_ephemeral_key": "tab_1"
  }
]
```

### Event Object Field Definitions

* **`trial_id`** (String): Unique identifier linking the event to its trial (`trial_{participant_id}_period{period}`).
* **`timestamp_utc`** (String): Exact ISO 8601 UTC timestamp of event.
* **`elapsed_ms`** (Integer): Milliseconds elapsed since the trial start timestamp.
* **`event_type`** (String): Coarse category of study action:
  * `trial_start`: Timer initiated by researcher.
  * `corpus_navigation`: Top-level navigation committed to an allowlisted corpus page.
  * `extension_search`: User entered search query in Spatial History UI (query text is **omitted** for privacy).
  * `extension_zoom`: User triggered zoom/fit action in Spatial History UI.
  * `trial_success`: Exact target corpus page reached and completed loading.
  * `trial_timeout`: 120-second deadline elapsed without reaching target.
  * `trial_abandoned`: Participant explicitly gave up before deadline.
  * `tlx_submitted`: NASA-TLX workload ratings submitted.
* **`page_key`** (String | null): Opaque allowlisted corpus page key (`px_*`, `py_*`). Off-corpus pages are never tracked.
* **`navigation_type`** (String | null): Browser navigation transition type (`link`, `typed`, `reload`, `back_forward`).
* **`qualifiers`** (Array of Strings | null): Navigation qualifiers (`from_address_bar`, `forward_back`).
* **`tab_ephemeral_key`** (String | null): Pseudonymous ephemeral session tab key (e.g. `tab_1`), avoiding exposure of system-level IDs.

---

## 3. Privacy Guarantees

1. **Zero External Communication:** No study data is transmitted over the network or uploaded to external servers. All data remains in local extension storage until explicitly exported by the researcher.
2. **Corpus Isolation:** Browsing activity outside the predefined local synthetic allowlist (`pack_x`, `pack_y`) is completely ignored and never logged.
3. **No PII or Search Content:** Raw URLs, webpage titles, query strings, fragments, free-form text inputs, mouse coordinates, and personal user identifiers are strictly excluded from all logs and exports.
