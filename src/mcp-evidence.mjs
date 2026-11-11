import { parseSnapshotJson } from './snapshot.mjs';

export const MAX_MCP_EVIDENCE_BYTES = 8192;

const PREFLIGHT = [
  'authenticatedInstance', 'canonicalHttps', 'fictionalRecordsOnly', 'dependencyReviewCompleted',
];
const EXPECTED = Object.freeze({
  withoutCredential: 'authentication-denied',
  connectionIdentityAndCompany: 'allowed',
  readOwnCompany: 'allowed',
  readOtherCompany: 'company-denied',
  taskWrite: 'scope-denied',
  agentConfigure: 'scope-denied',
  revokeOwnGrant: 'revoked',
  readWithRevokedGrant: 'authentication-denied',
  readAfterMembershipRemoval: 'authentication-denied',
});
const OUTCOMES = new Set([...Object.values(EXPECTED), 'not-run', 'unexpected', 'unavailable']);

function requireEvidence(condition) {
  if (!condition) throw new Error('MCP_EVIDENCE_INVALID');
}

function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

// This validates an operator declaration, never a credential or a server.
// No hostname, identity, response body, free text or credential is accepted.
export function evaluateMcpEvidence(bytes) {
  requireEvidence(bytes instanceof Uint8Array && bytes.byteLength <= MAX_MCP_EVIDENCE_BYTES);
  const value = parseSnapshotJson(bytes);
  requireEvidence(exactKeys(value, ['schemaVersion', 'environment', 'preflight', 'grantedScopes', 'observed']));
  requireEvidence(value.schemaVersion === 1);
  requireEvidence(['synthetic', 'isolated-authenticated'].includes(value.environment));
  requireEvidence(exactKeys(value.preflight, PREFLIGHT) &&
    PREFLIGHT.every((check) => typeof value.preflight[check] === 'boolean'));
  requireEvidence(Array.isArray(value.grantedScopes) && value.grantedScopes.length <= 4 &&
    value.grantedScopes.every((scope) => ['paperclip:read', 'paperclip:write', 'paperclip:configure', 'offline_access'].includes(scope)) &&
    new Set(value.grantedScopes).size === value.grantedScopes.length);
  const cases = Object.keys(EXPECTED);
  requireEvidence(exactKeys(value.observed, cases) && cases.every((name) => OUTCOMES.has(value.observed[name])));

  const preflightMissing = PREFLIGHT.filter((check) => !value.preflight[check]);
  const scopesMatch = value.grantedScopes.length === 1 && value.grantedScopes[0] === 'paperclip:read';
  const unmetCases = cases.filter((name) => value.observed[name] !== EXPECTED[name]);
  const expectedResultsDeclared = preflightMissing.length === 0 && scopesMatch && unmetCases.length === 0;
  return {
    schemaVersion: 1,
    environment: value.environment,
    reviewStatus: !expectedResultsDeclared ? 'incomplete' : value.environment === 'synthetic' ? 'synthetic-only' : 'declared-for-human-review',
    scopesMatch,
    preflightMissing,
    unmetCases,
    liveVerification: false,
    activationPermitted: false,
  };
}
