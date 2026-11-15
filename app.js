/* Throughline — UI. Renders state, forwards every action to the engine, shows the engine's refusals verbatim. */
(function () {
  const P = window.POLICY, E = window.ENGINE, DAY = E.DAY, KEY = 'throughline.v1';
  const app = document.getElementById('app');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const fmt = t => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const daysSince = t => Math.max(0, Math.floor((Date.now() - t) / DAY));
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const stageOf = id => P.stages.find(s => s.id === id);
  const REG = { prohibited: 'Prohibited practice', high: 'High-risk', limited: 'Transparency duties', minimal: 'Minimal risk' };
  const FW = { nist: 'NIST AI RMF', iso: 'ISO/IEC 42001', eu: 'EU AI Act', other: '' };

  let S = load();
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && Array.isArray(s.cases)) return s; } catch (e) {}
    return { cases: window.SEED(Date.now()), role: 'owner' };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  const find = id => S.cases.find(c => c.id === id);

  let toastTimer;
  function toast(msg, bad) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = ''; }, bad ? 6000 : 2600);
  }
  function run(id, action, payload, okMsg) {
    try { E.act(find(id), action, S.role, payload, Date.now()); save(); if (okMsg) toast(okMsg); }
    catch (e) { toast(e.message, true); }
    render();
  }

  // ---------- small pieces ----------
  const tierOf = c => (c.triage.result ? c.triage.result.tier : null);
  function tierBadge(c) {
    const t = tierOf(c);
    if (t == null) return '<span class="badge t-none">Untiered</span>';
    return '<span class="badge t' + t + '">' + P.tiers[t].short + ' ' + P.tiers[t].name + (c.triage.confirmed ? '' : ' · proposed') + '</span>';
  }
  function refs(r) {
    return Object.keys(r || {}).map(fw => r[fw].map(x => '<span class="ref ' + fw + '" title="' + esc(FW[fw]) + '">' + (fw === 'other' ? '' : '<b>' + fw.toUpperCase() + '</b> ') + esc(x) + '</span>').join('')).join('');
  }
  function gate(roles, html) {
    if (roles.includes(S.role)) return html;
    return '<div class="need">Needs the ' + roles.map(r => esc(E.roleName(r))).join(' or ') + '. ' +
      '<button class="btn small" data-action="role" data-role="' + roles[0] + '">Act as ' + esc(E.roleName(roles[0])) + '</button></div>';
  }
  const reviewOverdue = c => c.status === 'active' && c.stage === 'monitor' && c.monitor.nextReview < Date.now();
  function closedLabel(c) { return { blocked: 'Blocked', rejected: 'Rejected', retired: 'Retired' }[c.status]; }

  // ---------- pipeline ----------
  function pipeline() {
    const active = S.cases.filter(c => c.status === 'active');
    const closed = S.cases.filter(c => c.status !== 'active');
    const decided = S.cases.filter(c => c.decision && c.decision.outcome !== 'Rejected').map(c => (c.decision.at - c.createdAt) / DAY).sort((a, b) => a - b);
    const median = decided.length ? Math.round(decided[Math.floor((decided.length - 1) / 2)]) : null;
    const stats = [
      [active.filter(c => c.stage !== 'monitor').length, 'in the pipeline'],
      [active.filter(c => c.stage === 'monitor').length, 'live and monitored'],
      [closed.filter(c => c.status !== 'retired').length, 'stopped by a gate'],
      [active.filter(reviewOverdue).length, 'overdue for review', active.some(reviewOverdue)],
      [median == null ? '–' : median + 'd', 'median intake → decision'],
    ];
    const card = c => {
      const flags = [];
      if (E.isAgent(c)) flags.push('<span class="flag agent">Agent</span>');
      if (c.rereview) flags.push('<span class="flag warn">Re-review: ' + (c.rereview.kind === 'incident' ? 'incident' : 'change') + '</span>');
      if (reviewOverdue(c)) flags.push('<span class="flag warn">Review overdue ' + daysSince(c.monitor.nextReview) + 'd</span>');
      if (c.stage === 'triage' && c.triage.result && !c.triage.confirmed) flags.push('<span class="flag">Awaiting confirmation</span>');
      if (c.stage === 'decide') flags.push('<span class="flag">' + (E.approvers(c).length - E.pendingApprovers(c).length) + '/' + E.approvers(c).length + ' signed</span>');
      return '<a class="card" href="#/case/' + c.id + '"><span class="cid">' + c.id + '</span>' +
        '<strong>' + esc(c.intake.name || 'Untitled draft') + '</strong><span class="unit">' + esc(c.intake.unit || '') + '</span>' +
        '<span class="row">' + tierBadge(c) + '</span>' + (flags.length ? '<span class="row">' + flags.join('') + '</span>' : '') +
        '<span class="age">' + (c.status === 'active' ? plural(daysSince(c.stageAt), 'day') + ' in stage' : closedLabel(c)) + '</span></a>';
    };
    return '<section class="hero"><div><h1>Every AI use case, one front door.</h1>' +
      '<p>From first idea to retirement: tiered by risk, gated by evidence, decided by named people, and recorded so it can be proven later.</p></div>' +
      gate(['owner'], '<button class="btn primary" data-action="new">+ Register a use case</button>') + '</section>' +
      '<section class="stats">' + stats.map(s => '<div class="stat' + (s[2] ? ' alert' : '') + '"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>').join('') + '</section>' +
      '<section class="board">' + P.stages.map(st => {
        const list = active.filter(c => c.stage === st.id);
        return '<div class="col"><h3><span class="g">' + st.gate + '</span>' + st.name + '<em>' + list.length + '</em></h3><p class="q">' + st.question + '</p>' +
          (list.map(card).join('') || '<div class="empty">Nothing here</div>') + '</div>';
      }).join('') + '</section>' +
      (closed.length ? '<section class="closed"><h3>Closed</h3><div class="closedrow">' + closed.map(card).join('') + '</div></section>' : '');
  }

  // ---------- case view ----------
  function stepper(c) {
    const idx = P.stages.findIndex(s => s.id === c.stage);
    return '<ol class="stepper">' + P.stages.map((s, i) => {
      const skipped = s.id === 'golive' && c.triage.confirmed && tierOf(c) !== 0 && E.fastLane(c);
      const cls = skipped ? 'skip' : i < idx ? 'done' : i === idx ? (c.status === 'active' ? 'now' : 'halt') : '';
      return '<li class="' + cls + '"><span class="g">' + s.gate + '</span><b>' + s.name + '</b><small>' + (skipped ? 'Skipped: fast lane' : s.question) + '</small></li>';
    }).join('') + '</ol>';
  }

  function intakePanel(c) {
    const ro = S.role !== 'owner';
    const field = f => {
      const v = c.intake[f.id] || '', attr = 'name="' + f.id + '" id="f_' + f.id + '"' + (ro ? ' disabled' : '');
      const input = f.type === 'area' ? '<textarea rows="3" ' + attr + '>' + esc(v) + '</textarea>'
        : f.type === 'select' ? '<select ' + attr + '><option value="">Choose…</option>' + f.options.map(o => '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>'
        : '<input type="text" ' + attr + ' value="' + esc(v) + '">';
      return '<div class="field' + (f.type === 'area' ? ' wide' : '') + '"><label for="f_' + f.id + '">' + f.label + (f.optional ? ' <i>optional</i>' : '') + '</label>' + input + '</div>';
    };
    return '<form data-form="intake" class="grid2">' + P.intakeFields.map(field).join('') +
      '<div class="wide">' + gate(['owner'], '<button class="btn primary">Submit intake →</button>') + '</div></form>';
  }

  function resultCard(r) {
    const t = P.tiers[r.tier];
    return '<div class="result t' + r.tier + '"><div class="rhead"><span class="badge t' + r.tier + '">' + t.short + ' ' + t.name + '</span>' +
      '<span class="badge plain">' + REG[r.regClass] + '</span><span class="badge plain">Impact ' + r.score + '/15</span>' + (r.flags.agent ? '<span class="badge agent">Agent track</span>' : '') + '</div>' +
      '<p class="path">' + t.path + '</p><ul>' + r.reasons.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
  }

  function triagePanel(c) {
    const r = c.triage.result, a = c.triage.answers || { prohibited: [], areas: [], transparency: [], tools: [], impact: {} };
    let banner = '';
    if (c.rereview) banner = '<div class="banner warn"><b>Re-review opened ' + fmt(c.rereview.at) + '.</b> ' +
      (c.rereview.kind === 'incident' ? 'Use is paused after a serious incident: ' : 'Material change declared: ') + esc(c.rereview.reason) +
      ' Previous approvals are void until the tier is re-confirmed and the gates are passed again.</div>';
    if (r) {
      const t = r.tier;
      const esc8 = t > 1 ? '<details class="escalate"><summary>Escalate the tier instead</summary><form data-form="escalate">' +
        '<select name="escalateTo">' + [1, 2].filter(x => x < t).map(x => '<option value="' + x + '">' + P.tiers[x].short + ' ' + P.tiers[x].name + '</option>').join('') + '</select>' +
        '<input type="text" name="reason" placeholder="Reason for escalating"><button class="btn">Escalate and confirm</button></form>' +
        '<p class="hint">The second line can raise a tier. It cannot lower one below what the rules compute.</p></details>' : '';
      return banner + resultCard(r) + '<div class="actions">' +
        gate(['gov'], '<button class="btn primary" data-action="confirmTriage">' + (t === 0 ? 'Confirm and block' : 'Confirm ' + P.tiers[t].name + ' tier →') + '</button>' + esc8) +
        (S.role === 'owner' ? '<button class="btn" data-action="reviseTriage">Revise answers</button>' : '') + '</div>';
    }
    const box = (group, name) => P.triage[group].map(q => '<label class="check"><input type="checkbox" name="' + name + '" value="' + q.id + '"' +
      ((a[name] || []).includes(q.id) ? ' checked' : '') + '><span>' + q.text + (q.ref ? ' <i>' + q.ref + '</i>' : q.high ? ' <i>consequential</i>' : '') + '</span></label>').join('');
    const yn = (name, val) => ['no', 'yes'].map(v => '<label class="pill"><input type="radio" name="' + name + '" value="' + v + '"' + ((val ? 'yes' : 'no') === v ? ' checked' : '') + '>' + v + '</label>').join('');
    return banner + '<form data-form="triage"><fieldset><legend>1 · Is it something we must not do?</legend><p class="hint">Any tick here ends the workflow. These are the EU AI Act’s prohibited practices.</p>' + box('prohibited', 'prohibited') + '</fieldset>' +
      '<fieldset><legend>2 · Does it fall in a high-risk area?</legend>' + box('areas', 'areas') +
      '<div class="sub"><p>If you ticked an area: does it profile individuals? ' + yn('profiling', a.profiling) + '</p>' +
      '<p>Is it limited to a narrow procedural or preparatory task that does not materially influence the outcome? ' + yn('narrow', a.narrow) + ' <i>Art. 6(3)</i></p></div></fieldset>' +
      '<fieldset><legend>3 · Do transparency duties apply?</legend>' + box('transparency', 'transparency') + '</fieldset>' +
      '<fieldset><legend>4 · How much could it matter?</legend><p class="hint">Five factors, scored 0–3. This applies to every use case, regulated or not.</p><div class="impact">' +
      P.triage.impact.map(f => '<div class="field"><label for="i_' + f.id + '">' + f.name + '</label><select name="i_' + f.id + '" id="i_' + f.id + '">' +
        f.options.map((o, i) => '<option value="' + i + '"' + (+(a.impact[f.id] || 0) === i ? ' selected' : '') + '>' + i + ' · ' + o + '</option>').join('') + '</select></div>').join('') + '</div></fieldset>' +
      '<fieldset class="agentset"><legend>5 · What can it do on its own?</legend><p class="hint">Tick every action it can take through tools. Leave empty if it only produces output for a person. Any consequential tool, or acting without per-step approval, puts it on the agent track whether or not it was registered as an agent.</p>' + box('tools', 'tools') + '</fieldset>' +
      '<div id="preview">' + resultCard(E.classify(Object.assign({ prohibited: [], areas: [], transparency: [], tools: [] }, a), c.intake)) + '</div>' +
      gate(['owner'], '<button class="btn primary">Propose this classification →</button>') + '</form>';
  }
  function readTriage(form) {
    const fd = new FormData(form), impact = {};
    P.triage.impact.forEach(f => { impact[f.id] = +(fd.get('i_' + f.id) || 0); });
    return { prohibited: fd.getAll('prohibited'), areas: fd.getAll('areas'), profiling: fd.get('profiling') === 'yes', narrow: fd.get('narrow') === 'yes', transparency: fd.getAll('transparency'), tools: fd.getAll('tools'), impact };
  }

  function assessPanel(c) {
    const req = E.requiredControls(c), done = req.filter(k => c.controls[k.id]).length;
    return '<div class="progress"><div style="width:' + Math.round(100 * done / req.length) + '%"></div></div>' +
      '<p class="hint">' + done + ' of ' + req.length + ' controls evidenced. The list is generated from the tier and the triage answers; nothing here is optional.</p>' +
      req.map(k => {
        const s = c.controls[k.id], by = k.by || 'owner';
        const state = s ? '<div class="evid ' + s.status + '"><b>' + (s.status === 'na' ? 'Not applicable' : 'Evidenced') + '</b> ' + esc(s.note) + ' <i>' + esc(E.roleName(s.by)) + ', ' + fmt(s.at) + '</i></div>' : '';
        const form = S.role === by
          ? '<form data-form="control" class="inline"><input type="hidden" name="id" value="' + k.id + '"><input type="text" name="note" placeholder="' + (s ? 'Replace evidence…' : 'Link or describe the evidence…') + '" aria-label="Evidence for ' + esc(k.title) + '">' +
            '<button class="btn small" name="status" value="done">Evidence</button><button class="btn small ghost" name="status" value="na">N/A</button></form>'
          : (s ? '' : '<div class="need">Attested by the ' + esc(E.roleName(by)) + '. <button class="btn small" data-action="role" data-role="' + by + '">Act as ' + esc(E.roleName(by)) + '</button></div>');
        return '<div class="control' + (s ? ' ok' : '') + '"><div class="chead"><span class="kid">' + k.id + '</span><strong>' + k.title + '</strong><span class="refs">' + refs(k.refs) + '</span></div>' +
          '<p>' + k.evidence + '</p>' + state + form + '</div>';
      }).join('') +
      '<div class="actions">' + gate(['owner'], '<button class="btn primary" data-action="submitAssessment"' + (done < req.length ? ' disabled title="Gate G3: evidence every control first"' : '') + '>Submit for decision →</button>') + '</div>';
  }

  function decidePanel(c) {
    const t = P.tiers[tierOf(c)], waited = daysSince(c.stageAt);
    const rows = E.approvers(c).map(r => {
      const s = c.signoffs[r];
      const right = s ? '<span class="signed">Approved ' + fmt(s.at) + (s.condition ? '<br><i>Condition: ' + esc(s.condition) + '</i>' : '') + (s.note ? '<br><i>' + esc(s.note) + '</i>' : '') + '</span>'
        : S.role === r ? '<form data-form="sign" class="signform"><input type="text" name="note" placeholder="Rationale (required to return or reject)">' +
            '<input type="text" name="condition" placeholder="Condition of approval (optional)"><div>' +
            '<button class="btn primary small" name="decision" value="approve">Approve</button><button class="btn small" name="decision" value="return">Return for rework</button>' +
            '<button class="btn small danger" name="decision" value="reject">Reject</button></div></form>'
        : '<span class="pending">Pending <button class="btn small" data-action="role" data-role="' + r + '">Act as</button></span>';
      return '<div class="approver' + (s ? ' ok' : '') + '"><div><strong>' + esc(P.roles[r].name) + '</strong><small>' + P.roles[r].line + '</small></div>' + right + '</div>';
    }).join('');
    return '<p class="hint">' + t.name + ' tier needs ' + plural(E.approvers(c).length, 'approver') + (E.isAgent(c) && tierOf(c) === 3 ? ' (Security is added for every agent)' : '') + '. Target: ' + plural(t.slaDays, 'day') + '. Waiting ' + plural(waited, 'day') +
      (waited > t.slaDays ? ' <span class="flag warn">over target</span>' : '') + '. The use-case owner is never on this list.</p>' + rows;
  }

  function goLivePanel(c) {
    const conds = c.conditions.map((x, i) => '<div class="control' + (x.closed ? ' ok' : '') + '"><div class="chead"><strong>' + esc(x.text) + '</strong><span class="refs"><span class="ref">from ' + esc(E.roleName(x.from)) + '</span></span></div>' +
      (x.closed ? '<div class="evid done"><b>Closed</b> ' + esc(x.note) + '</div>'
        : S.role === 'owner' ? '<form data-form="condition" class="inline"><input type="hidden" name="index" value="' + i + '"><input type="text" name="note" placeholder="How was this met?"><button class="btn small">Close</button></form>'
        : '<div class="need">Closed by the Use-case owner.</div>') + '</div>').join('');
    const checks = E.goLiveChecks(c).map(k => '<label class="check"><input type="checkbox" data-check="' + k.id + '"' + (c.golive.checks[k.id] ? ' checked' : '') + (S.role === 'owner' ? '' : ' disabled') + '><span>' + k.text + '</span></label>').join('');
    return '<h4>Conditions of approval</h4>' + (conds || '<p class="hint">Approved without conditions.</p>') + '<h4>Operational readiness</h4>' + checks +
      (S.role === 'owner' ? '' : '<p class="hint">Readiness is confirmed by the Use-case owner.</p>') +
      '<div class="actions">' + gate(['gov'], '<button class="btn primary" data-action="authoriseGoLive">Authorise go-live →</button>') + '</div>';
  }

  function monitorPanel(c) {
    const m = c.monitor, over = reviewOverdue(c);
    const list = (items, f) => items.length ? '<ul class="events">' + items.slice().reverse().map(f).join('') + '</ul>' : '<p class="hint">None recorded.</p>';
    return '<div class="kv3"><div><small>Live since</small><b>' + fmt(m.liveAt) + '</b></div><div class="' + (over ? 'alert' : '') + '"><small>Next review</small><b>' + fmt(m.nextReview) + '</b>' +
      (over ? '<span class="flag warn">overdue ' + daysSince(m.nextReview) + 'd</span>' : '') + '</div><div><small>Cadence</small><b>Every ' + E.reviewDays(c) + ' days</b>' + (E.isAgent(c) ? '<span class="flag agent">agent cadence</span>' : '') + '</div></div>' +
      '<h4>Periodic review</h4>' + list(m.reviews, r => '<li><b>' + fmt(r.at) + '</b> ' + esc(r.note) + '</li>') +
      gate(['gov'], '<form data-form="review" class="inline"><input type="text" name="note" placeholder="What did the review find?"><button class="btn small">Complete review</button></form>') +
      '<h4>Incidents</h4>' + list(m.incidents, i => '<li><b>' + fmt(i.at) + '</b> <span class="flag' + (i.severity === 'serious' ? ' warn' : '') + '">' + i.severity + '</span> ' + esc(i.text) + '</li>') +
      '<form data-form="incident" class="inline"><input type="text" name="text" placeholder="What happened?"><select name="severity" aria-label="Severity"><option value="minor">Minor</option><option value="serious">Serious: pause and re-review</option></select><button class="btn small">Log incident</button></form>' +
      '<p class="hint">Anyone can raise an incident. A serious one pauses use and sends the case back to triage.</p>' +
      '<h4>Change and retirement</h4>' + (E.isAgent(c) ? '<p class="hint">For an agent, a new tool, a wider permission or a higher autonomy level is a material change. The approval covers the manifest shown in the agent profile and nothing wider.</p>' : '') +
      gate(['owner', 'gov'], '<form data-form="change" class="inline"><input type="text" name="reason" placeholder="New model, new data, new purpose, new audience…"><button class="btn small">Declare material change</button></form>' +
        '<form data-form="retire" class="inline"><input type="text" name="note" placeholder="Access revoked, data disposed or archived…"><button class="btn small danger">Retire</button></form>');
  }

  function auditPanel(c) {
    const v = E.verifyChain(c);
    return '<div class="chain ' + (v.ok ? 'ok' : 'bad') + '">' + (v.ok ? '✓ Chain intact · ' + v.entries + (v.entries === 1 ? ' entry' : ' entries') + ' · head ' + v.head.slice(0, 12) + '…' : '✗ Chain broken at entry ' + v.brokenAt) + '</div>' +
      '<ol class="audit">' + c.log.slice().reverse().map(e => '<li><time>' + fmt(e.ts) + '</time><b>' + esc(e.action) + '</b><span class="who">' + esc(e.role === 'system' ? 'System' : E.roleName(e.role)) + '</span>' +
        (e.detail ? '<p>' + esc(e.detail) + '</p>' : '') + '<code title="SHA-256 of this entry chained to the previous one">' + e.hash.slice(0, 16) + '</code></li>').join('') + '</ol>';
  }

  function caseView(c) {
    const r = c.triage.result, st = stageOf(c.stage);
    const panels = { intake: intakePanel, triage: triagePanel, assess: assessPanel, decide: decidePanel, golive: goLivePanel, monitor: monitorPanel };
    let body;
    if (c.status === 'blocked') body = '<div class="banner stop"><b>Blocked.</b> This use case matches a prohibited practice. There is no approval route; the record is kept so the decision can be shown later.</div>' + resultCard(r);
    else if (c.status === 'rejected') body = '<div class="banner stop"><b>Rejected</b> on ' + fmt(c.decision.at) + '. See the audit trail for the rationale.</div>';
    else if (c.status === 'retired') body = '<div class="banner"><b>Retired.</b> Kept in the inventory as a closed record.</div>';
    else body = '<div class="stagehead"><span class="g">' + st.gate + '</span><div><h2>' + st.name + '</h2><p>' + st.question + '</p></div><span class="refs">' + refs(st.refs) + '</span></div>' + panels[c.stage](c);
    const duties = r ? [['High-risk obligations', r.regClass === 'high'], ['AI disclosure', r.flags.art50], ['Personal data', r.flags.personalData], ['Agent track', r.flags.agent], ['Third-party', r.flags.thirdParty], ['Art. 6(3) exemption', r.flags.exemption]].filter(x => x[1]) : [];
    const fact = (k, v) => v ? '<div><small>' + k + '</small><span>' + v + '</span></div>' : '';
    return '<a class="back" href="#/">← Pipeline</a><div class="casehead"><div><span class="cid">' + c.id + '</span><h1>' + esc(c.intake.name || 'New use case') + '</h1>' +
      '<p>' + esc(c.intake.purpose || 'Not described yet.') + '</p></div><div class="headbadges">' + tierBadge(c) +
      (c.status !== 'active' ? '<span class="badge t0">' + closedLabel(c) + '</span>' : '') + (c.monitor && c.monitor.paused ? '<span class="badge t1">Use paused</span>' : '') + '</div></div>' +
      stepper(c) + '<div class="split"><section class="panel">' + body + '</section><aside>' +
      '<section class="panel facts"><h3>At a glance</h3>' + fact('Business unit', esc(c.intake.unit)) + fact('Affected', esc(c.intake.affected)) + fact('Sourcing', esc(c.intake.source)) + fact('Model / vendor', esc(c.intake.vendor)) +
      (r ? fact('Classification', REG[r.regClass]) + fact('Impact score', r.score + ' / 15') : '') + fact('Opened', fmt(c.createdAt)) + (c.decision ? fact('Decision', c.decision.outcome + ', ' + fmt(c.decision.at)) : '') +
      (duties.length ? '<div><small>Triggers</small><span>' + duties.map(d => '<span class="flag">' + d[0] + '</span>').join(' ') + '</span></div>' : '') +
      '<button class="btn small" data-action="record">Download decision record</button></section>' +
      (r && r.agent ? '<section class="panel agentcard"><h3>Agent profile</h3><div class="level"><small>' + (c.decision ? 'Approved autonomy' : 'Requested autonomy') + '</small><b>' + P.agentTrack.levels[r.agent.autonomy] + '</b>' +
        '<span class="bars">' + [0, 1, 2, 3].map(i => '<span class="' + (i <= r.agent.autonomy ? 'on' : '') + '"></span>').join('') + '</span></div>' +
        '<small>Tool manifest</small><ul>' + (r.agent.tools.map(id => { const t = P.triage.tools.find(x => x.id === id); return '<li' + (t.high ? ' class="hot"' : '') + '>' + t.text + '</li>'; }).join('') || '<li>No tools declared</li>') + '</ul>' +
        '<p class="hint">Reviewed every ' + E.reviewDays(c) + ' days. Widening any of this reopens triage.</p></section>' : '') +
      '<section class="panel"><h3>Audit trail</h3>' + auditPanel(c) + '</section></aside></div>';
  }

  // ---------- decision record ----------
  function record(c) {
    const r = c.triage.result, v = E.verifyChain(c), L = [];
    L.push('# AI Use Case Decision Record', '', '**' + (c.intake.name || 'Untitled') + '** (' + c.id + ')', '', 'Generated ' + fmt(Date.now()) + ' · Policy v' + P.version + ' · Status: ' + c.status + ', stage: ' + c.stage, '');
    L.push('## 1. Use case', '');
    P.intakeFields.forEach(f => L.push('- **' + f.label + ':** ' + (c.intake[f.id] || '–')));
    if (r) {
      L.push('', '## 2. Classification', '', '- **Tier:** ' + P.tiers[r.tier].short + ' ' + P.tiers[r.tier].name + (c.triage.confirmed ? ' (confirmed by second line)' : ' (proposed, not yet confirmed)'),
        '- **Regulatory class:** ' + REG[r.regClass], '- **Impact score:** ' + r.score + '/15', '', 'Reasoning:', '');
      r.reasons.forEach(x => L.push('- ' + x));
      if (r.agent) L.push('', '**Agent profile.** Autonomy: ' + P.agentTrack.levels[r.agent.autonomy] + '. Tools: ' + (r.agent.tools.map(id => P.triage.tools.find(x => x.id === id).text).join('; ') || 'none declared') + '. Review every ' + E.reviewDays(c) + ' days.');
      const req = E.requiredControls(c);
      if (req.length) {
        L.push('', '## 3. Controls and evidence', '', '| ID | Control | Status | Evidence | Attested by |', '|---|---|---|---|---|');
        req.forEach(k => { const s = c.controls[k.id]; L.push('| ' + k.id + ' | ' + k.title + ' | ' + (s ? (s.status === 'na' ? 'N/A' : 'Evidenced') : 'Open') + ' | ' + (s ? s.note.replace(/\|/g, '/') : '') + ' | ' + (s ? E.roleName(s.by) + ', ' + fmt(s.at) : '') + ' |'); });
      }
      if (E.approvers(c).length) {
        L.push('', '## 4. Decision', '', c.decision ? '**Outcome: ' + c.decision.outcome + '** on ' + fmt(c.decision.at) : '**Outcome: pending**', '', '| Approver | Decision | Date | Condition / note |', '|---|---|---|---|');
        E.approvers(c).forEach(a => { const s = c.signoffs[a]; L.push('| ' + P.roles[a].name + ' | ' + (s ? 'Approved' : 'Pending') + ' | ' + (s ? fmt(s.at) : '') + ' | ' + (s ? (s.condition || s.note || '').replace(/\|/g, '/') : '') + ' |'); });
        if (c.conditions.length) { L.push('', 'Conditions:', ''); c.conditions.forEach(x => L.push('- ' + x.text + ' — ' + (x.closed ? 'closed: ' + x.note : 'OPEN'))); }
      }
    }
    if (c.monitor) {
      L.push('', '## 5. Operation', '', '- **Live since:** ' + fmt(c.monitor.liveAt), '- **Next review due:** ' + fmt(c.monitor.nextReview), '- **Reviews completed:** ' + c.monitor.reviews.length, '- **Incidents:** ' + c.monitor.incidents.length);
      c.monitor.incidents.forEach(i => L.push('  - ' + fmt(i.at) + ' (' + i.severity + '): ' + i.text));
    }
    L.push('', '## 6. Audit trail', '', 'Entries: ' + c.log.length + ' · Integrity: ' + (v.ok ? 'verified' : 'BROKEN at entry ' + v.brokenAt) + (v.ok ? ' · Head hash: `' + v.head + '`' : ''), '', '| # | Date | Actor | Action | Detail |', '|---|---|---|---|---|');
    c.log.forEach(e => L.push('| ' + e.n + ' | ' + fmt(e.ts) + ' | ' + (e.role === 'system' ? 'System' : E.roleName(e.role)) + ' | ' + e.action + ' | ' + e.detail.replace(/\|/g, '/') + ' |'));
    return L.join('\n') + '\n';
  }
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- policy page ----------
  function policyView() {
    const principles = [
      ['One front door', 'Every AI use case enters the same way, including the vendor feature someone just switched on. The inventory is a by-product of the workflow, not a separate spreadsheet.'],
      ['Regulation is the floor, not the ceiling', 'Legal classification can only raise a tier. An autonomous agent that no statute names can still be Critical on impact.'],
      ['Proportionate by default', 'Low-risk work gets a fast lane with three or four attestations and one sign-off. Governance that is slow for everything gets bypassed for everything.'],
      ['Owners propose, the second line confirms', 'The people closest to the system classify it. An independent function confirms, and may escalate but never downgrade.'],
      ['Nobody approves their own use case', 'Approvers are set by tier, not chosen by the requester. Independent validation can only be attested by the validator.'],
      ['Evidence, not tick-boxes', 'A control is closed by pointing at something, or by a written reason it does not apply. Both are logged.'],
      ['Approval is a state, not an ending', 'Reviews fall due, incidents pause use, and material change sends the case back to triage with its approvals void.'],
      ['Agents get more, not different', 'An agent goes through the same gates. Its tools and autonomy level are part of what gets approved, so widening either is a change that needs approval.'],
      ['Provable afterwards', 'Every action is appended to a hash-chained log. Edit one entry and the chain visibly breaks.'],
    ];
    const tiers = [3, 2, 1, 0].map(t => { const x = P.tiers[t];
      return '<tr><td><span class="badge t' + t + '">' + x.short + ' ' + x.name + '</span></td><td>' + x.path + '</td><td>' + (x.approvers.map(a => P.roles[a].name).join(', ') || '–') + '</td><td>' +
        (t ? P.controls.filter(k => k.tiers.includes(t) && !k.if).length + ' + conditional' : '–') + '</td><td>' + (x.slaDays ? plural(x.slaDays, 'day') : '–') + '</td><td>' + (x.reviewDays ? 'Every ' + x.reviewDays + ' days' : '–') + '</td></tr>'; }).join('');
    return '<section class="hero"><div><h1>How it governs</h1><p>This page is generated from <code>policy.js</code>, the same file the engine enforces. Change the policy and both the rules and this description change together.</p></div></section>' +
      '<section class="principles">' + principles.map((p, i) => '<div><span>' + (i + 1) + '</span><h3>' + p[0] + '</h3><p>' + p[1] + '</p></div>').join('') + '</section>' +
      '<section class="panel"><h2>Lifecycle and gates</h2><div class="tablewrap"><table><thead><tr><th>Gate</th><th>Stage</th><th>The question it answers</th><th>Who</th><th>Framework anchors</th></tr></thead><tbody>' +
      P.stages.map(s => '<tr><td><span class="g">' + s.gate + '</span></td><td><b>' + s.name + '</b></td><td>' + s.question + '</td><td>' + s.who + '</td><td class="refs">' + refs(s.refs) + '</td></tr>').join('') + '</tbody></table></div></section>' +
      '<section class="panel"><h2>Tiers</h2><p class="hint">Impact score 0–15 across five factors: ' + P.scoring.tier2From + '+ is Elevated, ' + P.scoring.tier1From + '+ is Critical. Maximum autonomy or effect on people rules out the fast lane. EU AI Act high-risk is always Critical.</p>' +
      '<div class="tablewrap"><table><thead><tr><th>Tier</th><th>Path</th><th>Approvers</th><th>Controls</th><th>Decision target</th><th>Review</th></tr></thead><tbody>' + tiers + '</tbody></table></div></section>' +
      '<section class="panel"><h2>Agent track</h2><p class="hint">Same six gates. A use case is on this track if it is registered as an agent, acts without per-step human approval, or holds a consequential tool, so it cannot be avoided by calling an agent something else.</p>' +
      '<div class="tablewrap"><table><thead><tr><th>Gate</th><th>What changes for an agent</th></tr></thead><tbody>' +
      [['G2', 'Triage records the tool manifest and the autonomy level (' + P.agentTrack.levels.join(' · ') + '). Consequential tools (' + P.triage.tools.filter(t => t.high).map(t => t.text.charAt(0).toLowerCase() + t.text.slice(1)).join('; ') + ') make it at least Elevated; consequential tools at L2 or above make it Critical.'],
        ['G3', 'Agent controls are added: ' + P.controls.filter(k => /^agent/.test(k.if || '')).map(k => k.id + ' ' + k.title).join(', ') + '.'],
        ['G4', P.roles[P.agentTrack.extraApprover].name + ' always signs. No agent is approved on a single signature, even at Standard tier. The approval is for that manifest at that autonomy level.'],
        ['G5', 'No fast-lane skip. Every agent passes go-live, with an extra check: ' + P.goLiveChecks.find(k => k.if === 'agent').text.toLowerCase() + '.'],
        ['↻', 'Reviewed at ' + (1 / P.agentTrack.reviewFactor) + '× the tier frequency. A new tool, wider permission or higher autonomy is a material change: approvals are void and triage reopens.']]
        .map(x => '<tr><td><span class="g">' + x[0] + '</span></td><td>' + x[1] + '</td></tr>').join('') + '</tbody></table></div></section>' +
      '<section class="panel"><h2>Control library and crosswalk</h2><div class="tablewrap"><table><thead><tr><th>ID</th><th>Control</th><th>Tiers</th><th>Applies when</th><th>Attested by</th><th>Framework anchors</th></tr></thead><tbody>' +
      P.controls.map(k => '<tr><td><span class="kid">' + k.id + '</span></td><td><b>' + k.title + '</b><br><small>' + k.evidence + '</small></td><td>' + k.tiers.map(t => P.tiers[t].short).join(' ') + '</td><td>' +
        ({ thirdParty: 'Third-party sourced', art50: 'Transparency duty', agent: 'Agent track', agentState: 'Agent with memory or sub-agents', exemption: 'Art. 6(3) claimed', personalData: 'Personal data' }[k.if] || 'Always') + '</td><td>' + P.roles[k.by || 'owner'].name + '</td><td class="refs">' + refs(k.refs) + '</td></tr>').join('') + '</tbody></table></div></section>';
  }

  // ---------- routing and events ----------
  function render() {
    const h = location.hash.replace(/^#\/?/, '').split('/');
    const c = h[0] === 'case' ? find(h[1]) : null;
    app.innerHTML = c ? caseView(c) : h[0] === 'policy' ? policyView() : pipeline();
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === (h[0] === 'policy' ? 'policy' : 'pipeline')));
    document.getElementById('role').value = S.role;
  }
  const currentId = () => location.hash.replace(/^#\/?/, '').split('/')[1];

  const roleSel = document.getElementById('role');
  roleSel.innerHTML = Object.keys(P.roles).map(r => '<option value="' + r + '">' + P.roles[r].name + ' · ' + P.roles[r].line + '</option>').join('');
  roleSel.addEventListener('change', () => { S.role = roleSel.value; save(); render(); });
  document.getElementById('pv').textContent = P.version;

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const a = b.dataset.action, id = currentId();
    if (a === 'role') { S.role = b.dataset.role; save(); render(); toast('Now acting as ' + E.roleName(S.role)); }
    else if (a === 'new') {
      try {
        const n = S.cases.reduce((m, c) => Math.max(m, +c.id.slice(3)), 100) + 1;
        S.cases.push(E.createCase('UC-' + n, S.role, Date.now())); save(); location.hash = '#/case/UC-' + n;
      } catch (err) { toast(err.message, true); }
    }
    else if (a === 'reset') { if (confirm('Discard all changes and reload the demo portfolio?')) { S = { cases: window.SEED(Date.now()), role: 'owner' }; save(); location.hash = '#/'; render(); } }
    else if (a === 'export') download('throughline-register.json', JSON.stringify({ policyVersion: P.version, exportedAt: new Date().toISOString(), cases: S.cases }, null, 2), 'application/json');
    else if (a === 'record') download(id + '-decision-record.md', record(find(id)), 'text/markdown');
    else if (a === 'confirmTriage') run(id, a, {}, 'Classification confirmed');
    else if (a === 'reviseTriage') run(id, a, {});
    else if (a === 'submitAssessment') run(id, a, {}, 'Submitted for decision');
    else if (a === 'authoriseGoLive') run(id, a, {}, 'Live. First review scheduled.');
  });

  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(f)), id = currentId(), kind = f.dataset.form;
    const sub = e.submitter && e.submitter.name ? e.submitter.value : null;
    if (kind === 'intake') run(id, 'submitIntake', fd, 'Intake complete');
    else if (kind === 'triage') run(id, 'submitTriage', readTriage(f), 'Classification proposed');
    else if (kind === 'escalate') run(id, 'confirmTriage', fd, 'Escalated and confirmed');
    else if (kind === 'control') run(id, 'setControl', { id: fd.id, note: fd.note, status: sub });
    else if (kind === 'sign') run(id, 'sign', { note: fd.note, condition: fd.condition, decision: sub }, 'Decision recorded');
    else if (kind === 'condition') run(id, 'closeCondition', fd);
    else if (kind === 'review') run(id, 'completeReview', fd, 'Review recorded');
    else if (kind === 'incident') run(id, 'logIncident', fd, 'Incident logged');
    else if (kind === 'change') run(id, 'materialChange', fd, 'Re-review opened');
    else if (kind === 'retire') run(id, 'retire', fd, 'Retired');
  });

  document.addEventListener('change', e => {
    if (e.target.dataset.check) return run(currentId(), 'setCheck', { id: e.target.dataset.check, value: e.target.checked });
    const f = e.target.closest('form[data-form="triage"]');
    if (f) document.getElementById('preview').innerHTML = resultCard(E.classify(readTriage(f), find(currentId()).intake));
  });

  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  render();
})();
