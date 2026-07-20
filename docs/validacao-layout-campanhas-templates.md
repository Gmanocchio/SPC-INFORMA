# Validação do novo layout de campanhas e variáveis

## Evidências automatizadas

O contrato canônico possui nove colunas, na ordem solicitada: CPF, nome do cliente, nome do credor, valor, data de vencimento, número de contrato, telefone do credor, e-mail do credor e link. As regressões cobrem o cabeçalho exato do CSV, a primeira linha usada para gerar o XLSX, o schema persistido, o mapeamento de persistência e a renderização parametrizada para E-mail, SMS, WhatsApp e RCS.

A validação final concluiu com TypeScript aprovado, 105 testes aprovados, um teste de integração ignorado por configuração e build de produção concluído.

## Verificação visual

As rotas corretas são `/app/campanhas` e `/app/templates`. Sem usar uma sessão pessoal do usuário, ambas redirecionam corretamente para a tela corporativa de acesso. Por esse motivo, a área autenticada não foi inspecionada manualmente; sua estrutura foi validada por regressões de interface e pelo build de produção.
