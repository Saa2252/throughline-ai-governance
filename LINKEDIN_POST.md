# LinkedIn post draft

Replace `[link]` with the hosted URL (GitHub Pages) and `[repo]` with the repository. Lead with a screenshot of the pipeline board or a short screen recording of the blocked-action demo.

---

Most AI governance lives in two places: a policy PDF and a risk spreadsheet.

Neither tells you what happens on Tuesday morning when someone in Finance wants to switch on an AI agent that can raise purchase orders.

So I built the part in between: a working governance workflow, from intake to retirement.

It is called Throughline, it is open, and you can try it in your browser: [link]

A few choices I made, and why:

→ Regulation is the floor, not the ceiling. That procurement agent is not "high-risk" under the EU AI Act. The workflow still rates it Critical, because it acts alone and spends money.

→ Low-risk work gets a fast lane. A handful of attestations, one sign-off, two-day target. If governance is slow for everything, people bypass it for everything.

→ Owners propose the risk tier, an independent function confirms it. They can escalate. They cannot downgrade.

→ Nobody approves their own use case. Switch roles in the demo and try. The engine refuses and tells you why.

→ Agents go through the same gates, with more asked at each. The approval covers a specific tool list at a specific autonomy level. Add a tool or raise the autonomy and the approval is void.

→ Approval is not the end. A serious incident pauses use. A material change voids the approvals and reopens triage.

→ Every action goes into a hash-chained audit log. Edit one entry and the chain breaks.

→ The whole policy is one data file. Tiers, thresholds, approvers, 25 controls with pointers to NIST AI RMF, ISO/IEC 42001 and the EU AI Act. Change the file and the rules change with it.

It is a reference implementation, not a compliance tool and not legal advice. But it is concrete enough to argue with, which is what I want.

What would you change for your organisation?

Code: [repo]

#AIGovernance #ResponsibleAI #EUAIAct #NISTAIRMF #ISO42001
