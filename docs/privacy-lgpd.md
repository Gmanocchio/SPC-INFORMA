# Privacidade, LGPD e retenção de dados

**Autor:** Manus AI  
**Escopo:** Notificadora SPC Brasil  
**Última revisão técnica:** 13 de julho de 2026

> Este documento descreve controles técnicos e decisões operacionais recomendadas. Ele **não constitui parecer jurídico** nem, isoladamente, declaração de conformidade. A definição das bases legais, dos papéis de controlador e operador, dos prazos regulatórios e do atendimento aos titulares deve ser validada pelo encarregado e pela assessoria jurídica do SPC Brasil.

## 1. Princípios aplicados

A LGPD disciplina o tratamento de dados pessoais em meios digitais e protege liberdade, privacidade e livre desenvolvimento da personalidade.[1] A plataforma deve operar segundo finalidade, adequação, necessidade, segurança, prevenção e responsabilização, evitando coletar ou manter informação que não seja necessária ao envio, à comprovação da entrega ou ao cumprimento de obrigação aplicável.[1]

| Princípio operacional | Aplicação na plataforma |
| --- | --- |
| **Minimização** | Importações aceitam somente o layout multicanal aprovado de sete campos: CPF, primeiro nome, valor e vencimento da dívida, número do contrato, telefone e e-mail do credor. Campos ausentes, extras ou fora da ordem são rejeitados. |
| **Segregação** | Consultas e mutações são limitadas pela organização e pelo perfil do usuário; a matriz está em [`security-access-matrix.md`](./security-access-matrix.md). |
| **Confidencialidade** | CPF, primeiro nome, contrato, contatos do credor e JSON auxiliar de destinatários são cifrados em repouso; credenciais de brokers e segredos de API também são protegidos, e respostas administrativas não devolvem o segredo integral. |
| **Rastreabilidade** | Autenticação, cadastros, precificação, chaves, campanhas, templates e brokers geram eventos de auditoria sem registrar senha, código 2FA ou segredo completo. |
| **Redução de exposição** | Dashboards usam agregações; dados pessoais não são necessários para indicadores operacionais. Logs devem usar identificadores técnicos e mensagens sanitizadas. |

## 2. Inventário mínimo de tratamento

| Categoria | Finalidade técnica | Proteção atual | Retenção recomendada |
| --- | --- | --- | --- |
| Nome, e-mail, telefone e CPF de usuários | Identidade, autenticação, autorização e contato operacional | Senha com hash; sessão revogável; 2FA; escopo por organização | Enquanto a conta estiver ativa e pelo prazo necessário à defesa de direitos, conforme política jurídica |
| CPF, primeiro nome, valor e vencimento da dívida, número do contrato, telefone e e-mail do credor | Identificação multicanal, validação da base e renderização das sete variáveis do template | Campos textuais sensíveis e JSON auxiliar cifrados; valor em centavos e data em formato canônico; acesso por campanha escopada; não usados em dashboards | 90 dias após conclusão terminal da campanha, configurável; depois os campos pessoais, financeiros e auxiliares são removidos ou anonimizados |
| Arquivo de importação | Criação e validação de destinatários | Referência privada no armazenamento | 30 dias após conclusão terminal; depois a referência é descartada e o objeto fica inacessível pela aplicação |
| Eventos de entrega | Comprovação, métricas e diagnóstico | Identificadores internos, digest do payload e estado monotônico | 365 dias, configurável |
| Recibos de webhook | Idempotência e proteção contra repetição | Identificador do evento, broker e digest | 90 dias, configurável |
| Credenciais de broker e chaves de API | Integração de saída e autenticação de sistemas | Segredo cifrado ou hash irreversível; exibição mascarada | Até revogação, substituição ou encerramento do contrato |
| Sessões e desafios | Segurança de acesso | Tokens aleatórios, expiração, consumo único e vínculo de contexto | Desafios expirados: limpeza técnica em 7 dias; sessões expiradas ou revogadas: limpeza em 30 dias |
| Auditoria | Investigação, responsabilização e segurança | Evento, ator, organização, recurso e metadados limitados | Contexto auxiliar minimizado após 730 dias; evento-base preservado conforme obrigação aplicável |

Os prazos são carregados no início de cada manutenção pelas variáveis abaixo. Valores ausentes, não inteiros, menores que 1 ou maiores que 36.500 dias retornam ao padrão seguro. A manutenção é executada pelo callback Heartbeat autenticado e processa lotes limitados para destinatários e importações.

