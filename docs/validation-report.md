# Relatório de validação

## Execução automatizada

Em 13 de julho de 2026, a aplicação foi validada com verificação TypeScript, suíte Vitest e build de produção. O resultado final foi de **95 testes aprovados em 18 arquivos**, com um teste de integração dependente de ambiente ignorado, sem erros de tipagem e com geração bem-sucedida dos artefatos de frontend e servidor.

As coberturas incluem login, emissão e consumo de 2FA, criação e invalidação de sessão, recuperação de senha, expiração e uso único de desafios, configuração segura do SendGrid, escopo por organização, autorização por perfil, cálculos financeiros, layout único de sete colunas, download e reimportação com BOM UTF-8, instruções dos sete cabeçalhos na interface, validação e normalização da importação, renderização das sete variáveis, processamento de campanhas, timeout e autenticação de brokers, assinatura e replay de webhooks, transições monotônicas de entrega, callback periódico autenticado, retenção configurável, bloqueio de conta, vínculo de contexto, proteção de origem, governança arquitetural, contratos de qualidade da interface e edição administrativa de usuários, organizações, campanhas, templates e brokers. A regressão dedicada de templates comprova que `SPC_ADMIN` pode editar conteúdo ativo, que a versão é incrementada, que a operação é auditada e que o bloqueio de templates arquivados permanece em vigor. As campanhas persistem versão, nome, assunto, conteúdo e variáveis do template selecionado; o processamento usa esse snapshot em vez de reler o registro mutável. Um backfill transacional preserva as campanhas legadas antes da primeira alteração do template ativo. A cobertura do formulário de campanha comprova que o backend entrega credores ativos ao `SPC_ADMIN`, inclusive credores globais sem organização pai, que outros perfis continuam limitados ao proprietário selecionado, que credores inativos não aparecem, que a troca da organização limpa uma seleção incompatível e que o seletor relê as opções quando o diálogo é aberto. A nova regressão de acesso comprova, por regra pura usada pela aplicação, que visitante anônimo é enviado para `/acesso`, troca obrigatória de senha é respeitada, módulos exclusivos continuam restritos e `/app/campanhas` permanece envolvida pelo guard de rota. Também foram validadas a nova vigência histórica de preços e a rotação auditável de chaves de API, com escopo, proteção por estado, concorrência e auditoria.

| Camada | Evidência final | Resultado |
|---|---|---|
| Tipagem | `pnpm check` | Aprovada, sem erros TypeScript |
| Regressão | `pnpm test` | 95 aprovados; 1 integração dependente de ambiente ignorada |
| Produção | `pnpm build` | Frontend e servidor gerados com sucesso |
| Credores | `campaign-creditors.test.ts` | 6 cenários de escopo, inatividade, troca, releitura e estados |
| Rota protegida | `route-access.test.ts` | 5 cenários de anonimato, carregamento, senha obrigatória, perfil e vínculo de `/app/campanhas` |

## Verificação visual

Foram capturadas e revisadas as rotas `/`, `/acesso` e `/app` em 1280 × 720 e 390 × 844. A landing page e o acesso mantiveram hierarquia, contraste, legibilidade e adaptação responsiva. Em sessão anônima, `/app`, `/app/usuarios`, `/app/empresas`, `/app/campanhas`, `/app/templates`, `/app/precificacao` e `/app/chaves-api` redirecionaram corretamente para `/acesso`. Após a correção, uma nova captura automatizada de `/app/campanhas` em **1280 × 900** confirmou a continuidade dessa proteção e exibiu a tela de acesso, sem depender de navegador pessoal, login simulado ou desvio de 2FA.

O comportamento interno do seletor autenticado não é apresentado como inspeção visual manual nesta validação. Ele foi comprovado pelos contratos executáveis do backend e da interface: consulta de credores globais e organizacionais ativos, exclusão de inativos, limpeza imediata da seleção ao trocar a organização, releitura ao abrir o diálogo e estados explícitos de carregamento, atualização e ausência de opções.

Uma verificação dedicada em **tablet 768 × 1024** cobriu `/`, `/acesso` e a rota protegida correta `/app`. A landing page reorganizou cartões e chamadas sem corte horizontal, o formulário manteve largura e áreas de toque adequadas e `/app` encaminhou o visitante anônimo para `/acesso` sem expor conteúdo protegido.

O layout autenticado recebeu skip link, foco programático no conteúdo principal, indicação de página atual, controles com rótulos acessíveis e redimensionamento da navegação lateral por teclado. As páginas passaram a ser carregadas sob demanda, reduzindo o carregamento inicial e isolando os módulos em chunks próprios. As telas administrativas críticas possuem estados explícitos de carregamento, erro recuperável, vazio e confirmação, documentados em `ui-quality-matrix.md` e verificados por teste arquitetural.

## Observações operacionais

O build mantém um aviso não bloqueante de chunk base superior a 500 kB, relacionado às dependências compartilhadas do template. As páginas de negócio já foram separadas em chunks individuais e o aviso não impede a implantação.

A rota protegida autenticada depende de uma conta válida e do código 2FA enviado por e-mail. A inspeção visual anônima não é apresentada como teste de aceitação autenticado. Para o encerramento deste ajuste, essa inspeção manual foi registrada como **não executada e supersedida pela estratégia automatizada verificável**, composta pelos testes do backend, pelos contratos da interface, pela regra de acesso extraída e pela captura anônima da rota protegida. Os logs históricos do projeto registram uma redefinição anterior da senha administrativa; a credencial resultante não está disponível nesta sessão e não foi alterada novamente durante este ajuste. Nenhum mecanismo de 2FA foi contornado para simular acesso privilegiado.

A desativação do conector de navegador pessoal foi solicitada duas vezes pela configuração da sessão, mas a camada de confirmação recusou ambas as sugestões e não aplicou a alteração global. Esse impedimento externo está registrado de forma explícita: **o conector permaneceu habilitado, porém não foi usado em nenhuma validação ou implementação deste ajuste**. Todo o fechamento foi concluído com testes locais, build e captura automatizada da própria prévia do projeto.

O runtime foi reiniciado após o endurecimento e voltou a iniciar em `http://localhost:3000/` sem repetir o erro transitório de módulo registrado em histórico anterior. A ativação do Heartbeat permanece deliberadamente pós-publicação, pois o agendador somente alcança a implantação de produção.

A retenção executável possui prazos configuráveis por domínio para desafios, sessões, referências de importação, PII de destinatários, eventos de entrega, recibos de webhook e contexto auxiliar de auditoria. O callback periódico executa essa manutenção junto ao processamento da fila e retorna contadores sanitizados no objeto `retention`. Testes diretos do serviço verificam anonimização de destinatários, descarte de referências de importação, exclusão de eventos e recibos e minimização do contexto de auditoria.
