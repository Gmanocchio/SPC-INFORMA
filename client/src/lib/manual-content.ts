export type ManualRole = "SPC_ADMIN" | "ORG_ADMIN" | "REQUESTER";
export type ManualOrganizationType = "SPC_BRASIL" | "CDL" | "DISTRIBUTOR" | "CREDITOR";
export type ManualChapterId = "ACCESS" | "DASHBOARD" | "CAMPAIGNS" | "ORGANIZATIONS" | "USERS" | "TEMPLATES" | "PRICING" | "BROKERS" | "API_KEYS" | "DOMAINS" | "HELP";
export type ManualVisualId = "ACCESS" | "DASHBOARD" | "CAMPAIGN" | "ORGANIZATION" | "USER" | "TEMPLATE" | "PRICING" | "BROKER" | "API_KEY" | "HELP";

export type ManualStep = {
  title: string;
  description: string;
  example?: string;
  warning?: string;
};

export type ManualChapter = {
  id: ManualChapterId;
  title: string;
  shortTitle: string;
  summary: string;
  purpose: string;
  route?: string;
  routeLabel?: string;
  visual: ManualVisualId;
  roles: ManualRole[];
  organizationTypes: ManualOrganizationType[];
  estimatedMinutes: number;
  prerequisites: string[];
  steps: ManualStep[];
  bestPractices: string[];
  profileNotes?: Partial<Record<ManualOrganizationType, string>>;
  roleNotes?: Partial<Record<ManualRole, string>>;
  keywords: string[];
};

export const MANUAL_ROLE_LABELS: Record<ManualRole, string> = {
  SPC_ADMIN: "Administrador SPC Brasil",
  ORG_ADMIN: "Administrador da organização",
  REQUESTER: "Solicitante",
};

export const MANUAL_ORGANIZATION_LABELS: Record<ManualOrganizationType, string> = {
  SPC_BRASIL: "SPC Brasil",
  CDL: "CDL",
  DISTRIBUTOR: "Distribuidora",
  CREDITOR: "Credor",
};

const ALL_ROLES: ManualRole[] = ["SPC_ADMIN", "ORG_ADMIN", "REQUESTER"];
const ADMIN_ROLES: ManualRole[] = ["SPC_ADMIN", "ORG_ADMIN"];
const SPC_ROLES: ManualRole[] = ["SPC_ADMIN"];
const ALL_ORGANIZATIONS: ManualOrganizationType[] = ["SPC_BRASIL", "CDL", "DISTRIBUTOR", "CREDITOR"];
const SPC_ORGANIZATION: ManualOrganizationType[] = ["SPC_BRASIL"];

