import { mkdir, writeFile } from "node:fs/promises";
const assets = [
  [
    "lower-body",
    "https://images.unsplash.com/photo-1675026918756-3413844ea9e5",
  ],
  ["strength", "https://images.unsplash.com/photo-1603077492579-39ff927823db"],
  ["cycling", "https://images.unsplash.com/photo-1637904215427-42481f0eaefa"],
];
await mkdir("public/images", { recursive: true });
await Promise.all(
  assets.map(async ([name, url]) => {
    const response = await fetch(
      `${url}?auto=format&fit=crop&w=1400&q=80&fm=webp`,
      { signal: AbortSignal.timeout(30000) },
    );
    if (!response.ok) throw new Error(`${name}: ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    await writeFile(`public/images/${name}.webp`, bytes);
    console.log(`${name}: ${bytes.length} bytes`);
  }),
);
