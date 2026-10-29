import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpLeft } from "lucide-react";
import { goBack } from "@/routing/location";
import { Button } from "./ui/button";
export function DetailPage({
  label,
  title,
  description,
  fallback,
  children,
}: {
  label: string;
  title: string;
  description: string;
  fallback: string;
  children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section className="task-page entity-page" aria-label={label}>
      <Button
        variant="ghost"
        className="task-back"
        onClick={() => goBack(fallback)}
      >
        <ArrowUpLeft />
        Voltar
      </Button>
      <header className="sr-only">
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
        <p className="muted-copy">{description}</p>
      </header>
      {children}
    </section>
  );
}
