const $ = id => document.getElementById(id);
const video = $('video'), overlay = $('overlay'), alertEl = $('alert');
const startBtn = $('startBtn'), stopBtn = $('stopBtn'), statsEl = $('stats');
const CLASSES = ['person','bicycle','car','motorcycle','bus','truck','train','dog','cat','horse','chair','bench','suitcase','traffic light','stop sign','fire hydrant'];
const DEFAULTS = {conf:60, size:3, facing:'environment', boxes:true, voice:false, beep:false, vibrate:false,
  hazards:['person','bicycle','car','motorcycle','bus','truck','train','dog','horse']};
let S = load();
let model = null, stream = null, running = false, lastSpoke = 0, fpsT = 0, fpsN = 0;

function load(){
  try { return {...DEFAULTS, ...JSON.parse(localStorage.getItem('safevision') || '{}')}; }
  catch { return {...DEFAULTS}; }
}
function save(){ try { localStorage.setItem('safevision', JSON.stringify(S)); } catch {} }

/* ---------- Navigation ---------- */
function go(name){
  if (name !== 'detect' && running) stop();
  document.querySelectorAll('.view').forEach(v => v.hidden = v.dataset.view !== name);
  document.querySelectorAll('nav button').forEach(b => {
    if (b.dataset.go === name) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
  });
  window.scrollTo(0,0);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-go]');
  if (!b) return;
  go(b.dataset.go);
  if (b.hasAttribute('data-autostart')) start();
});

/* ---------- Settings UI ---------- */
function renderSettings(){
  $('conf').value = S.conf; $('confOut').textContent = S.conf + '%';
  $('size').value = S.size; $('sizeOut').textContent = S.size + '% of frame';
  $('facing').value = S.facing;
  $('showBoxes').checked = $('showBoxes2').checked = S.boxes;
  $('voice').checked = S.voice; $('beep').checked = S.beep; $('vibrate').checked = S.vibrate;
  $('classes').innerHTML = CLASSES.map(c =>
    `<label><input type="checkbox" value="${c}" ${S.hazards.includes(c) ? 'checked' : ''}>${c}</label>`).join('');
}
function bind(id, key, parse = v => v, ev = 'input'){
  $(id).addEventListener(ev, e => {
    S[key] = parse(e.target.type === 'checkbox' ? e.target.checked : e.target.value);
    save(); renderSettings();
  });
}
bind('conf','conf',Number); bind('size','size',Number); bind('facing','facing',v=>v,'change');
bind('showBoxes','boxes',v=>v,'change'); bind('showBoxes2','boxes',v=>v,'change');
bind('voice','voice',v=>v,'change'); bind('beep','beep',v=>v,'change'); bind('vibrate','vibrate',v=>v,'change');
$('classes').addEventListener('change', () => {
  S.hazards = [...$('classes').querySelectorAll('input:checked')].map(i => i.value);
  save();
});
$('reset').addEventListener('click', () => { S = {...DEFAULTS}; save(); renderSettings(); });

/* ---------- Camera & model ---------- */
function showError(msg){ const el = $('error'); el.textContent = msg || ''; el.hidden = !msg; }
function status(msg){ $('idleMsg').textContent = msg; }

async function setupCamera(){
  if (!navigator.mediaDevices?.getUserMedia)
    throw new Error('Camera is unavailable. Open this page over HTTPS or on localhost.');
  stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:S.facing}}, audio:false});
  video.srcObject = stream;
  await new Promise(r => video.onloadedmetadata = r);
  await video.play();
  overlay.width = video.videoWidth; overlay.height = video.videoHeight;
}

async function start(){
  if (running) return;
  showError('');
  startBtn.disabled = true;
  $('idle').hidden = false;
  try {
    status('Waiting for camera permission…');
    await setupCamera();
    if (!model){
      status('Loading detection model…');
      model = await cocoSsd.load();
    }
    $('idle').hidden = true;
    running = true; stopBtn.disabled = false;
    fpsT = performance.now(); fpsN = 0;
    loop();
  } catch (err) {
    stop();
    showError(err.name === 'NotAllowedError'
      ? 'Camera permission was denied. Allow camera access in your browser settings, then press Start camera.'
      : err.message || 'Could not start the camera.');
  }
}

function stop(){
  running = false;
  stream?.getTracks().forEach(t => t.stop()); stream = null;
  video.srcObject = null;
  overlay.getContext('2d').clearRect(0,0,overlay.width,overlay.height);
  alertEl.hidden = true;
  startBtn.disabled = false; stopBtn.disabled = true;
  $('idle').hidden = false; status('Camera is off.');
  statsEl.textContent = 'Ready';
}
startBtn.addEventListener('click', start);
stopBtn.addEventListener('click', stop);

async function loop(){
  if (!running) return;
  const preds = await model.detect(video);
  if (!running) return;
  draw(preds);
  fpsN++;
  const now = performance.now();
  if (now - fpsT > 1000){ statsEl.textContent = `${fpsN} fps · ${preds.length} objects`; fpsN = 0; fpsT = now; }
  requestAnimationFrame(loop);
}

/* ---------- Drawing & alerts ---------- */
function draw(preds){
  const ctx = overlay.getContext('2d'), W = overlay.width, H = overlay.height;
  ctx.clearRect(0,0,W,H);
  ctx.lineWidth = Math.max(2, W/300);
  ctx.textBaseline = 'alphabetic';
  const fs = Math.max(14, W/40); ctx.font = `600 ${fs}px Arial`;
  const hazards = [];
  for (const p of preds){
    const [x,y,w,h] = p.bbox;
    const conf = p.score*100;
    const isHazard = S.hazards.includes(p.class) && conf >= S.conf && (w*h)/(W*H)*100 >= S.size;
    if (isHazard) hazards.push(p);
    if (S.boxes || isHazard){
      const col = isHazard ? '#d7263d' : '#17c37b';
      ctx.strokeStyle = col; ctx.strokeRect(x,y,w,h);
      const label = `${p.class} ${Math.round(conf)}%`;
      const tw = ctx.measureText(label).width + 10;
      ctx.fillStyle = col; ctx.fillRect(x, Math.max(0,y-fs-6), tw, fs+6);
      ctx.fillStyle = '#fff'; ctx.fillText(label, x+5, Math.max(fs, y-6));
    }
    if (isHazard){
      ctx.fillStyle = 'rgba(215,38,61,0.2)'; ctx.fillRect(x,y,w,h);
    }
  }
  if (hazards.length){
    const names = [...new Set(hazards.map(h => h.class))].join(', ');
    alertEl.textContent = `HAZARD AHEAD: ${names}`; alertEl.hidden = false;
    notify(names);
  } else alertEl.hidden = true;
}

let audioCtx;
function notify(names){
  const now = Date.now();
  if (now - lastSpoke < 4000) return;
  lastSpoke = now;
  if (S.voice && 'speechSynthesis' in window){
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(`Hazard ahead. ${names}`));
  }
  if (S.beep){
    try {
      audioCtx ??= new AudioContext();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; g.gain.value = 0.15;
      o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.25);
    } catch {}
  }
  if (S.vibrate && navigator.vibrate) navigator.vibrate([200,100,200]);
}

renderSettings();
go('welcome');
