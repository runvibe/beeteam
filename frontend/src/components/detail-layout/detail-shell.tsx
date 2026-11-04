import type { ReactNode, Ref } from "react";
import "./detail-layout.css";
export function DetailShell({
  hero,
  children,
  context,
  overlays,
  backAction,
  primaryRef,
  heroRef,
  primaryHidden = false,
  primaryClassName = "",
  heroClassName = "",
}: {
  hero: ReactNode;
  children: ReactNode;
  context?: ReactNode;
  overlays?: ReactNode;
  backAction?: ReactNode;
  primaryRef?: Ref<HTMLDivElement>;
  heroRef?: Ref<HTMLDivElement>;
  primaryHidden?: boolean;
  primaryClassName?: string;
  heroClassName?: string;
}) {
  return (
    <div className="detail-columns">
      <div
        className={`detail-primary ${primaryClassName}`}
        data-detail-scroll
        ref={primaryRef}
        hidden={primaryHidden}
        inert={primaryHidden}
      >
        {backAction}
        <div className={`detail-hero ${heroClassName}`} ref={heroRef}>
          {hero}
        </div>
        {children}
      </div>
      {context}
      {overlays}
    </div>
  );
}
