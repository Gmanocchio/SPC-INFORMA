# Design system institucional

## Direção visual

A interface adotará uma estética **institucional contemporânea**, com superfícies claras, tipografia legível, formas curvas inspiradas no símbolo do SPC Brasil e uso criterioso de azul, verde e amarelo. A landing page terá composição assimétrica e elementos gráficos abstratos em CSS; o painel autenticado priorizará densidade informacional equilibrada, leitura rápida e confiança operacional.

O logo oficial será exibido a partir de `/manus-storage/logo-spcbrasil.png_0720e628.webp`, sem redesenho, alteração de proporção ou aplicação de efeitos que prejudiquem a marca.

## Tokens de cor

| Token | Cor | Aplicação |
|---|---|---|
| `brand-primary` | `#0066CC` | Ações primárias, links, destaques e séries principais |
| `brand-deep` | `#004A99` | Navegação, títulos fortes e estados ativos |
| `brand-sky` | `#4DA3FF` | Gráficos, superfícies informativas e estados secundários |
| `brand-success` | `#00B67A` | Entregas, saldo positivo, confirmações e RCS/WhatsApp |
| `brand-gold` | `#FFD54A` | Atenção moderada, detalhes do hero e indicadores de saldo |
| `brand-surface` | `#F5F7FA` | Fundo geral e separação de áreas |
| `ink` | `#102A43` | Texto principal com alto contraste |
| `muted-ink` | `#526579` | Texto secundário |
| `danger` | `#C62828` | Erros, bloqueios e ações destrutivas |

O amarelo será usado como acento e não como fundo para textos longos. Ações críticas utilizarão vermelho, preservando o verde exclusivamente para estados positivos. Gráficos combinarão formas, rótulos e cores para não depender apenas da percepção cromática.

## Tipografia e composição

A família **Inter** será usada na interface por sua clareza em tabelas, formulários e números. Títulos da landing page utilizarão pesos 700–800, com largura de linha controlada. O painel adotará escala tipográfica mais compacta e alinhamento tabular para métricas financeiras.

| Elemento | Diretriz |
|---|---|
| Título principal | 48–64 px em desktop, 36–44 px em celular, entrelinha curta |
| Título de página | 28–34 px, peso 700 |
| Título de cartão | 16–18 px, peso 650 |
| Corpo | 15–16 px, entrelinha 1,55 |
| Metadados | 12–13 px, contraste mínimo preservado |
| Valores financeiros | Numerais tabulares, peso 650–750 |

## Superfícies e interação

Cartões usarão raio de 16–20 px, borda discreta azul-acinzentada e sombra curta. Botões terão feedback de pressão com `scale(0.97)` e transições entre 120 e 180 ms. Modais e gavetas terão transições de opacidade e transformação, respeitando `prefers-reduced-motion`.

Todos os campos possuirão rótulo persistente, ajuda contextual quando necessária, estado de erro associado por `aria-describedby` e foco visível. Ações destrutivas e confirmações de campanha exigirão caixa de confirmação explícita, com resumo financeiro e de volume antes da execução.

## Estrutura da landing page

| Seção | Conteúdo e função |
|---|---|
| Cabeçalho | Logo, links para benefícios, canais e segurança, além do CTA “Acessar SPC Informa” |
| Hero | Promessa de orquestração multicanal, prova de governança e painel analítico ilustrativo |
| Indicadores | Quatro cartões com canais, rastreabilidade, controle financeiro e isolamento organizacional |
| Benefícios | Eficiência operacional, segurança, visão consolidada e personalização por organização |
| Canais | SMS, E-mail, WhatsApp e RCS com descrições objetivas |
| Segurança | RBAC, 2FA, auditoria, segregação e proteção de credenciais |
| CTA final | Chamada curta e botão com texto exato “Acessar SPC Informa” |
| Rodapé | Identidade do produto, navegação e aviso de ambiente institucional |

## Navegação autenticada

| Grupo | Rotas |
|---|---|
| Visão geral | `/app/dashboard` |
| Operação | `/app/campaigns`, `/app/campaigns/new` |
| Conteúdo | `/app/templates` apenas para SPC Admin |
| Cadastros | `/app/organizations`, `/app/creditors`, `/app/users` conforme perfil |
| Financeiro | `/app/pricing`, `/app/consumption` |
| Integrações | `/app/brokers`, `/app/api-keys` conforme perfil |
| Governança | `/app/audit`, `/app/domains` apenas para SPC Admin |
| Conta | `/app/profile`, encerramento de sessão |

O menu lateral será recolhível em desktop e funcionará como gaveta em celular. Cada página terá título, descrição contextual, ação primária e breadcrumb quando houver profundidade. Telas sem permissão não serão registradas na navegação do usuário e o servidor continuará rejeitando o acesso direto.

## Fluxos críticos

| Fluxo | Sequência |
|---|---|
| Login | E-mail e senha → desafio 2FA por e-mail → validação do código → troca obrigatória de senha, se aplicável → dashboard |
| Recuperação | Solicitação genérica → e-mail via SendGrid → token de uso único → nova senha → revogação das sessões anteriores |
| Nova campanha | Dados básicos → seleção de template → upload e validação → precificação → confirmação → agendamento/processamento |
| Broker | Metadados → credenciais → teste de conectividade controlado → ativação → definição como preferencial |
| Chave de API | Escopo e validade → confirmação → exibição única → cópia → listagem apenas com prefixo e últimos caracteres |

## Estados obrigatórios

Todas as telas terão estado de carregamento com skeleton, estado vazio com orientação, erro sem exposição de detalhes internos, sucesso com próximo passo e acesso negado com rota de retorno. Tabelas incluirão paginação, busca, filtros persistentes por sessão e indicação clara do escopo organizacional ativo.
