import { createContext, forwardRef, useContext } from "react";
import type { ComponentProps, ReactElement } from "react";
import { ScrollArea } from "radix-ui";

const PanelScrollContext = createContext(false);

/** The rail belongs to the whole panel; only the nested history is a viewport. */
export function ChatPanelScrollArea({ children }: { children: ReactElement }) {
  return (
    <PanelScrollContext.Provider value={true}>
      <ScrollArea.Root asChild type="auto" style={{ position: undefined }}>
        {children}
      </ScrollArea.Root>
    </PanelScrollContext.Provider>
  );
}

export function ChatPanelScrollbar() {
  return (
    <ScrollArea.Scrollbar
      orientation="vertical"
      className="chat-panel-scrollbar"
      style={{
        right: "var(--chat-scrollbar-inset, 0px)",
        top: "var(--chat-scrollbar-end-inset, 0px)",
        bottom: "var(--chat-scrollbar-end-inset, 0px)",
      }}
    >
      <ScrollArea.Thumb className="chat-panel-scroll-thumb" />
    </ScrollArea.Scrollbar>
  );
}

export const ChatHistoryViewport = forwardRef<
  HTMLDivElement,
  ComponentProps<"div">
>(function ChatHistoryViewport({ children, ...props }, ref) {
  const inPanel = useContext(PanelScrollContext);
  if (!inPanel)
    return (
      <div {...props} ref={ref}>
        {children}
      </div>
    );
  return (
    <ScrollArea.Viewport
      {...props}
      ref={ref}
      tabIndex={0}
      disableImplicitContentElement
    >
      <ScrollArea.Content
        className="assistant-thread-content"
        style={{ display: "flex" }}
      >
        {children}
      </ScrollArea.Content>
    </ScrollArea.Viewport>
  );
});
