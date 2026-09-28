const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const showBoxes = document.getElementById('showBoxes');
let model = null;
let stream = null;
let rafId = null;

async function setupCamera(){
  stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}, audio:false});
  video.srcObject = stream;
  return new Promise(resolve => video.onloadedmetadata = resolve);
}

function resizeCanvas(){
  overlay.width = video.videoWidth;
  overlay.height = video.videoHeight;
}

function drawDetections(predictions){
  const ctx = overlay.getContext('2d');
  ctx.clearRect(0,0,overlay.width,overlay.height);
  ctx.font = '16px Arial';
  ctx.lineWidth = 3;

  for(const p of predictions){
    const [x,y,w,h] = p.bbox;
    // Draw box
    if(showBoxes.checked){
      ctx.strokeStyle = 'lime';
      ctx.strokeRect(x,y,w,h);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x, y-22, ctx.measureText(p.class).width+10, 22);
      ctx.fillStyle = 'white';
      ctx.fillText(p.class + ' ' + Math.round(p.score*100)+'%', x+5, y-6);
    }
    // Simple heuristic: if object is large (close) and high score -> predictive alert
    const area = w*h;
    const areaRatio = area/(overlay.width*overlay.height);
    if(p.score>0.6 && areaRatio>0.03){
      // AR-style translucent warning
      ctx.fillStyle = 'rgba(255,0,0,0.18)';
      ctx.fillRect(x-10,y-10,w+20,h+20);
      ctx.fillStyle = 'rgba(255,0,0,0.95)';
      ctx.font = '24px Arial';
      ctx.fillText('!! HAZARD AHEAD !!', x, y - 30);
    }
  }
}

async function detectFrame(){
  if(!model) return;
  const predictions = await model.detect(video);
  drawDetections(predictions);
  rafId = requestAnimationFrame(detectFrame);
}

async function start(){
  startBtn.disabled = true;
  await setupCamera();
  resizeCanvas();
  stopBtn.disabled = false;
  video.play();
  if(!model){
    model = await cocoSsd.load();
  }
  detectFrame();
}

function stop(){
  startBtn.disabled = false;
  stopBtn.disabled = true;
  if(rafId) cancelAnimationFrame(rafId);
  if(stream){
    stream.getTracks().forEach(t => t.stop());
  }
  const ctx = overlay.getContext('2d');
  ctx.clearRect(0,0,overlay.width,overlay.height);
}

startBtn.addEventListener('click', start);
stopBtn.addEventListener('click', stop);
