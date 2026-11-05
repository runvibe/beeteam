import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { resolve, dirname, basename } from "node:path";
import {
  frontendInputs,
  sourceHash,
} from "../frontend/scripts/build-inputs.mjs";
import { compose, siteSources } from "./compose-ui.mjs";
test("composed binary metadata checks source and output hashes for both products", (t) => {
  const root = mkdtempSync(resolve(tmpdir(), "bee-compose-"));
  t.after(() => {
    assert.equal(dirname(root), tmpdir());
    assert.ok(basename(root).startsWith("bee-compose-"));
    rmSync(root, { recursive: true, force: true });
  });
  for (const n of frontendInputs) {
    const path = resolve(root, "frontend", n);
    if (["src", "public", "scripts"].includes(n)) {
      mkdirSync(path, { recursive: true });
      writeFileSync(resolve(path, "f"), n);
    } else writeFileSync(path, n);
  }
  mkdirSync(resolve(root, "docs"));
  writeFileSync(resolve(root, "Cargo.toml"), "version");
  for (const name of ["team-role-icons.json", "mcp-catalog.json"])
    writeFileSync(resolve(root, "docs", name), "{}");
  for (const n of ["app-dist", "site-dist", "site", ".local"])
    mkdirSync(resolve(root, n));
  writeFileSync(resolve(root, "site/package.json"), "{}");
  writeFileSync(resolve(root, "site/.git"), "gitdir: ../.git/modules/site");
  const output = (name, text) => {
    writeFileSync(resolve(root, name, "index.html"), text);
    return [
      {
        path: "index.html",
        sha256: createHash("sha256").update(text).digest("hex"),
      },
    ];
  };
  const appFiles = output("app-dist", "app");
  const siteFiles = output("site-dist", "site");
  writeFileSync(
    resolve(root, "app-dist/.beeteam-build.json"),
    JSON.stringify({
      sourceHash: sourceHash(resolve(root, "frontend")),
      files: appFiles,
      nodeEnv: "production",
      apiMode: "http",
      apiBase: "/api/v1",
    }),
  );
  writeFileSync(
    resolve(root, "site-dist/.beeteam-site-build.json"),
    JSON.stringify({ siteSources: siteSources(root), files: siteFiles }),
  );
  const out = compose(
    root,
    resolve(root, "app-dist"),
    resolve(root, "site-dist"),
    resolve(root, ".local/out"),
  );
  assert.equal(readFileSync(resolve(out, "app/index.html"), "utf8"), "app");
  assert.equal(readFileSync(resolve(out, "index.html"), "utf8"), "site");
  const manifest = JSON.parse(
    readFileSync(resolve(out, ".beeteam-build.json")),
  );
  assert.equal(manifest.files.length, 2);
  assert.equal(manifest.siteSources.length, 1);
  writeFileSync(resolve(root, "site-dist/index.html"), "tampered");
  assert.throws(
    () =>
      compose(
        root,
        resolve(root, "app-dist"),
        resolve(root, "site-dist"),
        resolve(root, ".local/out"),
      ),
    /hash mismatch/,
  );
});
