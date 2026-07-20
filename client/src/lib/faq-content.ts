export type FaqRole = "SPC_ADMIN" | "ORG_ADMIN" | "REQUESTER";
export type FaqOrganizationType = "SPC_BRASIL" | "CDL" | "DISTRIBUTOR" | "CREDITOR";

export type FaqCategoryId =
  | "ACCESS"
  | "DASHBOARD"
  | "CAMPAIGNS"
  | "ORGANIZATIONS"
  | "USERS"
  | "TEMPLATES"
  | "PRICING"
  | "BROKERS"
  | "API_KEYS"
  | "DOMAINS";

export type FaqVisualId =
  | "SECURITY"
  | "DASHBOARD"
  | "CAMPAIGN_FLOW"
  | "IMPORT_VALIDATION"
  | "ORGANIZATION_FORM"
  | "USER_SECURITY"
  | "TEMPLATE_EDITOR"
  | "PRICING_MATRIX"
  | "BROKER_CARD"
  | "API_KEY";

export type FaqItem = {
  id: string;
  category: FaqCategoryId;
  question: string;
  answer: string;
  steps?: string[];
  note?: string;
  route?: string;
  routeLabel?: string;
  visual?: FaqVisualId;
  roles: FaqRole[];
  organizationTypes: FaqOrganizationType[];
};

export const FAQ_CATEGORIES: Array<{
  id: FaqCategoryId;
  label: string;
  description: string;
}> = [
  { id: "ACCESS", label: "Acesso e segurança", description: "Login, código de segurança, primeiro acesso e senha" },
  { id: "DASHBOARD", label: "Dashboard", description: "Indicadores, filtros, gráficos e visão financeira" },
  { id: "CAMPAIGNS", label: "Campanhas", description: "Criação, arquivos, validação, agenda e acompanhamento" },
  { id: "ORGANIZATIONS", label: "Empresas", description: "Cadastros, vínculos, logos e modelos financeiros" },
  { id: "USERS", label: "Usuários", description: "Perfis, segurança, situação e primeiro acesso" },
  { id: "TEMPLATES", label: "Templates", description: "Conteúdo, variáveis, versões e canais" },
  { id: "PRICING", label: "Precificação", description: "Matriz por canal, vigências e Base SPC Brasil" },
  { id: "BROKERS", label: "Brokers", description: "Provedores, credenciais e roteamento por canal" },
  { id: "API_KEYS", label: "Chaves de API", description: "Emissão, escopos, rotação e revogação" },
  { id: "DOMAINS", label: "Gestão de Domínios", description: "Situação atual do módulo" },
];

