# Análise para Modal de Seleção de Templates com Preview

## Estrutura Atual
- **Campanhas.tsx**: Campo de seleção de templates (linha 353-365) usa Select simples
- **Templates.tsx**: Mostra preview com `renderSafePreview()` que substitui variáveis por dados sintéticos
- **Função renderSafePreview**: Substitui `{{variavel}}` por valores de exemplo

## Dados Disponíveis
- `templates.data`: Array com { id, name, channel, subject, content, variables, status, version }
- `syntheticPreviewData`: Mapa de variáveis para valores de exemplo
- `channelLabel`: Mapa de canais para labels (SMS, E-mail, WhatsApp, RCS)

## Implementação Necessária
1. Criar componente modal `TemplateSelectionModal` que:
   - Exibe grid de templates com preview
   - Mostra título + preview do conteúdo
   - Botão para selecionar template
   
2. Substituir Select em Campaigns.tsx por:
   - Botão "Selecionar Template"
   - Abre modal ao clicar
   - Modal chama callback ao selecionar

3. Reutilizar `renderSafePreview()` para preview visual

## Estrutura do Modal
```
Modal Header: "Selecionar Template"
Modal Body:
  - Grid de templates (responsive)
  - Cada card:
    - Título do template
    - Badge com canal (SMS, E-mail, etc)
    - Preview do conteúdo
    - Botão "Selecionar"
Modal Footer: Botão Cancelar
```
