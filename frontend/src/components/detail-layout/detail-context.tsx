import { useEffect, useRef, type ReactNode } from "react";
export function DetailContext({
  label,
  screenTitle,
  backAction,
  mobile,
  screen,
  compactHeader,
  children,
  className = "",
  contentClassName = "",
}: {
  label: string;
  screenTitle: string;
  backAction: ReactNode;
  mobile: boolean;
  screen: boolean;
  compactHeader?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null),
    aside = useRef<HTMLElement>(null),
    previous = useRef(screen);
  useEffect(() => {
    if (screen) heading.current?.focus({ preventScroll: true });
    else if (previous.current && !mobile)
      aside.current
        ?.closest(".detail-columns")
        ?.querySelector<HTMLElement>(".detail-primary h1")
        ?.focus({ preventScroll: true });
    previous.current = screen;
  }, [screen, mobile]);
  return (
    <aside
      ref={aside}
      className={`detail-context ${className}`}
      aria-label={label}
      data-detail-screen={screen}
      hidden={mobile && !screen}
    >
      {compactHeader}
      <header className="detail-context-screen-header" hidden={!screen}>
        {backAction}
        <h1 ref={heading} tabIndex={-1}>
          {screenTitle}
        </h1>
      </header>
      <div className={`detail-context-content ${contentClassName}`}>
        {children}
      </div>
    </aside>
  );
}
