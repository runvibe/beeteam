import {
  Children,
  useContext,
  Fragment,
  isValidElement,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { motion, useIsPresent, useReducedMotion } from "motion/react";
import { Popover, Tooltip } from "radix-ui";
import { FilterX } from "lucide-react";
import { Button } from "./ui/button";
import { filterSpring } from "./motion-settings";
import { FilterDirectionContext } from "./filter-context";

// Fragments are common in the search slot; keep each control's stable identity
// instead of animating one large, stretching wrapper around the whole toolbar.
export function movingControls(
  children: ReactNode,
  prefix: string,
  active: boolean,
  reduced: boolean,
) {
  return Children.toArray(children).map((child, index): ReactNode => {
    if (
      isValidElement<{ children?: ReactNode }>(child) &&
      child.type === Fragment
    )
      return movingControls(
        child.props.children,
        `${prefix}-${child.key ?? index}`,
        active,
        reduced,
      );
    return (
      <motion.div
        key={`${prefix}-${isValidElement(child) ? (child.key ?? index) : index}`}
        className="motion-filter-item"
        layout={reduced ? false : "position"}
        transition={{ layout: filterSpring }}
      >
        {child}
      </motion.div>
    );
  });
}

export function ClearFilterMotion({ onClear }: { onClear: () => void }) {
  const present = useIsPresent(),
    reduced = useReducedMotion();
  return (
    <motion.div
      className="motion-filter-item"
      aria-hidden={!present || undefined}
      initial={{ opacity: reduced ? 1 : 0, scale: reduced ? 1 : 0.96 }}
      animate={{
        opacity: 1,
        scale: 1,
        transition: { duration: reduced ? 0 : 0.14, delay: reduced ? 0 : 0.18 },
      }}
      exit={{
        opacity: 0,
        scale: reduced ? 1 : 0.96,
        transition: { duration: reduced ? 0 : 0.1 },
      }}
      style={{ pointerEvents: present ? undefined : "none" }}
    >
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="filter-icon"
            aria-label="Limpar filtros"
            onClick={onClear}
            disabled={!present}
          >
            <FilterX aria-hidden="true" />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="navigation-tooltip" sideOffset={6}>
            Limpar filtros
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </motion.div>
  );
}

export function AnimatedFilterContent({
  children,
  heading,
  trigger,
}: {
  children: ReactNode;
  heading: string;
  trigger: RefObject<HTMLButtonElement | null>;
}) {
  const direction = useContext(FilterDirectionContext);
  const present = useIsPresent(),
    reduced = useReducedMotion();
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!present && content.current?.contains(document.activeElement))
      trigger.current?.focus({ preventScroll: true });
  }, [present, trigger]);
  return (
    <Popover.Content
      forceMount
      asChild
      align={direction === "right" ? "start" : "end"}
      side={direction}
      sideOffset={8}
      collisionPadding={12}
      updatePositionStrategy="always"
      aria-labelledby={heading}
      onCloseAutoFocus={(event) => {
        // A newer popover or an outside click may already own focus by the time
        // this short exit finishes. Never steal it back to an obsolete trigger.
        const focused = document.activeElement;
        if (
          focused &&
          focused !== document.body &&
          focused !== trigger.current &&
          !content.current?.contains(focused)
        )
          event.preventDefault();
      }}
    >
      <motion.div
        ref={content}
        className="filter-popover"
        inert={!present || undefined}
        aria-hidden={!present || undefined}
        initial={{
          opacity: reduced ? 1 : 0,
          y: reduced ? 0 : 4,
          scale: reduced ? 1 : 0.98,
        }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: reduced ? 0 : 0.15, ease: "easeOut" },
        }}
        exit={{
          opacity: 0,
          y: reduced ? 0 : 4,
          scale: reduced ? 1 : 0.98,
          transition: { duration: reduced ? 0 : 0.1 },
        }}
        style={{
          transformOrigin: "var(--radix-popover-content-transform-origin)",
          pointerEvents: present ? undefined : "none",
        }}
      >
        {children}
      </motion.div>
    </Popover.Content>
  );
}
