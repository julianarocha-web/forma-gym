import { mkdir, writeFile } from "node:fs/promises";
// Licensed Pexels photographs; movement and framing are checked before use.
const photos = {
  squat: 4853693,
  press: 6539793,
  romanian: 7674497,
  bench: 3837743,
  pulldown: 12203215,
  hip: 13122465,
  shoulder: 7289370,
  biceps: 7289304,
  abduction: 6539849,
  crunch: 3930989,
  sumo: 7746282,
  kick: 6303435,
  triceps: 29218854,
};
await mkdir("public/images/exercises", { recursive: true });
await Promise.all(
  Object.entries(photos).map(async ([name, id]) => {
    const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1000&fm=webp&q=82`;
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`${name}: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.toString("ascii", 8, 12) !== "WEBP")
      throw new Error(`${name}: not WebP`);
    await writeFile(`public/images/exercises/${name}.webp`, bytes);
    console.log(`${name}: ${bytes.length}`);
  }),
);
const row = await fetch(
  "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Barbell_row.jpg/960px-Barbell_row.jpg",
  { signal: AbortSignal.timeout(30000) },
);
if (!row.ok) throw new Error(`row: ${row.status}`);
await writeFile(
  "public/images/exercises/row.jpg",
  Buffer.from(await row.arrayBuffer()),
);
const curl = await fetch(
  "https://upload.wikimedia.org/wikipedia/commons/c/c6/LyingLegCurlMachineExercise.JPG",
  { signal: AbortSignal.timeout(30000) },
);
if (!curl.ok) throw new Error(`curl: ${curl.status}`);
await writeFile(
  "public/images/exercises/curl.jpg",
  Buffer.from(await curl.arrayBuffer()),
);
const frames = {
  extension:
    "https://images.pexels.com/videos/32709558/4k-academy-attention-body-building-32709558.jpeg",
  bulgarian: "https://images.unsplash.com/photo-1609899517237-77d357b047cf",
};
await Promise.all(
  Object.entries(frames).map(async ([name, url]) => {
    const response = await fetch(`${url}?auto=compress&w=1000&fm=webp&q=82`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`${name}: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.toString("ascii", 8, 12) !== "WEBP")
      throw new Error(`${name}: not WebP`);
    await writeFile(`public/images/exercises/${name}.webp`, bytes);
    console.log(`${name}: ${bytes.length}`);
  }),
);
// Then run prepare-video-photos.mjs for the selected fly, Smith and seated curl frames.
