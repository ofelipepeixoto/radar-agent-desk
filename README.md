# Radar Agent Desk

Kit de Carlos Felipe Peixoto para transformar contagens de tarefas, bloqueios e aprovações em um resumo que pode ser revisado no ChatGPT. Roda no terminal. A importação offline funciona sem conta, servidor, banco ou conexão com o Paperclip.

Você escolhe o que entra, confere o JSON reduzido e só então decide se quer anexá-lo. A saída não inclui títulos, IDs, comentários, configurações ou credenciais. Os totais também podem revelar atividade: revise antes de compartilhar.

## Experimente no Ubuntu ou WSL

Requer Git e Node.js 24.11 ou superior no terminal em que vai rodar. No Windows, abra o Ubuntu com `wsl -d Ubuntu` antes de colar este bloco. O [guia de instalação](docs/INSTALACAO-WINDOWS.md) explica cada etapa.

```bash
git clone https://github.com/ofelipepeixoto/radar-agent-desk.git
cd radar-agent-desk
node bin/radar-agent-desk.mjs check
node bin/radar-agent-desk.mjs demo
```

O primeiro comando do kit checa o Node. Se estiver no Windows, `node bin/radar-agent-desk.mjs doctor` também informa se o ambiente foi reconhecido como WSL. O segundo mostra um resumo fictício na tela. Não é preciso rodar `npm install`.

| Quero | Comando |
| --- | --- |
| Guardar a demo | `mkdir -p local && node bin/radar-agent-desk.mjs demo --out local/demo.json` |
| Gerar um resumo dos meus totais | Copie o [exemplo](fixtures/contagens-exemplo.json) para `local/entrada.json`, edite apenas os cinco números e rode `node bin/radar-agent-desk.mjs snapshot --input local/entrada.json --out local/resumo.json`. |
| Revisar no ChatGPT | Anexe só o JSON de saída e use o [prompt de revisão](docs/REVISAO-CHATGPT.md). |
| Consultar meu Paperclip local | Siga o [guia do adaptador opcional](docs/INSTALACAO-WINDOWS.md#3-adaptador-opcional-paperclip-local). O servidor é instalado à parte. Veja também a [avaliação de versões e o ensaio de restauração](docs/OPERACAO-LOCAL.md). |
| Operar agentes no Paperclip | Siga o [passo a passo para Windows e WSL2](docs/AGENTES-PAPERCLIP-WSL.md): login do Codex, teste de conexão, primeira tarefa e revisão manual. |
| Conferir conectores do painel | Use a [auditoria de conectores](docs/AUDITORIA-CONECTORES.md) para separar conexão salva, permissões e teste observado. |
| Traduzir rótulos do painel | Veja a [tradução local e parcial no Chrome](docs/INTERFACE-PT-BR.md). |
| Evoluir pelo terminal | Siga [Desenvolver com Codex](docs/DESENVOLVER-COM-CODEX.md) e pegue a primeira tarefa do [roadmap](ROADMAP.md). |

Também dá para importar [uma linha de totais de planilha](docs/IMPORTACAO-OFFLINE.md) em CSV, sem rede. O [contrato de entrada e saída](docs/SNAPSHOT.md) explica a diferença entre números informados pelo operador, leitura local e recorte MCP. Tarefas em execução ou bloqueadas já estão incluídas em abertas. Uma fonte indisponível não equivale a zero.

A [avaliação de MCP, n8n e Cloudflare](docs/INTEGRACOES-CONTROLADAS.md) registra critérios de teste. O modo offline não depende dessas integrações.

## Como o projeto evolui

O [histórico de construção](docs/HISTORICO.md) documenta as decisões e verificações. O [changelog](CHANGELOG.md) registra o que entrou em cada versão. Use uma branch por melhoria, verifique a mudança localmente e abra uma PR para revisão. A CI roda em pushes e PRs.

```bash
npm test
python3 -m unittest discover -s test -p 'test_plugin_pack.py'
python3 scripts/pack-plugin.py --check
```

O teste Node cobre importação offline, CLI e um servidor HTTP de teste. Python 3 é necessário somente para verificar e empacotar a [skill opcional](plugin/radar-agent-desk-review). Ela contém instruções; não é um servidor MCP nem foi homologada para instalação no ChatGPT.

Código do Radar Agent Desk sob [MIT](LICENSE). Este repositório tem histórico próprio e não é um fork. O [Paperclip](https://github.com/paperclipai/paperclip) é um projeto externo, instalado separadamente se o adaptador for usado. Veja a [origem dos componentes](docs/HISTORICO.md#origem-e-licenças) e os [limites de segurança](SECURITY.md).
