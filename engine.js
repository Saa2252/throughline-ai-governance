/* Throughline — workflow engine. Pure logic, no DOM: runs in the browser and in Node (see test.js).
   It enforces three things the policy cannot enforce by itself:
   gates (you cannot skip a stage), decision rights (who may do what), and a tamper-evident log. */
(function (root) {
  const P = typeof module !== 'undefined' && module.exports ? require('./policy.js') : root.POLICY;
  const DAY = 864e5;

  // ---- SHA-256 (synchronous, dependency-free, so the audit chain works offline and from file://) ----
  const K = [], H0 = [];
  (function () {
    const frac = x => ((x - Math.floor(x)) * 4294967296) | 0;
    for (let n = 2, i = 0; i < 64; n++) {
      let prime = true;
      for (let d = 2; d * d <= n; d++) if (n % d === 0) { prime = false; break; }
      if (prime) { if (i < 8) H0[i] = frac(Math.sqrt(n)); K[i++] = frac(Math.cbrt(n)); }
    }
  })();
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  function sha256(str) {
    const b = unescape(encodeURIComponent(str)), l = b.length, w = [];
    for (let i = 0; i < l; i++) w[i >> 2] |= b.charCodeAt(i) << (24 - (i % 4) * 8);
    w[l >> 2] |= 0x80 << (24 - (l % 4) * 8);
    const N = (((l + 8) >> 6) + 1) * 16;
    w[N - 1] = l * 8;
    const H = H0.slice();
    for (let j = 0; j < N; j += 16) {
      const W = [];
      let [a, b2, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        if (i < 16) W[i] = w[j + i] | 0;
        else {
          const x = W[i - 15], y = W[i - 2];
          W[i] = (W[i - 16] + (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) + W[i - 7] + (rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10))) | 0;
        }
        const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b2) ^ (a & c) ^ (b2 & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b2; b2 = a; a = (t1 + t2) | 0;
      }
      [a, b2, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) | 0; });
    }
    return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }

  // ---- Audit log: each entry commits to the one before it ----
  function log(c, role, action, detail, now) {
    const prev = c.log.length ? c.log[c.log.length - 1].hash : 'genesis';
    const e = { n: c.log.length + 1, ts: now, role, action, detail: detail || '', prev };
    e.hash = sha256(prev + JSON.stringify([e.n, e.ts, e.role, e.action, e.detail]));
    c.log.push(e);
  }
  function verifyChain(c) {
    let prev = 'genesis';
    for (const e of c.log) {
      const h = sha256(prev + JSON.stringify([e.n, e.ts, e.role, e.action, e.detail]));
      if (e.prev !== prev || e.hash !== h) return { ok: false, brokenAt: e.n };
      prev = e.hash;
    }
    return { ok: true, entries: c.log.length, head: prev };
  }

  // ---- Triage: deterministic, explainable classification ----
  function classify(a, intake) {
    const imp = a.impact || {};
    const score = P.triage.impact.reduce((s, f) => s + (+imp[f.id] || 0), 0);
    const reasons = [];
    const areas = a.areas || [], prohibited = a.prohibited || [], transparency = a.transparency || [];
    const text = (list, id) => (list.find(x => x.id === id) || {}).ref || id;

    const inScope = areas.length > 0;
    const high = inScope && (areas.includes('product') || !!a.profiling || !a.narrow);
    const exemption = inScope && !high;
    // Agent detection: declared as one, acts without per-step approval, or holds a consequential tool.
    const tools = a.tools || [], autonomy = +imp.autonomy || 0;
    const toolDef = id => P.triage.tools.find(x => x.id === id) || {};
    const hot = tools.filter(id => toolDef(id).high);
    const declared = !!intake && /agent/i.test(intake.kind || '') && !/^AI system/i.test(intake.kind || '');
    const agent = declared || autonomy >= 2 || hot.length > 0;
    const flags = {
      thirdParty: !!intake && !!intake.source && intake.source !== 'Built in-house',
      personalData: (+imp.data || 0) >= 2,
      agent,
      agentState: agent && tools.some(id => toolDef(id).state),
      art50: transparency.length > 0,
      exemption,
    };
    const profile = agent ? { tools, autonomy } : null;

    if (prohibited.length) {
      reasons.push('Matches a prohibited practice: ' + prohibited.map(id => text(P.triage.prohibited, id)).join(', ') + '.');
      return { regClass: 'prohibited', tier: 0, score, reasons, flags, agent: profile };
    }

    let impactTier = score >= P.scoring.tier1From ? 1 : score >= P.scoring.tier2From ? 2 : 3;
    reasons.push('Impact score ' + score + '/15 → ' + P.tiers[impactTier].name + ' on impact alone.');
    const maxed = P.scoring.floorTier2If.filter(f => +imp[f] === 3);
    if (maxed.length && impactTier === 3) {
      impactTier = 2;
      reasons.push('Raised to Elevated: maximum score on ' + maxed.join(' and ') + '.');
    }

    if (agent) {
      if (!declared) reasons.push('Treated as an agent, although not declared as one: it ' + (autonomy >= 2 ? 'acts without per-step human approval.' : 'holds a consequential tool.'));
      const names = hot.map(id => toolDef(id).text.toLowerCase()).join('; ');
      if (hot.length && autonomy >= 2 && impactTier > 1) {
        impactTier = 1;
        reasons.push('Agent rule → Critical: acts alone (' + P.agentTrack.levels[autonomy] + ') with consequential tools (' + names + ').');
      } else if (hot.length && impactTier > 2) {
        impactTier = 2;
        reasons.push('Agent rule → Elevated: holds consequential tools (' + names + ').');
      }
      reasons.push('Agent track applies. Approval covers this tool set at ' + P.agentTrack.levels[autonomy] + ' and nothing wider.');
    }

    let regClass = 'minimal';
    if (high) {
      regClass = 'high';
      reasons.push('EU AI Act high-risk (' + areas.map(id => text(P.triage.areas, id)).join(', ') + ')' +
        (a.profiling && !areas.includes('product') ? '; profiling of individuals removes the Art. 6(3) exemption.' : '.'));
    } else if (exemption) {
      regClass = transparency.length ? 'limited' : 'minimal';
      reasons.push('In an Annex III area but claims the Art. 6(3) exemption (narrow or preparatory task, no profiling). The reasoning must be documented.');
    } else if (transparency.length) regClass = 'limited';
    if (transparency.length) reasons.push('Transparency duties apply (' + transparency.map(id => text(P.triage.transparency, id)).join(', ') + ').');

    const tier = high ? 1 : impactTier;
    if (high && impactTier > 1) reasons.push('Regulation sets the floor: tier raised to Critical.');
    if (!high && tier === 1) reasons.push('Not high-risk in law, but Critical on impact. Regulation is the floor, not the ceiling.');
    return { regClass, tier, score, reasons, flags, agent: profile };
  }

  const requiredControls = c => {
    const r = c.triage.result;
    if (!r || r.tier === 0) return [];
    return P.controls.filter(k => k.tiers.includes(r.tier) && (!k.if || r.flags[k.if]));
  };
  const controlsComplete = c => requiredControls(c).every(k => c.controls[k.id]);
  const approvers = c => {
    const r = c.triage.result;
    if (!r) return [];
    const list = P.tiers[r.tier].approvers.slice(), extra = P.agentTrack.extraApprover;
    if (r.tier && r.flags.agent && !list.includes(extra)) list.push(extra);
    return list;
  };
  const isAgent = c => !!(c.triage.result && c.triage.result.flags.agent);
  const reviewDays = c => Math.round(P.tiers[c.triage.result.tier].reviewDays * (isAgent(c) ? P.agentTrack.reviewFactor : 1));
  const goLiveChecks = c => P.goLiveChecks.filter(k => !k.if || c.triage.result.flags[k.if]);
  const fastLane = c => c.triage.result.tier === 3 && !isAgent(c);
  const pendingApprovers = c => approvers(c).filter(r => !c.signoffs[r]);

  // ---- Decision rights: action → stage it is valid in, roles that may perform it ----
  const RULES = {
    submitIntake:     { stage: 'intake',  roles: ['owner'] },
    submitTriage:     { stage: 'triage',  roles: ['owner'] },
    reviseTriage:     { stage: 'triage',  roles: ['owner'] },
    confirmTriage:    { stage: 'triage',  roles: ['gov'] },
    setControl:       { stage: 'assess' },                    // role depends on the control
    submitAssessment: { stage: 'assess',  roles: ['owner'] },
    sign:             { stage: 'decide' },                    // role must be a required approver
    closeCondition:   { stage: 'golive',  roles: ['owner'] },
    setCheck:         { stage: 'golive',  roles: ['owner'] },
    authoriseGoLive:  { stage: 'golive',  roles: ['gov'] },
    completeReview:   { stage: 'monitor', roles: ['gov'] },
    logIncident:      { stage: 'monitor' },                   // anyone can raise an incident
    materialChange:   { stage: 'monitor', roles: ['owner', 'gov'] },
    retire:           { stage: 'monitor', roles: ['owner', 'gov'] },
  };
  const need = (cond, msg) => { if (!cond) throw new Error(msg); };
  const roleName = r => (P.roles[r] ? P.roles[r].name : r);
  const move = (c, stage, now) => { c.stage = stage; c.stageAt = now; };

  function createCase(id, role, now) {
    need(role === 'owner', 'Only a use-case owner can open a new use case.');
    const c = { id, createdAt: now, stage: 'intake', stageAt: now, status: 'active', intake: {},
      triage: { answers: null, result: null, confirmed: false }, controls: {}, signoffs: {},
      conditions: [], golive: { checks: {} }, monitor: null, decision: null, rereview: null, log: [] };
    log(c, role, 'Opened', 'Use case registered in the inventory.', now);
    return c;
  }

  function goLive(c, now) {
    const m = c.monitor || { incidents: [], reviews: [] };
    c.monitor = Object.assign(m, { liveAt: m.liveAt || now, nextReview: now + reviewDays(c) * DAY, paused: false });
    c.rereview = null;
    move(c, 'monitor', now);
  }

  function reReview(c, kind, reason, now) {
    c.rereview = { kind, reason, at: now };
    c.triage.confirmed = false;
    c.signoffs = {}; c.conditions = []; c.golive = { checks: {} }; c.decision = null;
    if (kind === 'incident') c.monitor.paused = true;
    move(c, 'triage', now);
  }

  const ACTIONS = {
    submitIntake(c, role, p, now) {
      const missing = P.intakeFields.filter(f => !f.optional && !String(p[f.id] || '').trim());
      need(!missing.length, 'Gate G1: complete ' + missing.map(f => '“' + f.label + '”').join(', ') + '.');
      c.intake = {}; P.intakeFields.forEach(f => { c.intake[f.id] = String(p[f.id] || '').trim(); });
      log(c, role, 'Intake submitted', c.intake.name + ' (' + c.intake.unit + ')', now);
      move(c, 'triage', now);
    },
    submitTriage(c, role, p, now) {
      c.triage = { answers: p, result: classify(p, c.intake), confirmed: false };
      const r = c.triage.result;
      log(c, role, 'Triage proposed', P.tiers[r.tier].name + ' · ' + r.regClass + ' · impact ' + r.score + '/15', now);
    },
    reviseTriage(c, role, p, now) {
      need(c.triage.result, 'Nothing to revise yet.');
      c.triage.result = null;
      log(c, role, 'Triage reopened', 'Owner is revising the answers.', now);
    },
    confirmTriage(c, role, p, now) {
      const r = c.triage.result;
      need(r, 'Gate G2: the owner has not submitted triage answers yet.');
      p = p || {};
      if (p.escalateTo && r.tier !== 0) {
        const to = +p.escalateTo;
        need(to >= 1 && to < r.tier, 'The second line can raise a tier, never lower it.');
        need(String(p.reason || '').trim(), 'Escalating a tier needs a written reason.');
        r.reasons.push('Escalated to ' + P.tiers[to].name + ' by ' + roleName(role) + ': ' + p.reason.trim());
        r.tier = to; r.escalated = true;
      }
      c.triage.confirmed = true;
      if (r.tier === 0) {
        c.status = 'blocked';
        log(c, role, 'Blocked', 'Prohibited practice confirmed. No route to approval.', now);
        return;
      }
      log(c, role, 'Tier confirmed', P.tiers[r.tier].name + (r.escalated ? ' (escalated)' : ''), now);
      move(c, 'assess', now);
    },
    setControl(c, role, p, now) {
      const k = requiredControls(c).find(x => x.id === p.id);
      need(k, 'That control is not required for this use case.');
      const by = k.by || 'owner';
      need(role === by, '“' + k.title + '” can only be attested by the ' + roleName(by) + '.');
      need(['done', 'na'].includes(p.status), 'Unknown status.');
      need(String(p.note || '').trim(), p.status === 'na' ? 'A “not applicable” needs a written justification.' : 'Point to the evidence: a link, document name or short description.');
      c.controls[k.id] = { status: p.status, note: p.note.trim(), by: role, at: now };
      log(c, role, p.status === 'na' ? 'Control marked N/A' : 'Control evidenced', k.id + ' ' + k.title + ': ' + p.note.trim(), now);
    },
    submitAssessment(c, role, p, now) {
      const open = requiredControls(c).filter(k => !c.controls[k.id]);
      need(!open.length, 'Gate G3: ' + open.length + ' control(s) still open: ' + open.map(k => k.id).join(', ') + '.');
      c.signoffs = {};
      log(c, role, 'Submitted for decision', requiredControls(c).length + ' controls evidenced.', now);
      move(c, 'decide', now);
    },
    sign(c, role, p, now) {
      need(approvers(c).includes(role), roleName(role) + ' is not an approver for a ' + P.tiers[c.triage.result.tier].name + ' use case.');
      need(!c.signoffs[role], roleName(role) + ' has already signed.');
      need(['approve', 'return', 'reject'].includes(p.decision), 'Unknown decision.');
      const note = String(p.note || '').trim(), condition = String(p.condition || '').trim();
      need(p.decision === 'approve' || note, 'A rejection or return needs a written rationale.');
      if (p.decision === 'reject') {
        c.status = 'rejected'; c.decision = { outcome: 'Rejected', at: now };
        return log(c, role, 'Rejected', note, now);
      }
      if (p.decision === 'return') {
        c.signoffs = {}; c.conditions = [];
        log(c, role, 'Returned for rework', note, now);
        return move(c, 'assess', now);
      }
      c.signoffs[role] = { note, condition, at: now };
      if (condition) c.conditions.push({ text: condition, from: role, closed: false, note: '' });
      log(c, role, condition ? 'Approved with condition' : 'Approved', condition || note, now);
      if (!pendingApprovers(c).length) {
        c.decision = { outcome: c.conditions.length ? 'Approved with conditions' : 'Approved', at: now };
        log(c, 'system', 'Gate G4 passed', c.decision.outcome + ' by all ' + approvers(c).length + ' required approver(s).', now);
        if (fastLane(c)) { goLive(c, now); log(c, 'system', 'Live', 'Fast lane: no go-live gate for Standard tier.', now); }
        else move(c, 'golive', now);
      }
    },
    closeCondition(c, role, p, now) {
      const cond = c.conditions[+p.index];
      need(cond && !cond.closed, 'No such open condition.');
      need(String(p.note || '').trim(), 'Say how the condition was met.');
      cond.closed = true; cond.note = p.note.trim();
      log(c, role, 'Condition closed', cond.text + ' → ' + cond.note, now);
    },
    setCheck(c, role, p, now) {
      const chk = goLiveChecks(c).find(x => x.id === p.id);
      need(chk, 'Unknown check.');
      c.golive.checks[chk.id] = !!p.value;
      log(c, role, p.value ? 'Readiness check confirmed' : 'Readiness check withdrawn', chk.text, now);
    },
    authoriseGoLive(c, role, p, now) {
      const openC = c.conditions.filter(x => !x.closed).length;
      const openK = goLiveChecks(c).filter(x => !c.golive.checks[x.id]).length;
      need(!openC && !openK, 'Gate G5: ' + openC + ' condition(s) and ' + openK + ' readiness check(s) still open.');
      goLive(c, now);
      log(c, role, 'Go-live authorised', 'Next review due in ' + reviewDays(c) + ' days.', now);
    },
    completeReview(c, role, p, now) {
      need(String(p.note || '').trim(), 'Record what the review found.');
      c.monitor.reviews.push({ at: now, note: p.note.trim() });
      c.monitor.nextReview = now + reviewDays(c) * DAY;
      log(c, role, 'Periodic review completed', p.note.trim(), now);
    },
    logIncident(c, role, p, now) {
      need(String(p.text || '').trim(), 'Describe what happened.');
      const serious = p.severity === 'serious';
      c.monitor.incidents.push({ at: now, text: p.text.trim(), severity: serious ? 'serious' : 'minor', by: role });
      log(c, role, serious ? 'Serious incident' : 'Incident logged', p.text.trim(), now);
      if (serious) {
        reReview(c, 'incident', p.text.trim(), now);
        log(c, 'system', 'Use paused, re-review opened', 'Serious incidents suspend the approval and send the use case back to triage.', now);
      }
    },
    materialChange(c, role, p, now) {
      need(String(p.reason || '').trim(), 'Describe what is changing.');
      reReview(c, 'change', p.reason.trim(), now);
      log(c, role, 'Material change declared', p.reason.trim() + ' The change may not ship until re-approved.', now);
    },
    retire(c, role, p, now) {
      need(String(p.note || '').trim(), 'Record how it was decommissioned (access revoked, data disposed or archived).');
      c.status = 'retired';
      log(c, role, 'Retired', p.note.trim(), now);
    },
  };

  function act(c, action, role, payload, now) {
    const rule = RULES[action];
    need(rule && ACTIONS[action], 'Unknown action: ' + action);
    need(c.status === 'active', 'This use case is ' + c.status + '. No further actions are possible.');
    need(c.stage === rule.stage, '“' + action + '” is not available at the ' + c.stage + ' stage.');
    need(!rule.roles || rule.roles.includes(role), 'Not permitted for ' + roleName(role) + '. Needs: ' + (rule.roles || []).map(roleName).join(' or ') + '.');
    ACTIONS[action](c, role, payload || {}, now == null ? Date.now() : now);
    return c;
  }

  const ENGINE = { DAY, RULES, sha256, classify, requiredControls, controlsComplete, approvers, pendingApprovers, isAgent, reviewDays, goLiveChecks, fastLane, createCase, act, verifyChain, roleName };
  if (typeof module !== 'undefined' && module.exports) module.exports = ENGINE;
  else root.ENGINE = ENGINE;
})(typeof window !== 'undefined' ? window : globalThis);
