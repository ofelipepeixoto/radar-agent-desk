#!/usr/bin/env node
// Ensaio deliberadamente restrito a uma instalação fictícia criada neste laboratório.
import { createHash } from 'node:crypto';
import {
  constants, closeSync, fstatSync, lstatSync, mkdirSync, openSync, readSync,
  readdirSync, realpathSync, writeFileSync, writeSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MARKER = 'radar-agent-desk-backup-lab-v1\n';
const MAX_BYTES = 2 * 1024 ** 3;
const MAX_ENTRIES = 20_000;
const MAX_DEPTH = 32;
const MAX_MANIFEST = 8 * 1024 ** 2;
const NOFOLLOW = constants.O_NOFOLLOW | constants.O_NONBLOCK;

class LabError extends Error {}
function check(ok, code) {
  if (!ok) throw new LabError(code);
}

function directory(path, privateDirectory = false) {
  const stats = lstatSync(path);
  check(stats.isDirectory() && !stats.isSymbolicLink(), 'DIRETORIO_INVALIDO_OU_LINK');
  if (privateDirectory) {
    check(stats.uid === process.getuid() && (stats.mode & 0o777) === 0o700, 'DIRETORIO_DEVE_SER_PRIVADO');
  }
}

function sameFile(a, b) {
  return a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeNs === b.mtimeNs
    && a.ctimeNs === b.ctimeNs;
}

function copyOrRead(source, limit, options = {}) {
  const { target, collect = false } = options;
  const listed = lstatSync(source, { bigint: true });
  check(listed.isFile() && listed.nlink === 1n, 'ARQUIVO_NAO_REGULAR_OU_LINK');
  const from = openSync(source, constants.O_RDONLY | NOFOLLOW);
  let to;
  try {
    const before = fstatSync(from, { bigint: true });
    check(before.isFile() && before.nlink === 1n && sameFile(listed, before), 'FONTE_ALTERADA');
    check(before.size <= BigInt(limit), 'LIMITE_DE_DADOS');
    if (target) to = openSync(target, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | NOFOLLOW, 0o600);
    const digest = createHash('sha256');
    const buffer = Buffer.allocUnsafe(64 * 1024);
    const chunks = [];
    let size = 0;
    for (;;) {
      const n = readSync(from, buffer, 0, buffer.length, null);
      if (!n) break;
      size += n;
      check(size <= limit, 'LIMITE_DE_DADOS');
      const chunk = buffer.subarray(0, n);
      digest.update(chunk);
      if (collect) chunks.push(Buffer.from(chunk));
      if (to !== undefined) {
        for (let written = 0; written < n;) {
          const step = writeSync(to, chunk, written, n - written);
          check(step > 0, 'COPIA_INCOMPLETA');
          written += step;
        }
      }
    }
    check(BigInt(size) === before.size && sameFile(before, fstatSync(from, { bigint: true })), 'FONTE_ALTERADA');
    return { size, sha256: digest.digest('hex'), bytes: collect ? Buffer.concat(chunks) : undefined };
  } finally {
    if (to !== undefined) closeSync(to);
    closeSync(from);
  }
}

function inspectTree(root, destination) {
  const entries = [];
  let bytes = 0;
  function visit(path, relative, depth) {
    check(depth <= MAX_DEPTH, 'LIMITE_DE_PROFUNDIDADE');
    directory(path);
    const before = lstatSync(path, { bigint: true });
    for (const name of readdirSync(path).sort()) {
      check(entries.length < MAX_ENTRIES, 'LIMITE_DE_ARQUIVOS');
      check(!/[\x00-\x1f\x7f\\]/u.test(name), 'NOME_DE_ARQUIVO_INVALIDO');
      check(name !== 'postmaster.pid', 'POSTGRES_NAO_CONFIRMADO_COMO_PARADO');
      const child = join(path, name);
      const rel = relative ? `${relative}/${name}` : name;
      const out = destination && join(destination, rel);
      const item = lstatSync(child);
      if (item.isDirectory() && !item.isSymbolicLink()) {
        entries.push({ path: rel, type: 'directory' });
        if (out) mkdirSync(out, { mode: 0o700 });
        visit(child, rel, depth + 1);
      } else {
        const file = copyOrRead(child, MAX_BYTES - bytes, { target: out });
        bytes += file.size;
        entries.push({ path: rel, type: 'file', bytes: file.size, sha256: file.sha256 });
      }
    }
    check(sameFile(before, lstatSync(path, { bigint: true })), 'FONTE_ALTERADA');
  }
  visit(root, '', 0);
  // Um PG_VERSION sozinho não caracteriza um cluster completo.
  const regular = new Set(entries.filter((e) => e.type === 'file').map((e) => e.path));
  const pg = entries.filter((e) => e.type === 'file' && basename(e.path) === 'PG_VERSION'
    && regular.has(join(dirname(e.path), 'global/pg_control')));
  check(pg.length === 1, 'CLUSTER_POSTGRES_NAO_ENCONTRADO');
  const version = copyOrRead(join(root, pg[0].path), 32, { collect: true });
  check(version.sha256 === pg[0].sha256 && /^[1-9][0-9]*\n?$/u.test(version.bytes.toString()), 'VERSAO_POSTGRES_INVALIDA');
  return { version: 1, postgresMajor: Number(version.bytes.toString().trim()), bytes, entries };
}

const encoded = (manifest) => Buffer.from(`${JSON.stringify(manifest)}\n`, 'utf8');

export function operateLab(action, suppliedPath, confirmStopped = false) {
  check(process.platform === 'linux' && constants.O_NOFOLLOW, 'USE_UBUNTU_OU_WSL');
  check(typeof suppliedPath === 'string' && isAbsolute(suppliedPath), 'CAMINHO_ABSOLUTO_OBRIGATORIO');
  const root = resolve(suppliedPath);
  check(root !== '/' && realpathSync(dirname(root)) === dirname(root), 'CAMINHO_DEVE_SER_DIRETO');
  if (action === 'init') {
    mkdirSync(root, { mode: 0o700 }); // Nunca adota uma instalação preexistente.
    mkdirSync(join(root, 'instancia'), { mode: 0o700 });
    writeFileSync(join(root, '.laboratorio'), MARKER, { mode: 0o600, flag: 'wx' });
    return { status: 'laboratorio_criado' };
  }

  directory(root, true);
  check(realpathSync(root) === root, 'CAMINHO_DEVE_SER_DIRETO');
  const mark = copyOrRead(join(root, '.laboratorio'), 64, { collect: true });
  check(mark.bytes.toString() === MARKER, 'MARCADOR_DE_LABORATORIO_INVALIDO');
  check(confirmStopped, 'CONFIRME_ENCERRAMENTO_DO_PAPERCLIP_E_POSTGRES');
  const source = join(root, 'instancia');
  const backup = join(root, 'backup');
  const backupData = join(backup, 'dados');
  const record = join(backup, 'manifesto.json');
  const restored = join(root, 'restauracao');

  if (action === 'backup') {
    directory(source, true);
    const original = encoded(inspectTree(source));
    check(original.length <= MAX_MANIFEST, 'LIMITE_DO_MANIFESTO');
    mkdirSync(backup, { mode: 0o700 });
    mkdirSync(backupData, { mode: 0o700 });
    const manifest = inspectTree(source, backupData);
    check(original.equals(encoded(manifest)) && original.equals(encoded(inspectTree(backupData)))
      && original.equals(encoded(inspectTree(source))), 'FONTE_ALTERADA_OU_COPIA_DIVERGENTE');
    writeFileSync(record, original, { mode: 0o600, flag: 'wx' });
    return { status: 'copia_verificada', postgresMajor: manifest.postgresMajor, bytes: manifest.bytes };
  }

  check(action === 'restore', 'COMANDO_INVALIDO');
  directory(backup, true);
  directory(backupData, true);
  const manifest = copyOrRead(record, MAX_MANIFEST, { collect: true }).bytes;
  check(manifest.equals(encoded(inspectTree(backupData))), 'BACKUP_DIVERGE_DO_MANIFESTO');
  mkdirSync(restored, { mode: 0o700 });
  const copied = inspectTree(backupData, restored);
  check(manifest.equals(encoded(copied)) && manifest.equals(encoded(inspectTree(restored))), 'RESTAURACAO_DIVERGE_DO_MANIFESTO');
  return { status: 'restauracao_verificada', postgresMajor: copied.postgresMajor, bytes: copied.bytes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [action, path, flag, ...extras] = process.argv.slice(2);
    check(['init', 'backup', 'restore'].includes(action) && extras.length === 0
      && (action === 'init' ? flag === undefined : flag === '--confirmo-parado'), 'ARGUMENTOS_INVALIDOS');
    console.log(JSON.stringify(operateLab(action, path, flag === '--confirmo-parado')));
  } catch (error) {
    const code = error instanceof LabError ? error.message
      : error.code === 'EEXIST' ? 'DESTINO_JA_EXISTE' : 'LABORATORIO_INDISPONIVEL';
    console.error(`Backup local: ${code}`);
    process.exitCode = 1;
  }
}
