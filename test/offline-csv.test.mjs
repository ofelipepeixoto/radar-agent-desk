import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MAX_COUNTS_CSV_BYTES, summarizeCountsCsv } from '../src/offline-csv.mjs';
import { parseSnapshotJson, summarizeSnapshot } from '../src/snapshot.mjs';

const fixture = name => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const csvPath = fixture('contagens-planilha-exemplo.csv');
const jsonPath = fixture('contagens-exemplo.json');
const expected = JSON.parse(readFileSync(fixture('resumo-offline-exemplo.json'), 'utf8'));
const cli = fileURLToPath(new URL('../bin/radar-agent-desk.mjs', import.meta.url));
const semicolon = readFileSync(csvPath, 'utf8');
const [header] = semicolon.split('\n');
const parse = value => summarizeCountsCsv(Buffer.from(value));

test('spreadsheet and manual JSON reach the same versioned summary', () => {
  assert.deepEqual(parse(semicolon), expected);
  assert.deepEqual(summarizeSnapshot(parseSnapshotJson(readFileSync(jsonPath))), expected);
  assert.deepEqual(parse(`\ufeff${semicolon.replaceAll(';', ',').replaceAll('\n', '\r\n')}`), expected);
  assert.deepEqual(parse(semicolon.trimEnd()), expected);
});

test('validates the exact header and rejects mixed sources, duplicate columns and extra rows', () => {
  for (const malformed of [
    semicolon.replace('pendingApprovals', 'done'),
    semicolon.replace('pendingApprovals', 'ownerName'),
    semicolon.replace('open;inProgress', 'inProgress;open'),
    semicolon.replace('open;inProgress', 'open,inProgress'),
    `${semicolon}1;8;3;2;5;1\n`,
    `${semicolon}\n`,
    `${header}\n1;8;3;2;5;1;2`,
    `${header}\n1;8;3;2;5`,
    `${header}\r1;8;3;2;5;1`,
    `${header}\n`,
  ]) assert.throws(() => parse(malformed), { code: 'INVALID_COUNTS_CSV_LAYOUT' });
});

test('rejects unsupported version and noncanonical cells without echoing their contents', () => {
  assert.throws(() => parse(`${header}\n2;8;3;2;5;1`), { code: 'UNSUPPORTED_COUNTS_CSV_VERSION' });
  for (const cell of ['-1', '2.5', '+5', '1e3', '05', ' 5', '5\r', '"5"', '', '=SECRET()', '５', '99999999999']) {
    assert.throws(() => parse(`${header}\n1;8;3;2;${cell};1`), {
      code: 'INVALID_COUNTS_CSV_VALUE', message: 'INVALID_COUNTS_CSV_VALUE',
    });
  }
});

test('enforces shared aggregate limits, overlap, and zero', () => {
  assert.throws(() => parse(`${header}\n1;4;3;2;5;1`), { code: 'DASHBOARD_INCONSISTENT_COUNTS' });
  assert.throws(() => parse(`${header}\n1;8;3;2;1000000001;1`), { code: 'INVALID_DASHBOARD_COUNT' });
  assert.deepEqual(parse(`${header}\n1;0;0;0;1000000000;0`).dashboard, {
    state: 'available', coverage: 'operator_declared_aggregate',
    open: 0, inProgress: 0, blocked: 0, done: 1_000_000_000, pendingApprovals: 0,
  });
});

test('rejects oversize or invalid UTF-8 before parsing', () => {
  assert.throws(() => summarizeCountsCsv(Buffer.alloc(MAX_COUNTS_CSV_BYTES + 1, 0x61)), { code: 'LIMIT_CSV_BYTES' });
  assert.throws(() => summarizeCountsCsv(Buffer.from([0xc3, 0x28])), { code: 'INVALID_UTF8' });
});

test('CLI requires an explicit CSV format and keeps JSON as the default', () => {
  const run = args => execFileSync(process.execPath, [cli, 'snapshot', ...args], { encoding: 'utf8' });
  const csv = run(['--format', 'csv', '--input', csvPath]);
  assert.equal(csv, run(['--input', jsonPath]));
  assert.equal(csv, run(['--format', 'json', '--input', jsonPath]));
  assert.deepEqual(JSON.parse(csv), expected);

  for (const [args, code] of [
    [['snapshot', '--input', csvPath], 'INVALID_JSON'],
    [['snapshot', '--format', 'xlsx', '--input', csvPath], 'FORMATO_INVALIDO_USE_JSON_OU_CSV'],
    [['demo', '--format', 'csv'], 'ARGUMENTOS_INVALIDOS_USE_HELP'],
  ]) {
    const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, new RegExp(code));
    assert.ok(!result.stderr.includes(csvPath));
  }
});
