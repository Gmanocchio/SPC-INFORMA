import { Mail, MessageSquareText, RadioTower } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/QueryErrorState";

type Channel = "SMS" | "EMAIL" | "WHATSAPP" | "RCS";

const channelIcon: Record<Channel, typeof MessageSquareText> = {
  SMS: MessageSquareText,
  EMAIL: Mail,
  WHATSAPP: MessageSquareText,
  RCS: RadioTower,
};

const channelLabel: Record<Channel, string> = {
  SMS: "SMS",
  EMAIL: "E-mail",
  WHATSAPP: "WhatsApp",
  RCS: "RCS",
};

const syntheticPreviewData: Record<string, string> = {
  nome_cliente: "João Silva",
  valor: "R$ 1.500,00",
  nome_credor: "Credor Exemplo",
  data_vencimento: "31/12/2025",
  link: "https://exemplo.com",
  cpf: "123.456.789-00",
  cnpj: "12.345.678/0001-90",
  telefone: "(11) 98765-4321",
  email: "cliente@exemplo.com",
};

function renderSafePreview(value: string): string {
  return value.replace(/{{\s*([A-Za-z_][A-Za-z0-9_.-]{0,49})\s*}}/g, (_token, variable: string) => 
    syntheticPreviewData[variable.toLowerCase()] ?? `[${variable}: exemplo]`
  );
}

interface Template {
  id: number;
  name: string;
  channel: Channel;
  subject: string | null;
  content: string;
  variables: string[];
  version: number;
}

interface TemplateSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: Template[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: { message: string };
  onRetry?: () => void;
  onSelect: (templateId: number) => void;
  selectedChannel?: Channel;
}

export function TemplateSelectionModal({
  open,
  onOpenChange,
  templates,
  isLoading,
  isError,
  error,
  onRetry,
  onSelect,
  selectedChannel,
}: TemplateSelectionModalProps) {
  // commercial.templates.available já garante status ACTIVE no servidor.
  // O payload público não inclui status; filtrar por esse campo descartava todos os itens.
  const filteredTemplates = selectedChannel
    ? templates?.filter(template => template.channel === selectedChannel)
    : templates;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[calc(100vw-3rem)] lg:max-w-6xl">
        <DialogHeader className="shrink-0 border-b border-slate-100 px-5 py-5 pr-12 sm:px-7 sm:py-6">
          <DialogTitle>Selecionar Template</DialogTitle>
          <DialogDescription>
            Escolha um template homologado para sua campanha. Visualize o conteúdo antes de selecionar.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {isLoading ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-3 rounded-2xl border p-5 sm:p-6">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-52 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <QueryErrorState message={error?.message ?? "Erro ao carregar templates"} onRetry={onRetry} />
        ) : filteredTemplates?.length ? (
          <div data-testid="template-grid" className="grid gap-5 lg:grid-cols-2">
            {filteredTemplates.map(template => {
              const Icon = channelIcon[template.channel];
              const previewContent = renderSafePreview(template.content);
              const previewSubject = template.subject ? renderSafePreview(template.subject) : null;

              return (
                <div data-testid={`template-card-${template.id}`} key={template.id} className="flex min-h-[30rem] flex-col rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-blue-300 hover:shadow-md sm:p-6">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold leading-6 text-slate-900 sm:text-lg">{template.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Icon className="size-4 text-[#0066cc]" />
                        <span className="text-sm text-slate-500">{channelLabel[template.channel]}</span>
                      </div>
                    </div>
                    <Badge variant="secondary">v{template.version}</Badge>
                  </div>

                  {previewSubject && (
                    <div className="mb-3 rounded-xl bg-slate-50 p-3 text-sm">
                      <span className="font-semibold text-slate-600">Assunto: </span>
                      <span className="text-slate-700">{previewSubject}</span>
                    </div>
                  )}

                  <div className="mb-5 min-h-60 flex-1 overflow-y-auto rounded-xl bg-slate-50 p-4 sm:max-h-80 sm:p-5">
                    <p className="whitespace-pre-wrap break-words font-mono text-sm leading-6 text-slate-700">
                      {previewContent}
                    </p>
                  </div>

                  <Button
                    onClick={() => {
                      onSelect(template.id);
                      onOpenChange(false);
                    }}
                    className="w-full bg-[#0066cc] text-white hover:bg-[#004a99]"
                  >
                    Selecionar
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
            <MessageSquareText className="size-10 text-[#0066cc]" />
            <h3 className="mt-4 font-bold text-slate-900">Nenhum template disponível</h3>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              {selectedChannel
                ? `Nenhum template ativo encontrado para ${channelLabel[selectedChannel]}. Crie um novo template na biblioteca.`
                : "Selecione um canal para visualizar templates disponíveis."}
            </p>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
