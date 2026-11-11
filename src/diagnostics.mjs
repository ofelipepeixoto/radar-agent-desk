import { release } from 'node:os';

export function detectEnvironment(platform = process.platform, kernel = release()) {
  if (platform === 'linux') {
    if (/wsl2/i.test(kernel)) return 'wsl2';
    if (/microsoft|wsl/i.test(kernel)) return 'wsl';
    return 'linux';
  }
  return platform === 'win32' ? 'windows' : 'other';
}

export function diagnosticHint(code, { paperclipVersion, deadlineSeconds }) {
  switch (code) {
    case 'NODE_24_11_OU_SUPERIOR_EXIGIDO':
      return 'Use Node.js 24.11 ou superior no mesmo terminal. No Windows, confira a versão dentro do Ubuntu.';
    case 'PAPERCLIP_CONEXAO_RECUSADA':
      return 'A conexão local foi recusada. Confira se o Paperclip está aberto neste ambiente e se --port indica a porta certa.';
    case 'PAPERCLIP_TEMPO_ESGOTADO':
      return `O Paperclip não completou a resposta em ${deadlineSeconds} segundos. Aguarde o painel abrir e tente probe novamente.`;
    case 'VERSAO_PAPERCLIP_NAO_HOMOLOGADA':
      return `A captura está limitada ao Paperclip ${paperclipVersion}. Use a importação offline com outras versões.`;
    case 'COMMIT_PAPERCLIP_DIVERGENTE':
      return 'O commit informado não confere. Inicie o Paperclip fora da pasta de outro repositório Git e rode probe.';
    case 'MODO_LOCAL_PRIVADO_EXIGIDO':
      return 'O adaptador só aceita o laboratório local privado. Para outra instalação, use a importação offline.';
    case 'PAPERCLIP_NAO_PRONTO':
      return 'Aguarde o Paperclip terminar de iniciar e rode probe novamente.';
    case 'PAPERCLIP_HTTP_NAO_OK':
    case 'PAPERCLIP_INDISPONIVEL':
      return 'Confira se a porta é a do Paperclip e se o painel local responde. Nenhum resumo foi gerado.';
    default:
      return '';
  }
}
