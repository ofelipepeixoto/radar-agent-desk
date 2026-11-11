#!/usr/bin/env node
import { constants as fs, closeSync, fstatSync, openSync, readSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { captureLocal, probeLocal, LocalError, PAPERCLIP_VERSION, HTTP_DEADLINE_MS } from '../src/paperclip-local.mjs';
import { detectEnvironment, diagnosticHint } from '../src/diagnostics.mjs';
import { MAX_SNAPSHOT_BYTES, parseSnapshotJson, summarizeSnapshot, SnapshotError } from '../src/snapshot.mjs';

const options = { port: {type:'string'}, company: {type:'string'}, input: {type:'string'}, out: {type:'string'} };
const permissions = { check: [], doctor: [], probe: ['port'], demo: ['out'], snapshot: ['input','out'], capture: ['company','port','out'] };
const help = `Radar Agent Desk\n\n` +
  `  node bin/radar-agent-desk.mjs check\n` +
  `  node bin/radar-agent-desk.mjs doctor\n` +
  `  node bin/radar-agent-desk.mjs probe [--port 3100]\n` +
  `  node bin/radar-agent-desk.mjs demo [--out local/demo.json]\n` +
  `  node bin/radar-agent-desk.mjs capture --company UUID [--port 3100] [--out local/resumo.json]\n` +
  `  node bin/radar-agent-desk.mjs snapshot --input ARQUIVO.json [--out local/resumo.json]\n` +
  `\nImportação offline por padrão. Captura opcional de Paperclip local. A saída não sobrescreve arquivos.\n`;

function safeRead(path) {
  let fd;
  try {
    fd = openSync(path, fs.O_RDONLY | (fs.O_NOFOLLOW ?? 0) | (fs.O_NONBLOCK ?? 0));
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > MAX_SNAPSHOT_BYTES) throw new LocalError('ARQUIVO_INVALIDO_OU_GRANDE');
    const bytes = Buffer.alloc(MAX_SNAPSHOT_BYTES + 1);
    let size = 0;
    while (size < bytes.length) {
      const n = readSync(fd, bytes, size, bytes.length - size, size);
      if (!n) break;
      size += n;
    }
    return bytes.subarray(0,size);
  } catch (e) { if (e instanceof LocalError) throw e; throw new LocalError('ARQUIVO_INDISPONIVEL'); }
  finally { if (fd !== undefined) closeSync(fd); }
}

function emit(value, destination) {
  const output = JSON.stringify(value, null, 2) + '\n';
  if (!destination) { process.stdout.write(output); return; }
  try { writeFileSync(destination, output, {mode:0o600, flag:'wx'}); }
  catch { throw new LocalError('SAIDA_NAO_GRAVADA_CONFIRA_PASTA_E_NOME_NOVO'); }
}

function requireNodeVersion() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 24 || (major === 24 && minor < 11)) throw new LocalError('NODE_24_11_OU_SUPERIOR_EXIGIDO');
}

function check() {
  emit({ status:'ok', node:process.versions.node, platform:process.platform,
    paperclipTarget:PAPERCLIP_VERSION, paperclipInstalled:'not_checked',
    note:'Use probe para checar a instância local após abrir o Paperclip.' });
}

function doctor() {
  const ambiente = detectEnvironment();
  emit({ status: 'ok', node: process.versions.node, ambiente,
    proximoPasso: ambiente === 'windows'
      ? 'A demo funciona neste Node. Se o Paperclip estiver no WSL, abra o Ubuntu antes de usar probe.'
      : 'Rode demo para testar sem rede. Use probe só depois de iniciar o Paperclip neste ambiente.' });
}

async function main() {
  const [command,...args] = process.argv.slice(2);
  if (!command || (['help','--help'].includes(command) && !args.length)) { process.stdout.write(help); return; }
  if (!Object.hasOwn(permissions,command)) throw new LocalError('COMANDO_INVALIDO_USE_HELP');
  let parsed;
  try { parsed = parseArgs({args, options, strict:true, tokens:true}); }
  catch { throw new LocalError('ARGUMENTOS_INVALIDOS_USE_HELP'); }
  const {values,tokens} = parsed;
  const names = tokens.map(t => t.name);
  if (new Set(names).size !== names.length || names.some(n => !permissions[command].includes(n) || !values[n])) {
    throw new LocalError('ARGUMENTOS_INVALIDOS_USE_HELP');
  }
  requireNodeVersion();
  if (command === 'check') { check(); return; }
  if (command === 'doctor') { doctor(); return; }
  if (command === 'probe') { emit(await probeLocal(values.port)); return; }
  if (command === 'capture') {
    const summary = summarizeSnapshot(await captureLocal({companyId: values.company, port: values.port}));
    emit({...summary, capturedAt: new Date().toISOString()}, values.out);
    return;
  }
  const input = command === 'demo' ? fileURLToPath(new URL('../fixtures/contagens-exemplo.json', import.meta.url)) : values.input;
  if (!input) throw new LocalError('ARQUIVO_INPUT_EXIGIDO');
  emit(summarizeSnapshot(parseSnapshotJson(safeRead(input))), values.out);
}

main().catch(error => {
  // Unexpected exceptions and raw payloads are never echoed to the operator.
  const code = (error instanceof LocalError || error instanceof SnapshotError ? error.code : null) ?? 'ERRO_NAO_CLASSIFICADO';
  const hint = diagnosticHint(code, { paperclipVersion: PAPERCLIP_VERSION, deadlineSeconds: HTTP_DEADLINE_MS / 1000 });
  process.stderr.write(`Radar Agent Desk: ${code}\n${hint ? `${hint}\n` : ''}`);
  process.exitCode = 1;
});
