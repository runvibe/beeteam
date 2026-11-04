import type { ReactNode, Ref } from "react";
export function DetailHeader({
  title,
  titleRef,
  description,
  avatar,
  actions,
  children,
  className = "",
}: {
  title: string;
  titleRef?: Ref<HTMLHeadingElement>;
  description?: ReactNode;
  avatar?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`detail-header ${className}`}>
      {avatar}
      <div className="detail-header-text">
        <h1 ref={titleRef} tabIndex={-1}>
          {title}
        </h1>
        {description}
      </div>
      {actions}
      {children}
    </header>
  );
}
