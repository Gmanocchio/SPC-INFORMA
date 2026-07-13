# Relatório de validação

## Execução automatizada

Em 13 de julho de 2026, a aplicação foi validada com verificação TypeScript, suíte Vitest e build de produção. O resultado final foi de **54 testes aprovados em 12 arquivos**, sem erros de tipagem e com geração bem-sucedida dos artefatos de frontend e servidor.

As coberturas incluem login, emissão e consumo de 2FA, criação e invalidação de sessão, recuperação de senha, expiração e uso único de desafios, configuração segura do SendGrid, escopo por organização, autorização por perfil, cálculos financeiros, processamento de campanhas, timeout e autenticação de brokers, assinatura e replay de webhooks, transições monotônicas de entrega, callback periódico autenticado, retenção configurável, bloqueio de conta, vínculo de contexto, proteção de origem, governança arquitetural e contratos de qualidade da interface.

## Verificação visual

Foram capturadas e revisadas as rotas `/`, `/acesso` e `/app` em 1280 × 720 e 390 × 844. A landing page e o acesso mantiveram hierarquia, contraste, legibilidade e adaptação responsiva. Em sessão anônima, `/app` redirecionou corretamente para `/acesso`, confirmando a proteção do roteamento no cenário disponível.

Uma verificação dedicada em **tablet 768 × 1024** cobriu `/`, `/acesso` e a rota protegida correta `/app`. A landing page reorganizou cartões e chamadas sem corte horizontal, o formulário manteve largura e áreas de toque adequadas e `/app` encaminhou o visitante anônimo para `/acesso` sem expor conteúdo protegido.

O layout autenticado recebeu skip link, foco programático no conteúdo principal, indicação de página atual, controles com rótulos acessíveis e redimensionamento da navegação lateral por teclado. As páginas passaram a ser carregadas sob demanda, reduzindo o carregamento inicial e isolando os módulos em chunks próprios. As telas administrativas críticas possuem estados explícitos de carregamento, erro recuperável, vazio e confirmação, documentados em `ui-quality-matrix.md` e verificados por teste arquitetural.

## Observações operacionais

O build mantém um aviso não bloqueante de chunk base superior a 500 kB, relacionado às dependências compartilhadas do template. As páginas de negócio já foram separadas em chunks individuais e o aviso não impede a implantação.

A rota protegida autenticada depende de uma conta válida e do código 2FA enviado por e-mail. A inspeção visual anônima não substitui o teste de aceitação com credenciais reais após a publicação.

O runtime foi reiniciado após o endurecimento e voltou a iniciar em `http://localhost:3000/` sem repetir o erro transitório de módulo registrado em histórico anterior. A ativação do Heartbeat permanece deliberadamente pós-publicação, pois o agendador somente alcança a implantação de produção.

A retenção executável possui prazos configuráveis por domínio para desafios, sessões, referências de importação, PII de destinatários, eventos de entrega, recibos de webhook e contexto auxiliar de auditoria. O callback periódico executa essa manutenção junto ao processamento da fila e retorna contadores sanitizados no objeto `retention`. Testes diretos do serviço verificam anonimização de destinatários, descarte de referências de importação, exclusão de eventos e recibos e minimização do contexto de auditoria.
