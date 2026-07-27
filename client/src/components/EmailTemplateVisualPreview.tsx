import { useState } from "react";
import type { EmailTemplatePreviewImage } from "@/lib/email-template-preview-images";

type EmailTemplateVisualPreviewProps = {
  publicId: string;
  image: EmailTemplatePreviewImage;
  className?: string;
};

export function EmailTemplateVisualPreview({
  publicId,
  image,
  className = "",
}: EmailTemplateVisualPreviewProps) {
  const [loadFailed, setLoadFailed] = useState(false);

  return (
    <figure
      className={`mt-4 border-t border-slate-200 pt-4 ${className}`.trim()}
      data-testid={`email-template-visual-${publicId}`}
    >
      <figcaption>
        <p className="text-sm font-bold text-slate-900">Exemplo visual do e-mail</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Imagem de referência vinculada ao template {publicId}.
        </p>
      </figcaption>
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:p-3">
        {loadFailed ? (
          <div
            className="flex min-h-32 items-center justify-center rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500"
            role="status"
          >
            A imagem de exemplo está temporariamente indisponível.
          </div>
        ) : (
          <img
            src={image.src}
            alt={image.alt}
            className="mx-auto h-auto w-full max-w-[45rem] rounded-lg object-contain"
            decoding="async"
            loading="lazy"
            onError={() => setLoadFailed(true)}
          />
        )}
      </div>
    </figure>
  );
}
