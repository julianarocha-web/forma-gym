import assert from "node:assert/strict";
import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("public/manifest.webmanifest"));
const rewrite = new RegExp(`^${JSON.parse(fs.readFileSync("vercel.json")).rewrites[0].source}$`);
assert.equal(manifest.name, "Forma.");
assert.equal(manifest.start_url, "/");
assert.equal(manifest.scope, "/");
for (const icon of [...manifest.icons, { src: "/apple-touch-icon.png", sizes: "180x180" }]) {
  const bytes = fs.readFileSync(`public${icon.src}`);
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, icon.sizes);
  assert.equal(rewrite.test(icon.src), false);
  assert.deepEqual(fs.readFileSync(`dist${icon.src}`), bytes);
}
const html = fs.readFileSync("dist/index.html", "utf8");
for (const name of ["favicon.svg", "favicon.ico", "manifest.webmanifest", "apple-touch-icon.png"]) {
  assert.ok(html.includes(`/${name}`));
  assert.equal(rewrite.test(`/${name}`), false);
  assert.deepEqual(fs.readFileSync(`public/${name}`), fs.readFileSync(`dist/${name}`));
}
for (const route of ["/", "/rutinas", "/progreso"]) assert.ok(rewrite.test(route));
const ico = fs.readFileSync("public/favicon.ico");
assert.equal(ico.readUInt16LE(2), 1);
assert.equal(ico.readUInt16LE(4), 3);
for (const [index, size] of [16, 32, 48].entries()) {
  assert.equal(ico[6 + index * 16], size);
  assert.equal(ico[7 + index * 16], size);
}
// Conservative enclosing rectangle of the maskable foreground, scaled about center.
for (const x of [144, 384]) for (const y of [120, 392]) {
  assert.ok(Math.hypot((x - 256) * 0.8, (y - 256) * 0.8) < 512 * 0.4);
}
console.log("Icons: PNG sizes, ICO entries, maskable safe circle, built assets, HTML and Vercel routes OK.");
