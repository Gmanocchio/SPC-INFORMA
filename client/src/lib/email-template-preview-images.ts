export type EmailTemplatePreviewImage = {
  src: string;
  alt: string;
};

export const EMAIL_TEMPLATE_PREVIEW_IMAGES: Readonly<Record<string, EmailTemplatePreviewImage>> = {
  "TP-330001": {
    src: "/manus-storage/TP-330001_27be9cd2.png",
    alt: "Exemplo visual do e-mail de cobrança amigável do SPC Brasil",
  },
  "TP-240001": {
    src: "/manus-storage/TP-240001_92b9d9e5.png",
    alt: "Exemplo visual do e-mail de condições especiais do SPC Brasil",
  },
  "TP-300001": {
    src: "/manus-storage/TP-300001_cb16c371.png",
    alt: "Exemplo visual do e-mail de comunicado extrajudicial do SPC Brasil",
  },
  "TP-390001": {
    src: "/manus-storage/TP-390001_3f2f021f.png",
    alt: "Exemplo visual do e-mail de pré-negativação do SPC Brasil",
  },
  "TP-270001": {
    src: "/manus-storage/TP-270001_b6248e68.png",
    alt: "Exemplo visual do e-mail de reforço de negativação do SPC Brasil",
  },
  "TP-360001": {
    src: "/manus-storage/TP-360001_a6705d73.png",
    alt: "Exemplo visual do e-mail de oferta por tempo limitado do SPC Brasil",
  },
};

export function getEmailTemplatePreviewImage(publicId: string | null | undefined) {
  if (!publicId) return null;
  return EMAIL_TEMPLATE_PREVIEW_IMAGES[publicId] ?? null;
}
