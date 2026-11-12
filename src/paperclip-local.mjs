import { request } from 'node:http';
import { parseSnapshotJson } from './snapshot.mjs';

export const PAPERCLIP_VERSION = '2026.1106.0';
export const PAPERCLIP_COMMIT = 'd69631b01b9c658f80bf8bed389863dce82643e1';
export const DEFAULT_PORT = 3100;
const MAX_HTTP_BYTES = 256 * 1024;
export const HTTP_DEADLINE_MS = 3_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export class LocalError extends Error {
  constructor(code) { super(code); this.code = code; }
}

export function readPort(value = String(DEFAULT_PORT)) {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,4}$/.test(value) || Number(value) > 65535) throw new LocalError('PORT_INVALIDA');
  return Number(value);
}

function company(value) {
  if (typeof value !== 'string' || !UUID.test(value)) throw new LocalError('EMPRESA_UUID_INVALIDO');
  return value;
}

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Fixed literal loopback and paths assembled only from checked IDs. Native HTTP
// does not follow redirects or honor HTTP_PROXY, and no credential is attached.
function getJson(port, path) {
  return new Promise((resolve, reject) => {
    const fail = (code) => reject(new LocalError(code));
    const req = request({hostname: '127.0.0.1', family: 4, port, path, method: 'GET',
      agent: false, headers: { Accept: 'application/json', 'Accept-Encoding': 'identity' }, maxHeaderSize: 8192}, (res) => {
      if (res.statusCode !== 200) { res.destroy(); fail('PAPERCLIP_HTTP_NAO_OK'); return; }
      if (!/^application\/json(?:\s*;|$)/i.test(res.headers['content-type'] ?? '') ||
          ![undefined, 'identity'].includes(res.headers['content-encoding'])) {
        res.destroy(); fail('PAPERCLIP_RESPOSTA_INVALIDA'); return;
      }
      if (Number(res.headers['content-length']) > MAX_HTTP_BYTES) {
        res.destroy(); fail('PAPERCLIP_RESPOSTA_GRANDE'); return;
      }
      const parts = [];
      let total = 0;
      res.on('data', (chunk) => {
        total += chunk.length;
        if (total > MAX_HTTP_BYTES) { fail('PAPERCLIP_RESPOSTA_GRANDE'); res.destroy(); return; }
        parts.push(chunk);
      });
      res.on('error', () => fail('PAPERCLIP_INDISPONIVEL'));
      res.on('end', () => {
        try {
          const payload = parseSnapshotJson(Buffer.concat(parts));
          // The REST endpoints do not return tool outcomes or error envelopes on success.
          if (plain(payload) && (Object.hasOwn(payload, 'outcome') ||
              (Object.hasOwn(payload, 'isError') && payload.isError !== false) ||
              (Object.hasOwn(payload, 'error') && payload.error !== null))) {
            fail('PAPERCLIP_RESPOSTA_INVALIDA');
            return;
          }
          resolve(payload);
        } catch { fail('PAPERCLIP_RESPOSTA_INVALIDA'); }
      });
    });
    const deadline = setTimeout(() => { fail('PAPERCLIP_TEMPO_ESGOTADO'); req.destroy(); }, HTTP_DEADLINE_MS);
    req.on('error', (error) => {
      fail(error.code === 'ECONNREFUSED' ? 'PAPERCLIP_CONEXAO_RECUSADA' : 'PAPERCLIP_INDISPONIVEL');
    });
    req.on('close', () => clearTimeout(deadline));
    req.end();
  });
}

export async function probeLocal(portArg) {
  const port = readPort(portArg);
  const health = await getJson(port, '/api/health');
  if (!plain(health) || health.status !== 'ok') throw new LocalError('PAPERCLIP_NAO_PRONTO');
  if (health.deploymentMode !== 'local_trusted' || health.deploymentExposure !== 'private') throw new LocalError('MODO_LOCAL_PRIVADO_EXIGIDO');
  const version = health.serverVersion ?? health.version;
  if (version !== PAPERCLIP_VERSION) throw new LocalError('VERSAO_PAPERCLIP_NAO_HOMOLOGADA');
  if (health.commit != null && health.commit !== PAPERCLIP_COMMIT) throw new LocalError('COMMIT_PAPERCLIP_DIVERGENTE');
  return { status: 'ok', mode: 'local_trusted', exposure: 'private', version: PAPERCLIP_VERSION,
    reportedCommitMatches: health.commit === PAPERCLIP_COMMIT, port };
}

export async function captureLocal({companyId, port: portArg}) {
  const id = company(companyId);
  const {port} = await probeLocal(portArg);
  const path = `/api/companies/${id}`;
  const selected = await getJson(port, path);
  if (!plain(selected) || selected.id !== id) throw new LocalError('EMPRESA_NAO_CONFIRMADA');
  // The issue-list/detail GETs can reconcile recovery actions upstream.
  // Use the dashboard summary instead; do not collect item bodies.
  const dashboard = await getJson(port, `${path}/dashboard`);
  if (!plain(dashboard) || dashboard.companyId !== id) throw new LocalError('EMPRESA_DIVERGENTE');
  if (!plain(dashboard.tasks)) throw new LocalError('PAPERCLIP_CONTRATO_INVALIDO');
  const {open,inProgress,blocked,done} = dashboard.tasks;
  return {
    schemaVersion: 1, source: 'paperclip-local-rest', connection: { companyId: id },
    dashboard: { companyId: id, tasks: {open,inProgress,blocked,done}, pendingApprovals: dashboard.pendingApprovals },
  };
}
