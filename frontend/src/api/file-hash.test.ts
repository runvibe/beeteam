import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { FileHash } from "./file-hash";
it("matches SHA-256 across padding and chunk boundaries", () => {
  for (const length of [0, 3, 55, 56, 63, 64, 65, 1000, 1048579]) {
    const bytes = new Uint8Array(length).map((_, i) => i % 251);
    const hash = new FileHash();
    for (let i = 0; i < bytes.length; i += 97)
      hash.update(bytes.subarray(i, i + 97));
    expect(hash.digest()).toBe(
      createHash("sha256").update(bytes).digest("hex"),
    );
  }
});
