# Importar contagens sem conectar um serviço

Use o Radar Agent Desk para revisar os cinco totais de uma operação de agentes, inclusive quando o seu painel não é o Paperclip. Existem duas entradas: JSON preenchido localmente e CSV exportado de uma planilha de contagens. Ambas produzem o mesmo [resumo JSON de exemplo](../fixtures/resumo-offline-exemplo.json) para os mesmos números.

## Versão 1 do contrato

| Campo | O que informar |
| --- | --- |
| `schemaVersion` | `1` em ambas as entradas. |
| `source` | `radar-offline` no JSON. O importador define a origem automaticamente no CSV. |
| `open` | Total de tarefas abertas. |
| `inProgress` | Tarefas abertas em execução. |
| `blocked` | Tarefas abertas bloqueadas. |
| `done` | Tarefas concluídas. |
| `pendingApprovals` | Aprovações pendentes. |

Cada contagem é um inteiro entre 0 e 1 bilhão. Em execução e bloqueadas são subconjuntos distintos de abertas: sua soma não pode passar de `open`. Informe zero só quando o total observado for zero. Se algum total não estiver disponível, não invente um valor para completar a planilha. A importação precisa dos cinco totais.

O [esquema JSON](../schemas/contagens-offline-v1.schema.json) verifica chaves, versão e limites de cada número. O importador também verifica a relação entre os três números de tarefas abertas. As chaves do JSON ficam no objeto `counts` conforme o [modelo](../fixtures/contagens-exemplo.json).

## Entrada de planilha

Copie o [CSV de exemplo](../fixtures/contagens-planilha-exemplo.csv). A primeira linha deve ser este cabeçalho, seguido por exatamente uma linha de totais. Use UTF-8 com ou sem BOM, com quebras LF ou CRLF. O separador pode ser ponto e vírgula ou vírgula, sempre o mesmo em todo o arquivo.

```csv
schemaVersion;open;inProgress;blocked;done;pendingApprovals
1;8;3;2;5;1
```

Use apenas dígitos ASCII nos totais, sem aspas, fórmulas, espaços ou zeros à esquerda. Use o valor já calculado, não a fórmula. O arquivo não pode exceder 1 KiB. Não exporte uma planilha de tarefas, com nomes ou comentários. Monte uma aba separada só com os agregados e use `--format csv` para importá-la. Sem essa opção, o comando espera JSON independentemente da extensão do arquivo.

```bash
mkdir -p local
node bin/radar-agent-desk.mjs snapshot --format csv --input fixtures/contagens-planilha-exemplo.csv --out local/resumo-planilha.json
node bin/radar-agent-desk.mjs snapshot --input fixtures/contagens-exemplo.json --out local/resumo-json.json
cmp local/resumo-planilha.json local/resumo-json.json
```

`cmp` não imprime nada quando os dois arquivos são iguais. Os nomes de saída devem ser novos. Edite uma cópia dos exemplos em `local/`, não o arquivo de referência do repositório. Ao compartilhar, revise e anexe só o resumo. Ele identifica os totais como **declarados pelo operador** e não prova identidade, atualidade ou autenticidade. Nenhum desses comandos usa rede.

## Acrescentar uma fonte

1. Defina uma leitura local e limitada, com versão explícita. Não detecte o formato por tentativa e erro. Separe dados ausentes de valores zero.
2. Converta a entrada apenas para as cinco contagens do contrato e reaproveite `summarizeSnapshot`. Não transporte nomes, IDs, caminhos, texto, credenciais ou alegações de autorização.
3. Adicione uma amostra sintética que reproduza o [resumo de referência](../fixtures/resumo-offline-exemplo.json) e testes para erro de estrutura, bytes, versão, limites e sobreposição. Para mudanças incompatíveis, acrescente uma versão explícita sem reinterpretar arquivos v1.

Para entradas de painel e MCP, siga o [contrato completo](SNAPSHOT.md). Esses caminhos carregam evidências diferentes e não se misturam ao CSV de planilha.
