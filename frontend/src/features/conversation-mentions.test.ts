import { it, expect } from "vitest";
import { mentionToken, selectedRecipients } from "./conversation-mentions";
it("keeps stable recipients only while their selected mention remains in the body", () => {
  const selection = { id: "stable", name: "Worker [A]", slug: "worker-a" };
  const token = mentionToken(selection);
  expect(token).toBe("[@Worker \\[A\\]](/agents/worker-a)");
  expect(selectedRecipients(token, [selection, selection])).toEqual(["stable"]);
  expect(selectedRecipients("Edited text", [selection])).toEqual([]);
});
