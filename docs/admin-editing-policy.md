# Política de edição administrativa

Administradores podem corrigir registros persistidos dentro do escopo de sua organização. Toda atualização deve passar por validação no servidor, respeitar o perfil do operador e produzir evento de auditoria com os campos alterados. Identificadores legais, vínculos estruturais e segredos não são alterados por formulários genéricos.

| Módulo | Quem pode editar | Regra aplicada |
|---|---|---|
| Usuários | Administrador SPC Brasil ou administrador da organização dentro do próprio escopo | Nome, e-mail, telefone, perfil e situação podem ser alterados; CPF e organização permanecem imutáveis. O operador não pode remover o próprio acesso administrativo. |
| Empresas e credores | Administrador SPC Brasil ou administrador da organização dentro do próprio escopo | Dados cadastrais, responsável, endereço, financeiro e situação podem ser corrigidos; CNPJ, tipo e organização superior permanecem imutáveis. |
| Campanhas | Administrador SPC Brasil ou administrador da organização responsável | Nome e agendamento podem ser alterados apenas enquanto a campanha estiver em rascunho ou validada, antes de confirmação, reserva de saldo ou processamento. |
| Templates | Administrador SPC Brasil | Templates em rascunho ou ativos podem ter conteúdo e metadados alterados. Cada alteração incrementa a versão e gera auditoria; templates arquivados permanecem protegidos contra edição ou reativação. |
| Brokers | Administrador SPC Brasil | Configuração editável pelo fluxo existente, com credenciais tratadas como segredo e sem exposição do valor armazenado. |
| Preços | Conforme escopo comercial | O sistema registra uma nova vigência em vez de sobrescrever o histórico financeiro. |
| Chaves de API | Conforme escopo administrativo | Chaves não são editadas. A operação segura é revogar a chave anterior e emitir outra. |

As restrições de campanha, template arquivado, preço e chave de API são deliberadas. Elas preservam rastreabilidade operacional e financeira, evitam reescrita de registros encerrados e reduzem o risco de comprometimento de credenciais. Templates ativos constituem a exceção controlada: o Administrador SPC Brasil pode corrigi-los, com incremento obrigatório de versão e evento de auditoria.
