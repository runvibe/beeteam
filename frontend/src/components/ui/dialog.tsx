import { useLocale, t as tr } from "@/i18n";

import * as React from "react";
import { cn } from "cn";
import { Dialog as DialogPrimitive } from "radix-ui";

import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { motionCssVariables, motionTiming } from "../motion-presets";
import "./dialog-motion.css";

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  useLocale();
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  useLocale();
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  useLocale();
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  useLocale();
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  useLocale();
  const reduced = useReducedMotion();
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "dialog-motion fixed inset-0 isolate z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs",
        className,
      )}
      {...props}
      asChild
    >
      <motion.div
        style={motionCssVariables}
        initial={{ opacity: reduced ? 1 : 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: reduced ? 0 : motionTiming.enter,
          ease: "easeOut",
        }}
      />
    </DialogPrimitive.Overlay>
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  useLocale();
  const opener = React.useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();
  const panel = className?.includes("detail-dialog");
  return (
    <DialogPortal>
      <DialogOverlay className={panel ? "detail-overlay" : undefined} />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "dialog-motion fixed z-50 grid w-full max-w-[calc(100%-2rem)] gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none sm:max-w-sm",
          !panel && "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
          className,
        )}
        onOpenAutoFocus={(event) => {
          opener.current = document.activeElement as HTMLElement;
          onOpenAutoFocus?.(event);
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (!event.defaultPrevented && opener.current?.isConnected) {
            event.preventDefault();
            opener.current.focus();
          }
        }}
        {...props}
        asChild
      >
        <motion.div
          style={motionCssVariables}
          initial={{ opacity: reduced ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: reduced ? 0 : motionTiming.enter,
            ease: "easeOut",
          }}
        >
          {panel ? <div className="detail-scroll">{children}</div> : children}
          {showCloseButton && (
            <DialogPrimitive.Close data-slot="dialog-close" asChild>
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              >
                <XIcon />
                <span className="sr-only">{tr("common.close")}</span>
              </Button>
            </DialogPrimitive.Close>
          )}
        </motion.div>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  useLocale();
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  useLocale();
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">{tr("common.close")}</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  useLocale();
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  useLocale();
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
