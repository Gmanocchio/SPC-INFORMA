# Especificação do Manual do SPC Informa

## Princípio de visibilidade

O Manual deve aplicar duas dimensões simultaneamente: o **tipo da organização** (`SPC_BRASIL`, `CDL`, `DISTRIBUTOR` ou `CREDITOR`) e o **papel do usuário** (`SPC_ADMIN`, `ORG_ADMIN` ou `REQUESTER`). Usuários do SPC Brasil têm visão integral. Nos demais níveis, o conteúdo deve ser limitado às páginas exibidas no menu e às ações permitidas dentro de cada página.

| Módulo | SPC Brasil | CDL | Distribuidora | Credor | Solicitante não SPC |
| --- | --- | --- | --- | --- | --- |
| Acesso, primeiro acesso e recuperação | Completo | Completo | Completo | Completo | Completo |
| Dashboard | Completo, incluindo consolidação e SPAM | Indicadores da organização e credores do escopo | Indicadores da organização e credores do escopo | Indicadores do próprio credor | Indicadores do próprio escopo |
| Campanhas | Todos os responsáveis e credores | Credores vinculados à CDL | Credores vinculados à Distribuidora | Próprio credor | Criação e acompanhamento, sem editar ou excluir |
| Empresas | Todos os tipos e vínculos | Própria CDL e credores vinculados | Própria Distribuidora e credores vinculados | Escopo retornado pela aplicação | Não disponível |
| Usuários | Todas as organizações e perfis | Usuários da própria organização | Usuários da própria organização | Usuários da própria organização | Não disponível |
| Templates | Completo | Não disponível | Não disponível | Não disponível | Não disponível |
| Precificação | Base SPC e preços por credor | Base SPC somente leitura e credores do escopo | Base SPC somente leitura e credores do escopo | Preços aplicáveis ao próprio escopo | Não disponível |
| Brokers | Completo | Não disponível | Não disponível | Não disponível | Não disponível |
| Chaves de API | Todas as organizações | Própria organização | Própria organização | Própria organização | Não disponível |
| Gestão de Domínios | Situação do módulo reservado | Não disponível | Não disponível | Não disponível | Não disponível |
| FAQ e Manual | Visão integral | Conteúdo filtrado | Conteúdo filtrado | Conteúdo filtrado | Conteúdo filtrado |

## Estrutura editorial

Cada capítulo deve conter uma explicação objetiva da finalidade da tela, os pré-requisitos, um passo a passo numerado, um exemplo prático com dados demonstrativos, alertas de segurança ou restrições e um atalho para abrir a funcionalidade. As seções administrativas devem ser omitidas para solicitantes e todos os capítulos exclusivos do SPC devem ser omitidos para organizações externas.

## Estratégia visual

A tela pública de acesso será apresentada por meio de uma captura real sem credenciais. As telas internas serão representadas por ilustrações fiéis aos componentes da aplicação, sempre identificadas como **dados demonstrativos**, para evitar exposição de informações pessoais, financeiras, credenciais ou registros de clientes. Essas ilustrações reproduzirão a hierarquia visual de Dashboard, Campanhas, Empresas, Usuários, Templates, Precificação, Brokers e Chaves de API.

A captura real da página de acesso foi validada em 20 de julho de 2026, na resolução de 1440 × 900 pixels. Ela apresenta apenas campos vazios e textos institucionais, sem credenciais ou dados pessoais. O rodapé de pré-visualização será omitido visualmente pelo contêiner recortado da página do Manual.

## Experiência da página

A página deverá oferecer cabeçalho com identificação do escopo atual, busca textual, sumário lateral ou horizontal responsivo, progresso de leitura, capítulos expansíveis, atalhos para as telas permitidas, estado vazio para buscas sem resultado e aviso de que o conteúdo é automaticamente adaptado ao perfil autenticado.
