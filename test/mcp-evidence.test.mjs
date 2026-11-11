import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { evaluateMcpEvidence, MAX_MCP_EVIDENCE_BYTES } from '../src/mcp-evidence.mjs';

const fixture = readFileSync(new URL('../fixtures/mcp-evidence-synthetic.json', import.meta.url));
const demo = () => JSON.parse(fixture);
const encode = (value) => Buffer.from(JSON.stringify(value));
const script = fileURLToPath(new URL('../scripts/check-mcp-evidence.mjs', import.meta.url));
const run = (input) => spawnSync(process.execPath, [script], { input, encoding: 'utf8', timeout: 3000 });

test('synthetic successful scope and revocation evidence never qualifies as live or permits activation', () => {
  const response = run(fixture);
  assert.equal(response.status, 0);
  const result = JSON.parse(response.stdout);
  assert.equal(result.reviewStatus, 'synthetic-only');
  assert.deepEqual(result.unmetCases, []);
  assert.equal(result.liveVerification, false);
  assert.equal(result.activationPermitted, false);
});

test('declared staging results can be presented for human review without claiming live verification', () => {
  const input = demo();
  input.environment = 'isolated-authenticated';
  const result = evaluateMcpEvidence(encode(input));
  assert.equal(result.reviewStatus, 'declared-for-human-review');
  assert.equal(result.liveVerification, false);
  assert.equal(result.activationPermitted, false);
});

test('partial evidence fails closed on expanded scope, cross-company leakage, or an old grant still working', () => {
  const input = demo();
  input.preflight.dependencyReviewCompleted = false;
  input.grantedScopes.push('offline_access');
  input.observed.readOtherCompany = 'allowed';
  input.observed.readWithRevokedGrant = 'allowed';
  input.observed.readAfterMembershipRemoval = 'unavailable';
  const response = run(encode(input));
  assert.equal(response.status, 2);
  const result = JSON.parse(response.stdout);
  assert.equal(result.reviewStatus, 'incomplete');
  assert.equal(result.scopesMatch, false);
  assert.deepEqual(result.preflightMissing, ['dependencyReviewCompleted']);
  assert.deepEqual(result.unmetCases, ['readOtherCompany', 'readWithRevokedGrant', 'readAfterMembershipRemoval']);
});

test('a failure of the wrong type cannot prove scope enforcement or successful revocation', () => {
  const input = demo();
  input.observed.taskWrite = 'authentication-denied';
  input.observed.agentConfigure = 'company-denied';
  input.observed.readWithRevokedGrant = 'scope-denied';
  assert.deepEqual(evaluateMcpEvidence(encode(input)).unmetCases, ['taskWrite', 'agentConfigure', 'readWithRevokedGrant']);
});

test('rejects arbitrary data, duplicates, and oversized inputs without echoing raw content', () => {
  const input = demo();
  input.token = 'FAKE_VALUE_NEVER_ECHO';
  const response = run(encode(input));
  assert.equal(response.status, 1);
  assert.equal(response.stdout, '');
  assert.doesNotMatch(response.stderr, /FAKE_VALUE_NEVER_ECHO/);
  assert.equal(run(Buffer.alloc(MAX_MCP_EVIDENCE_BYTES + 1, 32)).status, 1);
  const duplicate = fixture.toString().replace('"schemaVersion": 1', '"schemaVersion": 1, "schemaVersion": 1');
  assert.equal(run(duplicate).status, 1);
});
