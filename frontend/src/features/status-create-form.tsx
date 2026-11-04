import { useLocale, t as tr } from "@/i18n";

import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useApi } from "@/api/context";
import type { Board } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Failure } from "@/components/shared";
import "./status-create-form.css";

export function StatusCreateForm({ board }: { board: Board }) {
  useLocale();
  const api = useApi(),
    client = useQueryClient();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [done, setDone] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const submitting = useRef(false);
  const intent = useRef<{ body: string; key: string } | null>(null);
  const create = useMutation({
    mutationFn: () => {
      const body = JSON.stringify({ name, isDone: done });
      if (intent.current?.body !== body)
        intent.current = { body, key: crypto.randomUUID() };
      return api.createStatus(
        board.id,
        { name, isDone: done },
        intent.current.key,
      );
    },
    onSuccess: () => {
      intent.current = null;
      setName("");
      setDone(false);
      restoreFocus.current = true;
      setOpen(false);
      return client.invalidateQueries();
    },
    onSettled: () => {
      submitting.current = false;
    },
  });
  useEffect(() => {
    if (open) input.current?.focus();
    else if (restoreFocus.current && !create.isPending) {
      trigger.current?.focus();
      restoreFocus.current = false;
    }
  }, [open, create.isPending]);
  function cancel() {
    if (submitting.current) return;
    setName("");
    setDone(false);
    create.reset();
    // Keep the uncertain intent until a successful response, even across reopening.
    restoreFocus.current = true;
    setOpen(false);
  }
  const disabled = !!board.archivedAt || create.isPending;
  return open ? (
    <form
      id={id}
      className="status-create-form"
      aria-busy={create.isPending}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          cancel();
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (
          submitting.current ||
          disabled ||
          !event.currentTarget.reportValidity()
        )
          return;
        submitting.current = true;
        create.mutate();
      }}
    >
      <div className="status-create-row">
        <Field>
          <FieldLabel htmlFor={`${id}-name`}>
            {tr("boards.newStatus")}
          </FieldLabel>
          <Input
            ref={input}
            id={`${id}-name`}
            required
            maxLength={200}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={disabled}
          />
        </Field>
        <div className="status-create-actions">
          <Button type="submit" variant="outline" disabled={disabled}>
            {tr("boards.save")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={create.isPending}
            onClick={cancel}
          >
            {tr("boards.cancel")}
          </Button>
        </div>
      </div>
      <div>
        <Field orientation="horizontal">
          <Switch
            id={`${id}-done`}
            aria-describedby={`${id}-help`}
            checked={done}
            onCheckedChange={setDone}
            disabled={disabled}
          />
          <FieldLabel htmlFor={`${id}-done`}>
            {tr("boards.countsAsCompleted")}
          </FieldLabel>
        </Field>
        <FieldDescription id={`${id}-help`}>
          {tr("boards.tasksInThisStatusAreConsideredCompleted")}
        </FieldDescription>
      </div>
      {create.error && <Failure error={create.error} />}
    </form>
  ) : (
    <Button
      ref={trigger}
      type="button"
      variant="outline"
      aria-expanded={false}
      disabled={disabled}
      onClick={() => {
        create.reset();
        setOpen(true);
      }}
    >
      <Plus data-icon="inline-start" />
      {tr("boards.addStatus")}
    </Button>
  );
}
