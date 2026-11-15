// Run with: node test.js
const assert = require('assert');
const crypto = require('crypto');
const E = require('./engine.js');
const SEED = require('./seed.js');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ✓ ' + name); };
const imp = (decision, autonomy, data, scale, reversibility) => ({ decision, autonomy, data, scale, reversibility });
const ans = o => Object.assign({ prohibited: [], areas: [], profiling: false, narrow: false, transparency: [], tools: [], impact: imp(0, 0, 0, 0, 0) }, o);
const intake = { name: 'X', kind: 'AI system or model (produces output for people)', unit: 'U', purpose: 'P', affected: 'A', source: 'Built in-house', vendor: '' };
const fresh = () => E.act(E.createCase('UC-1', 'owner', 1), 'submitIntake', 'owner', intake, 2);

console.log('Hashing');
test('sha256 matches Node crypto, including multi-block and non-ASCII input', () => {
  for (const s of ['', 'abc', 'é—✓ governance', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'y'.repeat(1000)])
    assert.strictEqual(E.sha256(s), crypto.createHash('sha256').update(s, 'utf8').digest('hex'));
});

console.log('Classification');
test('a prohibited practice is tier 0 whatever else is answered', () => {
  assert.strictEqual(E.classify(ans({ prohibited: ['social'], impact: imp(0, 0, 0, 0, 0) })).tier, 0);
});
test('Annex III + profiling is high-risk and Critical even with a low impact score', () => {
  const r = E.classify(ans({ areas: ['employment'], profiling: true, narrow: true, impact: imp(1, 0, 0, 0, 0) }));
  assert.deepStrictEqual([r.regClass, r.tier], ['high', 1]);
});
test('Art. 6(3) exemption: narrow task, no profiling → not high-risk, but must be documented', () => {
  const r = E.classify(ans({ areas: ['education'], narrow: true, impact: imp(1, 0, 1, 1, 0) }));
  assert.deepStrictEqual([r.regClass, r.tier, r.flags.exemption], ['minimal', 3, true]);
});
test('no exemption for a product safety component', () => {
  assert.strictEqual(E.classify(ans({ areas: ['product'], narrow: true })).regClass, 'high');
});
test('regulation is the floor, not the ceiling: unregulated but high-impact is Critical', () => {
  const r = E.classify(ans({ impact: imp(2, 3, 1, 2, 2) }));
  assert.deepStrictEqual([r.regClass, r.tier, r.flags.agent], ['minimal', 1, true]);
});
test('a fully autonomous low-score system cannot use the fast lane', () => {
  assert.strictEqual(E.classify(ans({ impact: imp(0, 3, 0, 0, 0) })).tier, 2);
});
test('controls scale with tier and flags', () => {
  const ids = a => { const c = fresh(); E.act(c, 'submitTriage', 'owner', a, 3); return E.requiredControls(c).map(k => k.id); };
  assert.deepStrictEqual(ids(ans({ impact: imp(0, 0, 1, 1, 0) })), ['B1', 'B2', 'B4']);
  assert.strictEqual(ids(ans({ areas: ['essential'], profiling: true, impact: imp(3, 1, 2, 3, 2) })).length, 15);
});

