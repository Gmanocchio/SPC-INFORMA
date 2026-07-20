# Matriz de qualidade das telas críticas

Esta matriz registra a evidência estrutural e visual usada para verificar **estados de interface, acessibilidade por teclado e responsividade**. Ela complementa os testes de negócio e não substitui validação assistida com usuários reais.

| Tela | Carregamento | Erro recuperável | Vazio ou orientação | Confirmação | Responsividade |
|---|---|---|---|---|---|
| Dashboard | Skeletons por indicador | Alerta explícito | Orientação por indicador | Dados atualizados por consulta | Grades `sm`, `md` e `lg` |
| Empresas | Skeletons de tabela | Alerta com retentativa | Estado vazio com orientação | Toast em criação, status e logo | Formulário e tabela adaptáveis |
| Usuários | Skeletons de tabela | Alerta com retentativa | Estado vazio com orientação | Toast em criação e status | Formulário e tabela adaptáveis |
| Templates | Skeleton da biblioteca | Alerta com retentativa | Estado vazio com chamada à ação | Toast em criação e situação | Diálogo e tabela adaptáveis |
| Precificação | Skeleton do histórico | Alerta com retentativa | Mensagem de ausência | Toast após nova vigência | Formulário e tabela adaptáveis |
| Chaves de API | Skeleton da lista | Alerta com retentativa | Estado vazio seguro | Toast e exibição única do segredo | Diálogo e tabela adaptáveis |
| Campanhas | Skeleton da lista | Alerta com retentativa | Estado vazio orientado | Resumo financeiro e toasts | Formulário, resumo e tabela adaptáveis |
| Brokers | Skeletons em grade | Alerta explícito | Estado vazio orientado | Toast em cadastro, edição e desativação | Grade `sm` e `lg` |
| Login e recuperação | Indicador em botões | Mensagens antienumeração | Instruções por etapa | Confirmação por etapa | Cartão fluido em celular e desktop |

## Contratos transversais

O aplicativo oferece um **skip link** para `#conteudo-principal`, foco programático na região principal após a navegação, foco visível nos controles e um separador lateral operável por teclado. As tabelas possuem contêiner com rolagem horizontal; formulários e grades usam pontos de quebra móveis antes de expandir para desktop.

O componente `QueryErrorState` usa `role="alert"`, mensagem textual, ícone decorativo oculto da árvore de acessibilidade e ação de retentativa com foco visível. A suíte `server/ui-quality-coverage.test.ts` impede regressões nos contratos estruturais desta matriz.

## Validação visual executada

Foram capturadas e revisadas as rotas públicas `/`, `/login`, `/recuperar-senha` e a rota protegida `/app` em **1280 × 720** e **390 × 844**. O redirecionamento seguro da rota protegida para login foi confirmado sem conteúdo privado visível.

As páginas internas autenticadas exigem credencial SPC válida. Como nenhuma credencial administrativa de teste foi fornecida no ambiente, a validação interna foi feita por inspeção estrutural, compilação, testes arquiteturais e contratos responsivos. Recomenda-se uma rodada final manual com cada perfil real após a publicação.
