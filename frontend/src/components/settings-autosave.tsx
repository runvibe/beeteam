import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { Button } from "./ui/button";
import { Failure } from "./shared";

type Entity = { id: string; version: number; archivedAt?: string | null };
type Snapshot<D> = {
  draft: D;
  baseline: D;
  version: number;
  pending: boolean;
  error: unknown;
  saved: boolean;
};
type Session<D> = {
  state: Snapshot<D>;
  listeners: Set<() => void>;
  queued: D | null;
  write: (draft: D, version: number) => Promise<{ value: D; version: number }>;
  notify: () => void;
  request: () => void;
};
// Keep failed or in-flight drafts when a configuration panel closes. Each API
// instance owns its sessions, so demo/test data never leaks into another backend.
const sessions = new WeakMap<object, Map<string, unknown>>();
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

function createSession<D>(draft: D, version: number): Session<D> {
  const session: Session<D> = {
    state: {
      draft,
      baseline: draft,
      version,
      pending: false,
      error: null,
      saved: false,
    },
    listeners: new Set(),
    queued: null,
    write: async () => {
      throw new Error("Autosave unavailable");
    },
    notify() {
      session.listeners.forEach((listener) => listener());
    },
    request() {
      session.queued = session.state.draft;
      if (!session.state.pending) void drain();
    },
  };
  async function drain() {
    while (session.queued !== null) {
      const next = session.queued;
      session.queued = null;
      if (equal(next, session.state.baseline)) return;
      const version = session.state.version;
      session.state = {
        ...session.state,
        pending: true,
        error: null,
        saved: false,
      };
      session.notify();
      try {
        const saved = await session.write(next, version);
        session.state = {
          ...session.state,
          draft: equal(session.state.draft, next)
            ? saved.value
            : session.state.draft,
          baseline: saved.value,
          version: saved.version,
          pending: false,
          saved: true,
        };
        session.notify();
      } catch (error) {
        // Preserve the latest draft and stop. Retrying is an explicit action,
        // including after a version conflict; never overwrite using a newer ETag.
        session.queued = null;
        session.state = {
          ...session.state,
          pending: false,
          error,
          saved: false,
        };
        session.notify();
        return;
      }
    }
  }
  return session;
}

export function useSettingsAutosave<E extends Entity, D extends object>({
  resource,
  latest,
  values,
  save,
  load,
}: {
  resource: string;
  latest: E;
  values: (entity: E) => D;
  save: (draft: D, version: number) => Promise<E>;
  load?: () => Promise<E>;
}) {
  const api = useApi(),
    client = useQueryClient();
  const form = useRef<HTMLFormElement>(null);
  const key = `${resource}:${latest.id}`;
  let owner = sessions.get(api);
  if (!owner) {
    owner = new Map();
    sessions.set(api, owner);
  }
  const instance = useRef<Session<D> | null>(null);
  if (!instance.current) {
    const previous = owner.get(key) as Session<D> | undefined;
    if (
      !previous ||
      (!previous.state.pending &&
        !previous.state.error &&
        equal(previous.state.draft, previous.state.baseline))
    )
      owner.set(key, createSession(values(latest), latest.version));
    instance.current = owner.get(key) as Session<D>;
  }
  const session = instance.current;
  const state = useSyncExternalStore(
    (listener) => {
      session.listeners.add(listener);
      return () => {
        session.listeners.delete(listener);
      };
    },
    () => session.state,
  );
  session.write = async (draft, version) => {
    const saved = await save(draft, version);
    client.setQueryData([resource, latest.id], saved);
    void client.invalidateQueries();
    return { value: values(saved), version: saved.version };
  };
  // Independent writes (for example status reordering) may advance the version
  // without changing these fields. Remote metadata edits must still conflict.
  useLayoutEffect(() => {
    if (
      !session.state.pending &&
      latest.version > session.state.version &&
      equal(values(latest), session.state.baseline)
    ) {
      session.state = { ...session.state, version: latest.version };
      session.notify();
    }
  });
  const request = () => {
    if (!latest.archivedAt && (!form.current || form.current.reportValidity()))
      session.request();
  };
  const requestRef = useRef(request);
  requestRef.current = request;
  const reset = (entity: E) => {
    session.state = {
      draft: values(entity),
      baseline: values(entity),
      version: entity.version,
      pending: false,
      error: null,
      saved: false,
    };
    session.queued = null;
    session.notify();
  };
  useLayoutEffect(() => {
    const node = form.current;
    return () => {
      // React does not always dispatch blur when a focused element is removed.
      if (node?.contains(document.activeElement) && node.reportValidity())
        requestRef.current();
    };
  }, []);
  return {
    ...state,
    dirty: !equal(state.draft, state.baseline),
    request,
    reload: load
      ? async () => {
          if (session.state.pending) return;
          try {
            reset(await load());
          } catch (error) {
            session.state = { ...session.state, error };
            session.notify();
          }
        }
      : undefined,
    change<K extends keyof D>(field: K, value: D[K], immediate = false) {
      session.state = {
        ...session.state,
        draft: { ...session.state.draft, [field]: value },
        saved: false,
      };
      session.notify();
      if (immediate) request();
    },
    reset,
    formProps: {
      ref: form,
      onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        request();
      },
      onBlur(event: React.FocusEvent<HTMLFormElement>) {
        if (
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement
        )
          request();
      },
      onKeyDownCapture(event: React.KeyboardEvent<HTMLFormElement>) {
        if (event.key === "Escape" && event.target instanceof HTMLElement)
          event.target.blur();
      },
    },
  };
}

export function AutosaveFeedback({
  state,
}: {
  state: {
    error: unknown;
    request: () => void;
    reload?: () => Promise<void>;
  };
}) {
  if (!state.error) return null;
  return (
    <>
      {state.error && (
        <>
          <Failure error={state.error} />
          <Button type="button" variant="outline" onClick={state.request}>
            Tentar salvar novamente
          </Button>
          {state.reload && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void state.reload?.()}
            >
              Recarregar formulário
            </Button>
          )}
        </>
      )}
    </>
  );
}