| Variável | Padrão | Domínio |
| --- | ---: | --- |
| `RETENTION_AUTH_CHALLENGE_DAYS` | 7 | Desafios de 2FA e recuperação expirados |
| `RETENTION_AUTH_SESSION_DAYS` | 30 | Sessões expiradas ou revogadas |
| `RETENTION_IMPORT_FILE_DAYS` | 30 | Referências de arquivos de campanhas terminais |
| `RETENTION_RECIPIENT_PII_DAYS` | 90 | Sete campos do destinatário, destino técnico e variáveis auxiliares |
| `RETENTION_DELIVERY_EVENT_DAYS` | 365 | Eventos detalhados de entrega |
| `RETENTION_WEBHOOK_RECEIPT_DAYS` | 90 | Recibos usados para idempotência |
| `RETENTION_AUDIT_CONTEXT_DAYS` | 730 | Metadados, IP e agente de usuário em auditoria |

Esses padrões precisam ser aprovados formalmente pelo SPC Brasil. A anonimização de destinatários só ocorre em campanhas terminais e preserva contagens e estados operacionais. Como a camada de armazenamento não expõe exclusão física, a aplicação remove a única chave de acesso ao objeto importado; a política de ciclo de vida do armazenamento gerenciado deve ser confirmada contratualmente para eliminação física. Retenção automática não substitui obrigação de preservação legal, regulatória ou por incidente.

## 3. Direitos dos titulares e solicitações

Toda solicitação deve ser recebida por canal oficial, autenticada e registrada em protocolo. A equipe responsável deve identificar as organizações envolvidas, localizar os registros pelo menor conjunto de dados possível, avaliar obrigação de conservação e responder conforme orientação do encarregado. O sistema não deve executar exclusão automática se houver obrigação legal, regulatória, contratual ou necessidade de preservação de evidência.

| Etapa | Procedimento |
| --- | --- |
| **Receber** | Registrar titular, canal, data, organização relacionada e direito solicitado. |
| **Validar** | Confirmar identidade por procedimento independente; não solicitar senha, código 2FA ou chave de API. |
| **Localizar** | Pesquisar usuários, destinatários e eventos dentro do escopo organizacional autorizado. |
| **Decidir** | Consultar encarregado e jurídico sobre acesso, correção, anonimização, bloqueio, portabilidade ou eliminação. |
| **Executar** | Aplicar a decisão com dupla verificação e evento de auditoria. |
| **Responder** | Informar resultado, limitações e medidas adotadas pelo canal oficial. |

## 4. Incidentes de segurança

A ANPD orienta a adoção de medidas administrativas e técnicas de segurança e disponibiliza guia e checklist próprios.[2] Quando um incidente puder causar risco ou dano relevante, o controlador deve avaliar a comunicação à ANPD e aos titulares; a página oficial informa que a comunicação à autoridade, por si só, não substitui a comunicação aos titulares afetados.[3]

| Fase | Ação mínima |
| --- | --- |
| **Conter** | Revogar sessões e chaves afetadas, desativar broker comprometido, bloquear origem e preservar evidências. |
| **Avaliar** | Identificar período, organizações, categorias de dados, titulares, causa, alcance e controles falhos. |
| **Preservar** | Exportar auditoria e logs pertinentes com controle de acesso e cadeia de custódia. Não registrar segredos adicionais. |
| **Notificar internamente** | Acionar segurança, encarregado, jurídico, gestão do produto e responsáveis das organizações afetadas. |
| **Comunicar externamente** | Seguir a avaliação do controlador e os procedimentos oficiais da ANPD e de comunicação aos titulares.[3] |
| **Remediar** | Corrigir causa raiz, rotacionar credenciais, revisar testes, monitorar recorrência e documentar lições aprendidas. |

## 5. Proibições operacionais

Senhas, códigos 2FA, tokens de recuperação, chaves de API, segredos HMAC e credenciais de brokers **não podem** ser enviados por chat, ticket sem proteção, planilha ou log. Dados reais de destinatários não devem ser usados em ambiente de teste. Exportações devem ser justificadas, limitadas, cifradas e eliminadas após a finalidade. O acesso administrativo deve ser nominal; contas compartilhadas impedem responsabilização adequada.

## Referências

[1]: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm "Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais"
[2]: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte "ANPD — Guia orientativo sobre segurança da informação"
[3]: https://www.gov.br/anpd/pt-br/assuntos/comunicacao-de-incidentes-de-seguranca-cis "ANPD — Comunicação de Incidente de Segurança"
