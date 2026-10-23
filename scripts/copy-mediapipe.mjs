// Copies MediaPipe's WASM runtime into public/ so the quality gate loads same-origin (and version-matched).
import fs from "node:fs";

const src = "node_modules/@mediapipe/tasks-vision/wasm";
const dst = "public/mediapipe/wasm";
if (fs.existsSync(src)) {
  fs.mkdirSync(dst, { recursive: true });
  fs.cpSync(src, dst, { recursive: true });
  console.log("mediapipe wasm copied to", dst);
}
if (!fs.existsSync("public/mediapipe/blaze_face_short_range.tflite")) {
  console.warn(
    "Missing public/mediapipe/blaze_face_short_range.tflite.\nDownload: https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
  );
}
