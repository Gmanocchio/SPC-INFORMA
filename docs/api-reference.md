# Referência técnica de API

**Base do aplicativo:** mesma origem da implantação  
**Transporte interno:** tRPC em `/api/trpc`  
**Webhooks de brokers:** JSON assinado ou callback Message Center com URL opaca
**Callback periódico:** HTTP autenticado pela plataforma

## 1. Autenticação e convenções

A interface administrativa usa sessão própria em cookie `HttpOnly`, com autenticação em duas etapas. O cliente deve consumir os procedimentos pelo cliente tRPC tipado do projeto; não há contrato REST público equivalente para as telas administrativas. Requisições de mutação com sessão são verificadas contra a origem esperada.

| Categoria | Regra |
| --- | --- |
| **Sessão administrativa** | Cookie seguro, revogável, vinculado ao contexto do navegador e renovado pelo fluxo de login/2FA. |
| **Entradas** | Validadas por esquemas Zod no servidor. |
| **Erros** | Erros de autenticação, autorização, validação e conflito são devolvidos pelo envelope tRPC. |
| **Datas** | Persistidas e transportadas em UTC; a interface converte para o fuso local. |
| **Segredos** | Senhas, códigos, tokens e credenciais integrais nunca são retornados por consultas administrativas. |

## 2. Procedimentos tRPC

| Namespace | Procedimentos principais | Acesso |
| --- | --- | --- |
| `auth` | `me`, `login`, `verifyTwoFactor`, `requestPasswordReset`, `resetPassword`, `changeFirstAccessPassword`, `logout` | Público nos passos de entrada e recuperação; sessão válida para troca de senha de primeiro acesso |
| `admin.organizations` | `list`, `create`, `update`, `uploadLogo` | Perfis administrativos, com escopo organizacional aplicado no serviço |
| `admin.users` | `list`, `create`, `update` | Perfis administrativos, limitados às organizações administráveis |
| `commercial.templates` | `available`, `list`, `create`, `update` | Consulta autenticada; manutenção exclusiva do Administrador SPC Brasil |
| `commercial.pricing` | `list`, `setBase`, `setCreditor` | Consulta administrativa; preço-base exclusivo do SPC; preço do credor conforme escopo |
| `commercial.apiKeys` | `list`, `create`, `revoke` | Perfis administrativos, com organização e segredo protegidos |
| `campaigns` | `options`, `layout`, `list`, `details`, `import`, `confirm` | Sessão autenticada e escopo por organização |
| `brokers` | `list`, `create`, `update`, `deactivate` | Exclusivo do Administrador SPC Brasil |
| `dashboard` | consulta de indicadores, séries e consolidação | Sessão autenticada, com agregações limitadas ao escopo do ator |

### 2.1 Fluxo de autenticação

1. `auth.login` recebe `email` e `password` e devolve `challengeId`, e-mail mascarado e validade.
2. `auth.verifyTwoFactor` recebe `challengeId` e código numérico de seis dígitos; em sucesso, o servidor cria a sessão.
3. `auth.me` devolve usuário, organização e nível de garantia, ou `null` quando não há sessão válida.
4. `auth.changeFirstAccessPassword` atende contas marcadas para troca obrigatória.
5. `auth.logout` revoga a sessão quando existente e sempre limpa o cookie.

Os fluxos de login e recuperação utilizam mensagens neutras para reduzir enumeração de contas. Desafios expiram, possuem limite de tentativas e são consumidos uma única vez.

### 2.2 Importação e confirmação de campanha

`campaigns.layout` mantém as nove colunas canônicas em SMS, WhatsApp e RCS: `CPF`, `Nome do cliente`, `Nome do credor`, `Valor`, `Data de vencimento`, `Número do contrato`, `Números de contato do credor (telefone)`, `E-mail de contato do credor` e `Link`. Para o canal E-mail, o modelo acrescenta como décima coluna `E-mail do cliente`, obrigatória e usada exclusivamente como destino do disparo. `campaigns.import` aceita CSV ou XLSX em base64, exige exatamente o layout do canal, normaliza e cifra os dados, aplica uma chave UUID de idempotência e cria a campanha para revisão. `campaigns.confirm` exige confirmação literal e executa as regras financeiras antes de liberar a campanha para fila ou agendamento. O processamento posterior reivindica destinatários atomicamente e limita tentativas transitórias.

## 3. Webhook de retorno do broker

**Rota:** `POST /api/webhooks/brokers/:brokerId`  
**Content-Type:** `application/json`  
**Limite:** 1 MiB

O broker deve assinar exatamente a cadeia `timestamp.corpo_bruto` com HMAC-SHA256. O timestamp é enviado em `x-spc-timestamp`, em milissegundos ou segundos Unix. A assinatura hexadecimal é enviada por padrão em `x-spc-signature`; o nome pode ser alterado em `extraConfig.signatureHeader` do broker.

```text
assinatura = hex(HMAC_SHA256(webhookSecret, `${timestamp}.${rawBody}`))
```

| Cabeçalho | Obrigatório | Descrição |
| --- | --- | --- |
| `Content-Type: application/json` | Sim | Preserva o corpo bruto para validação. |
| `x-spc-timestamp` | Sim | Instante da assinatura; tolerância de cinco minutos. |
| `x-spc-signature` | Sim, salvo configuração distinta | Digest hexadecimal; prefixo `sha256=` é aceito. |

