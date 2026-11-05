import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import topics from "../src/topics.json" with { type: "json" };
for (const topic of topics)
  for (const prefix of ["", "pt/"]) {
    const html = readFileSync(
      new URL(
        "../dist/client/" + prefix + "guide/" + topic + "/index.html",
        import.meta.url,
      ),
      "utf8",
    );
    assert.ok(html.includes('<html lang="' + (prefix ? "pt" : "en") + '"'));
    assert.ok(html.includes('rel="canonical"'));
    assert.ok(html.includes('hreflang="en"') && html.includes('hreflang="pt"'));
    assert.ok(
      !html.includes("<!--$!-->"),
      "Article must not be an SSR Suspense fallback",
    );
    if (topic === "first-team") assert.ok(html.includes("$get-a-team-lead"));
    if (topic === "reference/mcp/tools")
      assert.equal((html.match(/id="tool-/g) || []).length, 81);
  }
console.log(
  "All bilingual article HTML, metadata, default instructions and 81 tools verified.",
);