const ALL_ROLES: FaqRole[] = ["SPC_ADMIN", "ORG_ADMIN", "REQUESTER"];
const ADMIN_ROLES: FaqRole[] = ["SPC_ADMIN", "ORG_ADMIN"];
const SPC_ROLES: FaqRole[] = ["SPC_ADMIN"];
const ALL_ORGANIZATIONS: FaqOrganizationType[] = ["SPC_BRASIL", "CDL", "DISTRIBUTOR", "CREDITOR"];
const SPC_ORGANIZATION: FaqOrganizationType[] = ["SPC_BRASIL"];

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "access-account",
    category: "ACCESS",
    question: "Como obtenho acesso ao SPC Informa?",
    answer: "A tela de acesso não permite criar uma conta. Um administrador autorizado deve cadastrar previamente o usuário na área Usuários. Depois disso, o usuário entra com o e-mail corporativo e a senha recebida.",
    note: "Se o seu e-mail ainda não estiver cadastrado, procure o administrador da sua organização.",
    visual: "SECURITY",
    roles: ALL_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "access-two-factor",
    category: "ACCESS",
    question: "Por que o sistema solicita um código depois da senha?",
    answer: "O acesso possui uma segunda etapa de segurança. Após validar e-mail e senha, o sistema envia ao e-mail cadastrado um código numérico de seis dígitos, que deve ser informado para concluir o login.",
    steps: ["Informe e-mail e senha.", "Consulte a caixa de entrada e também a pasta de spam.", "Digite os seis números do código na tela de validação."],
    visual: "SECURITY",
    roles: ALL_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "access-recover-password",
    category: "ACCESS",
    question: "Como recupero uma senha esquecida?",
    answer: "Na tela de acesso, selecione “Esqueci minha senha”. Informe o e-mail corporativo, utilize o código de seis dígitos recebido e defina uma nova senha com pelo menos 12 caracteres.",
    note: "A nova senha deve combinar letras maiúsculas, letras minúsculas, números e símbolos.",
    roles: ALL_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "access-first-login",
    category: "ACCESS",
    question: "O que acontece no primeiro acesso?",
    answer: "Antes de abrir os módulos da plataforma, o sistema exige a substituição da senha provisória. Informe a senha recebida, crie a nova senha e confirme exatamente o mesmo valor.",
    steps: ["Digite a senha provisória.", "Crie uma senha de no mínimo 12 caracteres.", "Repita a nova senha e selecione “Salvar e acessar a plataforma”."],
    roles: ALL_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "access-permissions",
    category: "ACCESS",
    question: "Por que algumas opções não aparecem no meu menu?",
    answer: "O menu respeita o perfil do usuário e o tipo da organização. Administradores visualizam módulos de gestão; solicitantes acessam o Dashboard e Campanhas. O conteúdo desta página segue a mesma regra e mostra apenas orientações aplicáveis ao seu acesso.",
    note: "O nível SPC Brasil visualiza o FAQ completo para apoiar todas as organizações.",
    roles: ALL_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },

  {
    id: "dashboard-indicators",
    category: "DASHBOARD",
    question: "O que significam os indicadores principais do Dashboard?",
    answer: "Os cartões resumem os envios do período, as entregas confirmadas, a taxa de entrega e o valor processado. Eles permitem avaliar rapidamente volume, resultado e impacto financeiro da operação.",
    visual: "DASHBOARD",
    route: "/app",
    routeLabel: "Abrir Dashboard",
    roles: ALL_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "dashboard-refresh-filter",
    category: "DASHBOARD",
    question: "Os dados do Dashboard são atualizados automaticamente?",
    answer: "Sim. A consulta é atualizada automaticamente a cada 30 segundos. Quando o perfil puder consultar mais de um credor, o filtro no topo permite alternar entre a visão consolidada e um credor específico.",
    roles: ALL_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "dashboard-channels",
    category: "DASHBOARD",
    question: "Quais análises estão disponíveis nos gráficos?",
    answer: "O Dashboard apresenta desempenho por canal para SMS, E-mail, WhatsApp e RCS, volume diário dos últimos 14 dias, evolução mensal dos últimos 12 meses e, quando permitido, volume por credor.",
    visual: "DASHBOARD",
    roles: ALL_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "dashboard-financial",
    category: "DASHBOARD",
    question: "Por que a informação financeira muda entre saldo e consumo?",
    answer: "A visualização acompanha o modelo financeiro da organização. Operações pré-pagas mostram o saldo disponível; operações pós-pagas mostram o consumo acumulado e o limite aplicável.",
    roles: ALL_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "dashboard-consolidation",
    category: "DASHBOARD",
    question: "Quem pode consultar o consolidado por organização?",
    answer: "O consolidado por organização é exclusivo do nível SPC Brasil. Ele agrupa credores conforme o vínculo com CDLs, Distribuidoras e SPC Brasil e apresenta envios, entregas, falhas e valores por credor.",
    route: "/app",
    routeLabel: "Ver consolidado",
    roles: SPC_ROLES,
    organizationTypes: SPC_ORGANIZATION,
  },

  {
    id: "campaign-create",
    category: "CAMPAIGNS",
    question: "Como crio uma nova campanha?",
    answer: "Na página Campanhas, selecione “Nova campanha”, informe o nome, escolha o canal, o credor e um template ativo, defina se o envio será imediato ou agendado e carregue o arquivo de destinatários.",
    steps: ["Defina nome, canal, credor e template.", "Baixe o modelo e preencha uma linha por destinatário.", "Envie o arquivo e revise a validação.", "Confirme o envio imediato ou o agendamento."],
    visual: "CAMPAIGN_FLOW",
    route: "/app/campanhas",
    routeLabel: "Abrir Campanhas",
    roles: ALL_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "campaign-organization-creditor",
    category: "CAMPAIGNS",
    question: "Como a organização e o credor são definidos na campanha?",
    answer: "No nível SPC Brasil, o administrador pode selecionar a organização responsável. Em CDLs e Distribuidoras, a escolha fica limitada aos credores do seu escopo. Quando a própria organização é um Credor, esse credor é utilizado automaticamente.",
    roles: ALL_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "campaign-files",
    category: "CAMPAIGNS",
    question: "Quais arquivos de destinatários são aceitos?",
    answer: "A importação aceita arquivos CSV, XLSX ou TXT, com tamanho máximo de 8 MB e até 20.000 linhas. Os nomes e a ordem das colunas do modelo não devem ser alterados.",
    note: "Preencha uma linha por cliente e mantenha as variáveis exigidas pelo template escolhido.",
    visual: "IMPORT_VALIDATION",
    roles: ALL_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "campaign-model",
    category: "CAMPAIGNS",
    question: "Como preparo corretamente a planilha da campanha?",
    answer: "Use os botões de download do formulário para obter o modelo CSV ou XLSX. O arquivo é montado com as colunas necessárias para o canal e para as variáveis do template selecionado.",
    steps: ["Escolha canal, credor e template.", "Baixe o modelo disponível.", "Preencha os dados sem renomear colunas.", "Salve e carregue o arquivo no mesmo formulário."],
    roles: ALL_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "campaign-validation",
    category: "CAMPAIGNS",
    question: "O que faço quando a validação encontra linhas inválidas?",
    answer: "Revise o resumo de importação e o detalhamento dos erros por linha. Exclua o arquivo carregado, corrija os dados no documento original e faça um novo upload antes de confirmar a campanha.",
    visual: "IMPORT_VALIDATION",
    roles: ALL_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "campaign-edit",
    category: "CAMPAIGNS",
    question: "Posso editar ou excluir uma campanha?",
    answer: "Antes do processamento, campanhas em Rascunho, Pronta, Agendada ou com Falha podem permitir edição ou exclusão. A edição altera apenas o nome e o agendamento; canal, template, credor e destinatários permanecem vinculados ao registro original.",
    note: "Usuários com perfil Solicitante não visualizam as ações de editar e excluir.",
    roles: ALL_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "campaign-status",
    category: "CAMPAIGNS",
    question: "Como acompanho o andamento e o resultado de uma campanha?",
    answer: "A tabela mostra canal, quantidade de destinatários, entregas, valor, agenda e situação. Os estados indicam se a campanha está em preparação, agendada, processando, concluída ou se precisa de correção.",
    route: "/app/campanhas",
    routeLabel: "Acompanhar campanhas",
    roles: ALL_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "campaign-charge",
    category: "CAMPAIGNS",
    question: "Quando ocorre a confirmação financeira da campanha?",
    answer: "O débito do saldo pré-pago ou o registro do consumo pós-pago ocorre somente depois que o arquivo é validado e o usuário confirma o envio ou o agendamento.",
    roles: ALL_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },

  {
    id: "organization-create",
    category: "ORGANIZATIONS",
    question: "Quem pode cadastrar e editar empresas?",
    answer: "A página Empresas fica disponível para administradores. O nível SPC Brasil pode cadastrar SPC Brasil, CDL, Distribuidora e Credor. Os demais administradores cadastram Credores dentro do escopo permitido para sua organização.",
    visual: "ORGANIZATION_FORM",
    route: "/app/empresas",
    routeLabel: "Abrir Empresas",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "organization-link",
    category: "ORGANIZATIONS",
    question: "Como funciona o vínculo de um Credor?",
    answer: "No nível SPC Brasil, o credor pode ser vinculado diretamente ao SPC Brasil, a uma CDL ou a uma Distribuidora. Nos demais níveis administrativos, o vínculo é definido automaticamente conforme a organização do usuário.",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "organization-immutable",
    category: "ORGANIZATIONS",
    question: "Posso alterar o tipo ou o CNPJ depois do cadastro?",
    answer: "Não. O tipo da organização e o CNPJ permanecem vinculados ao cadastro original. Os demais dados permitidos, como contato, endereço, modelo financeiro e situação, podem ser atualizados pela edição.",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "organization-financial",
    category: "ORGANIZATIONS",
    question: "Qual a diferença entre Pré-pago e Pós-pago?",
    answer: "No modelo Pré-pago, o cadastro trabalha com saldo disponível. No modelo Pós-pago, a operação utiliza limite de crédito e acumula consumo para faturamento posterior.",
    visual: "ORGANIZATION_FORM",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "organization-logo",
    category: "ORGANIZATIONS",
    question: "Como adiciono a logo de uma empresa?",
    answer: "Use a ação de upload na listagem da organização. São aceitas imagens PNG, JPG ou WEBP com tamanho máximo de 1 MB.",
    note: "Use uma imagem nítida e sem dados pessoais.",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "organization-search-status",
    category: "ORGANIZATIONS",
    question: "Como encontro uma empresa e altero sua situação?",
    answer: "A busca localiza organizações por nome ou CNPJ. Na edição, a situação pode ser definida como Ativa, Inativa ou Suspensa, conforme a necessidade operacional.",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },

  {
    id: "users-create",
    category: "USERS",
    question: "Como cadastro um novo usuário?",
    answer: "Selecione “Novo usuário”, preencha nome, CPF, e-mail, telefone, senha inicial e perfil. O nível SPC Brasil também escolhe a organização; nos demais níveis, o cadastro usa a organização do administrador conectado.",
    visual: "USER_SECURITY",
    route: "/app/usuarios",
    routeLabel: "Abrir Usuários",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "users-roles",
    category: "USERS",
    question: "Qual a diferença entre Administrador e Solicitante?",
    answer: "O Administrador gerencia cadastros e configurações do escopo autorizado. O Solicitante acessa Dashboard e Campanhas, mas não possui ações administrativas e não pode editar ou excluir campanhas.",
    note: "Somente o nível SPC Brasil pode atribuir o perfil Administrador SPC Brasil.",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "users-initial-password",
    category: "USERS",
    question: "Quais cuidados devo ter com a senha inicial?",
    answer: "A senha inicial deve ter no mínimo 12 caracteres e não será exibida novamente. No primeiro acesso, o usuário será obrigado a substituí-la antes de entrar nos módulos.",
    visual: "USER_SECURITY",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "users-edit-status",
    category: "USERS",
    question: "O que pode ser alterado em um usuário?",
    answer: "É possível atualizar nome, e-mail, telefone, perfil e situação. CPF e organização permanecem vinculados ao cadastro original. Um usuário não pode alterar a própria situação.",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "users-security",
    category: "USERS",
    question: "Como acompanho a segurança e o acesso dos usuários?",
    answer: "A tabela exibe a situação do usuário, o estado de segurança — como troca de senha pendente — e a data do último acesso. A busca permite localizar por nome, CPF ou e-mail.",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },

  {
    id: "templates-create",
    category: "TEMPLATES",
    question: "Como crio um template homologado?",
    answer: "Selecione “Novo template”, informe nome, canal e situação inicial. Para E-mail, preencha também o assunto. Depois, escreva o conteúdo e salve o template.",
    visual: "TEMPLATE_EDITOR",
    route: "/app/templates",
    routeLabel: "Abrir Templates",
    roles: SPC_ROLES,
    organizationTypes: SPC_ORGANIZATION,
  },
  {
    id: "templates-variables",
    category: "TEMPLATES",
    question: "Como insiro variáveis no conteúdo?",
    answer: "Posicione o cursor no ponto desejado e selecione “Inserir variável”. Use somente variáveis suportadas pelo sistema; uma variável inválida impede o salvamento.",
    steps: ["Clique dentro do conteúdo.", "Abra “Inserir variável”.", "Escolha a variável da planilha.", "Confira a lista de variáveis detectadas."],
    visual: "TEMPLATE_EDITOR",
    roles: SPC_ROLES,
    organizationTypes: SPC_ORGANIZATION,
  },
  {
    id: "templates-sms-limit",
    category: "TEMPLATES",
    question: "Qual é o limite de conteúdo para SMS?",
    answer: "O conteúdo do template SMS aceita no máximo 164 caracteres, contando letras, números, pontuação, espaços e variáveis. O contador informa o uso e a digitação é bloqueada ao atingir o limite.",
    visual: "TEMPLATE_EDITOR",
    roles: SPC_ROLES,
    organizationTypes: SPC_ORGANIZATION,
  },
  {
    id: "templates-preview",
    category: "TEMPLATES",
    question: "Como verifico a mensagem antes de salvar?",
    answer: "A Pré-visualização segura substitui as variáveis por dados sintéticos para demonstrar a mensagem. Conteúdo HTML não é executado nessa visualização.",
    roles: SPC_ROLES,
    organizationTypes: SPC_ORGANIZATION,
  },
  {
    id: "templates-version",
    category: "TEMPLATES",
    question: "O que acontece quando edito um template usado por campanhas?",
    answer: "A edição cria uma nova versão. Campanhas já vinculadas mantêm a mensagem da versão anterior, preservando o histórico operacional.",
    roles: SPC_ROLES,
    organizationTypes: SPC_ORGANIZATION,
  },
  {
    id: "templates-status",
    category: "TEMPLATES",
    question: "Qual a diferença entre Rascunho, Ativo e Arquivado?",
    answer: "Rascunho ainda está em preparação; Ativo pode ser selecionado em campanhas; Arquivado deixa de ser disponibilizado para novos usos. A situação pode ser alterada na listagem.",
    roles: SPC_ROLES,
    organizationTypes: SPC_ORGANIZATION,
  },

  {
    id: "pricing-matrix",
    category: "PRICING",
    question: "Como funciona a matriz de preços?",
    answer: "Cada linha representa um credor e cada coluna representa E-mail, SMS, WhatsApp ou RCS. As células exibem o preço vigente e indicam visualmente se há uma configuração ativa.",
    visual: "PRICING_MATRIX",
    route: "/app/precificacao",
    routeLabel: "Abrir Precificação",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "pricing-edit",
    category: "PRICING",
    question: "Como cadastro ou altero um preço?",
    answer: "Selecione a célula do credor e do canal desejados, informe um valor unitário maior que zero e defina a data e hora de início da vigência.",
    visual: "PRICING_MATRIX",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "pricing-history",
    category: "PRICING",
    question: "Alterar um preço apaga o valor anterior?",
    answer: "Não. A alteração cria uma nova vigência a partir da data informada e mantém o histórico anterior protegido.",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "pricing-spc-base",
    category: "PRICING",
    question: "Por que não consigo editar a Base SPC Brasil?",
    answer: "A Base SPC Brasil é editável somente pelo nível SPC Brasil. Para administradores de CDL, Distribuidora ou Credor, ela permanece disponível apenas para consulta.",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "pricing-status",
    category: "PRICING",
    question: "Como identifico preços ativos ou ausentes?",
    answer: "As células ativas aparecem destacadas em verde com o valor vigente. Configurações inativas ou ainda não cadastradas são identificadas em vermelho.",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },

  {
    id: "brokers-purpose",
    category: "BROKERS",
    question: "Para que serve a tela Brokers?",
    answer: "A tela centraliza os provedores usados nos canais SMS, E-mail, WhatsApp e RCS, incluindo endpoint, autenticação protegida, retorno de status e preferência de roteamento.",
    visual: "BROKER_CARD",
    route: "/app/brokers",
    routeLabel: "Abrir Brokers",
    roles: SPC_ROLES,
    organizationTypes: SPC_ORGANIZATION,
  },
  {
    id: "brokers-create",
    category: "BROKERS",
    question: "O que é necessário para cadastrar um broker?",
    answer: "Informe nome, canal, endpoint HTTPS, rota de envio, timeout e pelo menos uma forma de credencial: API key, webhook secret ou usuário e senha.",
    note: "O timeout permitido fica entre 1.000 e 30.000 milissegundos.",
    roles: SPC_ROLES,
    organizationTypes: SPC_ORGANIZATION,
  },
  {
    id: "brokers-secrets",
    category: "BROKERS",
    question: "As credenciais do broker ficam visíveis?",
    answer: "Não. Os segredos são cifrados antes da persistência e nunca retornam para a tela. A listagem mostra apenas quais campos protegidos estão configurados.",
    visual: "BROKER_CARD",
    roles: SPC_ROLES,
    organizationTypes: SPC_ORGANIZATION,
  },
  {
    id: "brokers-preferred",
    category: "BROKERS",
    question: "O que significa marcar um broker como preferencial?",
    answer: "O broker preferencial passa a ter prioridade no roteamento daquele canal e substitui o preferencial anterior do mesmo canal.",
    roles: SPC_ROLES,
    organizationTypes: SPC_ORGANIZATION,
  },
  {
    id: "brokers-edit-disable",
    category: "BROKERS",
    question: "Como edito credenciais ou desativo um broker?",
    answer: "Na edição, deixe campos secretos em branco para preservar os valores atuais ou preencha novos valores para substituí-los. Ao desativar, o broker deixa a seleção automática para campanhas futuras.",
    roles: SPC_ROLES,
    organizationTypes: SPC_ORGANIZATION,
  },

  {
    id: "api-key-purpose",
    category: "API_KEYS",
    question: "Para que servem as Chaves de API?",
    answer: "Elas permitem integrações programáticas com permissões restritas, expiração opcional e armazenamento seguro do segredo. Cada chave deve ter um nome que identifique seu uso.",
    visual: "API_KEY",
    route: "/app/chaves-api",
    routeLabel: "Abrir Chaves de API",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "api-key-scopes",
    category: "API_KEYS",
    question: "Quais permissões posso conceder a uma chave?",
    answer: "É possível autorizar consulta de campanhas, criação de campanhas e consulta de relatórios. Pelo menos uma permissão deve ser selecionada.",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "api-key-once",
    category: "API_KEYS",
    question: "Posso consultar o segredo da chave novamente?",
    answer: "Não. O segredo completo é exibido uma única vez, logo após a emissão ou substituição. Copie e armazene-o em local seguro antes de fechar o aviso.",
    visual: "API_KEY",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "api-key-rotate",
    category: "API_KEYS",
    question: "O que acontece quando substituo uma chave?",
    answer: "A credencial anterior é revogada imediatamente e um novo segredo é gerado. A integração deve ser atualizada com o novo valor, que também será exibido apenas uma vez.",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },
  {
    id: "api-key-revoke",
    category: "API_KEYS",
    question: "Como funcionam expiração e revogação?",
    answer: "A expiração é opcional e pode ser definida na emissão ou substituição. A revogação é imediata e impede novos usos da chave.",
    note: "O nível SPC Brasil pode escolher a organização da chave; os demais administradores emitem para a própria organização.",
    roles: ADMIN_ROLES,
    organizationTypes: ALL_ORGANIZATIONS,
  },

  {
    id: "domains-status",
    category: "DOMAINS",
    question: "A Gestão de Domínios já está disponível?",
    answer: "A rota está reservada ao nível SPC Brasil, mas os fluxos operacionais ainda estão em preparação. A tela informa o estado de construção e não permite ações enquanto o módulo não estiver conectado.",
    route: "/app/dominios",
    routeLabel: "Ver situação do módulo",
    roles: SPC_ROLES,
    organizationTypes: SPC_ORGANIZATION,
  },
];

export function getVisibleFaqItems(identity: {
  role: FaqRole;
  organizationType: FaqOrganizationType;
}): FaqItem[] {
  if (identity.role === "SPC_ADMIN" || identity.organizationType === "SPC_BRASIL") {
    return FAQ_ITEMS;
  }

  return FAQ_ITEMS.filter(item => (
    item.roles.includes(identity.role)
    && item.organizationTypes.includes(identity.organizationType)
  ));
}

export function normalizeFaqSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function filterFaqItems(items: FaqItem[], search: string, category: FaqCategoryId | "ALL"): FaqItem[] {
  const normalizedSearch = normalizeFaqSearch(search);
  return items.filter(item => {
    if (category !== "ALL" && item.category !== category) return false;
    if (!normalizedSearch) return true;
    const haystack = normalizeFaqSearch([
      item.question,
      item.answer,
      item.note,
      ...(item.steps ?? []),
    ].filter(Boolean).join(" "));
    if (haystack.includes(normalizedSearch)) return true;
    return normalizedSearch.split(/\s+/).every(term => haystack.includes(term));
  });
}
