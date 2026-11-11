# Instalar no Windows com Ubuntu no WSL2

Para usar o Radar Agent Desk pela primeira vez, basta rodar a demo offline. Se o Paperclip já está no seu PC, deixe a instalação existente como está.

## 1. Abra o Ubuntu

**No PowerShell do Windows** (quando aparece `PS C:\Users\...`):

```powershell
wsl --list --verbose
wsl -d Ubuntu
```

Use a distribuição Ubuntu com versão `2`. A partir daqui, todos os comandos com `bash` são no **Ubuntu**, onde o prompt costuma terminar em `$`. O Node que aparece no PowerShell é o do Windows. Confira no Ubuntu:

```bash
node --version
git --version
```

O kit exige Node.js 24.11 ou superior. Se já usa nvm no Ubuntu e o Node não apareceu, carregue-o com `. "$HOME/.nvm/nvm.sh"` e rode `nvm use 24`. Se não tem Node no Ubuntu, instale a linha 24 conforme as [instruções do Node.js](https://nodejs.org/pt-br/download) ou da [Microsoft para WSL2](https://learn.microsoft.com/pt-br/windows/dev-environment/javascript/nodejs-on-wsl). Volte e confira as versões antes de continuar.

## 2. Baixe e rode a demo

**No Ubuntu**:

```bash
mkdir -p "$HOME/projetos"
cd "$HOME/projetos"
git clone https://github.com/ofelipepeixoto/radar-agent-desk.git
cd "$HOME/projetos/radar-agent-desk" &&
test -f bin/radar-agent-desk.mjs &&
node bin/radar-agent-desk.mjs check &&
mkdir -p local &&
node bin/radar-agent-desk.mjs demo --out local/demo.json
```

Se já clonou, pule o `git clone`. Se preferir ZIP, baixe por **Code → Download ZIP** na página do projeto. Extraia e entre na pasta que contém `bin/radar-agent-desk.mjs`. Um ZIP serve para experimentar, mas use o clone Git para desenvolver.

A checagem retorna `"status": "ok"` e a demo gera `local/demo.json`. Se já existir, escolha outro nome para a saída. Para localizar o arquivo no Windows, rode `explorer.exe local`. Se não encontrar a CLI, rode `pwd` e `ls bin` para conferir a pasta. O kit não precisa de `npm install`.

Para testar com suas próprias contagens, copie `fixtures/contagens-exemplo.json` para `local/entrada.json`, edite os cinco números e rode:

```bash
node bin/radar-agent-desk.mjs snapshot --input local/entrada.json --out local/resumo.json
```

Anexe só a saída ao ChatGPT, se desejar. Veja o [prompt de revisão](REVISAO-CHATGPT.md).

## 3. Adaptador opcional: Paperclip local

A demo e a importação offline não precisam desta etapa. Se o Paperclip já roda no WSL2, vá direto ao `probe` abaixo. Para uma instalação separada de laboratório, use uma pasta nova e dados fictícios. O comando segue a ordem do [guia da Curta Soluções](https://posts.curtasolucoes.com.br/paperclip), com versão explícita e porta local. A versão testada mantém um aviso crítico no conjunto npm observado; veja [SECURITY.md](../SECURITY.md).

Abra **outra janela do Ubuntu** e rode fora do clone Git:

```bash
export PAPERCLIP_TELEMETRY_DISABLED=1
RADAR_DESK_LAB="$HOME/.radar-agent-desk-paperclip-lab"
mkdir -p -m 700 "$RADAR_DESK_LAB" &&
cd "$RADAR_DESK_LAB" &&
npx --yes --registry=https://registry.npmjs.org paperclipai@2026.1106.0 onboard --yes --bind loopback --no-install-service --data-dir "$RADAR_DESK_LAB"
```

O Paperclip pode reportar o SHA de outro projeto se for iniciado dentro da pasta Git desse projeto. Se a porta padrão estiver ocupada, use `export PORT=4310` antes de iniciar. Mantenha a janela aberta; quando o servidor estiver ouvindo, abra [localhost:3100](http://localhost:3100) no navegador do Windows, ou a porta escolhida. Para o laboratório, crie só uma empresa fictícia, sem agente, rotina, chave ou túnel.

No primeiro Ubuntu, dentro do clone do kit:

```bash
node bin/radar-agent-desk.mjs probe
```

O esperado é `status: ok`, versão `2026.1106.0`, `local_trusted` e exposição `private`. Um SHA ausente é reportado como não confirmado; um SHA declarado diferente é recusado. Se mudou a porta, acrescente `--port 4310` ao `probe` e à captura.

No navegador local, abra `http://localhost:3100/api/companies` com a mesma porta da instância e copie o `id` da empresa de teste. Mantenha a lista bruta no computador. Substitua `COLE_O_ID_AQUI` abaixo:

```bash
mkdir -p local
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

A assinatura usada pelo agente dentro do Paperclip e uma conexão MCP para o ChatGPT consultar o painel são fluxos separados. O guia local não precisa de MCP nem expõe a porta.
