import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync,
  symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { operateLab } from '../scripts/paperclip-backup-lab.mjs';

const onlyLinux = { skip: process.platform !== 'linux' };

function makeLab(t) {
  const parent = mkdtempSync(join(tmpdir(), 'radar-backup-test-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const root = join(parent, 'ensaio');
  operateLab('init', root);
  const source = join(root, 'instancia');
  const db = join(source, 'instances', 'default', 'db');
  mkdirSync(join(db, 'global'), { recursive: true });
  mkdirSync(join(db, 'base', 'vazio'), { recursive: true });
  mkdirSync(join(source, 'storage'));
  writeFileSync(join(db, 'PG_VERSION'), '18\n');
  writeFileSync(join(db, 'global', 'pg_control'), Buffer.from([0, 8, 100]));
  writeFileSync(join(source, 'storage', 'anexo.txt'), 'conteúdo fictício\n');
  return { parent, root, db, source };
}

test('copia e restaura a árvore inteira com manifestos, modos privados e diretórios vazios', onlyLinux, (t) => {
  const { root, source } = makeLab(t);
  assert.deepEqual(operateLab('backup', root, true), {
    status: 'copia_verificada', postgresMajor: 18, bytes: 26,
  });
  // A restauração não consulta nem depende da árvore original.
  rmSync(source, { recursive: true });
  assert.equal(operateLab('restore', root, true).status, 'restauracao_verificada');
  const restored = join(root, 'restauracao');
  assert.equal(readFileSync(join(restored, 'storage', 'anexo.txt'), 'utf8'), 'conteúdo fictício\n');
  assert.deepEqual(readFileSync(join(restored, 'instances/default/db/global/pg_control')), Buffer.from([0, 8, 100]));
  assert.ok(statSync(join(restored, 'instances/default/db/base/vazio')).isDirectory());
  assert.equal(statSync(restored).mode & 0o777, 0o700);
  assert.equal(statSync(join(restored, 'storage', 'anexo.txt')).mode & 0o777, 0o600);
});

test('recusa raiz preexistente, confirmação ausente e sinal de PostgreSQL ativo', onlyLinux, (t) => {
  const { parent, root, db } = makeLab(t);
  assert.throws(() => operateLab('init', parent), { code: 'EEXIST' });
  assert.throws(() => operateLab('backup', root), /CONFIRME_ENCERRAMENTO/);
  writeFileSync(join(db, 'postmaster.pid'), '123\n');
  const cli = fileURLToPath(new URL('../scripts/paperclip-backup-lab.mjs', import.meta.url));
  const r = spawnSync(process.execPath, [cli, 'backup', root, '--confirmo-parado'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.equal(r.stderr.trim(), 'Backup local: POSTGRES_NAO_CONFIRMADO_COMO_PARADO');
  assert.equal(existsSync(join(root, 'backup')), false);
});

test('recusa links simbólicos e físicos em vez de seguir referências fora da árvore', onlyLinux, (t) => {
  const { parent, root, source } = makeLab(t);
  const external = join(parent, 'externo');
  writeFileSync(external, 'fora do laboratório');
  symlinkSync(external, join(source, 'atalho'));
  assert.throws(() => operateLab('backup', root, true), /ARQUIVO_NAO_REGULAR_OU_LINK/);
  rmSync(join(source, 'atalho'));
  linkSync(external, join(source, 'hardlink'));
  assert.throws(() => operateLab('backup', root, true), /ARQUIVO_NAO_REGULAR_OU_LINK/);
  assert.equal(existsSync(join(root, 'backup')), false);
  assert.equal(readFileSync(external, 'utf8'), 'fora do laboratório');
});

test('detecta alteração do backup e preserva destinos já existentes', onlyLinux, (t) => {
  const { root } = makeLab(t);
  operateLab('backup', root, true);
  assert.throws(() => operateLab('backup', root, true), { code: 'EEXIST' });
  const copied = join(root, 'backup', 'dados', 'storage', 'anexo.txt');
  const original = readFileSync(copied);
  writeFileSync(copied, 'fraude');
  assert.throws(() => operateLab('restore', root, true), /BACKUP_DIVERGE_DO_MANIFESTO/);
  assert.equal(existsSync(join(root, 'restauracao')), false);
  writeFileSync(copied, original);
  operateLab('restore', root, true);
  assert.throws(() => operateLab('restore', root, true), { code: 'EEXIST' });
});
