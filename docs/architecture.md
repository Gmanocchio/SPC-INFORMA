# Arquitetura da Notificadora SPC Brasil

## Visão geral

A aplicação será organizada como um **monólito modular full-stack** em React, Express, tRPC e MySQL/TiDB. Essa estrutura reduz a superfície operacional inicial, mantém contratos tipados entre front-end e back-end e permite separar regras de negócio por domínio sem introduzir microsserviços prematuros. Integrações externas serão acessadas exclusivamente pelo servidor.

| Camada | Responsabilidade | Controles principais |
|---|---|---|
| Interface pública | Landing page, login, recuperação e validação de segundo fator | Conteúdo sem dados sensíveis, CSP, rate limiting e mensagens sem enumeração de usuários |
| Interface autenticada | Dashboards e módulos operacionais | Navegação orientada por perfil, estados seguros e nenhuma confiança em restrições apenas visuais |
| API tRPC | Casos de uso autenticados | Sessão, RBAC, escopo organizacional, validação Zod, rate limiting e auditoria |
| Rotas HTTP | Webhooks, importações e callbacks agendados | Assinatura, idempotência, limites de corpo, autenticação técnica e rejeição por padrão |
| Domínio | Organizações, usuários, campanhas, preços, brokers e faturamento | Invariantes centralizadas, transações e isolamento por organização |
| Persistência | Dados relacionais e trilha de auditoria | Chaves estrangeiras, índices de escopo, valores monetários inteiros e exclusão lógica quando aplicável |
| Armazenamento | Logos e bases de destinatários | S3, metadados no banco, tipos permitidos, tamanho máximo e URLs assinadas |
| Integrações | SendGrid e brokers multicanal | Segredos no servidor, timeouts, retries limitados, circuit breaker e logs sem conteúdo sensível |

## Domínios funcionais

| Domínio | Entidades principais | Invariantes relevantes |
|---|---|---|
| Identidade | Usuário, sessão, desafio 2FA, token de recuperação | Senhas com hash forte; tokens de uso único; sessão emitida somente após 2FA; primeiro acesso exige troca de senha |
| Organizações | Organização, vínculo de usuário, credor | Toda entidade de negócio tem organização proprietária ou escopo global explícito; consultas nunca aceitam `organizationId` como autoridade do cliente |
| Mensageria | Template, campanha, lote, destinatário, evento de entrega | Template e canal compatíveis; campanha confirmada é imutável nos dados financeiros; eventos externos são idempotentes |
| Precificação | Tabela SPC, preço organizacional, reserva, lançamento | Valores em centavos; vigência temporal; preço obrigatório por canal e credor; débitos e estornos transacionais |
| Integrações | Broker, credencial cifrada, webhook, chave de API | Broker preferencial único por canal; segredos não retornam ao cliente; chaves são exibidas uma vez e persistidas somente como hash |
| Governança | Evento de auditoria, política de retenção | Ações críticas registram ator, organização, recurso, resultado, IP mascarado e correlação; logs de auditoria não são editáveis pela interface |

## Isolamento multiorganizacional

O isolamento será imposto no back-end por um contexto de autorização calculado a partir da sessão. Administradores SPC Brasil poderão operar em escopo global; administradores de CDL/Distribuidora receberão apenas o identificador da própria organização; solicitantes receberão o mesmo escopo organizacional com conjunto reduzido de ações. Identificadores informados pelo front-end serão tratados apenas como filtros adicionais e nunca como fonte de autorização.

> Regra central: nenhuma consulta ou mutação de negócio pode acessar uma tabela multiorganizacional sem aplicar o escopo derivado da sessão, inclusive buscas por identificador, contagens, exportações, dashboards, arquivos e webhooks correlacionados.

As tabelas multiorganizacionais terão `organizationId` indexado. Recursos globais, como templates e brokers do SPC Brasil, usarão um campo de escopo explícito e procedimentos exclusivos para o perfil `SPC_ADMIN`. Credores terão vínculo com a organização que os administra; usuários SPC poderão visualizar a consolidação sem transferir propriedade dos dados.

## Modelo de autenticação

| Etapa | Comportamento seguro |
|---|---|
| Credenciais | E-mail normalizado e senha verificados com comparação resistente a timing; falhas retornam resposta genérica |
| Bloqueio | Tentativas falhas incrementam contador; bloqueio progressivo e rate limit por IP e identidade normalizada |
| Segundo fator | Código aleatório com hash persistido, validade curta, limite de tentativas e invalidação após uso |
| Primeiro acesso | Após o 2FA, o usuário recebe uma sessão restrita apenas à troca obrigatória de senha |
| Sessão | Cookie `HttpOnly`, `Secure` em produção, `SameSite=Lax`, expiração curta e identificador de sessão revogável |
| Recuperação | Token aleatório de uso único enviado via SendGrid; resposta pública não revela se o e-mail existe |
| Logout | Revoga a sessão no banco e remove o cookie no cliente |

## Processamento de campanhas

A criação de campanha seguirá estados explícitos: `DRAFT`, `UPLOADING`, `VALIDATING`, `READY`, `SCHEDULED`, `QUEUED`, `PROCESSING`, `COMPLETED`, `PARTIAL`, `FAILED` e `CANCELED`. A confirmação reservará créditos para organizações pré-pagas ou registrará consumo previsto para pós-pagas. O processamento usará lotes idempotentes e chaves de deduplicação para impedir cobranças ou envios duplicados.

Campanhas com data futura serão registradas pelo mecanismo Heartbeat da plataforma, nunca por temporizadores em memória. O callback autenticado localizará a campanha pelo identificador seguro da tarefa agendada, validará novamente o estado e responderá de forma idempotente. O disparo efetivo por broker permanecerá bloqueado até a configuração e a validação de credenciais reais.

## Fronteiras de segurança

Segredos de SendGrid e brokers serão fornecidos por variáveis de ambiente ou cifrados com chave de aplicação disponível apenas no servidor. O front-end receberá somente metadados mascarados. Conteúdo de destinatários não será gravado em logs; respostas de brokers serão reduzidas a identificadores técnicos, códigos de status e informações necessárias à auditoria.

Uploads serão validados por extensão, MIME real, tamanho, quantidade de linhas e estrutura esperada. Fórmulas de planilha serão tratadas como texto na importação e escapadas na exportação. O sistema aplicará cabeçalhos de segurança, limites de corpo distintos por rota, proteção CSRF para mutações baseadas em cookie, validação de origem, rate limiting e timeouts em chamadas externas.

## Estratégia de implementação

O primeiro ciclo entregará todos os módulos navegáveis, o modelo de dados, regras de acesso, APIs e testes automatizados, com integrações externas em modo seguro. O envio real dependerá das credenciais de SendGrid e de cada broker, dos remetentes/domínios aprovados e da publicação do ambiente. Nenhum destinatário real será contactado durante o desenvolvimento.

