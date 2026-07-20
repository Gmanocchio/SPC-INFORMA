# Referências externas confirmadas

## Identidade institucional

A referência visual informada na especificação é [Negociar Dívida — SPC Brasil](https://negociardivida.spcbrasil.org.br). A página utiliza mensagens curtas, cartões de benefícios, fundos claros e acentos institucionais. A implementação preservará o logo fornecido e aplicará a paleta especificada pelo usuário: `#0066CC`, `#004A99`, `#4DA3FF`, `#00B67A`, `#FFD54A` e `#F5F7FA`.

## SendGrid

A integração transacional seguirá a documentação oficial [Email API Quickstart for Node.js](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/quickstart-nodejs), [Authentication](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/authentication), [SendGrid v3 API Reference](https://www.twilio.com/docs/sendgrid/api-reference) e o [SDK oficial sendgrid-nodejs](https://github.com/sendgrid/sendgrid-nodejs).

As referências confirmam o uso do pacote `@sendgrid/mail`, autenticação por API key via Bearer token, armazenamento da chave em variável de ambiente, restrição de escopo da chave para envio de e-mail e verificação da identidade do remetente. O remetente de produção deverá ter autenticação de domínio ou identidade aprovada no SendGrid. Nenhuma credencial será persistida no front-end, banco de dados em texto puro, logs ou repositório.

O SDK oficial também disponibiliza `@sendgrid/eventwebhook` para validação de eventos assinados. A implementação de retornos do SendGrid deverá verificar a assinatura do Event Webhook antes de aceitar eventos e aplicar idempotência para impedir processamento duplicado.

## Observação operacional

Disparos externos permanecerão desabilitados até que credenciais de produção sejam armazenadas no gerenciador de segredos e cada broker seja validado. O ambiente de desenvolvimento não deve enviar notificações reais acidentalmente.
