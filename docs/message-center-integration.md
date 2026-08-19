# Integração Message Center — E-mail e Callback

## Fontes públicas auditadas

A análise foi realizada sem My Browser ou sessão pessoal, usando exclusivamente a documentação pública da Message Center em [api.messagecenter.com.br](https://api.messagecenter.com.br) e sua [coleção pública no Postman](https://documenter.getpostman.com/view/24841648/2s93CGQvbg). A coleção consultada registra atualizações de envio e callback até julho de 2025.

## Alternativas de integração

| Abordagem | Vantagens e limitações | Custo operacional | Complexidade de configuração |
| --- | --- | --- | --- |
| API HTTPS `EnviarEmailComTemplate` | Correlaciona cada destinatário pelo campo `Identificador`, usa o endpoint já cadastrado e permite retorno individual no callback. Exige template homônimo previamente cadastrado na Message Center. | Uma requisição por destinatário; respeitar o rate limit da chave. | Média; requer API key, remetente, template e URL de callback. |
| SMTP autenticado por API key | Integração simples e aceita HTML livre, até 50 destinatários por mensagem. Não aproveita o endpoint já cadastrado e dificulta a correlação individual quando vários destinatários são agrupados. | Até cinco conexões simultâneas; limite por chave. | Baixa para envio, maior para correlação e rastreabilidade. |

O broker cadastrado já aponta para `EnviarEmailComTemplate`; portanto, o contrato de implementação do sistema é a API HTTPS direta. SMTP permanece apenas como alternativa documentada e não será ativado.

## Contrato de envio

O método é `POST` para `https://sistema.messagecenter.com.br/api/Integracao/EnviarEmailComTemplate`. A API key deve ser enviada no header `apikey`, sem prefixo `Bearer`. Os parâmetros obrigatórios são `Destinatario`, `NomeTemplate`, `RemetenteNome`, `RemetenteEmail` e `Assunto`. Os parâmetros de correlação utilizados pelo SPC Informa serão `Identificador` para o ID interno do destinatário, `ClienteNome`, `ClienteDocumento`, `CentroCusto`, `NossoNumero`, `I_instrucao_1` a `I_instrucao_5` e `CamposCustomizados1` a `CamposCustomizados5`.

A chave possui limite padrão documentado de 50 requisições por minuto e pode ser configurada até 3.000 requisições por minuto. O adaptador deve limitar a concorrência e o orçamento por execução, tratar 408, 429 e 5xx como transitórios e nunca registrar a API key nem a URL completa com dados pessoais.

## Contrato de callback

A Message Center envia `POST` em JSON e também realiza verificações de disponibilidade por `GET` e `POST`. O callback pode agrupar até dez eventos por requisição. Eventos indisponíveis permanecem em fila por até 14 dias; após 100 falhas consecutivas, o modo sleep pode ser ativado.

Os campos documentados incluem `IdCall`, `Identificador`, `ClienteNome`, `DocumentoCliente`, `Destinatario`, `DataEvento`, `Status`, `StatusEntregue`, `MensagemStatus`, `CentroCusto`, `CampanhaId`, `MetodoEnvio`, `FormatoEnvio` e campos customizados. O `Identificador` será o vínculo principal com `campaign_recipients.id`. O `IdCall` será preservado como identificador externo da Message Center.

A documentação pública não define assinatura HMAC nem timestamp no callback. Para não aceitar requisições anônimas, será usado um token de callback derivado do segredo já armazenado no broker e validado em tempo constante no caminho da URL. O endpoint genérico HMAC existente permanecerá inalterado para outros brokers.

## Mapeamento de status

| Retorno Message Center | Evento interno | Estado do destinatário |
| --- | --- | --- |
| `StatusEntregue = Entregue` | `DELIVERED` | `DELIVERED` |
| `Status = Enviado` | `SENT` | `SENT` |
| `Status = Não enviado` ou `StatusEntregue = Não entregue` | `FAILED` | `FAILED` |
| Mensagem de status contendo abertura/leitura | `READ` | Não regride o estado de entrega |
| Mensagem de status contendo clique | `CLICKED` | Não regride o estado de entrega |
| Mensagem de status contendo spam/opt-out/bloqueio | `SPAM` ou `OPTED_OUT` | `OPTED_OUT` |

## Configuração operacional

O adaptador usa exclusivamente `customerEmail`/`E-mail do cliente` como `Destinatario`. `email_credor` permanece como contato/remetente e nunca é usado como destino do cliente. Campanhas recebidas pela API pública são criadas em `READY` e continuam dependentes de confirmação manual.

Após publicar a versão, a URL protegida `https://<domínio>/api/webhooks/message-center/<brokerId>/<token>` deverá ser cadastrada na plataforma Message Center em **Parâmetros → Chave de API / Callback**. Esse cadastro externo não pode ser automatizado pela API pública documentada e não será executado sem acesso autorizado à conta. O teste real de envio somente será feito após confirmação explícita do destinatário de homologação.
