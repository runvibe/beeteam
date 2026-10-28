import { readFileSync } from "node:fs";
import { beforeEach, expect, it } from "vitest";
const source = readFileSync("public/theme-init.js", "utf8");
beforeEach(() => {
  document.documentElement.className = "";
});
for (const saved of [null, "system", "light", "dark", "invalid"])
  for (const systemDark of [false, true]) {
    it(`applies pre-render preference ${saved} with system dark=${systemDark}`, () => {
      const target = {
        localStorage: { getItem: () => saved },
        matchMedia: () => ({ matches: systemDark }),
      };
      new Function("window", "document", source)(target, document);
      const expected = saved === "dark" || (saved !== "light" && systemDark);
      expect(document.documentElement.classList.contains("dark")).toBe(
        expected,
      );
      expect(document.documentElement.style.colorScheme).toBe(
        expected ? "dark" : "light",
      );
    });
  }
it("applies system even when storage access throws before app boot", () => {
  const target = {
    get localStorage() {
      throw new Error("denied");
    },
    matchMedia: () => ({ matches: true }),
  };
  expect(() =>
    new Function("window", "document", source)(target, document),
  ).not.toThrow();
  expect(document.documentElement).toHaveClass("dark");
});
it("keeps the blocking script before body and React entry", () => {
  const html = readFileSync("index.html", "utf8");
  expect(html.indexOf("theme-init.js")).toBeLessThan(html.indexOf("<body>"));
  expect(html).toContain('<script src="%BASE_URL%theme-init.js"></script>');
});