export const MANUAL_CHAPTERS: ManualChapter[] = [
  {
    id: "ACCESS",
    title: "Acesso, segurança e recuperação de senha",
    shortTitle: "Acesso e segurança",
    summary: "Entre com credenciais corporativas, conclua a validação em duas etapas, troque a senha provisória e recupere o acesso.",
    purpose: "Garantir que somente usuários previamente autorizados utilizem o SPC Informa.",
    visual: "ACCESS",
    roles: ALL_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
    estimatedMinutes: 6,
    prerequisites: [
      "Ter sido cadastrado previamente por um administrador autorizado.",
      "Ter acesso ao e-mail corporativo informado no cadastro.",
    ],
    steps: [
      { title: "Abra a tela de acesso", description: "Selecione “Acessar SPC Informa”, informe o e-mail corporativo exatamente como foi cadastrado e a senha recebida ou definida anteriormente.", example: "Exemplo: usuario@empresa.com.br. A tela não cria contas; o cadastro é feito por um administrador na área Usuários." },
      { title: "Conclua a validação em duas etapas", description: "Consulte a caixa de entrada e informe os seis dígitos recebidos. Verifique também a pasta de spam.", warning: "Nunca compartilhe senha ou código de segurança. O suporte não precisa desses dados." },
      { title: "Troque a senha no primeiro acesso", description: "Informe a senha provisória e defina uma nova senha com pelo menos 12 caracteres, incluindo maiúscula, minúscula, número e símbolo.", example: "Use uma frase longa e exclusiva. Evite nome da empresa, CPF ou sequências previsíveis." },
      { title: "Recupere uma senha esquecida", description: "Selecione “Esqueci minha senha”, informe o e-mail cadastrado, valide o código recebido e defina uma nova senha forte." },
      { title: "Finalize a sessão", description: "Abra o menu da conta no rodapé da navegação lateral e selecione “Sair com segurança”, especialmente em computadores compartilhados." },
    ],
    bestPractices: ["Não reutilize a senha em outros serviços.", "Mantenha o e-mail corporativo atualizado.", "Solicite a inativação da conta em caso de acesso desconhecido."],
    keywords: ["login", "acesso", "senha", "código", "2fa", "primeiro acesso", "recuperação", "sair"],
  },
  {
    id: "DASHBOARD",
    title: "Dashboard e leitura dos indicadores",
    shortTitle: "Dashboard",
    summary: "Entenda cartões operacionais, gráficos por canal, evolução dos envios e informações financeiras disponíveis ao seu escopo.",
    purpose: "Oferecer uma visão rápida do volume processado, entregas, falhas, interações e custos.",
    route: "/app",
    routeLabel: "Abrir Dashboard",
    visual: "DASHBOARD",
    roles: ALL_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
    estimatedMinutes: 7,
    prerequisites: ["Ter campanhas processadas no período para visualizar indicadores diferentes de zero."],
    steps: [
      { title: "Leia os indicadores principais", description: "Os cartões mostram base incluída, envios, entregues, abertos, cliques e, no nível SPC, registros de SPAM." },
      { title: "Compare o desempenho por canal", description: "Compare SMS, E-mail, WhatsApp e RCS. A barra demonstra o percentual entregue em relação ao total enviado.", example: "9.560 entregues de 10.000 envios correspondem a 95,6% de entrega." },
      { title: "Acompanhe a evolução", description: "Use os gráficos diário e mensal para identificar aumento de volume, sazonalidade ou quedas que mereçam investigação." },
      { title: "Interprete saldo ou consumo", description: "Organizações pré-pagas visualizam o saldo. Organizações pós-pagas acompanham consumo acumulado e limite." },
      { title: "Confirme o escopo", description: "Quando houver mais de um credor, selecione o escopo desejado no filtro antes de analisar os números." },
    ],
    bestPractices: ["Compare canais com volumes semelhantes.", "Investigue quedas persistentes de entrega.", "Confirme o filtro antes de registrar conclusões."],
    profileNotes: {
      SPC_BRASIL: "O SPC visualiza a operação consolidada, o indicador de SPAM e o agrupamento por SPC Brasil, CDL e Distribuidora.",
      CDL: "A CDL visualiza sua operação e os credores vinculados ao seu escopo.",
      DISTRIBUTOR: "A Distribuidora visualiza sua operação e os credores vinculados ao seu escopo.",
      CREDITOR: "O Credor visualiza os indicadores relacionados à própria organização.",
    },
    keywords: ["dashboard", "indicadores", "envios", "entregues", "abertos", "cliques", "spam", "saldo", "consumo", "gráficos"],
  },
  {
    id: "CAMPAIGNS",
    title: "Campanhas: criação, importação e acompanhamento",
    shortTitle: "Campanhas",
    summary: "Configure uma campanha, baixe o modelo, importe destinatários, corrija erros, envie ou agende e acompanhe resultados.",
    purpose: "Organizar comunicações multicanal com validação prévia dos destinatários e rastreabilidade.",
    route: "/app/campanhas",
    routeLabel: "Abrir Campanhas",
    visual: "CAMPAIGN",
    roles: ALL_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
    estimatedMinutes: 14,
    prerequisites: ["Possuir um template ativo do canal.", "Ter credor ativo e preço vigente.", "Preparar CSV, XLSX ou TXT com até 8 MB e 20.000 linhas."],
    steps: [
      { title: "Inicie uma campanha", description: "Selecione “Nova campanha”, informe um nome descritivo e escolha SMS, E-mail, WhatsApp ou RCS.", example: "Exemplo: Aviso de vencimento — Julho 2026." },
      { title: "Defina responsável, credor e template", description: "Selecione a organização responsável quando disponível, escolha o credor e um template ativo do mesmo canal.", warning: "No nível Credor, o próprio credor é selecionado automaticamente. CDL e Distribuidora veem apenas credores vinculados." },
      { title: "Baixe e preencha o modelo", description: "Baixe o modelo CSV ou XLSX, preserve nomes e ordem das colunas e preencha uma linha por destinatário.", example: "Campos variam conforme o canal e as variáveis: nome, documento, contrato, valor, vencimento, telefone, e-mail e link." },
      { title: "Importe e valide", description: "Carregue o arquivo e aguarde a validação. A tela informa linhas válidas e descreve os erros por linha.", warning: "Corrija o arquivo original e envie novamente; não confirme dados incompletos." },
      { title: "Envie agora ou agende", description: "Confirme o envio imediato ou informe uma data e hora futuras válidas, observando o fuso do navegador." },
      { title: "Revise valores", description: "Confira quantidade, preço unitário e valor estimado. O débito ou consumo ocorre após validação e confirmação." },
      { title: "Acompanhe o status", description: "Consulte canal, destinatários, entregas, valor, agenda e situações como Rascunho, Pronta, Agendada, Processando, Concluída ou Falha." },
      { title: "Edite ou exclua quando permitido", description: "Antes do processamento, perfis administrativos podem editar nome e agenda ou excluir situações permitidas. Canal, template, credor e destinatários não mudam." },
    ],
    bestPractices: ["Revise uma amostra antes do upload.", "Identifique credor, objetivo e período no nome.", "Acompanhe campanhas agendadas até o processamento."],
    profileNotes: {
      SPC_BRASIL: "O SPC escolhe a organização responsável e acessa os credores permitidos em toda a operação.",
      CDL: "A CDL trabalha com credores vinculados à própria organização.",
      DISTRIBUTOR: "A Distribuidora trabalha com credores vinculados à própria organização.",
      CREDITOR: "O Credor utiliza automaticamente a própria organização.",
    },
    roleNotes: { REQUESTER: "O Solicitante cria e acompanha campanhas, mas não visualiza ações administrativas de editar ou excluir." },
    keywords: ["campanha", "csv", "xlsx", "txt", "planilha", "modelo", "importar", "validar", "agendar", "enviar", "status"],
  },
  {
    id: "ORGANIZATIONS",
    title: "Empresas, vínculos e configuração financeira",
    shortTitle: "Empresas",
    summary: "Cadastre e mantenha organizações, responsáveis, endereços, modelos financeiros, vínculos, situação e identidade visual.",
    purpose: "Manter a estrutura usada para autorização, cobrança, segmentação de dados e execução das campanhas.",
    route: "/app/empresas",
    routeLabel: "Abrir Empresas",
    visual: "ORGANIZATION",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
    estimatedMinutes: 11,
    prerequisites: ["Possuir perfil Administrador SPC Brasil ou Administrador da organização."],
    steps: [
      { title: "Pesquise antes de cadastrar", description: "Use razão social, nome fantasia ou CNPJ para encontrar um cadastro existente e evitar duplicidade." },
      { title: "Cadastre a organização", description: "Selecione “Cadastrar empresa” e preencha CNPJ, razão social, nome fantasia, responsável, contatos e endereço.", warning: "CNPJ e tipo não podem ser alterados depois do cadastro. Revise antes de salvar." },
      { title: "Defina tipo e vínculo", description: "O SPC cadastra todos os tipos e escolhe o vínculo do Credor. Administradores externos cadastram somente Credores vinculados à própria organização." },
      { title: "Configure o modelo financeiro", description: "No modelo Pré-pago, informe o saldo. No Pós-pago, informe o limite de crédito.", example: "Uma organização pré-paga com saldo de R$ 5.000,00 terá o valor das campanhas descontado após a confirmação." },
      { title: "Atualize situação e dados", description: "Na edição, atualize contatos, endereço, modelo financeiro e situação entre Ativa, Inativa ou Suspensa." },
      { title: "Envie a marca", description: "Use a ação de logo na listagem. São aceitas imagens PNG, JPG ou WEBP com até 1 MB.", warning: "Envie apenas a marca institucional autorizada, sem documentos ou dados pessoais." },
    ],
    bestPractices: ["Pesquise o CNPJ antes de cadastrar.", "Confirme o vínculo do Credor.", "Inative empresas encerradas em vez de reutilizar cadastros."],
    profileNotes: {
      SPC_BRASIL: "O SPC gerencia todos os tipos e vincula credores ao SPC, a uma CDL ou a uma Distribuidora.",
      CDL: "A CDL visualiza sua organização e credores vinculados; novos credores ficam vinculados automaticamente à CDL.",
      DISTRIBUTOR: "A Distribuidora visualiza sua organização e credores vinculados; novos credores ficam vinculados automaticamente.",
      CREDITOR: "O administrador do Credor opera somente no escopo retornado para sua organização.",
    },
    keywords: ["empresas", "organizações", "cnpj", "credor", "cdl", "distribuidora", "vínculo", "saldo", "limite", "logo"],
  },
  {
    id: "USERS",
    title: "Usuários, perfis e segurança operacional",
    shortTitle: "Usuários",
    summary: "Crie usuários autorizados, atribua perfis, acompanhe o primeiro acesso e controle a situação da conta.",
    purpose: "Administrar identidades individuais e conceder apenas as permissões necessárias ao trabalho.",
    route: "/app/usuarios",
    routeLabel: "Abrir Usuários",
    visual: "USER",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
    estimatedMinutes: 9,
    prerequisites: ["Possuir perfil administrativo.", "Confirmar a organização correta do novo usuário."],
    steps: [
      { title: "Pesquise antes de cadastrar", description: "Use nome, CPF ou e-mail para confirmar que a pessoa ainda não possui cadastro." },
      { title: "Crie o usuário", description: "Selecione “Novo usuário” e preencha nome, CPF, e-mail, telefone, senha inicial e perfil.", warning: "A senha inicial deve ser entregue com segurança e será trocada no primeiro acesso." },
      { title: "Escolha o perfil", description: "Administrador gerencia cadastros e configurações; Solicitante acessa Dashboard e Campanhas. Apenas o SPC atribui Administrador SPC Brasil." },
      { title: "Oriente o primeiro acesso", description: "Entregue o endereço da plataforma e a senha inicial por canal corporativo seguro. O usuário deverá substituí-la." },
      { title: "Edite dados e situação", description: "Atualize nome, e-mail, telefone, perfil e situação. CPF e organização permanecem vinculados ao cadastro original." },
      { title: "Acompanhe a segurança", description: "A tabela informa troca de senha pendente, situação da conta e data do último acesso." },
    ],
    bestPractices: ["Conceda o menor privilégio necessário.", "Inative contas sem necessidade de acesso.", "Não crie contas genéricas ou compartilhadas."],
    profileNotes: {
      SPC_BRASIL: "O SPC escolhe a organização e pode atribuir os três perfis conforme as regras de vínculo.",
      CDL: "A CDL administra usuários vinculados à própria organização.",
      DISTRIBUTOR: "A Distribuidora administra usuários vinculados à própria organização.",
      CREDITOR: "O Credor administra usuários vinculados à própria organização.",
    },
    keywords: ["usuários", "cpf", "email", "perfil", "administrador", "solicitante", "senha inicial", "inativar", "último acesso"],
  },
  {
    id: "TEMPLATES",
    title: "Templates multicanal, variáveis e versões",
    shortTitle: "Templates",
    summary: "Crie mensagens homologadas, use variáveis válidas, visualize o resultado e preserve versões anteriores.",
    purpose: "Padronizar comunicações e reduzir erros de conteúdo ou variáveis incompatíveis.",
    route: "/app/templates",
    routeLabel: "Abrir Templates",
    visual: "TEMPLATE",
    roles: SPC_ROLES,
    organizationTypes: SPC_ORGANIZATION,
    estimatedMinutes: 12,
    prerequisites: ["Possuir perfil Administrador SPC Brasil.", "Conhecer o canal e as variáveis necessárias."],
    steps: [
      { title: "Crie o template", description: "Selecione “Novo template”, informe nome, canal e situação. Para E-mail, informe também o assunto." },
      { title: "Escreva o conteúdo", description: "Digite a mensagem considerando o canal. SMS aceita no máximo 164 caracteres, incluindo espaços e variáveis." },
      { title: "Insira variáveis", description: "Posicione o cursor, abra “Inserir variável” e escolha um campo suportado.", example: "SPC INFORMA: Olá {{nome_cliente}}, consulte sua comunicação em {{link}}.", warning: "Variáveis não suportadas impedem o salvamento." },
      { title: "Revise a prévia", description: "A pré-visualização usa dados sintéticos e não executa HTML. Confira legibilidade, links e informações fixas." },
      { title: "Ative ou arquive", description: "Rascunho indica preparação; Ativo libera para campanhas; Arquivado impede novas seleções sem apagar o histórico." },
      { title: "Edite com versionamento", description: "A edição cria uma nova versão. Campanhas anteriores mantêm a mensagem original." },
    ],
    bestPractices: ["Revise texto e links antes de ativar.", "Use somente variáveis necessárias.", "Arquive modelos obsoletos."],
    keywords: ["templates", "sms", "email", "whatsapp", "rcs", "variáveis", "assunto", "164", "pré-visualização", "versão"],
  },
  {
    id: "PRICING",
    title: "Precificação por canal e vigência",
    shortTitle: "Precificação",
    summary: "Consulte a matriz de preços e registre novas vigências sem apagar o histórico.",
    purpose: "Determinar com rastreabilidade o preço unitário aplicado a cada canal e credor.",
    route: "/app/precificacao",
    routeLabel: "Abrir Precificação",
    visual: "PRICING",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
    estimatedMinutes: 8,
    prerequisites: ["Possuir perfil administrativo.", "Confirmar credor, canal e início da vigência."],
    steps: [
      { title: "Leia a matriz", description: "Cada linha representa uma base ou credor e cada coluna um canal. Verde indica preço ativo; vermelho indica valor ausente ou inativo." },
      { title: "Selecione a célula", description: "Clique no encontro entre credor e canal e confirme a linha e a coluna antes de registrar." },
      { title: "Informe valor e vigência", description: "Digite um valor unitário maior que zero e a data e hora em que passará a valer.", example: "Para R$ 0,10 por SMS, registre o valor no formato monetário exibido." },
      { title: "Preserve o histórico", description: "A alteração cria uma nova vigência; o preço anterior não é apagado." },
      { title: "Confira a Base SPC", description: "Somente o SPC edita a Base SPC Brasil. Administradores externos consultam essa linha em modo somente leitura." },
    ],
    bestPractices: ["Valide o valor com a área comercial.", "Evite vigências retroativas sem justificativa.", "Confirme preço ativo para todos os canais utilizados."],
    profileNotes: {
      SPC_BRASIL: "O SPC edita a Base SPC Brasil e os preços no escopo completo.",
      CDL: "A CDL consulta a Base SPC e administra preços permitidos para credores vinculados.",
      DISTRIBUTOR: "A Distribuidora consulta a Base SPC e administra preços permitidos para credores vinculados.",
      CREDITOR: "O Credor consulta os valores do próprio escopo; a Base SPC permanece somente leitura.",
    },
    keywords: ["preço", "precificação", "matriz", "sms", "email", "whatsapp", "rcs", "vigência", "base spc"],
  },
  {
    id: "BROKERS",
    title: "Brokers, credenciais e roteamento por canal",
    shortTitle: "Brokers",
    summary: "Configure provedores de envio, endpoints, autenticação protegida, timeout e prioridade por canal.",
    purpose: "Centralizar a integração técnica com provedores responsáveis pelo processamento das mensagens.",
    route: "/app/brokers",
    routeLabel: "Abrir Brokers",
    visual: "BROKER",
    roles: SPC_ROLES,
    organizationTypes: SPC_ORGANIZATION,
    estimatedMinutes: 10,
    prerequisites: ["Possuir perfil Administrador SPC Brasil.", "Ter endpoint HTTPS e credenciais fornecidos pelo provedor."],
    steps: [
      { title: "Cadastre o provedor", description: "Informe nome, canal, endpoint HTTPS, rota de envio e timeout entre 1.000 e 30.000 milissegundos." },
      { title: "Configure a autenticação", description: "Cadastre API key, webhook secret ou usuário e senha. Os valores são protegidos e não retornam para a tela.", warning: "Na edição, deixe campos secretos em branco para preservar o valor atual." },
      { title: "Defina o retorno de status", description: "Configure os dados necessários para reconhecer resultados e atualizar entregas, falhas e interações." },
      { title: "Marque o preferencial", description: "O broker preferencial ganha prioridade naquele canal e substitui o preferencial anterior." },
      { title: "Edite ou desative", description: "Atualize dados permitidos. Ao desativar, o broker deixa o roteamento automático de campanhas futuras." },
    ],
    bestPractices: ["Teste o endpoint em ambiente controlado.", "Rotacione credenciais conforme a política do provedor.", "Documente a estratégia de contingência."],
    keywords: ["broker", "provedor", "endpoint", "api key", "webhook", "secret", "timeout", "preferencial", "roteamento"],
  },
  {
    id: "API_KEYS",
    title: "Chaves de API, escopos, rotação e revogação",
    shortTitle: "Chaves de API",
    summary: "Emita credenciais para integrações, limite permissões, defina expiração e faça rotação ou revogação.",
    purpose: "Permitir integrações programáticas rastreáveis com o menor conjunto de permissões necessário.",
    route: "/app/chaves-api",
    routeLabel: "Abrir Chaves de API",
    visual: "API_KEY",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
    estimatedMinutes: 8,
    prerequisites: ["Possuir perfil administrativo.", "Definir o responsável pela guarda da credencial."],
    steps: [
      { title: "Emita uma chave", description: "Selecione “Nova chave”, informe um nome que identifique o sistema consumidor e escolha a organização quando disponível.", example: "Exemplo: ERP Produção — Campanhas." },
      { title: "Conceda somente os escopos necessários", description: "Escolha consulta de campanhas, criação de campanhas e/ou consulta de relatórios conforme a finalidade." },
      { title: "Defina a expiração", description: "Quando aplicável, informe uma data e planeje a substituição antes do vencimento." },
      { title: "Copie o segredo imediatamente", description: "O segredo completo aparece uma única vez. Guarde-o em um cofre corporativo.", warning: "Não envie o segredo por e-mail, mensagem ou documento compartilhado." },
      { title: "Faça a rotação", description: "A substituição revoga a credencial anterior imediatamente e gera um novo segredo de exibição única." },
      { title: "Revogue acessos encerrados", description: "A revogação impede novos usos e deve ser aplicada quando a integração terminar ou houver suspeita de exposição." },
    ],
    bestPractices: ["Crie uma chave por integração e ambiente.", "Use expiração e rotação periódica.", "Nunca registre segredos no código-fonte."],
    profileNotes: {
      SPC_BRASIL: "O SPC administra chaves para organizações no escopo completo.",
      CDL: "A CDL administra chaves para a própria organização.",
      DISTRIBUTOR: "A Distribuidora administra chaves para a própria organização.",
      CREDITOR: "O Credor administra chaves para a própria organização.",
    },
    keywords: ["api", "chave", "segredo", "escopo", "permissão", "expiração", "rotação", "revogar", "integração"],
  },
  {
    id: "DOMAINS",
    title: "Gestão de Domínios",
    shortTitle: "Domínios",
    summary: "Entenda a situação atual da área reservada para gestão futura de domínios.",
    purpose: "Reservar no menu do SPC a área destinada à futura administração de domínios da plataforma.",
    route: "/app/dominios",
    routeLabel: "Ver situação do módulo",
    visual: "HELP",
    roles: SPC_ROLES,
    organizationTypes: SPC_ORGANIZATION,
    estimatedMinutes: 2,
    prerequisites: ["Possuir perfil Administrador SPC Brasil."],
    steps: [
      { title: "Consulte a situação", description: "Abra “Gestão de Domínios” para visualizar o aviso de que o módulo permanece em preparação." },
      { title: "Não espere ações operacionais", description: "Enquanto a integração não estiver disponível, a página não permite cadastrar, editar ou remover domínios." },
    ],
    bestPractices: ["Não registre informações sensíveis em fluxos alternativos enquanto o módulo estiver indisponível."],
    keywords: ["domínio", "dns", "gestão de domínios", "em preparação"],
  },
  {
    id: "HELP",
    title: "FAQ, busca no Manual e boas práticas de suporte",
    shortTitle: "Ajuda e suporte",
    summary: "Use busca e sumário, consulte respostas rápidas no FAQ e encaminhe ao suporte somente informações seguras.",
    purpose: "Ajudar o usuário a encontrar instruções sem expor dados de clientes ou credenciais.",
    route: "/app/faq",
    routeLabel: "Abrir FAQ",
    visual: "HELP",
    roles: ALL_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
    estimatedMinutes: 4,
    prerequisites: [],
    steps: [
      { title: "Pesquise pela ação", description: "Procure por ações como “criar campanha”, “trocar senha”, “planilha”, “preço” ou “revogar chave”." },
      { title: "Use o sumário do perfil", description: "O sumário mostra apenas capítulos aplicáveis ao seu papel e organização. O SPC visualiza todos." },
      { title: "Abra a tela pelo atalho", description: "Use o botão ao final do capítulo para ir diretamente à funcionalidade documentada." },
      { title: "Prepare uma solicitação segura", description: "Informe tela, ação, horário e mensagem de erro. Oculte CPF, telefone, e-mail de clientes, valores, senhas e chaves." },
    ],
    bestPractices: ["Consulte primeiro o capítulo correspondente.", "Não envie arquivos reais de clientes.", "Use dados fictícios ao reproduzir um problema."],
    keywords: ["manual", "faq", "ajuda", "busca", "suporte", "erro", "dúvida", "atalho"],
  },
];

