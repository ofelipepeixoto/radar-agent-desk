import { Buffer } from 'node:buffer';

export const MAX_SNAPSHOT_BYTES = 256 * 1024;
const MAX_DEPTH = 32;
const MAX_NODES = 25_000;
const MAX_TASKS = 100;
const MAX_APPROVALS = 100;
const MAX_DASHBOARD_COUNT = 1_000_000_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOURCES = ['fixture', 'paperclip-native-mcp', 'paperclip-local-rest', 'radar-offline'];
export const OFFLINE_COUNT_KEYS = Object.freeze(['open', 'inProgress', 'blocked', 'done', 'pendingApprovals']);
const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'blocked', 'cancelled'];
const APPROVAL_TYPES = ['hire_agent', 'approve_ceo_strategy', 'budget_override_required', 'request_board_approval'];

export class SnapshotError extends Error {
  constructor(code) {
    super(code);
    this.name = 'SnapshotError';
    this.code = code;
  }
}

function check(condition, code) {
  if (!condition) throw new SnapshotError(code);
}

// Scan structure before JSON.parse so hostile nesting and duplicate JSON keys
// (including escaped spellings) do not reach ordinary property validation.
function scan(text) {
  const stack = [];
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      const start = i;
      for (i += 1; i < text.length && text[i] !== '"'; i += 1) {
        if (text[i] === '\\') i += 1;
      }
      if (i >= text.length) break; // JSON.parse reports invalid syntax.
      const keys = stack.at(-1);
      if (keys) {
        let next = i + 1;
        while (next < text.length && /[\t\n\r ]/.test(text[next])) next += 1;
        if (text[next] === ':') {
          const key = JSON.parse(text.slice(start, i + 1));
          check(!keys.has(key), 'DUPLICATE_JSON_KEY');
          keys.add(key);
        }
      }
    } else if (char === '{' || char === '[') {
      stack.push(char === '{' ? new Set() : null);
      check(stack.length <= MAX_DEPTH, 'LIMIT_DEPTH');
    } else if (char === '}' || char === ']') {
      stack.pop();
    }
  }
}

export function parseSnapshotJson(bytes) {
  check(typeof bytes === 'string' || bytes instanceof Uint8Array, 'INVALID_JSON_INPUT');
  check(bytes.length <= MAX_SNAPSHOT_BYTES, 'LIMIT_BYTES');
  if (typeof bytes === 'string') check(Buffer.byteLength(bytes) <= MAX_SNAPSHOT_BYTES, 'LIMIT_BYTES');
  let text;
  try {
    text = typeof bytes === 'string' ? bytes : new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new SnapshotError('INVALID_UTF8');
  }
  try {
    scan(text);
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SnapshotError) throw error;
    throw new SnapshotError('INVALID_JSON');
  }
}

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertCompact(input) {
  let nodes = 0;
  let bytes = 0;
  function addText(value) {
    check(value.length <= MAX_SNAPSHOT_BYTES, 'LIMIT_BYTES');
    bytes += Buffer.byteLength(value);
    check(bytes <= MAX_SNAPSHOT_BYTES, 'LIMIT_BYTES');
  }
  function visit(value, depth) {
    nodes += 1;
    check(nodes <= MAX_NODES, 'LIMIT_NODES');
    if (value === null || typeof value === 'boolean') return;
    if (typeof value === 'number') return check(Number.isFinite(value), 'INVALID_VALUE');
    if (typeof value === 'string') return addText(value);
    check(typeof value === 'object', 'INVALID_VALUE');
    check(depth <= MAX_DEPTH, 'LIMIT_DEPTH');
    const proto = Object.getPrototypeOf(value);
    check(proto === Object.prototype || proto === Array.prototype || proto === null, 'INVALID_VALUE');
    for (const key of Reflect.ownKeys(value)) {
      if (Array.isArray(value) && key === 'length') continue;
      check(typeof key === 'string', 'INVALID_VALUE');
      addText(key);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      check(descriptor?.enumerable && Object.hasOwn(descriptor, 'value'), 'INVALID_VALUE');
      visit(descriptor.value, depth + 1);
    }
  }
  visit(input, 1);
}

function companyIfPresent(value, companyId) {
  if (Object.hasOwn(value, 'companyId')) check(value.companyId === companyId, 'COMPANY_MISMATCH');
}

function assertSuccessful(value, code) {
  check(!Object.hasOwn(value, 'outcome') && (!Object.hasOwn(value, 'isError') || value.isError === false), code);
}

function toolEnvelope(envelope, companyId) {
  check(record(envelope) && record(envelope.result), 'INVALID_TOOL_ENVELOPE');
  check(envelope.requestedCompanyId === companyId, 'COMPANY_MISMATCH');
  assertSuccessful(envelope, 'INVALID_TOOL_ENVELOPE');
  assertSuccessful(envelope.result, 'INVALID_TOOL_ENVELOPE');
  companyIfPresent(envelope.result, companyId);
  return envelope.result;
}

function countRows(rows, enums, field, companyId, requireCompany, max) {
  check(Array.isArray(rows), 'INVALID_ROWS');
  check(rows.length <= max, 'LIMIT_ROWS');
  const ids = new Set();
  const counts = Object.fromEntries(enums.map((value) => [value, 0]));
  let unknown = 0;
  for (const row of rows) {
    check(record(row) && typeof row.id === 'string' && UUID.test(row.id), 'INVALID_ROW_ID');
    const id = row.id.toLowerCase();
    check(!ids.has(id), 'DUPLICATE_ROW_ID');
    ids.add(id);
    if (requireCompany) check(row.companyId === companyId, 'COMPANY_MISMATCH');
    else companyIfPresent(row, companyId);
    if (field === 'type') check(row.status === 'pending', 'INVALID_APPROVAL_STATE');
    const value = row[field];
    if (typeof value === 'string' && Object.hasOwn(counts, value)) counts[value] += 1;
    else unknown += 1;
  }
  return { rows: rows.length, counts, unknown };
}

