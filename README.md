# SPC Informa

Plataforma multi-organização para criação, precificação, agendamento, despacho e acompanhamento de notificações por canais integrados. O produto combina autenticação própria com 2FA, escopo hierárquico por organização, campanhas idempotentes, controles financeiros, brokers configuráveis, webhooks assinados, processamento periódico e trilha de auditoria.

## Capacidades

| Domínio | Implementação |
| --- | --- |
| Identidade | Login próprio, 2FA por e-mail, primeiro acesso, recuperação, sessões revogáveis e bloqueio progressivo |
| Governança | Perfis administrativos, isolamento por organização e auditoria dos eventos críticos |
| Comercial | Templates, preço-base, preço ao credor, saldo pré-pago, consumo/limite pós-pago e chaves de API administradas |
| Campanhas | Importação CSV/XLSX, validação de layout, idempotência, revisão, confirmação e agendamento |
| Entrega | Broker preferencial por canal, autenticação de saída, timeout, retentativas e claim atômico por destinatário |
| Retorno | Webhook HMAC-SHA256, proteção contra replay, recibos idempotentes e estados monotônicos |
| Operação | Dashboard por período, canal e organização; callback Heartbeat; runbook e matrizes de qualidade |

## Arquitetura

O projeto usa React 19 e Tailwind CSS 4 no cliente, Express e tRPC no servidor, Drizzle ORM e banco relacional. A aplicação executa como um único servidor Node. Processamento recorrente ocorre por callback HTTP autenticado em `/api/scheduled/process-campaigns`; não há worker residente nem temporizador em processo.

```text
client/src/                 interface React e componentes
server/                     serviços, roteadores, segurança e integrações
server/routers/             contratos tRPC por domínio
drizzle/                    schema e migrações
docs/                       API, operação, privacidade e matrizes de evidência
todo.md                     checklist verificável e histórico da entrega
```

## Desenvolvimento

```bash
pnpm install
pnpm dev
```

O ambiente fornece as credenciais do banco, sessão, OAuth estrutural, armazenamento e SendGrid. Não criar `.env` com segredos nem registrar credenciais no repositório.

## Qualidade

```bash
pnpm check
pnpm test
pnpm build
```

A suíte cobre autenticação e uso único de desafios, autorização e escopo, cálculos financeiros, brokers, webhooks, callback cron, governança arquitetural e contratos de qualidade da interface.

## Publicação

1. Revisar o [`todo.md`](./todo.md) e executar os três comandos de qualidade.
2. Criar checkpoint e revisar a prévia.
3. Publicar pela interface de gerenciamento.
4. Após a implantação, criar o Heartbeat do projeto conforme [`docs/deployment-checklist.md`](./docs/deployment-checklist.md).
5. Executar os smoke tests pós-publicação e registrar o `task_uid` operacional.

## Documentação

O índice completo está em [`docs/README.md`](./docs/README.md). Os documentos essenciais são a [referência de API](./docs/api-reference.md), o [runbook operacional](./docs/operations-runbook.md), o [checklist de publicação](./docs/deployment-checklist.md), a [política técnica de privacidade/LGPD](./docs/privacy-lgpd.md), a [matriz de segurança](./docs/security-access-matrix.md) e a [matriz de qualidade da interface](./docs/ui-quality-matrix.md).
