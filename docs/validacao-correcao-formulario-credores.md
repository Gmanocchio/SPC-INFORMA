# Validação da correção do formulário de credores

**Data:** 13 de julho de 2026  
**Escopo:** abertura dos diálogos **Nova empresa** e **Editar empresa** para organizações do tipo **Credor**.

## Causa e correção

O crash ocorria porque o componente `SelectItem` do Radix UI recebia uma opção com `value=""` no campo **Vinculado a**. A correção substitui o valor vazio por um sentinela interno não vazio, converte esse sentinela para `null` apenas no payload enviado ao servidor e preserva vínculos históricos que já não aparecem entre as organizações elegíveis.

## Evidência automatizada

O teste `server/organization-form.ui.test.tsx` monta o componente real `Organizations` em jsdom, abre os diálogos pelos mesmos botões usados na interface e interage com todos os Selects habilitados. A regressão verifica explicitamente os seguintes valores renderizados:

| Fluxo | Tipo | Vinculado a | Modelo financeiro | Situação |
|---|---|---|---|---|
| Nova empresa | Credor | SPC Brasil | Pré-pago | Não aplicável na criação |
| Editar credor | Credor | Vínculo atual indisponível (ID 999) | Pré-pago | Ativa |

Além do teste do componente, `server/organization-form.test.ts` valida as conversões do sentinela e impede a reintrodução de `SelectItem value=""` no arquivo do formulário.

## Limite de validação

Por decisão expressa do usuário, **nenhum navegador conectado nem sessão autenticada do usuário foi acessado**. Portanto, não foi executada uma validação manual autenticada como `SPC_ADMIN`. Essa limitação não foi tratada como substituta dos testes: a aceitação técnica foi sustentada pela montagem do componente real, pela abertura automatizada dos dois diálogos, pela interação com os Selects, pela suíte Vitest completa, pela verificação de tipos e pelo build de produção.
