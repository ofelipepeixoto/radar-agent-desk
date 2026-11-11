import { evaluateMcpEvidence, MAX_MCP_EVIDENCE_BYTES } from '../src/mcp-evidence.mjs';

// Stdin only. This command has no HTTP client and does not save a file.
try {
  if (process.argv.length !== 2 || process.stdin.isTTY) throw new Error();
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.byteLength;
    if (bytes > MAX_MCP_EVIDENCE_BYTES) throw new Error();
    chunks.push(chunk);
  }
  const result = evaluateMcpEvidence(Buffer.concat(chunks));
  console.log(JSON.stringify(result, null, 2));
  if (result.reviewStatus === 'incomplete') process.exitCode = 2;
} catch {
  console.error('MCP_EVIDENCE_INVALID: informe JSON de evidência reduzida pela entrada padrão.');
  process.exitCode = 1;
}
