import React from "react";
import { hydrateRoot } from "react-dom/client";
import { Page } from "../src/Page";
export function onRenderClient(ctx: { urlPathname: string }) {
  hydrateRoot(
    document.getElementById("site-root")!,
    <Page path={ctx.urlPathname} />,
  );
}
