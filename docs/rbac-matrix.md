# Matriz de controle de acesso

## Perfis

| Perfil | Escopo de dados | Finalidade |
|---|---|---|
| `SPC_ADMIN` | Global | Administração da plataforma, governança, templates, brokers, preços-base e consolidação nacional |
| `ORG_ADMIN` | Organização da sessão | Administração da CDL/Distribuidora, credores vinculados, usuários, preços próprios e campanhas |
| `REQUESTER` | Organização da sessão | Operação de campanhas, consulta de resultados e consumo, sem acesso a configurações críticas |

## Permissões por módulo

| Módulo / ação | SPC Admin | Admin CDL/Distribuidora | Solicitante |
|---|---:|---:|---:|
| Dashboard consolidado nacional | Sim | Não | Não |
| Dashboard da própria organização | Sim | Sim | Sim |
| Criar e editar organizações | Sim | Própria organização, campos permitidos | Não |
| Gerenciar credores | Sim | Própria organização | Não |
| Gerenciar usuários SPC | Sim | Não | Não |
| Gerenciar usuários da organização | Sim | Própria organização | Não |
| Criar e editar templates | Sim | Não | Não |
| Visualizar templates ativos | Sim | Sim | Sim |
| Criar campanhas | Sim | Sim | Sim |
| Confirmar campanhas | Sim | Sim | Sim, conforme política |
| Cancelar campanha ainda não processada | Sim | Sim, própria organização | Sim, se for autor e permitido |
| Definir preço-base SPC | Sim | Não | Não |
| Definir preço ao credor | Sim | Própria organização | Não |
| Gerenciar brokers e credenciais | Sim | Não | Não |
| Gerenciar chaves de API SPC | Sim | Não | Não |
| Gerenciar chaves de API da organização | Sim | Sim | Não |
| Consultar auditoria | Sim, global | Própria organização | Próprias ações, quando permitido |
| Gestão de Domínios | Sim | Não | Não |

## Políticas invariáveis

Ocultar um item de menu não constitui autorização. Cada procedimento do servidor deverá validar o perfil, o escopo e a propriedade do recurso. A busca de um recurso por identificador deverá combinar o identificador com o escopo organizacional em uma única consulta. Respostas de acesso negado não revelarão a existência de dados pertencentes a outra organização.

Templates e brokers são funcionalidades exclusivas de `SPC_ADMIN`. Preços-base também são globais e exclusivos do SPC Brasil. Preços finais cobrados de credores podem ser definidos por administradores da CDL/Distribuidora apenas dentro da própria organização e nunca abaixo das restrições comerciais configuradas pela plataforma.
