import { useId, type ReactNode } from "react";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "./ui/empty";
import { Skeleton } from "./ui/skeleton";
import { Button } from "./ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "./ui/select";
import { Field, FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import type { Page } from "@/api/types";
export function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="grid gap-3 p-4">
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
export function Failure({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Não foi possível carregar</AlertTitle>
      <AlertDescription>
        {error instanceof Error ? error.message : "Tente novamente."}
        {retry && (
          <Button variant="outline" onClick={retry}>
            Tentar novamente
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
export function NoData({
  title = "Nenhum registro encontrado",
  description = "Tente ajustar os filtros ou consulte o planejamento com o team leader.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
export function QueryState({
  query,
  children,
}: {
  query: {
    isPending: boolean;
    error: unknown;
    data?: unknown;
    refetch: () => unknown;
  };
  children: ReactNode;
}) {
  if (query.isPending) return <Loading />;
  return (
    <>
      {query.error ? (
        <Failure error={query.error} retry={() => void query.refetch()} />
      ) : null}
      {(!query.error || query.data !== undefined) && children}
    </>
  );
}
export function Pager({
  page,
  onOffset,
}: {
  page: Page<unknown>;
  onOffset: (n: number) => void;
}) {
  return (
    <nav aria-label="Paginação" className="pager">
      <span>
        {page.total === 0
          ? "0 registros"
          : `${page.offset + 1}–${page.offset + page.items.length} de ${page.total}`}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page.offset === 0}
        onClick={() => onOffset(Math.max(0, page.offset - page.limit))}
      >
        Anterior
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={!page.hasMore}
        onClick={() => onOffset(page.nextOffset ?? 0)}
      >
        Próxima
      </Button>
    </nav>
  );
}
export function Choice({
  label,
  value,
  onChange,
  options,
  all,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  all?: string;
}) {
  return (
    <Field className="filter-field">
      <FieldLabel>{label}</FieldLabel>
      <Select
        value={value || "__all"}
        onValueChange={(v) => onChange(v === "__all" ? "" : v)}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {all && <SelectItem value="__all">{all}</SelectItem>}
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}
export function Search({
  value,
  onChange,
  label = "Buscar",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const id = useId();
  return (
    <Field className="filter-field grow">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="search"
        maxLength={200}
        placeholder="Digite para filtrar…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
export function TextBlock({ children }: { children: ReactNode }) {
  return (
    <div className="text-block">
      {children || (
        <span className="text-muted-foreground">Não informado.</span>
      )}
    </div>
  );
}
export const modeLabels = {
  manual: "Totalmente manual",
  standard: "Padrão",
  automatic: "Totalmente automático",
};
export function safeUrl(value: string | null | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:", "codex:"].includes(url.protocol)
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}
