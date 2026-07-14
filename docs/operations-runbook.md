# Runbook operacional

## 1. Objetivo e responsabilidades

Este runbook orienta operação, suporte, segurança e manutenção do **SPC Informa**. Mudanças em produção exigem checkpoint, revisão de testes e publicação pela interface de gerenciamento. O processamento de campanhas é executado em requisições curtas; não depende de processo residente no contêiner.

| Papel | Responsabilidade |
| --- | --- |
| **Administrador SPC Brasil** | Brokers, preço-base, templates, visão consolidada, organizações de nível superior e resposta técnica a incidentes. |
| **Administrador CDL/Distribuidora** | Organizações subordinadas, usuários permitidos, preço ao credor e acompanhamento de campanhas dentro do escopo. |
| **Administrador Credor** | Usuários e campanhas da própria organização, conforme permissões concedidas. |
| **Segurança/Encarregado** | Política de retenção, incidentes, solicitações de titulares e aprovação de acessos excepcionais. |

## 2. Rotina de publicação

1. Confirmar que o `todo.md` não possui requisito de entrega pendente.
2. Executar `pnpm check`, `pnpm test` e `pnpm build`.
3. Revisar `.manus-logs/devserver.log`, `.manus-logs/browserConsole.log` e `.manus-logs/networkRequests.log` para erros recentes.
4. Criar checkpoint e abrir sua prévia.
5. Publicar pelo botão **Publish** da interface de gerenciamento.
6. Executar smoke test de login, 2FA, dashboard, criação de campanha de teste controlada e acesso negado entre perfis.
7. Somente após a implantação do callback, criar ou atualizar o Heartbeat descrito na seção 3.

## 3. Processamento de fila e agendamentos

O Heartbeat do projeto deve executar a cada minuto, em UTC, por meio do callback `/api/scheduled/process-campaigns`.

```bash
manus-heartbeat create \
  --name spc-informa-process-campaigns \
  --cron "0 * * * * *" \
  --path /api/scheduled/process-campaigns \
  --description "Processa campanhas e aplica retenção configurável de autenticação, PII, eventos e auditoria"
```

> Não execute esse comando antes da publicação: o agendador chama a URL de produção, não a prévia local.

Após criar, guardar o `task_uid` no registro operacional. Para inspecionar execuções, usar `manus-heartbeat list` e `manus-heartbeat logs --task-uid <uid> --with-body`. A interface de gerenciamento também apresenta histórico, pausa, retomada, execução manual e investigação.

Na mesma requisição autenticada, o callback limpa desafios e sessões expirados, anonimiza destinatários de campanhas terminais, descarta referências a importações, elimina eventos e recibos vencidos e minimiza o contexto antigo de auditoria. Os prazos são controlados pelas variáveis `RETENTION_*_DAYS` documentadas em [`privacy-lgpd.md`](./privacy-lgpd.md). Depois de qualquer mudança, executar **Run Now** e conferir o objeto `retention` na resposta.

| Sintoma | Diagnóstico | Ação |
| --- | --- | --- |
| Campanha permanece `QUEUED` | Heartbeat ausente, pausado ou com falhas | Verificar tarefa, última execução e resposta do callback |
| Muitos destinatários `FAILED` | Endpoint, credencial, timeout ou rejeição do broker | Validar broker preferencial, logs e resposta sanitizada do provedor |
| Webhook retorna `401` | Timestamp ou assinatura incorreta | Confirmar segredo, corpo bruto, relógio do provedor e cabeçalhos |
| Webhook retorna `422` | `messageId`, destinatário ou campanha incompatível | Verificar correlação do envio e vínculo do broker |
| Campanha `PARTIAL` | Parte terminal entregue/opt-out e parte falhou | Corrigir causa, avaliar reprocessamento controlado e evitar novo envio a entregues |

## 4. Configuração de brokers

Cada canal deve possuir no máximo um broker ativo preferencial. O endpoint deve ser HTTPS público; endereços locais e redes privadas são rejeitados. As credenciais são cifradas e respostas de listagem mostram apenas indicação de configuração.

Antes de ativar um broker, validar em ambiente controlado: autenticação de saída, timeout, resposta com identificador da mensagem, callback público, segredo HMAC distinto da credencial de envio, relógio sincronizado e mapeamento dos estados. Rotação de segredo exige janela coordenada; manter dois segredos simultâneos não é suportado pela versão atual.

## 5. Autenticação e acesso

Falhas de login elevam bloqueio progressivo. Um bloqueio administrativo explícito não é liberado por decurso de tempo. Desafios de 2FA e recuperação são de uso único, expiram e possuem limite de tentativas. Em investigação, nunca solicitar senha, código ou token ao usuário.

| Situação | Procedimento |
| --- | --- |
| Usuário não recebe 2FA | Confirmar status da conta e e-mail, verificar entrega do SendGrid e evitar revelar existência da conta a terceiros |
| Conta bloqueada por tentativas | Aguardar expiração do bloqueio temporário; investigar origem das tentativas antes de intervenção |
| Conta bloqueada administrativamente | Administrador autorizado deve revisar o motivo e alterar o status; o login não desbloqueia automaticamente |
| Suspeita de sessão comprometida | Revogar sessão, redefinir senha por fluxo oficial, revisar auditoria e avaliar incidente |

## 6. Campanhas e finanças

Uma importação cria uma campanha revisável. A confirmação executa o cálculo financeiro e, conforme o modelo, reserva saldo pré-pago ou valida o limite pós-pago. A chave de idempotência impede duplicação acidental. Destinatários são reivindicados atomicamente, têm até três tentativas transitórias e usam chave de idempotência externa quando suportada.

Antes de autorizar reenvio manual, confirmar estados finais e o histórico do broker. Nunca recriar uma campanha somente para “forçar” entrega sem avaliar duplicidade. Ajustes financeiros devem manter razão, ator e referência auditável.

## 7. Observabilidade e incidentes

Logs de desenvolvimento ficam em `.manus-logs/`. Logs da implantação publicada são consultados pela ferramenta de logs de produção da plataforma. Pesquisar por `scheduled:campaigns`, erros de broker, códigos HTTP de webhook e eventos de auditoria. Não copiar payloads com dados pessoais para tickets ou chats.

Para incidente, seguir [`privacy-lgpd.md`](./privacy-lgpd.md): conter, preservar evidências, avaliar impacto, notificar responsáveis, rotacionar credenciais e registrar a correção. Se uma mudança quebrar o aplicativo, preferir rollback para o checkpoint estável em vez de alterações destrutivas no repositório ou no banco.

## 8. Verificação periódica

| Frequência | Verificação |
| --- | --- |
| Diária | Falhas do Heartbeat, campanhas presas, erros de broker e webhooks rejeitados |
| Semanal | Chaves próximas do vencimento, usuários bloqueados, brokers inativos e taxa de falha por canal |
| Mensal | Perfis administrativos, escopo de organizações, política de preços, valores `RETENTION_*_DAYS`, amostra de anonimização e testes de restauração |
| Após mudança | Tipagem, testes, build, smoke test, autorização cruzada e revisão de logs |
