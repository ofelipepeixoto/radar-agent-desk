# Instalar no Windows com Ubuntu no WSL2

Para usar o Radar Agent Desk pela primeira vez, basta rodar a demo offline. Se o Paperclip já está no seu PC, deixe a instalação existente como está.

## 1. Abra o Ubuntu

**No PowerShell do Windows** (quando aparece `PS C:\Users\...`):

```powershell
wsl --list --verbose
wsl -d Ubuntu
```

Use a distribuição Ubuntu com versão `2`. Espere o prompt mudar de `PS C:\Users\...>` para um prompt do Ubuntu que termine em `$`. Se ainda começa com `PS`, não cole comandos Bash ali. O Node que aparece no PowerShell é o do Windows. Confira no Ubuntu:

```bash
node --version
git --version
```

O mínimo técnico é Node.js 24.11. Para uso diário, instale a atualização mais recente do Node.js 24 LTS: [24.22.3 na revisão de segurança](https://nodejs.org/pt-br/blog/release/v24.22.3). Se já usa nvm no Ubuntu, carregue-o com `. "$HOME/.nvm/nvm.sh"` se necessário e rode `nvm install 24 && nvm use 24`. Se não tem Node no Ubuntu, instale a linha 24 conforme as [instruções do Node.js](https://nodejs.org/pt-br/download) ou da [Microsoft para WSL2](https://learn.microsoft.com/pt-br/windows/dev-environment/javascript/nodejs-on-wsl). Volte e confira as versões antes de continuar.

## 2. Baixe e rode a demo

**No Ubuntu**:

```bash
mkdir -p "$HOME/projetos"
cd "$HOME/projetos"
git clone https://github.com/ofelipepeixoto/radar-agent-desk.git
cd "$HOME/projetos/radar-agent-desk" &&
test -f bin/radar-agent-desk.mjs &&
node bin/radar-agent-desk.mjs doctor &&
test ! -L local && mkdir -p -m 700 local &&
node bin/radar-agent-desk.mjs demo --out local/demo.json
```

Se já clonou, pule o `git clone`. Se preferir ZIP, baixe por **Code → Download ZIP** na página do projeto. Extraia e entre na pasta que contém `bin/radar-agent-desk.mjs`. Um ZIP serve para experimentar, mas use o clone Git para desenvolver.

Mantenha entradas e saídas numa pasta privada do seu usuário no Ubuntu, sem links simbólicos no caminho. Se `local/` já existia, confira se é um diretório seu e aplique `chmod 700 local`. Evite pastas compartilhadas ou graváveis por outras contas.

A checagem retorna `"status": "ok"` e a demo gera `local/demo.json`. Se já existir, escolha outro nome para a saída. Para localizar o arquivo no Windows, rode `explorer.exe local`. Se aparecer `MODULE_NOT_FOUND`, rode `pwd` e `ls bin`. Você precisa estar na pasta que contém `bin/radar-agent-desk.mjs`; um ZIP pode criar uma pasta extra dentro da primeira. Se aparecer `node: command not found`, volte à etapa 1 dentro do Ubuntu. O kit não precisa de `npm install`.

Para testar com suas próprias contagens, copie `fixtures/contagens-exemplo.json` para `local/entrada.json`, edite os cinco números e rode:

```bash
node bin/radar-agent-desk.mjs snapshot --input local/entrada.json --out local/resumo.json
```

Anexe só a saída ao ChatGPT, se desejar. Veja o [prompt de revisão](REVISAO-CHATGPT.md).

## 3. Adaptador opcional: Paperclip local

A demo e a importação offline não precisam desta etapa. Se já tiver um Paperclip de laboratório com dados fictícios em loopback, vá direto ao `probe` abaixo. Para uma instalação separada de laboratório, use uma pasta nova. O comando segue a ordem do [guia da Curta Soluções](https://posts.curtasolucoes.com.br/paperclip), com versão explícita e porta local. O pin mantém um aviso crítico no conjunto npm observado e nenhuma versão estável corrigida foi homologada para o adaptador; veja [SECURITY.md](../SECURITY.md).

Abra **outra janela do Ubuntu** e rode fora do clone Git:

```bash
export PAPERCLIP_TELEMETRY_DISABLED=1
RADAR_DESK_LAB="$HOME/.radar-agent-desk-paperclip-lab"
test ! -L "$RADAR_DESK_LAB" && mkdir -p -m 700 "$RADAR_DESK_LAB" &&
cd "$RADAR_DESK_LAB" &&
npx --yes --registry=https://registry.npmjs.org paperclipai@2026.1106.0 onboard --yes --bind loopback --no-install-service --data-dir "$RADAR_DESK_LAB"
```

O Paperclip pode reportar o SHA de outro projeto se for iniciado dentro da pasta Git desse projeto. Se a porta padrão estiver ocupada, use `export PORT=4310` antes de iniciar. Mantenha a janela aberta; quando o servidor estiver ouvindo, abra [localhost:3100](http://localhost:3100) no navegador do Windows, ou a porta escolhida. Para o laboratório, crie só uma empresa fictícia, sem agente, rotina, chave ou túnel.

No primeiro Ubuntu, dentro do clone do kit:

```bash
node bin/radar-agent-desk.mjs probe
```

O esperado é `status: ok`, versão `2026.1106.0`, `local_trusted` e exposição `private`. Um SHA ausente é reportado como não confirmado; um SHA declarado diferente é recusado. Se mudou a porta, acrescente `--port 4310` ao `probe` e à captura.

Se o diagnóstico falhar, use o código para decidir o próximo passo:

| Código | O que fazer |
| --- | --- |
| `PAPERCLIP_CONEXAO_RECUSADA` | Confira se o servidor está aberto neste Ubuntu e se a porta é a mesma. |
| `PAPERCLIP_TEMPO_ESGOTADO` | Aguarde o painel carregar. O kit encerra cada requisição após 3 segundos. |
| `VERSAO_PAPERCLIP_NAO_HOMOLOGADA` | Use a importação offline. A captura não aceita automaticamente uma versão diferente. |
| `COMMIT_PAPERCLIP_DIVERGENTE` | Inicie a versão homologada fora da pasta de outro repositório Git. |

No navegador local, abra `http://localhost:3100/api/companies` com a mesma porta da instância e copie o `id` da empresa de teste. Mantenha a lista bruta no computador. Substitua `COLE_O_ID_AQUI` abaixo:

```bash
test ! -L local && mkdir -p -m 700 local &&
node bin/radar-agent-desk.mjs capture --company COLE_O_ID_AQUI --out local/resumo-paperclip.json
```

O arquivo contém contagens. Em execução e bloqueadas já estão dentro de abertas. Abra o JSON antes de anexar e siga o [roteiro de revisão](REVISAO-CHATGPT.md).

Pressione **Ctrl+C** na janela do Paperclip para parar o processo. Para abrir de novo, use a mesma pasta e a mesma porta. Exemplo no Ubuntu:

```bash
export PAPERCLIP_TELEMETRY_DISABLED=1
RADAR_DESK_LAB="$HOME/.radar-agent-desk-paperclip-lab"
cd "$RADAR_DESK_LAB" &&
npx --yes --registry=https://registry.npmjs.org paperclipai@2026.1106.0 run --data-dir "$RADAR_DESK_LAB"
```

Este passo a passo instala o painel para testar a **captura de contagens**, sem agente. Para configurar o Codex em uma instância local de teste e validar a primeira tarefa, siga [Operar agentes no Paperclip](AGENTES-PAPERCLIP-WSL.md). O guia de agentes trata separadamente da pasta Git de trabalho, da assinatura e da chave de API. O guia local não precisa de MCP nem expõe a porta.
