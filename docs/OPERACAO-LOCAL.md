# Operação local: versão, cópia e restauração

O Radar Agent Desk funciona offline sem Paperclip. Este ensaio é para o **adaptador opcional** e usa somente uma instalação nova, em loopback, com dados fictícios. O script não lê a instalação normal do usuário e não inicia processos, agentes ou integrações.

## Versões verificadas em 11/11/2026

| Distribuição consultada | Better Auth no lock resolvido | `npm audit --omit=dev` |
| --- | --- | --- |
| `2026.1106.0`, tag npm `latest` | `1.7.2` | 1 crítico, 5 altos, 2 moderados, 2 baixos |
| `2026.1111.0-canary.12`, pré-lançamento | `1.7.16` | 0 críticos, 5 altos, 3 moderados |

Os resultados são de duas árvores de dependências resolvidas isoladamente pelo npm 11.9.0, sem executar scripts de instalação para a análise. Eles mudam com a resolução do npm e com a base de avisos. O [aviso crítico de Better Auth](https://github.com/advisories/GHSA-965c-763c-88jm) indica correção em `1.7.7`. O candidato canary usa uma versão posterior e o aviso não apareceu nesse scan. Isso não comprova a segurança da aplicação, nem a presença ou ausência de exploração na configuração do Paperclip. Os outros canais observados, beta `2026.1110.0-beta.0` e nightly `2026.1111.0-nightly.0`, ainda declaravam `1.7.2`. A instalação repetível do canary com `npm ci --ignore-scripts` também não passou: o npm reportou divergências de OpenTelemetry e dependências opcionais no lock que acabara de resolver. O resultado do scan do canary é do lock, não de um servidor iniciado.

**Decisão: o pin do adaptador não mudou.** O canary é apenas candidato para novo ensaio e ainda teve avisos altos. Não houve homologação de uma versão estável corrigida. A versão antiga continua restrita ao laboratório local fictício.

Para repetir o scan em um diretório descartável fora do clone, troque `VERSAO` pela versão exata a avaliar:

```bash
npm view paperclipai dist-tags --json --registry=https://registry.npmjs.org
audit_dir="$(mktemp -d /tmp/radar-audit.XXXXXXXX)"
cd "$audit_dir" &&
npm init -y &&
npm install --save-exact --package-lock-only --ignore-scripts --no-audit --no-fund paperclipai@VERSAO --registry=https://registry.npmjs.org &&
npm ls better-auth --package-lock-only &&
npm audit --omit=dev --registry=https://registry.npmjs.org
```

Consulte também o [registro npm do servidor](https://registry.npmjs.org/@paperclipai%2Fserver), as [releases do Paperclip](https://github.com/paperclipai/paperclip/releases) e as notas de migração. Um exit code de auditoria diferente de zero pode indicar avisos, não uma falha de instalação. Não rode `npm audit fix --force` contra a instalação do operador.

## Ensaiar a cópia a frio no WSL

O PostgreSQL [requer o cluster inteiro desligado para a cópia física](https://www.postgresql.org/docs/18/backup-file.html). O [guia de banco do Paperclip](https://docs.paperclip.ing/reference/deploy/database/#what-a-database-backup-preserves) explica por que backup só do banco não inclui os anexos nem substitui a chave local correspondente. Esta ferramenta copia a árvore completa do laboratório; ela não serve para banco externo, armazenamento externo, caminhos com links ou backup em produção.

No Ubuntu, partindo da raiz do clone:

```bash
REPO="$(pwd -P)"
LAB_PARENT="$(mktemp -d /tmp/radar-paperclip.XXXXXXXX)"
LAB="$LAB_PARENT/ensaio"
node "$REPO/scripts/paperclip-backup-lab.mjs" init "$LAB"
```

Para testar com o Paperclip, execute a instalação oficial **só nessa pasta nova**. Confira que a porta 4310 está livre antes de usar. O primeiro servidor local continua intacto.

```bash
cd "$LAB/instancia" &&
PAPERCLIP_TELEMETRY_DISABLED=1 PORT=4310 npx --yes --registry=https://registry.npmjs.org paperclipai@2026.1106.0 onboard --yes --bind loopback --no-install-service --data-dir "$LAB/instancia"
```

Se iniciar, crie uma empresa fictícia sem agentes, credenciais de modelo ou rotinas. Na mesma janela, encerre o Paperclip com **Ctrl+C** e confirme que o PostgreSQL correspondente também terminou. Não force a cópia nem remova `postmaster.pid` para passar a checagem. Com ambos parados:

```bash
node "$REPO/scripts/paperclip-backup-lab.mjs" backup "$LAB" --confirmo-parado &&
node "$REPO/scripts/paperclip-backup-lab.mjs" restore "$LAB" --confirmo-parado
```

O esperado é `copia_verificada` e `restauracao_verificada`. O original permanece em `instancia/`, a cópia em `backup/dados/` e a restauração em `restauracao/`. O manifesto é gravado depois da verificação. O script não sobrescreve destinos existentes. Se a operação for interrompida, trate a saída parcial como inválida e repita em outro laboratório.

Os SHA-256 detectam divergência em relação ao manifesto local; não comprovam autenticidade e não criptografam a cópia. Mesmo cópias de laboratório devem ficar fora do Git. O script usa diretórios novos com modo 0700 e arquivos com 0600, recusa links e limita a árvore a 2 GiB e 20 mil entradas. A ausência de `postmaster.pid` não substitui a confirmação de que o cluster e o aplicativo foram desligados.

Não inicie o aplicativo apontando para a configuração restaurada sem revisar os caminhos de banco, armazenamento e chaves: caminhos absolutos podem apontar para a origem. Para homologar o painel, verifique os caminhos restaurados em um ambiente de teste, use a mesma versão do servidor e do PostgreSQL e uma porta diferente, e compare a empresa e o arquivo fictício. Nenhuma migração deve ser rodada sobre a instalação real neste ensaio.

## Evidência e critério para trocar o pin

- Quatro testes automatizados de laboratório: cópia e restauração sem a origem, recusa com PID ativo, rejeição de links e detecção de alteração do backup sem sobrescrever saídas.
- Ensaio real da camada de banco, em Linux isolado: PostgreSQL **18.1** do pacote npm estável, migrações oficiais do Paperclip aplicadas, uma empresa fictícia gravada, cópia fria de **80.585.686 bytes**, reabertura do PostgreSQL restaurado, registro fictício recuperado e arquivo sintético com bytes iguais. O script recusou a cópia enquanto o banco estava ativo. Nenhuma instalação real foi acessada.
- Isso comprova a restauração do banco e do arquivo no laboratório, não a abertura do painel HTTP ou uma captura da instância restaurada pelo kit. A CLI estável passou nas 12 checagens do diagnóstico, mas a tentativa de subir o painel encerrou pelo limite de tempo sem sinal de prontidão. Nesse ambiente, a enumeração de interfaces de rede do Node também falha. A homologação do painel no WSL continua pendente.
- Para trocar o pin: escolha uma release estável revisada, repita a auditoria, teste migrações na cópia descartável e verifique `probe`, captura, isolamento e restauração. Atualize o par versão/commit e os testes somente com esse resultado. Se falhar, preserve o original e aponte a versão anterior somente para o cluster anterior. Não faça downgrade no banco que já passou por migração.
