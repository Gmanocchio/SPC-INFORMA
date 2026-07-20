# Checklist de publicação e ativação

## 1. Antes do checkpoint

| Item | Critério de aceite |
| --- | --- |
| Código | `pnpm check`, `pnpm test` e `pnpm build` concluídos sem erro |
| Banco | Schema e migrações aplicados; nenhuma alteração destrutiva pendente |
| E-mail | `SENDGRID_API_KEY`, remetente e nome configurados e validados |
| Segurança | Cookies, origem, cabeçalhos, bloqueios, auditoria e testes de autorização ativos |
| Brokers | Endpoint HTTPS público, credenciais, timeout, preferência por canal e segredo de webhook configurados |
| Privacidade | Responsáveis, prazos `RETENTION_*_DAYS` e ciclo de vida do armazenamento aprovados |
| Interface | Desktop, tablet e celular revisados; estados de carregamento, erro e vazio presentes |
| Logs | Sem erro ativo de servidor, navegador ou rede |

## 2. Publicação

1. Criar o checkpoint final.
2. Abrir a prévia do checkpoint e revisar landing page, login, dashboard, campanhas e brokers.
3. Clicar em **Publish** na interface de gerenciamento.
4. Aguardar a implantação ficar saudável.
5. Confirmar a URL pública e, se necessário, configurar domínio em **Settings → Domains**.

## 3. Ativação do Heartbeat

Somente depois de a versão com `/api/scheduled/process-campaigns` estar publicada:

```bash
manus-heartbeat create \
  --name spc-informa-process-campaigns \
  --cron "0 * * * * *" \
  --path /api/scheduled/process-campaigns \
  --description "Processa campanhas e aplica retenção configurável de autenticação, PII, eventos e auditoria"
```

Registrar o `task_uid`, executar **Run Now** ou aguardar o próximo minuto e verificar resposta `200` com `ok: true` e objeto `retention`. Chamadas comuns sem identidade cron devem permanecer rejeitadas. Confirmar que os valores de `RETENTION_*_DAYS` foram cadastrados pela gestão de segredos quando os padrões não forem adequados à política aprovada.

## 4. Smoke test pós-publicação

| Fluxo | Resultado esperado |
| --- | --- |
| Login e 2FA | Código entregue, desafio consumido uma vez e sessão criada |
| Acesso por perfil | Rota Domínios e Brokers invisíveis e inacessíveis para não-SPC_ADMIN |
| Organizações | Um administrador não lê nem altera organização fora do seu escopo |
| Campanha | Importação valida layout; confirmação aplica preço e coloca em fila/agendamento |
| Despacho | Broker preferencial recebe requisição autenticada e devolve identificador |
| Webhook | Assinatura válida atualiza estado; repetição do mesmo `eventId` é idempotente |
| Dashboard | Indicadores refletem campanha confirmada e eventos finais sem expor PII |
| Recuperação | Mensagem neutra, token de uso único e senha forte |

## 5. Critérios de rollback

Efetuar rollback para o checkpoint estável se houver falha generalizada de login, quebra de isolamento entre organizações, débito/reserva financeira incorreta, duplicação de envios, indisponibilidade persistente ou exposição de segredo/PII. Pausar o Heartbeat e desativar brokers afetados antes do rollback quando houver risco de novos envios.
