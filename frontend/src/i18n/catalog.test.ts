import { describe, expect, it } from "vitest";
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
import { resources } from "./resources";
import {
  auditFrontend,
  auditSource,
  frontendRoot,
  sourceFiles,
} from "../../scripts/i18n-audit.mjs";
function flatten(value: object, prefix = ""): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) =>
      typeof item === "string"
        ? [[prefix + key, item]]
        : Object.entries(flatten(item, prefix + key + ".")),
    ),
  );
}
const en = flatten(resources.en.translation),
  pt = flatten(resources.pt.translation);
const placeholders = (value: string) =>
  [...value.matchAll(/{{\s*([^},\s]+)(?:[^}]*)}}/g)]
    .map((match) => match[1])
    .sort();
it("keeps complete key, interpolation and plural parity", () => {
  expect(Object.keys(pt).sort()).toEqual(Object.keys(en).sort());
  expect(Object.keys(en).length).toBeGreaterThan(800);
  for (const key of Object.keys(en)) {
    expect(en[key].trim(), key).not.toBe("");
    expect(pt[key].trim(), key).not.toBe("");
    expect(placeholders(pt[key]), key).toEqual(placeholders(en[key]));
    if (key.endsWith("_one")) {
      for (const suffix of ["zero", "other", "many"])
        expect(en[key.replace(/_one$/, "_" + suffix)], key).toBeDefined();
    }
  }
});
it("resolves every static translation/message reference to a catalog entry", () => {
  const missing: string[] = [];
  for (const file of sourceFiles()) {
    if (/\.test\.|generated|[\\/]test[\\/]/.test(file)) continue;
    const sf = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node: ts.Node) {
      if (
        ts.isCallExpression(node) &&
        ["tr", "t", "message"].includes(node.expression.getText(sf))
      ) {
        const key = node.arguments[0];
        if (
          key &&
          ts.isStringLiteral(key) &&
          !(key.text in en) &&
          !(key.text + "_other" in en)
        )
          missing.push(file + ": " + key.text);
      }
      ts.forEachChild(node, visit);
    }
    visit(sf);
  }
  expect(missing).toEqual([]);
});
it("has no unconverted production UI or stale/broad audit exceptions", () => {
  const result = auditFrontend();
  expect(result.files).toBeGreaterThan(150);
  expect(result.unresolved).toEqual([]);
  expect(result.stale).toEqual([]);
  for (const exception of result.exceptions) {
    expect(exception.file).not.toContain("*");
    expect(exception.text.length).toBeGreaterThan(0);
    expect(exception.reason.length).toBeGreaterThan(15);
  }
});
describe("hardcoded UI AST guard", () => {
  it.each([
    "<p>Hello world</p>",
    '<button aria-label="save" />',
    '<Input placeholder="search" />',
    'function Helper({label = "Unnamed"}) {}',
    'const labels = { open: "open" };',
    'const state = { label: "pending" };',
    '<div>{done ? "done" : "pending"}</div>',
    "<p>{`Hello ${name}`}</p>",
    'throw new Error("Request failed");',
  ])("detects ordinary UI: %s", (source) =>
    expect(auditSource(source)).not.toEqual([]),
  );
  it("allows translated text, user content and technical syntax", () => {
    expect(
      auditSource(
        'import { t } from "@/i18n"; const x = <button aria-label={t("common.save")} className="flex gap-2">{task.title}</button>;',
      ),
    ).toEqual([]);
    expect(
      auditSource(
        'type State = "open"; const match = state === "open"; const x = <p>{row.name}</p>;',
      ),
    ).toEqual([]);
  });
});
it("keeps every production source and catalog below the file-size limit", () => {
  const files = [
    ...sourceFiles(),
    ...fs
      .readdirSync(path.join(frontendRoot, "src/i18n/catalogs"))
      .map((file: string) =>
        path.join(frontendRoot, "src/i18n/catalogs", file),
      ),
  ].filter((file) => !/generated|\.test\./.test(file));
  expect(
    files.filter(
      (file) => fs.readFileSync(file, "utf8").split("\n").length >= 1000,
    ),
  ).toEqual([]);
});
