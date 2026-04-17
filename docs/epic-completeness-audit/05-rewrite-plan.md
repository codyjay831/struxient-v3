# Rewrite plan

Minimum work needed so the epic library becomes build-trustworthy.

---

## Keep as-is (no changes needed)

These epics are implementation-complete or sufficiently detailed for their scope.

| # | Epic | Reason |
|---|------|--------|
| 01 | Leads | Reference quality |
| 02 | Customers | Strong CRM epic |
| 05 | Notes & timeline | Good cross-cutting spec |
| 06 | Files / photos | Good cross-cutting spec |
| 20 | Assemblies / rules | Secondary system, adequately scoped |
| 21 | AI packet authoring | Adequately scoped with commit wall |
| 22 | AI quote drafting | Adequately scoped with commit wall |
| 26 | Skeleton tasks | Simple sub-object, adequate |
| 27 | Completion rules | Config sub-panel, adequate |
| 28 | Detours / loopback | Runtime concept, adequate |
| 29 | Hold model | Runtime overlay, adequate |
| 30 | Start eligibility | Core computation, well-specified |
| 33 | Activation | Transaction spec, adequate |
| 35 | Runtime task instances | Materialization spec, adequate |
| 36 | Effective snapshot merge | Projection spec, adequate |
| 37 | Change orders | Post-activation delta, adequate |
| 38 | Inspection model | Folded model per decision 03, adequate |
| 39 | Work station / feed | View spec with sections and filters |
| 40 | Node / job views | Board view spec, adequate |
| 41 | Task execution UX | Critical field UX, well-specified |
| 42 | Evidence / photos | Capture spec, adequate |
| 43 | Mobile field execution | Cross-cutting constraint doc |
| 44 | Office-to-field handoff | Handoff record spec, adequate |
| 45 | Scheduling (MVP) | Deliberately scoped with decision 01 alignment |
| 46 | Schedule blocks | Block model, adequate |
| 47 | Payment gates | Notably strong with satisfaction semantics |
| 48 | Payment + operational holds | Integration glue, adequate |
| 49 | Cost / actual events | Append-only model, adequate |
| 50 | Time tracking | Labor entries with approval, adequate |
| 51 | Variance / margin | Read-only analytics, adequate |
| 52 | Learning feedback | Suggestion inbox, adequate |
| 53 | Customer portal | Portal shell, adequate |
| 54 | Portal quote review/sign | Portal signing, adequate |
| 55 | Portal structured inputs | Portal input collection, adequate |
| 56 | Notifications | Cross-cutting, good |
| 57 | Audit / history | Cross-cutting, good |
| 58 | Search / filtering | Cross-cutting, adequate |
| 59 | Permissions / roles | Infrastructure, adequate |
| 60 | Admin settings | Control plane, adequate |

**Count: 40 epics** — no work needed.

---

## Lightly expand (add missing sections, fill tables)

These epics are structurally sound but need specific sections fleshed out — typically field definitions tables, permissions tables, edge cases, or mobile behavior.

| # | Epic | What to add | Effort |
|---|------|-------------|--------|
| 03 | FlowGroup | Field definitions table for address fields; mobile capability table; 2-3 more edge cases | Small |
| 04 | Contacts | Field definitions table; polymorphic parent implementation guidance; mobile tap-to-call detail | Small |
| 09 | Quote line items | Field definitions table (money, quantity); edit behavior detail; mobile behavior | Small |
| 10 | Proposal groups | Field definitions table; permissions note expansion; default group auto-creation detail | Small |
| 13 | Signatures | "Record signature" dialog detail; portal signing UX cross-ref; offline sign policy | Small |
| 14 | Quote change/revision | Compare-versions UX expansion; void confirmation flow; carry-forward checkbox detail | Small |
| 16 | Packet task lines | Node picker UX detail; field max-lengths; detail drawer content | Small |
| 17 | Task definitions | Field definitions table expansion (currently 2 lines) | Small |
| 18 | Structured inputs | Split UX guidance: authoring vs quote-time vs portal vs execution-time behaviors | Small |
| 19 | Packet tiers | Picker UX expansion; compare-tiers preview detail | Small |
| 24 | Nodes | Canvas placement UX guidance (can be brief if 23 covers editor layout) | Small |
| 25 | Gates | Gate editor modal detail; expression language decision | Small |
| 31 | Generated plan | Manual plan task creation UX; plan preview table detail | Small |
| 32 | Execution package | Compose summary UX in send modal | Small |