### 3.1 Payload

```json
{
  "eventId": "evt-98172",
  "event": "DELIVERED",
  "messageId": "provider-message-id",
  "campaignId": "00000000-0000-4000-8000-000000000000",
  "occurredAt": "2026-07-13T00:00:00.000Z",
  "metadata": {}
}
```

`eventId` e `event` são obrigatórios. O destinatário é localizado por `recipientId` interno ou `messageId` do provedor. Se `campaignId` for informado, deve corresponder à campanha vinculada ao broker.

| Eventos recebidos | Estado interno |
| --- | --- |
| `SENT`, `ACCEPTED`, `QUEUED` | `SENT` |
| `DELIVERED`, `DELIVERY_SUCCESS` | `DELIVERED` |
| `FAILED`, `REJECTED`, `UNDELIVERED`, `BOUNCED` | `FAILED` |
| `OPT_OUT`, `UNSUBSCRIBED`, `BLOCKED` | `OPTED_OUT` |

O processamento é idempotente pela combinação `brokerId:eventId`. Estados terminais não regredirão para eventos anteriores. Payloads assinados fora da janela são rejeitados para reduzir replay.

### 3.2 Callback específico da Message Center

**Rota:** `GET|POST /api/webhooks/message-center/:brokerId/:token`
**Content-Type:** `application/json`
**Lote:** um a dez eventos
**Limite:** 1 MiB

A Message Center não documenta assinatura HMAC ou timestamp no callback. Por isso, o sistema gera um token opaco de 256 bits derivado da API key do broker e do segredo da aplicação. O token permanece somente no caminho HTTPS cadastrado na plataforma Message Center. Uma rotação da API key exige atualizar a URL de callback. Requisições `GET` e `POST` vazias respondem como verificação de disponibilidade.

O campo `Identificador` deve conter o ID interno do destinatário informado no envio. `CampoCustomizado1` transporta o UUID da campanha e `Destinatario`, quando presente, é comparado por fingerprint HMAC com o destino cifrado. `IdCall`, tipo do evento e data formam a chave de idempotência. O callback normaliza envio, entrega, falha, abertura, clique, spam e opt-out sem permitir regressão de estados terminais.

### 3.3 Respostas

| HTTP | Situação |
| --- | --- |
| `200` | Processado, duplicado ou evento desconhecido ignorado de forma controlada |
| `400` | Broker inválido ou payload incompatível com o esquema |
| `401` | Timestamp ausente/antigo ou assinatura inválida |
| `403` | Segredo de webhook não configurado |
| `404` | Broker não encontrado ou inativo |
| `422` | Assinatura válida, mas destinatário/campanha incompatível |
| `503` | Banco temporariamente indisponível |

## 4. Callback periódico interno

**Rota:** `POST /api/scheduled/process-campaigns`

Essa rota não aceita autenticação de usuário comum. Ela exige a identidade cron fornecida pela plataforma e processa, por execução, até cinco campanhas, cem destinatários por campanha e concorrência oito. A mesma execução aplica a política configurável de retenção a autenticação, arquivos de importação, destinatários, eventos de entrega, recibos de webhook e contexto auxiliar de auditoria.

```json
{
  "ok": true,
  "taskUid": "cron_task_uid",
  "campaignsProcessed": 1,
  "retention": {
    "importReferencesRemoved": 0,
    "recipientsAnonymized": 12,
    "deliveryEventsDeleted": 0,
    "webhookReceiptsDeleted": 0,
    "auditContextsMinimized": 0
  }
}
```

Respostas `401` e `403` indicam chamada sem identidade cron; `500` é uma falha transitória registrada no servidor e pode ser repetida pela plataforma.

## 5. API pública de campanhas de E-mail

**Rota:** `POST /api/v1/campaigns/email`
**Autenticação:** `x-api-key: ntf_...` ou `Authorization: Bearer ntf_...`
**Escopo exigido:** `campaigns:write`

O valor integral da chave é exibido somente na criação e o banco mantém apenas seu hash. A organização deriva da chave autenticada e nunca do corpo da requisição. A operação aceita até 20.000 destinatários, exige `customerEmail` válido, aplica as mesmas validações e preços do upload e cria a campanha em `READY`. **Nenhum e-mail é enviado automaticamente**: um usuário autorizado ainda deve revisar e confirmar a campanha.

```json
{
  "creditorOrganizationId": 34,
  "templateId": 12,
  "name": "Campanha de cobrança",
  "idempotencyKey": "9cf9c7d2-0d29-4baf-b585-2c3bd2eb7ae7",
  "recipients": [
    {
      "cpf": "52998224725",
      "customerName": "Ana Maria",
      "customerEmail": "cliente@example.com.br",
      "creditorName": "Credor Brasil",
      "amount": "R$ 1.234,56",
      "dueDate": "31/12/2026",
      "contractNumber": "CTR-2026-001",
      "creditorPhone": "1140001234",
      "creditorEmail": "cobranca@credor.com.br",
      "link": "https://credor.example/negociar/CTR-2026-001"
    }
  ]
}
```

Uma resposta `201` contém `status: "READY"` e `requiresConfirmation: true`. Respostas `401` indicam chave ausente, inválida, revogada ou expirada; `403`, escopo insuficiente; `409`, repetição da idempotência; e `422`, payload ou destinatário inválido.
