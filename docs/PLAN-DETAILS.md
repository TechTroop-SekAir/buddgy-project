# Buddgy — Delivery Plan Details

## Contents

| Section | What's in it |
|---|---|
| [Day-by-Day Schedule](#day-by-day-schedule) | What's active each day, across all three people |
| [Demo Script Outline](#demo-script-outline) | 7-minute slot, mapped to features |
| [Requirement Traceability](#requirement-traceability) | Every bootcamp requirement → ticket |

This is the TA-facing detail behind [`PLAN.md`](./PLAN.md) — the narrative schedule, the demo script, and the requirement mapping `final_project.md` Step 4 asks for. The team's day-to-day reference is `PLAN.md`; this file exists so nothing from that level of detail was lost when `PLAN.md` was simplified to a per-person checklist.

---

## Day-by-Day Schedule

| Day | Date | Focus |
|---|---|---|
| 1 | Sun Aug 9 | Kickoff. A-01/A-02, B-01/B-04, C-01. **API contract in `API.md` reviewed and frozen by end of day.** |
| 2 | Mon Aug 10 | A-03, B-02/B-03, C-01 finishes (empty app deployed both environments) |
| 3 | Tue Aug 11 | A-04/A-05 (against mock), B-05, C-02 starts |
| 4 | Wed Aug 12 | A-06/A-07, B-06, C-02 continues |
| 5 | Thu Aug 13 | A-08, A-09 (client switches to real API), B-07 starts |
| 6 | Fri Aug 14 | A-10 + C-02 converge (Quick Entry), C-03/C-04 start |
| 7 | Sat Aug 15 | A-11 + C-04 converge (CSV import), C-05 starts |
| 8 | Sun Aug 16 | A-12 + C-06 converge (Calendar sync), B-07 finishes |
| 9 | Mon Aug 17 | A-13 (forecast UI), B-08, A-14 (admin), C-07 |
| 10 | Tue Aug 18 | A-15/A-16/A-17, B-09/B-10, C-08/C-09 |
| 11 | **Wed Aug 19** | **FEATURE FREEZE (EOD).** A-18, C-10, cross-track integration testing. No new features merge after today. |
| 12 | Thu Aug 20 | Bug fixes only, seed realistic demo data, slide deck, full demo rehearsal against the promoted environment |

## Demo Script Outline

7-minute demo + 3-minute Q&A (`final_project.md` § Step 6):

1. **0:00–0:45** — Problem statement: budgeting tools look backward, Buddgy looks forward
2. **0:45–2:00** — Live: envelope dashboard, an envelope near depletion (status color visible)
3. **2:00–3:15** — Live: Quick Entry — type a free-text expense, show the AI-parsed confirmation, save it
4. **3:15–4:15** — Live: Calendar sync surfaces an upcoming planned expense, assign it to an envelope
5. **4:15–5:15** — Live: forecast banner shows a projected shortfall with a concrete recommendation
6. **5:15–6:00** — Quick CSV import demo (upload → mapping confirm → imported count)
7. **6:00–7:00** — Technical highlights: 3-person split, external integrations, and one challenge overcome
8. **7:00–10:00** — Q&A

Seed data for this (a demo user with realistic envelopes/transactions/planned expenses) is part of ticket A-18/C-10's Day 12 prep — don't demo against an empty account.

## Requirement Traceability

Every `final_project.md` technical requirement mapped to the ticket(s) that satisfy it:

| Requirement | Ticket(s) |
|---|---|
| React Router | A-02 |
| State management | A-01–A-03, [`STATE.md`](./STATE.md) |
| UI component library (Mantine) | A-01, A-03, [`DESIGN.md`](./DESIGN.md) |
| Responsive design | A-16 |
| Error handling reflected in UI | A-17 |
| Express MVC architecture | B-02–B-05 |
| Authentication & authorization | B-03, B-10 |
| Data validation | B-04, B-05 |
| Unified error handling | B-04 |
| SQL (PostgreSQL) | B-01, B-02 |
| External storage for media | C-07 |
| Deployment | C-01, C-10 |
| External API integration | C-02–C-06 (Claude, Google Calendar) |
| AI integration | C-02, C-03, A-10 |
