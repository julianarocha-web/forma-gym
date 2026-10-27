import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import { existsSync } from "node:fs";

// Source videos stay in a project-local, ignored review folder; only photos ship.
const videos = {
  "seated-curl":
    "https://upload.wikimedia.org/wikipedia/commons/1/14/Muscle_Strengthening_at_the_Gym_-_Leg_Curl.webm",
  smith:
    "https://videos.pexels.com/video-files/6892543/6892543-uhd_2160_3840_25fps.mp4",
  fly: "https://videos.pexels.com/video-files/8402113/8402113-hd_1080_1920_30fps.mp4",
};
await mkdir(".asset-review", { recursive: true });
await Promise.all(
  Object.entries(videos).map(async ([id, url]) => {
    if (!existsSync(`.asset-review/${id}.video`)) {
      const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
      if (!response.ok) throw new Error(`${id}: ${response.status}`);
      if (Number(response.headers.get("content-length")) > 100_000_000)
        throw new Error(`${id}: video too large`);
      const bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(`.asset-review/${id}.video`, bytes);
    }
    execFileSync(ffmpeg, [
      "-y",
      "-loglevel",
      "error",
      "-i",
      `.asset-review/${id}.video`,
      "-vf",
      "fps=1/3,scale=240:-1,tile=4x3",
      "-frames:v",
      "1",
      `.asset-review/${id}-review.jpg`,
    ]);
    console.log(`${id}: video downloaded and contact sheet prepared`);
  }),
);
for (const [id, time] of [
  ["seated-curl", "27"],
  ["fly", "4.5"],
  ["smith", "8"],
]) {
  const extension = id === "seated-curl" ? "jpg" : "webp";
  execFileSync(ffmpeg, [
    "-y",
    "-loglevel",
    "error",
    "-ss",
    time,
    "-i",
    `.asset-review/${id}.video`,
    "-frames:v",
    "1",
    ...(extension === "webp"
      ? ["-vf", "scale=900:-2", "-c:v", "libwebp", "-q:v", "82"]
      : ["-q:v", "2"]),
    `public/images/exercises/${id}.${extension}`,
  ]);
  console.log(`${id}: selected frame at ${time}s`);
}