function aggregateSummary({ open, inProgress, blocked, done, pendingApprovals }, coverage) {
  for (const count of [open, inProgress, blocked, done, pendingApprovals]) {
    check(Number.isSafeInteger(count) && count >= 0 && count <= MAX_DASHBOARD_COUNT, 'INVALID_DASHBOARD_COUNT');
  }
  // These are disjoint statuses within `open`, not extra tasks to add to it.
  check(inProgress + blocked <= open, 'DASHBOARD_INCONSISTENT_COUNTS');
  return { state: 'available', coverage, open, inProgress, blocked, done, pendingApprovals };
}

function dashboardSummary(dashboard, companyId) {
  check(record(dashboard) && record(dashboard.tasks), 'INVALID_DASHBOARD');
  check(dashboard.companyId === companyId, 'COMPANY_MISMATCH');
  assertSuccessful(dashboard, 'INVALID_DASHBOARD');
  const { open, inProgress, blocked, done } = dashboard.tasks;
  return aggregateSummary({ open, inProgress, blocked, done, pendingApprovals: dashboard.pendingApprovals }, 'dashboard_aggregate');
}

function hasExactKeys(value, keys) {
  return record(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function summary(source, scopeEvidence, dashboard, taskPage = { state: 'unavailable' }, pendingApprovals = { state: 'unavailable' }) {
  return {
    schemaVersion: 1,
    source,
    authenticity: 'not_verified_by_summary',
    scopeEvidence,
    dashboard,
    taskPage,
    pendingApprovals,
    humanApprovalRequired: true,
    actionsExecuted: false,
  };
}

export function summarizeSnapshot(input) {
  assertCompact(input);
  check(record(input) && input.schemaVersion === 1 && SOURCES.includes(input.source), 'INVALID_SNAPSHOT');
  if (input.source === 'radar-offline') {
    check(hasExactKeys(input, ['schemaVersion', 'source', 'counts']) && hasExactKeys(input.counts, OFFLINE_COUNT_KEYS), 'INVALID_OFFLINE_COUNTS_FORMAT');
    return summary(input.source, 'operator_declared_counts_no_auth_claim', aggregateSummary(input.counts, 'operator_declared_aggregate'));
  }
  const connection = input.connection;
  check(record(connection) && typeof connection.companyId === 'string' && UUID.test(connection.companyId), 'INVALID_CONNECTION');
  assertSuccessful(connection, 'INVALID_CONNECTION');
  const companyId = connection.companyId;
  if (Object.hasOwn(connection, 'company')) {
    check(record(connection.company) && connection.company.id === companyId, 'COMPANY_MISMATCH');
  }
  let dashboard = { state: 'unavailable' };
  if (input.source === 'paperclip-local-rest') {
    check(!Object.hasOwn(connection, 'scopes'), 'INVALID_REST_SCOPE_CLAIM');
    check(!Object.hasOwn(input, 'taskPage') && !Object.hasOwn(input, 'pendingApprovals'), 'MIXED_SNAPSHOT_FORMAT');
    dashboard = dashboardSummary(input.dashboard, companyId);
  } else {
    check(!Object.hasOwn(input, 'dashboard'), 'MIXED_SNAPSHOT_FORMAT');
    check(Array.isArray(connection.scopes) && connection.scopes.length === 1 && connection.scopes[0] === 'paperclip:read', 'READ_ONLY_SCOPE_REQUIRED');
  }

  let taskPage = { state: 'unavailable' };
  if (Object.hasOwn(input, 'taskPage')) {
    const result = toolEnvelope(input.taskPage, companyId);
    check(Number.isSafeInteger(result.limit) && result.limit >= 1 && result.limit <= MAX_TASKS, 'INVALID_PAGINATION');
    check(Number.isSafeInteger(result.offset) && result.offset >= 0, 'INVALID_PAGINATION');
    const metrics = countRows(result.tasks, TASK_STATUSES, 'status', companyId, true, result.limit);
    taskPage = {
      state: 'available', coverage: 'single_page_only', binding: 'declared_company_matches_task_rows',
      offset: result.offset, limit: result.limit, atPageLimit: metrics.rows === result.limit,
      rows: metrics.rows, statusCounts: metrics.counts, unknownStatusCount: metrics.unknown,
    };
  }

  let pendingApprovals = { state: 'unavailable' };
  if (Object.hasOwn(input, 'pendingApprovals')) {
    const result = toolEnvelope(input.pendingApprovals, companyId);
    const metrics = countRows(result.approvals, APPROVAL_TYPES, 'type', companyId, false, MAX_APPROVALS);
    pendingApprovals = {
      state: 'available', coverage: 'response_rows_only', binding: 'declared_request_company',
      rows: metrics.rows, typeCounts: metrics.counts, unknownTypeCount: metrics.unknown,
    };
  }

  return summary(input.source,
    input.source === 'paperclip-local-rest' ? 'local_trusted_no_oauth_claim' : 'operator_declared_read_only',
    dashboard, taskPage, pendingApprovals);
}
