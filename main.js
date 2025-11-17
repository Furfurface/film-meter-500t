// 简易版 Film Meter 500T 测光逻辑

const video = document.getElementById("video");
const canvas = document.getElementById("hidden-canvas");
const tapLayer = document.getElementById("tap-layer");
const marker = document.getElementById("marker");

const statusEl = document.getElementById("status");
const evInfoEl = document.getElementById("ev-info");
const stopInfoEl = document.getElementById("stop-info");
const noteEl = document.getElementById("note");

const setGrayBtn = document.getElementById("set-gray");
const measureBtn = document.getElementById("measure");

let lastTapX = null;
let lastTapY = null;
let midGrayValue = null; // 0〜255 の中間グレー参照値

// カメラ起動
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment" // スマホなら背面カメラ
      },
      audio: false
    });
    video.srcObject = stream;
    statusEl.textContent = "画面をタップして測光ポイントを選んでください。";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "カメラにアクセスできません。ブラウザの設定を確認してください。";
  }
}

startCamera();

// タップ位置を記録してマーカー表示
function setTapPosition(clientX, clientY) {
  const rect = tapLayer.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  lastTapX = x;
  lastTapY = y;

  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  marker.style.display = "block";
}

// タップイベント（PCクリック＋スマホタップ両対応）
tapLayer.addEventListener("click", (e) => {
  setTapPosition(e.clientX, e.clientY);
});

tapLayer.addEventListener("touchend", (e) => {
  const touch = e.changedTouches[0];
  setTapPosition(touch.clientX, touch.clientY);
});

// 指定位置周辺の平均輝度を計算
function sampleLuma() {
  if (!video.videoWidth || !video.videoHeight) {
    statusEl.textContent = "ビデオがまだ準備できていません。もう一度試してください。";
    return null;
  }
  if (lastTapX === null || lastTapY === null) {
    statusEl.textContent = "先に画面をタップしてポイントを選択してください。";
    return null;
  }

  const vw = video.videoWidth;
  const vh = video.videoHeight;

  // video 要素と tapLayer のサイズ比で座標変換
  const rect = tapLayer.getBoundingClientRect();
  const normX = lastTapX / rect.width;
  const normY = lastTapY / rect.height;

  const px = Math.floor(normX * vw);
  const py = Math.floor(normY * vh);

  const ctx = canvas.getContext("2d");
  canvas.width = vw;
  canvas.height = vh;
  ctx.drawImage(video, 0, 0, vw, vh);

  const size = 20; // 20x20 ピクセルを平均
  const half = Math.floor(size / 2);
  const sx = Math.max(0, px - half);
  const sy = Math.max(0, py - half);
  const sw = Math.min(size, vw - sx);
  const sh = Math.min(size, vh - sy);

  const imgData = ctx.getImageData(sx, sy, sw, sh);
  const data = imgData.data;

  let sum = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Rec.709 の輝度係数で Y を計算
    const yVal = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sum += yVal;
    count++;
  }

  const avg = sum / count; // 0〜255
  return avg;
}

// この点を中間グレーに設定
setGrayBtn.addEventListener("click", () => {
  const avg = sampleLuma();
  if (avg == null) return;

  midGrayValue = avg;
  evInfoEl.textContent = `サンプル輝度：${avg.toFixed(1)} / 中間グレー：${midGrayValue.toFixed(1)}`;
  stopInfoEl.textContent = "相対露出：0.0 stop（ここを基準とします）";
  noteEl.textContent = "顔やグレーのカードをタップして「中間グレー」に設定すると、その後の測光結果が分かりやすくなります。";
});

// 測光
measureBtn.addEventListener("click", () => {
  const avg = sampleLuma();
  if (avg == null) return;

  if (midGrayValue == null) {
    // まだ基準がない場合、とりあえず 128 を中間グレーと仮定
    midGrayValue = 128;
  }

  const ratio = avg / midGrayValue;
  const stops = Math.log2(ratio);

  evInfoEl.textContent = `サンプル輝度：${avg.toFixed(1)} / 中間グレー：${midGrayValue.toFixed(1)}`;
  stopInfoEl.textContent = `相対露出：${stops.toFixed(2)} stop`;

  // 簡単なコメント
  if (stops > 2) {
    noteEl.textContent = "かなり明るい領域です（ハイライト側）。500T ならハイライト肩に近いイメージ。";
  } else if (stops > 1) {
    noteEl.textContent = "中間調より明るめの領域です。顔なら「明るめハイキー」寄り。";
  } else if (stops > -1) {
    noteEl.textContent = "中間調付近の領域です。肌の基準にはこのあたりが目安になります。";
  } else if (stops > -2) {
    noteEl.textContent = "やや暗めの領域です。シャドー側ですがまだ情報は残っています。";
  } else {
    noteEl.textContent = "かなり暗い領域です。フィルムならディテールはだいぶ落ちてくるゾーン。";
  }
});
