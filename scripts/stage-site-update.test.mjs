import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve, basename, dirname } from "node:path";
import { stageSiteUpdate } from "./stage-site-update.mjs";
test("editorial promotion preserves the app and release manifest and retains prior immutable assets", (t) => {
  const root = mkdtempSync(resolve(tmpdir(), "bee-site-update-"));
  t.after(() => {
    assert.equal(dirname(root), tmpdir());
    assert.ok(basename(root).startsWith("bee-site-update-"));
    rmSync(root, { recursive: true, force: true });
  });
  for (const name of [
    "previous/app/assets",
    "previous/site-assets",
    "site/guide/about",
    ".local",
  ])
    mkdirSync(resolve(root, name), { recursive: true });
  const put = (path, data) => writeFileSync(resolve(root, path), data);
  put("previous/app/index.html", "app version A");
  put("previous/app/assets/hash.js", "old application");
  put("previous/site-assets/old.js", "prior public chunk");
  put("previous/install.json", "released manifest");
  put("site/index.html", "new landing");
  put("site/guide/about/index.html", "new docs");
  put("site/install.json", "unpromoted manifest");
  const out = stageSiteUpdate(
    root,
    resolve(root, "previous"),
    resolve(root, "site"),
    resolve(root, ".local/next"),
  );
  assert.equal(
    readFileSync(resolve(out, "app/index.html"), "utf8"),
    "app version A",
  );
  assert.equal(
    readFileSync(resolve(out, "install.json"), "utf8"),
    "released manifest",
  );
  assert.equal(
    readFileSync(resolve(out, "site-assets/old.js"), "utf8"),
    "prior public chunk",
  );
  assert.equal(
    readFileSync(resolve(out, "guide/about/index.html"), "utf8"),
    "new docs",
  );
});
