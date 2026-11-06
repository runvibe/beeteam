import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const source = readFileSync(join(publicDir, "icons/bee-logo.svg"), "utf8");
const favicon = source.replace('stroke-width="2.3"', 'stroke-width="3.3"');
const outputs = new Map([["favicon.svg", Buffer.from(favicon)]]);
function png(svg, size) {
  return new Resvg(svg, { fitTo: { mode: "width", value: size }, font: { loadSystemFonts: false } }).render().asPng();
}
for (const size of [16, 32, 48, 96]) outputs.set(`favicon-${size}x${size}.png`, png(favicon, size));
for (const size of [192, 512]) {
  const buffer = png(source, size);
  outputs.set(`icons/bee-${size}.png`, buffer);
  outputs.set(`icons/bee-maskable-${size}.png`, buffer);
}
outputs.set("icons/apple-touch-icon.png", png(source, 180));
// PNG-compressed ICO entries are supported by modern desktop browsers.
const sizes = [16, 32, 48];
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
const frames = sizes.map((size, index) => {
  const frame = outputs.get(`favicon-${size}x${size}.png`);
  const entry = 6 + index * 16;
  header[entry] = size; header[entry + 1] = size;
  header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(frame.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
  return frame;
});
outputs.set("favicon.ico", Buffer.concat([header, ...frames]));
for (const [name, bytes] of outputs) {
  const target = join(publicDir, name);
  if (process.argv.includes("--check")) {
    if (!readFileSync(target).equals(bytes)) throw new Error(`Outdated brand asset: ${name}`);
  } else writeFileSync(target, bytes);
}
console.log(`${outputs.size} brand assets ${process.argv.includes("--check") ? "verified" : "generated"}.`);
