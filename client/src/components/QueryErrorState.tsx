import { AlertCircle, RefreshCw } from "lucide-react";

type QueryErrorStateProps = {
  message?: string;
  onRetry?: () => void;
};

export function QueryErrorState({ message = "Não foi possível carregar estes dados.", onRetry }: QueryErrorStateProps) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 p-8 text-center" role="alert">
      <AlertCircle className="size-9 text-red-600" aria-hidden="true" />
      <h3 className="mt-3 font-bold text-red-950">Falha ao carregar</h3>
      <p className="mt-1 max-w-md text-sm text-red-800">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-800 shadow-sm transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 active:scale-[.97]"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Tentar novamente
        </button>
      )}
    </div>
  );
}
