import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseSnapshotJson, summarizeSnapshot } from '../src/snapshot.mjs';

const fixture = readFileSync(new URL('../fixtures/contagens-exemplo.json', import.meta.url));
const counts = { open: 8, inProgress: 3, blocked: 2, done: 5, pendingApprovals: 1 };
const offline = (values = counts) => ({ schemaVersion: 1, source: 'radar-offline', counts: values });

test('summarizes synthetic offline counts without treating them as authenticated data', () => {
  assert.deepEqual(summarizeSnapshot(parseSnapshotJson(fixture)), {
    schemaVersion: 1,
    source: 'radar-offline',
    authenticity: 'not_verified_by_summary',
    scopeEvidence: 'operator_declared_counts_no_auth_claim',
    dashboard: { state: 'available', coverage: 'operator_declared_aggregate', ...counts },
    taskPage: { state: 'unavailable' },
    pendingApprovals: { state: 'unavailable' },
    humanApprovalRequired: true,
    actionsExecuted: false,
  });
});

test('requires the exact offline schema and rejects IDs, free text and scope claims', () => {
  const { done, ...missingDone } = counts;
  for (const malformed of [
    { ...offline(), description: 'some text' },
    { ...offline(), connection: { scopes: ['paperclip:read'] } },
    offline({ ...counts, companyId: '11111111-1111-4111-8111-111111111111' }),
    offline({ ...missingDone, other: done }),
    offline(missingDone),
    offline([8, 3, 2, 5, 1]),
    offline(null),
  ]) assert.throws(() => summarizeSnapshot(malformed), { code: 'INVALID_OFFLINE_COUNTS_FORMAT' });
});

test('requires non-negative bounded integer counts without coercion', () => {
  for (const invalid of [-1, 1.5, 1_000_000_001, '1', null, true]) {
    assert.throws(() => summarizeSnapshot(offline({ ...counts, done: invalid })), { code: 'INVALID_DASHBOARD_COUNT' });
  }
  assert.equal(summarizeSnapshot(offline({ ...counts, done: 1_000_000_000 })).dashboard.done, 1_000_000_000);
});

test('recognizes the open subcounts and accepts explicit zero counts', () => {
  assert.throws(() => summarizeSnapshot(offline({ ...counts, open: 4 })), { code: 'DASHBOARD_INCONSISTENT_COUNTS' });
  const zero = { open: 0, inProgress: 0, blocked: 0, done: 0, pendingApprovals: 0 };
  assert.deepEqual(summarizeSnapshot(offline(zero)).dashboard,
    { state: 'available', coverage: 'operator_declared_aggregate', ...zero });
});
