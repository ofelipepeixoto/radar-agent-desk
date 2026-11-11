# Continuar o projeto com Codex no Windows

Você vai clonar o repositório público dentro do Ubuntu, editar uma melhoria por vez com o Codex e revisar a mudança antes de enviá-la ao GitHub. O login do Codex usa sua conta do ChatGPT; o acesso para publicar no GitHub é separado.

## 1. Prepare a primeira sessão

No **PowerShell**, rode só esta linha:

```powershell
wsl -d Ubuntu
```

Espere o prompt do Ubuntu terminar em `$`. **Os próximos blocos são todos no Ubuntu.** Se ainda estiver vendo `PS C:\...>`, volte ao comando acima.

```bash
mkdir -p "$HOME/projetos" &&
cd "$HOME/projetos" &&
git clone https://github.com/ofelipepeixoto/radar-agent-desk.git &&
cd radar-agent-desk &&
node --version &&
npm test
```

Clone só na primeira vez. Se a pasta já for um clone, entre com `cd "$HOME/projetos/radar-agent-desk"` e confira `git remote -v`. O Node precisa ser 24.11 ou superior dentro do Ubuntu. Se ele não aparecer, siga o [guia de instalação no Windows](INSTALACAO-WINDOWS.md).

Confira `codex --version`. Se o comando não existir, instale o [Codex CLI oficial](https://github.com/openai/codex/blob/main/README.md) no Ubuntu:

```bash
npm install -g @openai/codex
```

Rode `codex login status`. Se precisar entrar, rode `codex login` e faça login com o ChatGPT no navegador. Se a volta ao terminal falhar, `codex login --device-auth` é uma opção quando o login por código de dispositivo está habilitado na conta. Não envie códigos ou arquivos de autenticação ao chat.

## 2. Faça uma mudança por vez

Rode `git status --short` e confira se não há alterações suas pendentes. Com a pasta limpa:

```bash
git switch main &&
git pull --ff-only &&
git switch -c melhoria/diagnostico-wsl &&
codex --sandbox workspace-write --ask-for-approval on-request
```

Use o nome da próxima melhoria no lugar de `melhoria/diagnostico-wsl` em sessões futuras. As permissões acima permitem editar o clone e pedir aprovação quando necessário. Mantenha as proteções ativas.

**Primeira tarefa para colar no Codex:**

> Leia `AGENTS.md`, `README.md` e `ROADMAP.md`. Implemente apenas o primeiro item de v0.1.1: diagnóstico de instalação no WSL. Melhore o guia para separar os comandos do PowerShell e do Ubuntu, verificar o Node dentro do Ubuntu e confirmar que o usuário está na raiz do clone antes de chamar a CLI. Na captura opcional do Paperclip, diferencie porta fechada, tempo de espera excedido e versão não homologada. Preserve as rotas fixas, a restrição ao endereço local, os limites de resposta e a redução de dados. Use dados fictícios e um servidor HTTP de teste. Preserve mudanças já existentes. Rode `npm test` e `git diff --check`. Mostre os arquivos alterados, os resultados, o que ainda falta validar e uma descrição curta para a PR. Trabalhe só neste clone. Não faça push, merge, deploy ou alteração de conta.

## 3. Revise e envie ao GitHub

1. Revise `git diff --stat`, `git diff` e `git diff --check`. Rode `npm test` e os demais checks do README. Atualize `CHANGELOG.md` e marque o avanço em `ROADMAP.md` quando a entrega corresponder ao critério de aceite.
2. Adicione apenas os arquivos revisados com `git add`, incluindo novos arquivos intencionais. Leia `git diff --cached` antes de criar o commit. Não inclua arquivos locais, chaves, logs, dados do painel ou credenciais do Codex. Antes do primeiro commit público, confira `git config user.email`. Se quiser ocultar seu endereço, use no clone o e-mail `noreply` exibido em [Settings → Emails](https://github.com/settings/emails). Para a primeira melhoria, você pode usar `git commit -m "Melhora diagnóstico no WSL"`.
3. Envie a branch, abra a PR em rascunho e acompanhe o CI. Se usar a [CLI do GitHub](https://cli.github.com/), confira antes `gh auth status` e, se necessário, rode `gh auth login --hostname github.com --git-protocol https --web`. Para usar o login do `gh` também no Git por HTTPS, rode `gh auth setup-git`. Depois do commit:

   ```bash
   git push -u origin HEAD
   gh pr create --draft --base main --fill
   gh pr checks --watch
   ```

   Sem `gh`, abra a PR no navegador depois do push e consulte a aba **Checks**.

4. Faça o merge pelo GitHub depois de revisar a PR e confirmar que os checks passaram. Volte à `main` e rode `git pull --ff-only` antes da próxima melhoria.

O CI roda em pushes e PRs e não precisa da sua sessão do ChatGPT. O Codex no seu terminal só trabalha quando você o abre. A cadência é uma tarefa por sessão, uma PR por melhoria e revisão manual antes de entrar na `main`.

Referências: [comandos do WSL](https://learn.microsoft.com/pt-br/windows/wsl/basic-commands), [autenticação do Codex](https://developers.openai.com/codex/auth), [referência da CLI](https://developers.openai.com/codex/cli/reference), [criar PR com gh](https://cli.github.com/manual/gh_pr_create) e [acompanhar checks](https://cli.github.com/manual/gh_pr_checks).
