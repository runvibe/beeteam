import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
export const frontendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const visibleAttributes = new Set([
  "aria-label",
  "aria-description",
  "aria-valuetext",
  "aria-roledescription",
  "alt",
  "title",
  "placeholder",
  "label",
  "description",
  "all",
  "emptyMessage",
  "emptyLabel",
  "detailsLabel",
]);
const textProperties = new Set([
  "label",
  "title",
  "description",
  "message",
  "emptyMessage",
  "emptyLabel",
]);
function parentAttribute(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isJsxAttribute(p)) return p.name.getText();
    if (ts.isJsxElement(p) || ts.isJsxSelfClosingElement(p)) break;
  }
}
function styleLiteral(node) {
  const attr = parentAttribute(node);
  if (
    attr === "className" ||
    attr === "style" ||
    attr === "d" ||
    attr === "viewBox"
  )
    return true;
  for (let p = node.parent; p; p = p.parent) {
    if (
      ts.isCallExpression(p) &&
      ["cn", "cva", "clsx"].includes(p.expression.getText())
    )
      return true;
    if (ts.isStatement(p)) break;
  }
  return false;
}
function displayedValue(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (
      ts.isBinaryExpression(p) &&
      [
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
        ts.SyntaxKind.EqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsToken,
        ts.SyntaxKind.InKeyword,
        ts.SyntaxKind.InstanceOfKeyword,
      ].includes(p.operatorToken.kind)
    )
      return false;
    if (ts.isPropertyAssignment(p) && p.name === node) return false;
    if (ts.isFunctionLike(p) || ts.isCallExpression(p)) return false;
    if (ts.isJsxAttribute(p)) return visibleAttributes.has(p.name.getText());
    if (ts.isJsxExpression(p))
      return ts.isJsxElement(p.parent) || ts.isJsxFragment(p.parent);
  }
  return false;
}
function labelContainer(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isFunctionLike(p)) return false;
    if (ts.isVariableDeclaration(p)) {
      if (
        !/(labels|names|sections|symbols|categories)$/i.test(p.name.getText())
      )
        return false;
      if (ts.isPropertyAssignment(node.parent) && node.parent.name === node)
        return false;
      if (
        ts.isArrayLiteralExpression(node.parent) &&
        node.parent.elements.length === 2 &&
        node.parent.elements[0] === node
      )
        return false;
      return true;
    }
  }
  return false;
}
function isHumanText(value) {
  return (
    /[À-ž]/u.test(value) ||
    /^[A-Z][a-z]+$/.test(value) ||
    /\p{L}+ +\p{L}+/u.test(value)
  );
}
/** Conservative AST guard: JSX, accessible attributes, helper/default literals and template fragments. */
export function auditSource(source, filename = "example.tsx") {
  const sf = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    filename.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const findings = [];
  function report(node, text, kind) {
    if (!/\p{L}/u.test(text)) return;
    findings.push({
      file: filename.replaceAll("\\", "/"),
      line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
      text,
      kind,
    });
  }
  function visit(node) {
    if (ts.isJsxText(node)) {
      const text = node.text.replace(/\s+/g, " ").trim();
      if (text) report(node, text, "jsx");
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const p = node.parent,
        text = node.text;
      if (
        ts.isCallExpression(p) &&
        p.arguments[0] === node &&
        ["tr", "t", "message"].includes(p.expression.getText())
      )
        return;
      const syntax =
        ts.isImportDeclaration(p) ||
        ts.isExportDeclaration(p) ||
        ts.isLiteralTypeNode(p) ||
        ts.isImportSpecifier(p);
      if (!syntax && !styleLiteral(node)) {
        const attr = parentAttribute(node);
        const prop = ts.isPropertyAssignment(p)
          ? p.name.getText(sf).replaceAll('"', "").replaceAll("'", "")
          : "";
        if (
          (ts.isJsxAttribute(p) && visibleAttributes.has(p.name.getText())) ||
          (textProperties.has(prop) && p.initializer === node) ||
          isHumanText(text) ||
          displayedValue(node) ||
          labelContainer(node)
        )
          report(node, text, attr ? "attribute" : "literal");
      }
    }
    if (ts.isTemplateExpression(node) && !styleLiteral(node)) {
      let text = node.head.text;
      node.templateSpans.forEach((span, index) => {
        text += `{{value${index + 1}}}` + span.literal.text;
      });
      const attr = parentAttribute(node);
      if (
        isHumanText(text) ||
        (displayedValue(node) &&
          /\p{L}/u.test(
            node.head.text +
              node.templateSpans.map((span) => span.literal.text).join(""),
          )) ||
        (attr &&
          visibleAttributes.has(attr) &&
          /\p{L}/u.test(text.replace(/\{\{value\d+\}\}/g, "")))
      )
        report(node, text, "template");
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return findings;
}
export function sourceFiles(directory = path.join(frontendRoot, "src")) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(target)
      : /\.tsx?$/.test(target)
        ? [target]
        : [];
  });
}
export function auditFrontend() {
  const exceptions = JSON.parse(
    fs.readFileSync(
      path.join(frontendRoot, "scripts/i18n-exceptions.json"),
      "utf8",
    ),
  );
  const candidates = sourceFiles().filter(
    (file) =>
      !/(\.test\.|[\\/]test[\\/]|[\\/]generated[\\/]|[\\/]execution-fixtures\.ts$|[\\/]seed\.ts$)/.test(
        file,
      ),
  );
  const findings = candidates.flatMap((file) =>
    auditSource(
      fs.readFileSync(file, "utf8"),
      path.relative(frontendRoot, file),
    ),
  );
  const unresolved = findings.filter(
    (finding) =>
      !exceptions.some(
        (exception) =>
          exception.file === finding.file &&
          exception.text === finding.text &&
          exception.reason.length > 15,
      ),
  );
  const stale = exceptions.filter(
    (exception) =>
      !findings.some(
        (finding) =>
          finding.file === exception.file && finding.text === exception.text,
      ),
  );
  return { files: candidates.length, findings, unresolved, stale, exceptions };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = auditFrontend();
  console.log(
    JSON.stringify(
      {
        files: result.files,
        unresolved: result.unresolved,
        stale: result.stale,
      },
      null,
      2,
    ),
  );
  if (result.unresolved.length || result.stale.length) process.exitCode = 1;
}
