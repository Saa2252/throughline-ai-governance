/* Demo portfolio for a fictional organisation. Every case is built by replaying real engine
   actions with back-dated timestamps, so the audit chains are genuine and verifiable. */
(function (root) {
  const node = typeof module !== 'undefined' && module.exports;
  const E = node ? require('./engine.js') : root.ENGINE;

  function SEED(now) {
    const D = E.DAY, cases = [];
    let n = 100;
    const imp = (decision, autonomy, data, scale, reversibility) => ({ decision, autonomy, data, scale, reversibility });
    const ans = (o) => Object.assign({ prohibited: [], areas: [], profiling: false, narrow: false, transparency: [], tools: [], impact: imp(0, 0, 0, 0, 0) }, o);

    function open(daysAgo, intake) {
      const c = E.createCase('UC-' + (++n), 'owner', now - daysAgo * D);
      if (intake) E.act(c, 'submitIntake', 'owner', intake, now - daysAgo * D + 36e5);
      cases.push(c);
      return c;
    }
    const triage = (c, d, a) => E.act(c, 'submitTriage', 'owner', a, now - d * D);
    const confirm = (c, d, p) => E.act(c, 'confirmTriage', 'gov', p, now - d * D);
    function evidence(c, d, only) {
      E.requiredControls(c).forEach((k, i) => {
        if (only && !only.includes(k.id)) return;
        E.act(c, 'setControl', k.by || 'owner', { id: k.id, status: 'done', note: 'Evidence pack §' + (i + 1) + ', governance workspace' }, now - d * D + i * 6e5);
      });
    }
    const sign = (c, d, role, p) => E.act(c, 'sign', role, Object.assign({ decision: 'approve' }, p), now - d * D);

    // 1. Standard tier, fast lane, live
    let c = open(21, { name: 'Meeting notes summariser', kind: 'AI system or model (produces output for people)', euRole: 'Deployer (we use AI someone else built)', unit: 'Operations', purpose: 'Summarises internal meeting transcripts into actions and decisions.', affected: 'Internal staff attending meetings', source: 'AI feature inside existing software', vendor: 'Collaboration suite add-on' });
    triage(c, 20.8, ans({ impact: imp(0, 0, 1, 2, 0) })); confirm(c, 20.5);
    evidence(c, 20.3); E.act(c, 'submitAssessment', 'owner', {}, now - 20.1 * D);
    sign(c, 19.6, 'gov', { note: 'Registered. Baseline controls attested.' });

    // 2. Elevated tier, live, periodic review overdue
    c = open(232, { name: 'Customer support assistant', kind: 'AI system or model (produces output for people)', euRole: 'Deployer (we use AI someone else built)', unit: 'Customer Service', purpose: 'Answers billing and account questions in chat, hands off to an agent when unsure.', affected: 'Customers contacting support', source: 'Foundation model via API', vendor: 'Hosted LLM with retrieval over help-centre content' });
    triage(c, 230, ans({ transparency: ['interacts'], impact: imp(1, 1, 2, 3, 1) })); confirm(c, 229);
    evidence(c, 222); E.act(c, 'submitAssessment', 'owner', {}, now - 221 * D);
    sign(c, 219, 'gov'); sign(c, 217, 'privacy', { condition: 'Chat transcripts deleted after 90 days' }); sign(c, 215, 'security');
    E.act(c, 'closeCondition', 'owner', { index: 0, note: 'Retention rule deployed and verified' }, now - 212 * D);
    ['mon', 'stop', 'user'].forEach((id, i) => E.act(c, 'setCheck', 'owner', { id, value: true }, now - 211 * D + i * 6e5));
    E.act(c, 'authoriseGoLive', 'gov', {}, now - 200 * D);
    E.act(c, 'logIncident', 'owner', { severity: 'minor', text: 'Quoted an outdated refund window to 14 customers. Knowledge base corrected, customers contacted.' }, now - 64 * D);

    // 3. Critical (high-risk in law), assessment under way
    c = open(16, { name: 'CV screening assistant', kind: 'AI system or model (produces output for people)', euRole: 'Deployer (we use AI someone else built)', unit: 'People & Talent', purpose: 'Ranks incoming applications against role criteria to prioritise recruiter review.', affected: 'Job applicants', source: 'Vendor product', vendor: 'Applicant tracking system AI module' });
    triage(c, 15, ans({ areas: ['employment'], profiling: true, impact: imp(2, 0, 2, 3, 2) })); confirm(c, 14);
    evidence(c, 9, ['B1', 'B2', 'B3', 'E1', 'E2', 'D2']);

    // 4. Critical, in decision: three of five approvers have signed
    c = open(41, { name: 'Credit limit recommendation', kind: 'AI system or model (produces output for people)', euRole: 'Both (we build it and use it ourselves)', unit: 'Retail Lending', purpose: 'Recommends credit limit changes for existing cardholders from repayment behaviour.', affected: 'Retail credit customers', source: 'Built in-house', vendor: '' });
    triage(c, 40, ans({ areas: ['essential'], profiling: true, impact: imp(3, 1, 2, 3, 2) })); confirm(c, 39);
    evidence(c, 20); E.act(c, 'submitAssessment', 'owner', {}, now - 12 * D);
    sign(c, 10, 'gov'); sign(c, 8, 'privacy'); sign(c, 6, 'security', { condition: 'Quarterly access review on the feature store' });

    // 5. Prohibited: blocked at triage
    c = open(6, { name: 'Agent sentiment monitor', kind: 'AI system or model (produces output for people)', euRole: 'Deployer (we use AI someone else built)', unit: 'Contact Centre', purpose: 'Infers call-centre agents’ emotional state from voice to flag stress and coach performance.', affected: 'Contact-centre employees', source: 'Vendor product', vendor: 'Speech analytics platform' });
    triage(c, 5.5, ans({ prohibited: ['emotion'], impact: imp(2, 0, 3, 1, 1) })); confirm(c, 5);

    // 6. Not high-risk in law, Critical on impact: awaiting confirmation
    c = open(3, { name: 'Autonomous procurement agent', kind: 'AI agent (takes actions through tools)', euRole: 'Deployer (we use AI someone else built)', unit: 'Finance', purpose: 'Sources quotes, negotiates with suppliers by email and raises purchase orders under a spend threshold.', affected: 'Suppliers; Finance and budget holders', source: 'Foundation model via API', vendor: 'Agent framework with ERP and email tools' });
    triage(c, 2, ans({ transparency: ['interacts'], tools: ['read', 'comms', 'money', 'write', 'untrusted'], impact: imp(2, 3, 1, 2, 2) }));

    // 7. Elevated, approved with a condition, waiting at go-live
    c = open(19, { name: 'Contract clause extraction', kind: 'AI system or model (produces output for people)', euRole: 'Deployer (we use AI someone else built)', unit: 'Legal', purpose: 'Extracts key clauses and renewal dates from supplier contracts into the contracts register.', affected: 'Legal and procurement teams', source: 'Foundation model via API', vendor: 'Hosted LLM, zero-retention endpoint' });
    triage(c, 18, ans({ impact: imp(1, 0, 3, 1, 1) })); confirm(c, 17.5);
    evidence(c, 13); E.act(c, 'submitAssessment', 'owner', {}, now - 12 * D);
    sign(c, 10, 'gov'); sign(c, 9, 'privacy'); sign(c, 7, 'security', { condition: 'Privileged documents excluded by folder rule' });
    E.act(c, 'setCheck', 'owner', { id: 'user', value: true }, now - 4 * D);

    // 8. Agent, Elevated by the agent rule, live on the agent review cadence
    c = open(75, { name: 'IT helpdesk agent', kind: 'AI agent (takes actions through tools)', euRole: 'Deployer (we use AI someone else built)', unit: 'IT Service Desk', purpose: 'Resolves routine tickets: resets passwords, unlocks accounts and provisions standard software after verifying the requester.', affected: 'All employees', source: 'Foundation model via API', vendor: 'Agent framework on the service-desk platform' });
    triage(c, 74, ans({ transparency: ['interacts'], tools: ['read', 'write', 'code', 'memory', 'untrusted'], impact: imp(1, 1, 1, 2, 0) })); confirm(c, 73);
    evidence(c, 66); E.act(c, 'submitAssessment', 'owner', {}, now - 65 * D);
    sign(c, 63, 'gov'); sign(c, 62, 'privacy'); sign(c, 60, 'security', { condition: 'Admin and privileged accounts are out of scope' });
    E.act(c, 'closeCondition', 'owner', { index: 0, note: 'Deny rule on privileged groups, verified in test tenant' }, now - 58 * D);
    ['mon', 'stop', 'user', 'perm'].forEach((id, i) => E.act(c, 'setCheck', 'owner', { id, value: true }, now - 57 * D + i * 6e5));
    E.act(c, 'authoriseGoLive', 'gov', {}, now - 55 * D);

    // 9. Standard tier, went live, then retired through the checklist
    c = open(190, { name: 'Invoice capture pilot', kind: 'AI system or model (produces output for people)', euRole: 'Deployer (we use AI someone else built)', unit: 'Finance', purpose: 'Read supplier invoices and proposed ledger entries for a clerk to confirm, during a six-month pilot.', affected: 'Accounts payable team', source: 'Vendor product', vendor: 'Document AI service' });
    triage(c, 189, ans({ impact: imp(0, 1, 1, 1, 1) })); confirm(c, 188);
    evidence(c, 187); E.act(c, 'submitAssessment', 'owner', {}, now - 186 * D);
    sign(c, 185, 'gov', { note: 'Registered for the pilot period.' });
    E.act(c, 'retire', 'owner', { checks: ['access', 'data', 'users', 'log'], note: 'Pilot ended. Replaced by invoice capture built into the finance system.' }, now - 24 * D);

    // 10. Draft at intake
    c = open(1);
    c.intake = { name: 'Demand forecasting model', kind: 'AI system or model (produces output for people)', euRole: 'Deployer (we use AI someone else built)', unit: 'Supply Chain', purpose: '', affected: '', source: 'Built in-house', vendor: '' };

    return cases;
  }

  if (node) module.exports = SEED; else root.SEED = SEED;
})(typeof window !== 'undefined' ? window : globalThis);
