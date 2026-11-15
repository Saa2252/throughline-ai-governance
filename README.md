# Throughline

**An AI governance workflow that takes a use case from first idea to retirement.**
Tiered by risk, gated by evidence, decided by named people, and recorded so it can be proven later.

Most AI governance material is a policy PDF or a risk spreadsheet. This is the missing piece between them: the *workflow* that makes a policy actually happen, as a working product any organisation can open, try, and adapt.

No build step, no server, no dependencies. Open `index.html`, or host the folder on GitHub Pages.

```bash
python3 -m http.server 8765   # then open http://localhost:8765
node test.js                  # 21 tests on the rules engine
```

## What it does

| Gate | Stage | The question it answers |
|---|---|---|
| G1 | Intake | What is it, and who owns it? |
| G2 | Triage | How much governance does it need? |
| G3 | Assessment | Is the evidence there? |
| G4 | Decision | Who accepts the risk? |
| G5 | Go-live | Are the conditions actually met? |
| ↻ | Monitoring | Is it still behaving, and still the same thing? |

The demo opens with nine fictional use cases spread across every stage, two of them agents, including one blocked as a prohibited practice and one that no regulation names but the workflow still treats as Critical. Use the **Acting as** switcher to play each role and try to break the rules: the engine will refuse and tell you why.

## Design decisions

1. **One front door.** Every use case enters the same way, including the vendor feature someone just switched on. The inventory is a by-product of the workflow rather than a separate spreadsheet that goes stale.
2. **Regulation is the floor, not the ceiling.** Triage runs two tests: the EU AI Act classification (prohibited, high-risk, transparency duties) and a five-factor impact score that applies to everything. The law can only raise the tier. An autonomous purchasing agent is not in Annex III, and is still Critical.
3. **Proportionate by default.** Three tiers, three paths. Standard-tier work gets a fast lane: three or four attestations, one sign-off, a two-day target. If governance is slow for everything, people route around it for everything.
4. **Owners propose, the second line confirms.** The people closest to the system classify it; an independent function confirms. That function can escalate a tier with a written reason. It cannot downgrade below what the rules compute.
5. **Nobody approves their own use case.** Approvers are set by tier, never chosen by the requester. Independent validation can only be attested by the validator role.
6. **Evidence, not tick-boxes.** A control closes by pointing at something, or with a written reason it does not apply. Both are logged.
7. **Approval is a state, not an ending.** Reviews fall due on a tier-based cadence. A serious incident pauses use; a material change reopens triage. Either way the previous approvals are void until the gates are passed again.
8. **Provable afterwards.** Every action is appended to a SHA-256 hash-chained log per use case. Change one historic entry and the chain visibly breaks. Each case exports a decision record in Markdown.
9. **Agents get more, not different.** There is no separate agent process to forget about. An agent passes the same six gates with extra requirements at each one (see below).
10. **Policy as data.** Stages, tiers, thresholds, triage questions, approvers and the control library all live in [`policy.js`](policy.js). The engine enforces that file and the "How it governs" page is generated from it, so the description and the behaviour cannot drift apart.

## The agent track

A use case is on the agent track if it is registered as an agent, acts without per-step human approval, or holds a consequential tool. Calling an agent a "system" does not avoid it.

| Gate | What changes for an agent |
|---|---|
| G2 Triage | Records the **tool manifest** and the **autonomy level** (L0 suggests, L1 human approves each step, L2 acts alone with spot-checks, L3 fully autonomous). Consequential tools (writing to systems of record, external messages, spending, running code) make it at least Elevated. Consequential tools at L2 or above make it Critical. |
| G3 Assessment | Up to seven agent controls: tool and permission manifest, agent identity and credentials, action limits and human approval points, kill switch, action trace logging, adversarial testing in a sandbox, memory and delegation rules. |
| G4 Decision | Security always signs. No agent is approved on a single signature. The approval covers that manifest at that autonomy level and nothing wider. |
| G5 Go-live | No fast-lane skip, plus a check that production permissions match the approved manifest. |
| ↻ Monitoring | Reviewed twice as often as the tier requires. A new tool, a wider permission or a higher autonomy level is a material change: approvals are void and triage reopens. |

## Framework anchors

Each stage and each of the 25 controls carries pointers to the frameworks it draws on:

- **NIST AI RMF 1.0** — Govern, Map, Measure, Manage subcategories
- **ISO/IEC 42001:2023** — clauses 5–10 and Annex A control groups
- **EU AI Act (Regulation (EU) 2024/1689)** — Art. 5, Art. 6 and Annex III including the Art. 6(3) exemption, Art. 9–15, 26, 27, 50, 72, 73
- OWASP Top 10 for LLM Applications and for Agentic Applications, for the agent controls
- Three lines of defence, and independent validation from model risk management practice

These are anchors to start from, not a compliance mapping. Verify them against the source texts and your own legal advice before relying on them.

## Files

| File | Role |
|---|---|
| `policy.js` | The governance policy as data. Edit this to make it yours. |
| `engine.js` | Classification, gates, decision rights, audit chain. No DOM; runs in Node. |
| `seed.js` | Demo portfolio, built by replaying real engine actions. |
| `app.js`, `styles.css`, `index.html` | The interface. |
| `test.js` | Tests for the engine. |

## Honest limits

- It is a reference implementation. State lives in the browser's local storage; there is no login, and the role switcher stands in for real identity and access control.
- The hash chain makes tampering *evident*, not impossible. A production system would anchor the chain head somewhere the editor cannot reach.
- The EU AI Act triage is a screening aid. It simplifies the legal tests and does not cover general-purpose AI model obligations or the provider/deployer split in detail.
- Not legal advice.
