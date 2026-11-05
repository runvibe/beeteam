import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
const publicUrl = new URL("../public/", import.meta.url);
test("manifest icons exist at declared sizes and remain in their own scope", () => {
 const manifest = JSON.parse(readFileSync(new URL("manifest.webmanifest", publicUrl)));
 assert.equal(manifest.scope, '/app/');
 assert.equal(manifest.start_url, '/app/');
 assert.equal(manifest.display, 'standalone');
 for (const icon of manifest.icons) {
  assert.ok(icon.src.startsWith(manifest.scope));
  const bytes = readFileSync(new URL(icon.src.slice(manifest.scope.length), publicUrl));
  assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, icon.sizes);
 }
 const apple = readFileSync(new URL("icons/apple-touch-icon.png", publicUrl));
 assert.equal(apple.readUInt32BE(16), 180);
 const ico = readFileSync(new URL("favicon.ico", publicUrl));
 assert.equal(ico.readUInt16LE(2), 1);
 assert.equal(ico.readUInt16LE(4), 3);
});
test("maskable logo has an opaque background and stays inside its safe circle", () => {
 const svg = readFileSync(new URL("icons/bee-logo.svg", publicUrl));
 const { pixels, width, height } = new Resvg(svg).render();
 for (let y=0; y<height; y++) for (let x=0; x<width; x++) {
  const i=(y*width+x)*4;
  assert.equal(pixels[i+3],255);
  if (Math.hypot(x+0.5-width/2,y+0.5-height/2)>width*0.4)
   assert.equal(pixels[i],24, "Logo escapes maskable safe zone");
 }
});
