import {
  createContext,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/i18n";
import {
  VoiceSessionOwner,
  type ManagedVoiceProps,
} from "./voice-session-owner";
import { VoiceAvatar } from "./voice-avatar";
import { DetachedVoice, VoiceErrorNotice } from "./detached-voice";
import type { VoicePosition } from "./use-voice-drag";
import "./voice-hexagon.css";
export { voiceHistory } from "./voice-history";
export type ManagedVoiceControl = {
  active: boolean;
  starting?: boolean;
  canStart: boolean;
  start: () => void;
  stop: () => void;
  adoptConversation?: (id: string) => void;
};
const VoiceContext = createContext<VoiceSessionOwner | null>(null);

/** Mount once above navigation, never inside a keyed chat subtree. */
export function ManagedVoiceProvider({ children }: { children: ReactNode }) {
  const [owner] = useState(() => new VoiceSessionOwner());
  useEffect(() => () => owner.dispose(), [owner]);
  return (
    <VoiceContext.Provider value={owner}>
      {children}
      <VoicePresentation owner={owner} />
    </VoiceContext.Provider>
  );
}
function VoicePresentation({ owner }: { owner: VoiceSessionOwner }) {
  useLocale();
  const [position, setPosition] = useState<VoicePosition | null>(null);
  const snapshot = useSyncExternalStore(
    owner.subscribe,
    owner.snapshot,
    owner.snapshot,
  );
  if (snapshot.state === "idle" && !snapshot.error) return null;
  const avatar = snapshot.state !== "idle" && (
    <VoiceAvatar owner={owner} snapshot={snapshot} />
  );
  if (snapshot.inlineTarget)
    return createPortal(
      <>
        {avatar}
        <VoiceErrorNotice owner={owner} snapshot={snapshot} />
      </>,
      snapshot.inlineTarget,
    );
  return (
    <>
      {snapshot.state !== "idle" && (
        <DetachedVoice
          owner={owner}
          snapshot={snapshot}
          position={position}
          onPositionChange={setPosition}
        />
      )}
      <VoiceErrorNotice owner={owner} snapshot={snapshot} detached />
    </>
  );
}
type Props = ManagedVoiceProps & {
  controlRef?: Ref<ManagedVoiceControl>;
  children: (control: ManagedVoiceControl) => ReactNode;
};
export function ManagedVoiceChat(props: Props) {
  const owner = useContext(VoiceContext);
  // Isolated embeds still get an owner; the application supplies its persistent owner.
  if (!owner)
    return (
      <ManagedVoiceProvider>
        <ManagedVoiceChat {...props} />
      </ManagedVoiceProvider>
    );
  return <VoiceView {...props} owner={owner} />;
}
function VoiceView({ owner, ...props }: Props & { owner: VoiceSessionOwner }) {
  const anchor = useRef<HTMLDivElement>(null);
  const snapshot = useSyncExternalStore(
    owner.subscribe,
    owner.snapshot,
    owner.snapshot,
  );
  useLayoutEffect(() => {
    owner.updateView(props, anchor.current);
  });
  useLayoutEffect(() => () => owner.updateView(null), [owner]);
  const matching = owner.matches(props);
  const control: ManagedVoiceControl = {
    active: matching && snapshot.state !== "idle",
    starting: matching && snapshot.state === "connecting",
    canStart: !props.disabled && !props.readOnly,
    start: () => owner.start(props),
    stop: () => {
      if (matching) owner.stop();
    },
    adoptConversation: (id) => {
      if (matching) owner.adoptConversation(id);
    },
  };
  useImperativeHandle(props.controlRef, () => control);
  return (
    <div className="managed-voice-chat" data-call-active={control.active}>
      <div ref={anchor} className="voice-inline-anchor" />
      {props.children(control)}
    </div>
  );
}