console.log('Agent track');
const AGENT = 'AI agent (takes actions through tools)';
const agentCase = (a, kind) => { const c = E.act(E.createCase('UC-1', 'owner', 1), 'submitIntake', 'owner', Object.assign({}, intake, kind ? { kind } : {}), 2); E.act(c, 'submitTriage', 'owner', a, 3); return c; };
test('an undeclared agent is still caught: autonomy or a consequential tool is enough', () => {
  assert.strictEqual(E.classify(ans({ impact: imp(0, 2, 0, 0, 0) }), intake).flags.agent, true);
  assert.strictEqual(E.classify(ans({ tools: ['money'] }), intake).flags.agent, true);
  assert.strictEqual(E.classify(ans({ tools: ['read'], impact: imp(1, 1, 1, 1, 0) }), intake).flags.agent, false);
});
test('consequential tools lift the tier: Elevated with a human in the loop, Critical when acting alone', () => {
  assert.strictEqual(E.classify(ans({ tools: ['write'], impact: imp(0, 1, 0, 0, 0) }), intake).tier, 2);
  assert.strictEqual(E.classify(ans({ tools: ['money'], impact: imp(0, 2, 0, 0, 0) }), intake).tier, 1);
});
test('agent controls scale: 2 at Standard, 6 at Elevated, plus memory rules when it keeps state', () => {
  const A = c => E.requiredControls(c).map(k => k.id).filter(id => id[0] === 'A');
  assert.deepStrictEqual(A(agentCase(ans({ tools: ['read'] }), AGENT)), ['A1', 'A2']);
  assert.deepStrictEqual(A(agentCase(ans({ tools: ['write', 'memory'], impact: imp(1, 1, 1, 1, 0) }))), ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7']);
});
test('a Standard-tier agent still needs Security, passes go-live with the manifest check, and is reviewed twice as often', () => {
  const c = agentCase(ans({ tools: ['read'] }), AGENT);
  assert.deepStrictEqual([c.triage.result.tier, E.approvers(c), E.reviewDays(c)], [3, ['gov', 'security'], 183]);
  E.act(c, 'confirmTriage', 'gov', {}, 4);
  E.requiredControls(c).forEach(k => E.act(c, 'setControl', 'owner', { id: k.id, status: 'done', note: 'x' }, 5));
  E.act(c, 'submitAssessment', 'owner', {}, 6);
  E.act(c, 'sign', 'gov', { decision: 'approve' }, 7); E.act(c, 'sign', 'security', { decision: 'approve' }, 8);
  assert.strictEqual(c.stage, 'golive');
  ['mon', 'stop', 'user'].forEach(id => E.act(c, 'setCheck', 'owner', { id, value: true }, 9));
  assert.throws(() => E.act(c, 'authoriseGoLive', 'gov', {}, 10), /0 condition\(s\) and 1 readiness/);
});
test('widening an agent after approval voids the approval', () => {
  const c = SEED(Date.now()).find(x => x.intake.name === 'IT helpdesk agent');
  assert.strictEqual(c.stage, 'monitor');
  E.act(c, 'materialChange', 'owner', { reason: 'Adding a tool to grant admin rights' });
  assert.deepStrictEqual([c.stage, c.triage.confirmed, c.decision], ['triage', false, null]);
});

console.log('Gates and decision rights');
test('G1: intake cannot be submitted incomplete', () => {
  const c = E.createCase('UC-1', 'owner', 1);
  assert.throws(() => E.act(c, 'submitIntake', 'owner', { name: 'X' }, 2), /Gate G1/);
});
test('stages cannot be skipped', () => {
  assert.throws(() => E.act(fresh(), 'submitAssessment', 'owner', {}, 3), /not available at the triage stage/);
});
test('owners cannot confirm their own tier; second line can escalate but never lower', () => {
  const c = fresh();
  E.act(c, 'submitTriage', 'owner', ans({ impact: imp(1, 1, 2, 2, 1) }), 3);
  assert.throws(() => E.act(c, 'confirmTriage', 'owner', {}, 4), /Not permitted/);
  assert.throws(() => E.act(c, 'confirmTriage', 'gov', { escalateTo: 3, reason: 'x' }, 4), /never lower/);
  E.act(c, 'confirmTriage', 'gov', { escalateTo: 1, reason: 'Novel vendor' }, 4);
  assert.strictEqual(c.triage.result.tier, 1);
});
test('G3: evidence is required, N/A needs a reason, validation is reserved for the validator', () => {
  const c = fresh();
  E.act(c, 'submitTriage', 'owner', ans({ areas: ['essential'], profiling: true, impact: imp(3, 1, 2, 3, 2) }), 3);
  E.act(c, 'confirmTriage', 'gov', {}, 4);
  assert.throws(() => E.act(c, 'submitAssessment', 'owner', {}, 5), /Gate G3/);
  assert.throws(() => E.act(c, 'setControl', 'owner', { id: 'B1', status: 'na', note: '' }, 5), /justification/);
  assert.throws(() => E.act(c, 'setControl', 'owner', { id: 'K3', status: 'done', note: 'self-validated' }, 5), /Independent Validator/);
});
test('G4: owners cannot sign; every required approver must; conditions hold the go-live gate', () => {
  const c = SEED(Date.now()).find(x => x.intake.name === 'Credit limit recommendation');
  assert.throws(() => E.act(c, 'sign', 'owner', { decision: 'approve' }), /not an approver/);
  assert.throws(() => E.act(c, 'sign', 'gov', { decision: 'approve' }), /already signed/);
  E.act(c, 'sign', 'legal', { decision: 'approve' });
  assert.strictEqual(c.stage, 'decide');
  E.act(c, 'sign', 'committee', { decision: 'approve' });
  assert.strictEqual(c.stage, 'golive');
  assert.throws(() => E.act(c, 'authoriseGoLive', 'gov', {}), /Gate G5/);
});
test('a serious incident pauses use and reopens triage; signatures are cleared', () => {
  const c = SEED(Date.now()).find(x => x.intake.name === 'Customer support assistant');
  E.act(c, 'logIncident', 'security', { severity: 'serious', text: 'Leaked another customer’s address' });
  assert.deepStrictEqual([c.stage, c.monitor.paused, Object.keys(c.signoffs).length], ['triage', true, 0]);
});
test('blocked use cases accept no further actions', () => {
  const c = SEED(Date.now()).find(x => x.status === 'blocked');
  assert.throws(() => E.act(c, 'reviseTriage', 'owner', {}), /blocked/);
});

console.log('Audit trail');
test('every seeded chain verifies, and editing any entry breaks it', () => {
  const cases = SEED(Date.now());
  cases.forEach(c => assert.ok(E.verifyChain(c).ok));
  const c = cases[1];
  c.log[3].detail = 'quietly rewritten';
  assert.deepStrictEqual(E.verifyChain(c), { ok: false, brokenAt: 4 });
});

console.log('\n' + passed + ' tests passed');
