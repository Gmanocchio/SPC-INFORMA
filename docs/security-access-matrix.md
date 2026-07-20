# Matriz de segurança, escopo e auditoria

## Objetivo

Esta matriz registra o contrato verificável de **autorização por perfil**, **isolamento organizacional** e **auditoria** do SPC Informa. O arquivo `server/governance-coverage.test.ts` transforma as fronteiras abaixo em testes de regressão executados pelo Vitest.

| Domínio | Fronteira da API | Regra de escopo | Eventos auditados |
|---|---|---|---|
| Autenticação | Procedimentos públicos somente para login, 2FA e recuperação; sessão própria para rotas internas | Sessão vinculada ao usuário, organização e contexto do navegador | Login, falha de login, 2FA, redefinição e logout |
| Organizações | `adminProcedure` | SPC_ADMIN acessa a rede; ORG_ADMIN acessa a própria organização e credores vinculados | Criação, alteração e logo |
| Usuários | `adminProcedure` | SPC_ADMIN administra todos; ORG_ADMIN apenas a própria organização e nunca cria SPC_ADMIN | Criação e alteração |
| Templates | Consulta disponível autenticada; escrita com `spcAdminProcedure` | Templates ativos globais são disponibilizados às campanhas; manutenção é exclusiva do SPC Brasil | Criação e alteração |
| Precificação | Leitura e preço de credor com `adminProcedure`; preço-base com `spcAdminProcedure` | Regras vinculadas à organização proprietária e ao credor | Preço-base e preço de credor |
| Chaves de API | `adminProcedure` | Organização do ator, salvo seleção explícita de SPC_ADMIN | Emissão e revogação |
| Campanhas | `protectedProcedure` com MFA | Consultas e mutações filtram a organização do ator; SPC_ADMIN pode selecionar organização | Importação e confirmação financeira |
| Dashboard | `authenticatedProcedure` | Agregações filtradas pela organização; SPC_ADMIN recebe consolidado global | Somente leitura |
| Brokers | `spcAdminProcedure` | Configuração global mantida na organização SPC Brasil | Criação, alteração e desativação |
| Webhooks | Rota pública assinada | Evento é resolvido pelo broker e pela campanha; identificador externo é idempotente | Evento técnico de entrega persistido |
| Processamento periódico | Callback autenticado como cron | Processa apenas campanhas elegíveis e usa claim idempotente por destinatário | Eventos técnicos e estados da campanha |

## Controles centrais

O arquivo `server/_core/trpc.ts` define quatro fronteiras: `publicProcedure`, `authenticatedProcedure`, `protectedProcedure` com MFA, `adminProcedure` e `spcAdminProcedure`. As funções de `server/authorization.ts` concentram decisões reutilizáveis de perfil e organização; os serviços aplicam filtros no banco para impedir que identificadores enviados pelo cliente ampliem o escopo.

> Toda nova consulta ou mutação deve ser incluída na matriz e no teste arquitetural. A ausência da fronteira, dos tokens de escopo ou do evento de auditoria esperado interrompe a suíte de testes.

## Tratamento de dados sensíveis

Credenciais de brokers e dados de destinatários são cifrados antes da persistência. Segredos de API são armazenados apenas como hash e exibidos uma única vez. Respostas administrativas nunca retornam o valor integral de credenciais. Logs e auditoria registram metadados operacionais, não senhas, códigos 2FA, tokens, chaves ou conteúdo cifrado.
