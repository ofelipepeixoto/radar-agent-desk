import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const cli = fileURLToPath(new URL('../bin/radar-agent-desk.mjs', import.meta.url));
const fixture = new URL('../fixtures/contagens-exemplo.json', import.meta.url);

test('CLI accepts direct nested paths and refuses linked ancestors for input and output', async (t) => {
  const cwd = await mkdtemp(join(await realpath(tmpdir()), 'radar-cli-paths-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const invoke = (...args) => run(process.execPath, [cli, ...args], { cwd });
  const directory = join('dados', 'contagens');
  const input = join(directory, 'input.json');
  const output = join(directory, 'output.json');
  await mkdir(join(cwd, directory), { recursive: true });
  await writeFile(join(cwd, input), await readFile(fixture));

  const written = await invoke('snapshot', '--input', input, '--out', output);
  assert.equal(written.stdout, '');
  const result = await readFile(join(cwd, output), 'utf8');
  assert.equal(JSON.parse(result).source, 'radar-offline');
  if (process.platform !== 'win32') assert.equal((await stat(join(cwd, output))).mode & 0o077, 0);

  const link = 'CAMINHO-SINTETICO-PRIVADO';
  await symlink(join(cwd, 'dados'), join(cwd, link), process.platform === 'win32' ? 'junction' : 'dir');
  const rejects = (args, code) => assert.rejects(invoke(...args), (error) => {
    assert.equal(error.code, 1);
    assert.equal(error.stdout, '');
    assert.match(error.stderr, code);
    assert.ok(!error.stderr.includes(link));
    return true;
  });

  // The linked directory is not the immediate parent of the file.
  await rejects(['snapshot', '--input', join(link, 'contagens', 'input.json')], /ARQUIVO_INDISPONIVEL/);
  await rejects(['snapshot', '--input', input, '--out', join(link, 'contagens', 'new.json')],
    /SAIDA_NAO_GRAVADA_CONFIRA_PASTA_E_NOME_NOVO/);
  await assert.rejects(stat(join(cwd, directory, 'new.json')), { code: 'ENOENT' });
  assert.equal(await readFile(join(cwd, output), 'utf8'), result);
});
