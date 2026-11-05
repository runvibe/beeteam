import { cpSync, existsSync, mkdirSync, realpathSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { inventory } from "./compose-ui.mjs";
// Stage an editorial publish against an existing promoted artifact, without rebuilding app.
export function stageSiteUpdate(root, previous, siteDist, output) {
  root = realpathSync(root);
  output = resolve(output);
  previous = realpathSync(previous);
  siteDist = realpathSync(siteDist);
  if (!output.startsWith(resolve(root, ".local") + sep) || existsSync(output))
    throw new Error("Use a new output directory within .local");
  inventory(previous);
  inventory(siteDist);
  if (!existsSync(resolve(previous, "app/index.html")))
    throw new Error("Missing promoted app artifact");
  mkdirSync(output, { recursive: true });
  cpSync(siteDist, output, { recursive: true });
  // Previously published immutable chunks remain accessible to already-open documents.
  for (const namespace of ["assets", "site-assets"]) {
    if (existsSync(resolve(previous, namespace)))
      cpSync(resolve(previous, namespace), resolve(output, namespace), {
        recursive: true,
        force: false,
        errorOnExist: false,
      });
  }
  cpSync(resolve(previous, "app"), resolve(output, "app"), { recursive: true });
  for (const file of ["install.json"])
    if (existsSync(resolve(previous, file)))
      cpSync(resolve(previous, file), resolve(output, file));
  return output;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [previous, siteDist, output] = process.argv.slice(2);
  if (!output)
    throw new Error(
      "Usage: node scripts/stage-site-update.mjs <promoted-artifacts> <site-dist> <new-output>",
    );
  console.log(
    stageSiteUpdate(
      fileURLToPath(new URL("..", import.meta.url)),
      previous,
      siteDist,
      output,
    ),
  );
}