**Count: 14 epics** — light touch, typically adding 1-3 sections.

---

## Heavily rewrite (full expansion to writing standard)

These epics need substantial new content to become implementation-complete. They are the highest-risk epics in the library.

| # | Epic | What must change | Effort |
|---|------|-----------------|--------|
| **07** | **Quotes (shell)** | Full rewrite. Every section needs expansion. Create flow, list view, detail page, edit, archive, delete, restore, field definitions, permissions, mobile, edge cases — all need to match Leads-level depth. | **Large** |
| **34** | **Job anchor** | Heavy expansion. Job list UX, job detail page layout, status transition table, cancel/restore flow, field definitions, permissions, mobile. | **Large** |

**Count: 2 epics** — substantial rewrite.

---

## Expand with implementation supplement

These epics are correctly scoped as "orchestrator" or "authoring surface" epics, but the authoring/editing UX they describe needs more specification. Rather than distorting the epic into a giant product doc, create a paired supplement that defines the screen layout and interaction patterns.

| # | Epic | Supplement | What the supplement covers |
|---|------|-----------|--------------------------|
| **11** | Quote editing (draft) | `11A-quote-editor-layout-supplement.md` | Editor screen layout: header bar (version badge, save indicator, Send button), left panel (group tree), center panel (line grid), right rail (validation/compose/structured inputs). Navigation routing rules (deep link → latest draft or latest sent). Autosave indicator states. Preflight error/warning display locations. |
| **23** | Process templates | `23A-template-editor-layout-supplement.md` | Template editor screen layout: canvas area, node inspector panel, gate editor modal, toolbar (add node, add gate, validate, publish), node list sidebar. How the user creates and connects nodes. How the inspector panel works. How publish validation results are displayed. |
| **15** | Scope packets | `15A-packet-editor-layout-supplement.md` | Packet editor screen layout: Overview tab content, Tiers tab (matrix or list), Task Lines tab (grid with node picker), Checkpoints tab, History tab (revision list with diff), Where Used tab (quote/line count). Publish flow confirmation. Deprecation flow. |
| **08** | Quote versions | `08A-version-ux-supplement.md` | Version history list layout within quote detail. Version header display (status badge, dates, totals). Version switching UX. Read-only sent version layout. Comparison view (optional, can ref 14). |
| **12** | Quote send/freeze | `12A-send-confirmation-ux-supplement.md` | Send confirmation modal layout: summary section (totals, template, line count), warning list with acknowledge checkboxes, error list (if blocking), Send button states. Progress indicator ("Sending..."). Success state (toast, redirect, celebration). Failure recovery UX. |

**Count: 5 supplements** — focused UX specs paired with existing epics.

---

## Split into two epics

No epics need splitting. The current epic boundaries are canon-correct.

---

## Rewrite plan execution order

### Phase 1: Slice 1 critical path (do now)

1. **Rewrite epic 07** — Quotes shell
2. **Write supplement 11A** — Quote editor layout
3. **Write supplement 08A** — Version UX
4. **Write supplement 12A** — Send confirmation UX
5. **Lightly expand epic 09** — Quote line items (field definitions)
6. **Lightly expand epic 10** — Proposal groups (field definitions)

### Phase 2: Catalog authoring (do before catalog build)

7. **Write supplement 15A** — Packet editor layout
8. **Write supplement 23A** — Template editor layout
9. **Lightly expand epics 16, 17, 18, 19** — Catalog sub-objects

### Phase 3: Runtime / execution (do before job/execution build)

10. **Rewrite epic 34** — Job anchor
11. **Lightly expand epic 03** — FlowGroup
12. **Lightly expand epics 13, 14** — Signatures, revisions
13. **Lightly expand epics 24, 25, 31, 32** — Template sub-objects, plan/package

### Phase 4: Supporting objects (do when those epics enter implementation)

14. **Lightly expand epic 04** — Contacts

---

## Rewritten epic delivery

For Phase 1, the following rewritten/supplemented files will be created in `06-rewritten-epics/`:

- `07-quotes-epic.rewritten.md` — Full rewrite
- `34-job-anchor-epic.rewritten.md` — Heavy expansion
- `11A-quote-editor-layout-supplement.md` — New supplement
- `08A-version-ux-supplement.md` — New supplement
- `12A-send-confirmation-ux-supplement.md` — New supplement