export function getVisibleManualChapters(identity: { role: ManualRole; organizationType: ManualOrganizationType }): ManualChapter[] {
  if (identity.role === "SPC_ADMIN" || identity.organizationType === "SPC_BRASIL") return MANUAL_CHAPTERS;
  return MANUAL_CHAPTERS.filter(chapter => chapter.roles.includes(identity.role) && chapter.organizationTypes.includes(identity.organizationType));
}

export function normalizeManualSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

export function filterManualChapters(chapters: ManualChapter[], search: string): ManualChapter[] {
  const normalizedSearch = normalizeManualSearch(search);
  if (!normalizedSearch) return chapters;
  const terms = normalizedSearch.split(/\s+/).filter(Boolean);
  return chapters.filter(chapter => {
    const haystack = normalizeManualSearch([
      chapter.title, chapter.shortTitle, chapter.summary, chapter.purpose,
      ...chapter.prerequisites,
      ...chapter.steps.flatMap(step => [step.title, step.description, step.example, step.warning]),
      ...chapter.bestPractices, ...chapter.keywords,
    ].filter(Boolean).join(" "));
    return terms.every(term => haystack.includes(term));
  });
}

export function getManualReadingMinutes(chapters: ManualChapter[]): number {
  return chapters.reduce((total, chapter) => total + chapter.estimatedMinutes, 0);
}
