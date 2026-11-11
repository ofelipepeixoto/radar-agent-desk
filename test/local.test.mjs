import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { captureLocal, probeLocal, readPort } from '../src/paperclip-local.mjs';
import { detectEnvironment } from '../src/diagnostics.mjs';

const run = promisify(execFile);
const bin = fileURLToPath(new URL('../bin/radar-agent-desk.mjs', import.meta.url));
const companyId = '11111111-1111-4111-8111-111111111111';
const otherCompany = '22222222-2222-4222-8222-222222222222';
const privateText = 'PRIVATE-DO-NOT-EXPOSE-EXAMPLE';
const health = {
  status: 'ok', deploymentMode: 'local_trusted', deploymentExposure: 'private',
  serverVersion: '2026.1106.0', commit: 'd69631b01b9c658f80bf8bed389863dce82643e1',
};
const base = `/api/companies/${companyId}`;
const dashboard = `${base}/dashboard`;
const tasks = { open: 3, inProgress: 1, blocked: 1, done: 2 };

function json(res, value, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}

async function listen(t, handler) {
  const seen = [];
  const server = createServer((req, res) => {
    seen.push({ method: req.method, path: req.url, headers: req.headers });
    handler(req, res);
  });
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  t.after(() => new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  return { port: String(server.address().port), seen };
}

function source(t, changes = {}) {
  const values = {
    '/api/health': { ...health, internal: privateText },
    [base]: { id: companyId, name: privateText },
    [dashboard]: { companyId, tasks: { ...tasks, sampleTitle: privateText }, pendingApprovals: 1,
      costs: { providerName: privateText, company: otherCompany } },
    ...changes,
  };
  return listen(t, (req, res) => Object.hasOwn(values, req.url) ? json(res, values[req.url]) : json(res, { error: privateText }, 404));
}

test('doctor identifies WSL kernels without returning usernames or paths', async () => {
  assert.equal(detectEnvironment('linux', '6.6.87.2-microsoft-standard-WSL2'), 'wsl2');
  assert.equal(detectEnvironment('linux', '4.4.0-19041-Microsoft'), 'wsl');
  assert.equal(detectEnvironment('linux', '6.12.0-generic'), 'linux');
  assert.equal(detectEnvironment('win32', '10.0'), 'windows');
  const { stdout, stderr } = await run(process.execPath, [bin, 'doctor']);
  const result = JSON.parse(stdout);
  assert.equal(stderr, '');
  assert.equal(result.status, 'ok');
  assert.equal(result.ambiente, detectEnvironment());
  assert.deepEqual(Object.keys(result).sort(), ['ambiente', 'node', 'proximoPasso', 'status']);
});

test('CLI separates refused loopback connection, stalled response and incompatible version without echoing payloads', { timeout: 12_000 }, async (t) => {
  const closed = createServer();
  await new Promise((resolve, reject) => closed.listen(0, '127.0.0.1', resolve).once('error', reject));
  const closedPort = String(closed.address().port);
  await new Promise((resolve, reject) => closed.close((error) => error ? reject(error) : resolve()));
  const stalled = await listen(t, (_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.write(`{"message":"${privateText}`);
  });
  const incompatible = await source(t, { '/api/health': { ...health, serverVersion: privateText } });
  const cases = [
    [closedPort, /PAPERCLIP_CONEXAO_RECUSADA/, /porta certa/],
    [stalled.port, /PAPERCLIP_TEMPO_ESGOTADO/, /3 segundos/],
    [incompatible.port, /VERSAO_PAPERCLIP_NAO_HOMOLOGADA/, /2026\.1106\.0/],
  ];
  await Promise.all(cases.map(([port, code, hint]) => assert.rejects(
    run(process.execPath, [bin, 'probe', '--port', port]),
    (error) => {
      assert.equal(error.code, 1);
      assert.equal(error.stdout, '');
      assert.match(error.stderr, code);
      assert.match(error.stderr, hint);
      assert.doesNotMatch(error.stderr, new RegExp(privateText));
      return true;
    },
  )));
  assert.deepEqual(stalled.seen.map(({ path }) => path), ['/api/health']);
  assert.deepEqual(incompatible.seen.map(({ path }) => path), ['/api/health']);
});

test('local capture issues exactly three fixed GET requests for the selected company without forwarding credentials', async (t) => {
  const { port, seen } = await source(t);
  const snapshot = await captureLocal({ companyId, port });
  assert.deepEqual(seen.map(({ method, path }) => [method, path]), [
    ['GET', '/api/health'], ['GET', base], ['GET', dashboard],
  ]);
  for (const { headers } of seen) {
    assert.equal(headers.host, `127.0.0.1:${port}`);
    assert.equal(headers.authorization, undefined);
    assert.equal(headers.cookie, undefined);
    assert.equal(headers['accept-encoding'], 'identity');
  }
  assert.deepEqual(snapshot, {
    schemaVersion: 1, source: 'paperclip-local-rest', connection: { companyId },
    dashboard: { companyId, tasks, pendingApprovals: 1 },
  });
});

test('rejects an invalid company ID before contacting even a healthy service', async (t) => {
  const { port, seen } = await source(t);
  await assert.rejects(captureLocal({ companyId: `${companyId}/../elsewhere`, port }), { code: 'EMPRESA_UUID_INVALIDO' });
  assert.deepEqual(seen, []);
  for (const invalid of ['0', '00080', '65536', '127.0.0.1:3100', 'https://example.invalid', 3100]) {
    assert.throws(() => readPort(invalid), { code: 'PORT_INVALIDA' });
  }
});

test('refuses redirects and authentication failures without reaching an alternative destination or reflecting body text', async (t) => {
  const destination = await listen(t, (_req, res) => json(res, health));
  for (const status of [302, 401, 403]) {
    const origin = await listen(t, (_req, res) => {
      res.writeHead(status, { location: `http://127.0.0.1:${destination.port}/unexpected` });
      res.end(privateText);
    });
    await assert.rejects(captureLocal({ companyId, port: origin.port }), { code: 'PAPERCLIP_HTTP_NAO_OK', message: 'PAPERCLIP_HTTP_NAO_OK' });
    assert.deepEqual(origin.seen.map(({ path }) => path), ['/api/health']);
  }
  assert.deepEqual(destination.seen, []);
});

test('CLI probe keeps the connection on loopback even if Node environment proxies are enabled', async (t) => {
  const local = await source(t);
  const proxy = await listen(t, (_req, res) => json(res, { error: privateText }, 403));
  const proxyUrl = `http://127.0.0.1:${proxy.port}`;
  const { stdout, stderr } = await run(process.execPath, [bin, 'probe', '--port', local.port], {
    env: { ...process.env, NODE_USE_ENV_PROXY: '1', HTTP_PROXY: proxyUrl, http_proxy: proxyUrl,
      NO_PROXY: '', no_proxy: '' },
  });
  assert.equal(stderr, '');
  assert.equal(JSON.parse(stdout).reportedCommitMatches, true);
  assert.deepEqual(local.seen.map(({ path }) => path), ['/api/health']);
  assert.deepEqual(proxy.seen, []);
});

test('requires a ready, private, local-trusted instance reporting the pinned version and no conflicting commit', async (t) => {
  const scenarios = [
    [{ status: 'starting' }, 'PAPERCLIP_NAO_PRONTO'],
    [{ deploymentMode: 'authenticated' }, 'MODO_LOCAL_PRIVADO_EXIGIDO'],
    [{ deploymentExposure: 'public' }, 'MODO_LOCAL_PRIVADO_EXIGIDO'],
    [{ serverVersion: '2026.1107.0' }, 'VERSAO_PAPERCLIP_NAO_HOMOLOGADA'],
    [{ commit: 'a'.repeat(40) }, 'COMMIT_PAPERCLIP_DIVERGENTE'],
  ];
  for (const [changes, code] of scenarios) {
    const { port, seen } = await source(t, { '/api/health': { ...health, ...changes } });
    await assert.rejects(captureLocal({ companyId, port }), { code });
    assert.deepEqual(seen.map(({ path }) => path), ['/api/health']);
  }
  const { port } = await source(t, { '/api/health': { ...health, commit: null } });
  const probe = await probeLocal(port);
  assert.equal(probe.version, health.serverVersion);
  assert.equal(probe.reportedCommitMatches, false);
  assert.doesNotMatch(JSON.stringify(probe), new RegExp(privateText));
});

test('fails closed if the selected company or dashboard belongs to a different company', async (t) => {
  const foreign = await source(t, { [base]: { id: otherCompany, name: privateText } });
  await assert.rejects(captureLocal({ companyId, port: foreign.port }), { code: 'EMPRESA_NAO_CONFIRMADA' });
  assert.deepEqual(foreign.seen.map(({ path }) => path), ['/api/health', base]);

  const wrongDashboard = await source(t, { [dashboard]: { companyId: otherCompany, tasks, pendingApprovals: 1 } });
  await assert.rejects(captureLocal({ companyId, port: wrongDashboard.port }), { code: 'EMPRESA_DIVERGENTE' });
});

test('rejects an oversized response advertised in Content-Length or delivered in chunks', async (t) => {
  const payload = JSON.stringify({ message: privateText.repeat(16_000) });
  for (const advertised of [true, false]) {
    const { port, seen } = await listen(t, (_req, res) => {
      res.writeHead(200, {
        'content-type': 'application/json',
        ...(advertised ? { 'content-length': Buffer.byteLength(payload) } : {}),
      });
      res.write(payload.slice(0, 180_000));
      res.end(payload.slice(180_000));
    });
    await assert.rejects(captureLocal({ companyId, port }), { code: 'PAPERCLIP_RESPOSTA_GRANDE' });
    assert.deepEqual(seen.map(({ path }) => path), ['/api/health']);
  }
});

test('CLI capture writes only aggregate counts and preserves an existing output file', async (t) => {
  const { port } = await source(t);
  const dir = await mkdtemp(join(tmpdir(), 'radar-paperclip-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const out = join(dir, 'resumo.json');
  const args = [bin, 'capture', '--company', companyId, '--port', port];
  const { stdout, stderr } = await run(process.execPath, args);
  const report = JSON.parse(stdout);
  assert.equal(stderr, '');
  assert.deepEqual(report.dashboard, { state: 'available', coverage: 'dashboard_aggregate', ...tasks, pendingApprovals: 1 });
  assert.deepEqual(report.taskPage, { state: 'unavailable' });
  assert.deepEqual(report.pendingApprovals, { state: 'unavailable' });
  assert.equal(report.authenticity, 'not_verified_by_summary');
  assert.equal(report.scopeEvidence, 'local_trusted_no_oauth_claim');
  assert.equal(report.actionsExecuted, false);
  assert.equal(report.humanApprovalRequired, true);
  for (const field of [companyId, otherCompany, privateText]) assert.ok(!stdout.includes(field));
  assert.equal((await run(process.execPath, [...args, '--out', out])).stdout, '');
  const written = await readFile(out, 'utf8');
  // Live reports may have distinct capture timestamps between invocations.
  const withoutCaptureTime = ({ capturedAt, ...summary }) => {
    assert.equal(new Date(capturedAt).toISOString(), capturedAt);
    return summary;
  };
  assert.deepEqual(withoutCaptureTime(JSON.parse(written)), withoutCaptureTime(report));
  if (process.platform !== 'win32') assert.equal((await stat(out)).mode & 0o077, 0);
  await assert.rejects(run(process.execPath, [...args, '--out', out]), (error) => {
    assert.equal(error.stdout, '');
    assert.match(error.stderr, /SAIDA_NAO_GRAVADA_CONFIRA_PASTA_E_NOME_NOVO/);
    assert.ok(!error.stderr.includes(out));
    return true;
  });
  assert.equal(await readFile(out, 'utf8'), written);
});

test('CLI snapshot will not read an oversized input or a symlink on Linux', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'radar-paperclip-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = join(dir, `${privateText}.json`);
  await writeFile(input, Buffer.alloc(256 * 1024 + 1));
  const rejectPath = (path, expected) => assert.rejects(run(process.execPath, [bin, 'snapshot', '--input', path]), (error) => {
    assert.equal(error.stdout, '');
    assert.match(error.stderr, expected);
    assert.ok(!error.stderr.includes(privateText));
    return true;
  });
  await rejectPath(input, /ARQUIVO_INVALIDO_OU_GRANDE/);
  if (process.platform === 'linux') {
    const link = join(dir, 'link.json');
    await symlink(input, link);
    await rejectPath(link, /ARQUIVO_INDISPONIVEL/);
  }
});
