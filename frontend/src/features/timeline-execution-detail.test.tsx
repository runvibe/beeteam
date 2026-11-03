import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { event, executionPage } from "./execution-fixtures";
import { TimelineExecutionDisclosure } from "./timeline-execution-detail";
it("loads the exact summary event only when expanded", async () => {
 const api = createMockApi({delay: 0});
 const fetch = vi.spyOn(api, "executionTrackingEvents").mockResolvedValue(executionPage([event]));
 render(<ApiProvider api={api}><TimelineExecutionDisclosure taskId="task" summaryId={event.summaryId} /></ApiProvider>);
 expect(fetch).not.toHaveBeenCalled();
 await userEvent.click(screen.getByText("Detalhes da execução"));
 expect(await screen.findByText("Em revisão histórica", {exact: false})).toBeVisible();
 expect(screen.getByText("Troca de tarefa")).toBeVisible();
 expect(screen.getByRole("button", {name: "Ver intervalo"})).toBeVisible();
});
