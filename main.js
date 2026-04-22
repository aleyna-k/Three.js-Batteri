
// ═══════════════════════════════════════════════
//  AUDIO ENGINE
// ═══════════════════════════════════════════════
let audioCtx, masterGain, dryGain, reverbGain, reverbNode, destNode, analyser, vuData;
let reverbEnabled = false;

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.92;

    dryGain = audioCtx.createGain(); dryGain.gain.value = 1;
    reverbGain = audioCtx.createGain(); reverbGain.gain.value = 0;

    dryGain.connect(masterGain);
    reverbGain.connect(masterGain);
    masterGain.connect(audioCtx.destination);

    // Synthetic impulse reverb
    const len = audioCtx.sampleRate * 2.6;
    const buf = audioCtx.createBuffer(2, len, audioCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.0);
    }
    reverbNode = audioCtx.createConvolver();
    reverbNode.buffer = buf;
    reverbNode.connect(reverbGain);

    // Analyser for VU
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    vuData = new Uint8Array(analyser.frequencyBinCount);
    masterGain.connect(analyser);

    // Recording destination
    destNode = audioCtx.createMediaStreamDestination();
    masterGain.connect(destNode);
}

function send(node) {
    node.connect(dryGain);
    node.connect(reverbNode);
}

function osc(freq, type, vol, atk, dec, pitchDrop, pitchAmt, t0 = 0) {
    const t = audioCtx.currentTime + t0;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq + pitchAmt, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(freq, 1), t + pitchDrop);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.exponentialRampToValueAtTime(0.001, t + dec);
    o.connect(g); send(g);
    o.start(t); o.stop(t + dec + 0.05);
}

function noise(vol, atk, dec, lp, hp, t0 = 0) {
    const t = audioCtx.currentTime + t0;
    const len = Math.ceil(audioCtx.sampleRate * (dec + 0.12));
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const lpf = audioCtx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = lp;
    const hpf = audioCtx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = hp;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.exponentialRampToValueAtTime(0.001, t + dec);
    src.connect(lpf); lpf.connect(hpf); hpf.connect(g); send(g);
    src.start(t); src.stop(t + dec + 0.12);
}

const sounds = {
    z: () => { // KICK
        osc(52, 'sine', 1.0, 0.002, 0.55, 0.08, 190);
        osc(105, 'sine', 0.38, 0.001, 0.07, 0.02, 40);
        noise(0.20, 0.001, 0.04, 220, 60);
    },
    s: () => { // SNARE
        osc(188, 'triangle', 0.55, 0.001, 0.14, 0.03, 65);
        osc(225, 'sine', 0.22, 0.001, 0.08, 0.02, 28);
        noise(0.75, 0.001, 0.20, 9000, 700);
        noise(0.28, 0.001, 0.06, 3000, 250);
    },
    q: () => { // HI-HAT
        noise(0.55, 0.001, 0.055, 18000, 7500);
        osc(8500, 'square', 0.07, 0.001, 0.035, 0.005, 0);
    },
    w: () => { // TOM 1
        osc(205, 'sine', 0.88, 0.002, 0.28, 0.06, 90);
        noise(0.10, 0.001, 0.04, 1300, 220);
    },
    e: () => { // TOM 2
        osc(158, 'sine', 0.92, 0.002, 0.33, 0.07, 82);
        noise(0.10, 0.001, 0.04, 950, 160);
    },
    a: () => { // FLOOR TOM
        osc(90, 'sine', 1.0, 0.002, 0.44, 0.09, 105);
        noise(0.12, 0.001, 0.06, 650, 85);
    },
    d: () => { // RIDE
        noise(0.28, 0.001, 1.1, 14500, 4000);
        osc(3500, 'sine', 0.13, 0.001, 0.85, 0.01, 0);
        osc(5200, 'sine', 0.06, 0.001, 0.55, 0.01, 0);
    },
    x: () => { // CRASH
        noise(0.70, 0.001, 1.7, 16000, 3200);
        osc(2300, 'sine', 0.16, 0.001, 1.1, 0.01, 0);
        osc(4100, 'sine', 0.08, 0.001, 0.75, 0.01, 0);
    },
};

function playSound(key) {
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (sounds[key]) sounds[key]();
}

function toggleReverb() {
    reverbEnabled = !reverbEnabled;
    if (audioCtx) {
        reverbGain.gain.setTargetAtTime(reverbEnabled ? 0.40 : 0, audioCtx.currentTime, 0.06);
        dryGain.gain.setTargetAtTime(reverbEnabled ? 0.72 : 1, audioCtx.currentTime, 0.06);
    }
    document.getElementById('btn-reverb').classList.toggle('active', reverbEnabled);
}

// ═══════════════════════════════════════════════
//  RECORDER
// ═══════════════════════════════════════════════
let mediaRecorder = null, recordedChunks = [], isRecording = false;
let recStart = 0, recTimerInt = null, recCount = 0;
const recStore = {}; // id -> { url, label, audio }

function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Pick best supported mimeType
function getBestMime() {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', ''];
    return types.find(t => t === '' || MediaRecorder.isTypeSupported(t)) || '';
}

document.getElementById('rec-btn').addEventListener('click', () => {
    initAudio();
    isRecording ? stopRec() : startRec();
});

function startRec() {
    recordedChunks = [];
    const mime = getBestMime();
    try {
        mediaRecorder = mime
            ? new MediaRecorder(destNode.stream, { mimeType: mime })
            : new MediaRecorder(destNode.stream);
    } catch (e) {
        mediaRecorder = new MediaRecorder(destNode.stream);
    }
    mediaRecorder.ondataavailable = e => { if (e.data && e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = finishRec;
    mediaRecorder.start(50);
    isRecording = true;
    recStart = Date.now();
    document.getElementById('rec-btn').classList.add('recording');
    const tmr = document.getElementById('rec-timer');
    tmr.classList.add('visible');
    recTimerInt = setInterval(() => { tmr.textContent = fmtTime(Date.now() - recStart); }, 250);
}

function stopRec() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
    mediaRecorder.stop();
    isRecording = false;
    clearInterval(recTimerInt);
    document.getElementById('rec-btn').classList.remove('recording');
    document.getElementById('rec-timer').classList.remove('visible');
    document.getElementById('rec-timer').textContent = '0:00';
}

function finishRec() {
    const mimeUsed = mediaRecorder.mimeType || 'audio/webm';
    const blob = new Blob(recordedChunks, { type: mimeUsed });
    const url = URL.createObjectURL(blob);
    recCount++;
    const id = 'rec_' + recCount;
    const dur = fmtTime(Date.now() - recStart);
    const label = `Kayıt ${recCount}`;
    // pre-create Audio element so it's ready to play
    const audioEl = new Audio(url);
    audioEl.preload = 'auto';
    recStore[id] = { url, label, audioEl };

    const list = document.getElementById('rec-list');
    const item = document.createElement('div');
    item.className = 'rec-item';
    item.id = id + '_item';

    const sp = document.createElement('span');
    sp.innerHTML = `● ${label} <span style="color:#ffffff33">${dur}</span>`;

    const btnPlay = document.createElement('button');
    btnPlay.textContent = '▶ OYNAT';
    btnPlay.onclick = () => {
        const r = recStore[id];
        if (!r) return;
        r.audioEl.currentTime = 0;
        r.audioEl.play().catch(() => {
            // fallback: create fresh Audio
            const a2 = new Audio(r.url);
            a2.play();
        });
    };

    const btnDl = document.createElement('button');
    btnDl.textContent = '⬇ İNDİR';
    btnDl.onclick = () => {
        const a = document.createElement('a');
        a.href = recStore[id].url;
        a.download = recStore[id].label.replace(/\s+/g, '_') + '.webm';
        a.click();
    };

    const btnDel = document.createElement('button');
    btnDel.textContent = '✕';
    btnDel.onclick = () => {
        URL.revokeObjectURL(recStore[id].url);
        delete recStore[id];
        item.remove();
    };

    item.append(sp, btnPlay, btnDl, btnDel);
    list.appendChild(item);
}

// ═══════════════════════════════════════════════
//  VU METER
// ═══════════════════════════════════════════════
const vuBar = document.getElementById('vu-bar');
const VU_N = 22;
const vuSegs = [];
for (let i = 0; i < VU_N; i++) {
    const s = document.createElement('div'); s.className = 'vu-seg';
    vuBar.appendChild(s); vuSegs.push(s);
}

function updateVU() {
    if (!analyser) return;
    analyser.getByteFrequencyData(vuData);
    let avg = 0;
    for (let i = 0; i < vuData.length; i++) avg += vuData[i];
    avg /= vuData.length;
    const level = Math.min(1, avg / 75);
    const active = Math.round(level * VU_N);
    vuSegs.forEach((s, i) => {
        if (i < active) {
            const p = i / VU_N;
            s.style.background = p < 0.6 ? '#22dd88' : p < 0.85 ? '#ffaa00' : '#ff3311';
        } else {
            s.style.background = '#ffffff08';
        }
    });
}

// ═══════════════════════════════════════════════
//  THREE.JS
// ═══════════════════════════════════════════════
const container = document.getElementById('canvas-container');
const W = window.innerWidth, H = window.innerHeight;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(W, H);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0f);
scene.fog = new THREE.FogExp2(0x0a0a0f, 0.018);

const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 200);
camera.position.set(0, 6, 14);
camera.lookAt(0, 1, 0);

// Lights
const ambient = new THREE.AmbientLight(0xffffff, 0.15); scene.add(ambient);
const mainLight = new THREE.SpotLight(0xffd4a0, 2.5, 40, Math.PI / 5, 0.4);
mainLight.position.set(0, 14, 4);
mainLight.castShadow = true; mainLight.shadow.mapSize.set(2048, 2048); scene.add(mainLight);
const rimL = new THREE.PointLight(0xff3311, 1.2, 25); rimL.position.set(-8, 3, -3); scene.add(rimL);
const rimR = new THREE.PointLight(0x2244ff, 0.8, 25); rimR.position.set(8, 3, -3); scene.add(rimR);
const hitLight = new THREE.PointLight(0xff4422, 0, 10); hitLight.position.set(0, 5, 5); scene.add(hitLight);

// Floor + grid
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.9, metalness: 0.1 })
);
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
scene.add(new THREE.GridHelper(40, 40, 0x222233, 0x181825));

// Drum builder helpers
const drums = [];
const mMat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, metalness: 0.85 });
const hMat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.05 });
const rMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.2, metalness: 0.95 });

function makeDrum({ x, y, z, bodyR, bodyH, headColor, shellColor, name, key }) {
    const g = new THREE.Group();
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(bodyR, bodyR * 0.97, bodyH, 32), mMat(shellColor));
    sh.castShadow = true; sh.receiveShadow = true; g.add(sh);
    const hd = new THREE.Mesh(new THREE.CylinderGeometry(bodyR * 1.02, bodyR * 1.02, 0.06, 32), hMat(headColor));
    hd.position.y = bodyH / 2 + 0.02; hd.castShadow = true; g.add(hd);
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(bodyR * 1.03, 0.055, 8, 32), rMat);
    r1.rotation.x = Math.PI / 2; r1.position.y = bodyH / 2 + 0.06; g.add(r1);
    const r2 = new THREE.Mesh(new THREE.TorusGeometry(bodyR * 1.03, 0.04, 8, 32), rMat);
    r2.rotation.x = Math.PI / 2; r2.position.y = -bodyH / 2; g.add(r2);
    g.position.set(x, y, z); scene.add(g);
    drums.push({ mesh: g, name, key, origY: y });
    return g;
}

function makeCymbal({ x, y, z, r, tilt, name, key, color = 0xd4c060 }) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, y + 1, 8),
        new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.4, metalness: 0.7 })
    );
    pole.position.y = -(y + 1) / 2; g.add(pole);
    const pts = [];
    for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        pts.push(new THREE.Vector2(t * r, Math.pow(t, 2.2) * 0.22 - (t < 0.1 ? 0.1 * (1 - t / 0.1) : 0)));
    }
    const cymMat = new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.92, side: THREE.DoubleSide });
    const cym = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), cymMat);
    cym.castShadow = true; g.add(cym);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), cymMat));
    g.position.set(x, y, z);
    if (tilt) g.rotation.z = tilt;
    scene.add(g);
    drums.push({ mesh: g, name, key, origY: y, isCymbal: true });
    return g;
}

// ── KICK ──
const bG = new THREE.Group();
const bSh = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.2, 32), mMat(0x1a1a2e));
bSh.rotation.z = Math.PI / 2; bSh.castShadow = true; bSh.receiveShadow = true; bG.add(bSh);
const bHd = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.42, 0.07, 32), hMat(0xf0e8d8));
bHd.rotation.z = Math.PI / 2; bHd.position.x = 1.12; bG.add(bHd);
const bRm = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.07, 8, 32), rMat);
bRm.position.x = 1.15; bG.add(bRm);
bG.position.set(0, 1.4, 0); scene.add(bG);
drums.push({ mesh: bG, name: 'KICK', key: 'z', origY: 1.4, isBass: true });

makeDrum({ x: -2.5, y: 2.2, z: 2.5, bodyR: 0.75, bodyH: 0.55, headColor: 0xf5f0e8, shellColor: 0xc0392b, name: 'SNARE', key: 's' });

// Hi-hat
const hhG = new THREE.Group();
const hhPts = [];
for (let i = 0; i <= 20; i++) { const t = i / 20; hhPts.push(new THREE.Vector2(t * 0.65, Math.pow(t, 2) * 0.12)); }
const hhM = new THREE.MeshStandardMaterial({ color: 0xd4c060, roughness: 0.15, metalness: 0.92, side: THREE.DoubleSide });
const hh1 = new THREE.Mesh(new THREE.LatheGeometry(hhPts, 40), hhM);
const hh2 = new THREE.Mesh(new THREE.LatheGeometry(hhPts, 40), hhM);
hh2.rotation.x = Math.PI; hh2.position.y = 0.07;
hhG.add(hh1, hh2); hhG.position.set(-3.8, 3.2, 1.5); scene.add(hhG);
drums.push({ mesh: hhG, name: 'HI-HAT', key: 'q', origY: 3.2, isCymbal: true });

makeDrum({ x: -1.2, y: 4.2, z: -0.5, bodyR: 0.62, bodyH: 0.6, headColor: 0xf0e0c0, shellColor: 0x16213e, name: 'TOM 1', key: 'w' });
makeDrum({ x: 1.2, y: 4.2, z: -0.5, bodyR: 0.68, bodyH: 0.65, headColor: 0xf0e0c0, shellColor: 0x16213e, name: 'TOM 2', key: 'e' });
makeDrum({ x: 3.0, y: 1.6, z: 1.8, bodyR: 0.88, bodyH: 0.9, headColor: 0xf0e0c0, shellColor: 0x16213e, name: 'FLOOR TOM', key: 'a' });
makeCymbal({ x: 3.8, y: 4.2, z: 0, r: 1.1, tilt: -0.2, name: 'RIDE', key: 'd', color: 0xe8c840 });
makeCymbal({ x: -4.2, y: 5.0, z: -0.5, r: 0.9, tilt: 0.25, name: 'CRASH', key: 'x', color: 0xd4af37 });

// Stool
const stG = new THREE.Group();
stG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 24),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 })));
for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x555566, metalness: 0.8, roughness: 0.3 }));
    leg.position.set(Math.cos(a) * 0.4, -1.1, Math.sin(a) * 0.4); stG.add(leg);
}
stG.position.set(0, 2.2, 3.5); scene.add(stG);

// ── HIT SYSTEM ──
const hitLabel = document.getElementById('hit-label');
let hitTimeout = null;
const drumHits = {}; drums.forEach(d => { drumHits[d.key] = 0; });

function triggerHit(d) {
    playSound(d.key);
    drumHits[d.key] = 1.0;
    hitLight.intensity = 3.5;
    hitLabel.textContent = d.name;
    hitLabel.style.opacity = '1'; hitLabel.style.transition = 'none';
    clearTimeout(hitTimeout);
    hitTimeout = setTimeout(() => {
        hitLabel.style.transition = 'opacity 0.55s';
        hitLabel.style.opacity = '0';
    }, 80);
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
function getMeshes(g) { const m = []; g.traverse(o => { if (o.isMesh) m.push(o); }); return m; }

renderer.domElement.addEventListener('click', e => {
    mouse.x = (e.clientX / W) * 2 - 1; mouse.y = -(e.clientY / H) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    for (const d of drums) {
        if (raycaster.intersectObjects(getMeshes(d.mesh)).length > 0) { triggerHit(d); break; }
    }
});

document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    const d = drums.find(d => d.key === k);
    if (d) triggerHit(d);
});

// ── CAMERA ──
let isDrag = false, prevMX = 0, prevMY = 0;
let camTheta = 0, camPhi = 0.42, camR = 14, autoRotate = true;

renderer.domElement.addEventListener('mousedown', e => { isDrag = true; prevMX = e.clientX; prevMY = e.clientY; });
renderer.domElement.addEventListener('mouseup', () => { isDrag = false; });
renderer.domElement.addEventListener('mousemove', e => {
    if (!isDrag) return;
    camTheta -= (e.clientX - prevMX) * 0.008;
    camPhi = Math.max(0.1, Math.min(1.2, camPhi - (e.clientY - prevMY) * 0.006));
    prevMX = e.clientX; prevMY = e.clientY;
    autoRotate = false;
    document.getElementById('btn-rotate').classList.remove('active');
});
renderer.domElement.addEventListener('wheel', e => { camR = Math.max(6, Math.min(25, camR + e.deltaY * 0.02)); });

function toggleRotate() {
    autoRotate = !autoRotate;
    document.getElementById('btn-rotate').classList.toggle('active', autoRotate);
}
let lightMode = false;
function toggleLight() {
    lightMode = !lightMode;
    document.getElementById('btn-light').classList.toggle('active', lightMode);
    if (lightMode) { scene.background = new THREE.Color(0x1a1a2e); scene.fog = new THREE.FogExp2(0x1a1a2e, 0.012); ambient.intensity = 0.5; mainLight.intensity = 3; }
    else { scene.background = new THREE.Color(0x0a0a0f); scene.fog = new THREE.FogExp2(0x0a0a0f, 0.018); ambient.intensity = 0.15; mainLight.intensity = 2.5; }
}

// ── RENDER LOOP ──
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    if (autoRotate) camTheta += 0.003;
    camera.position.x = camR * Math.sin(camTheta) * Math.cos(camPhi);
    camera.position.y = camR * Math.sin(camPhi) + 1;
    camera.position.z = camR * Math.cos(camTheta) * Math.cos(camPhi);
    camera.lookAt(0, 1.5, 0);

    drums.forEach(d => {
        if (drumHits[d.key] > 0) {
            const v = drumHits[d.key];
            if (d.isBass) d.mesh.position.x = -v * 0.18;
            else if (d.isCymbal) d.mesh.rotation.x = -v * 0.18;
            else d.mesh.position.y = d.origY - v * 0.12;
            drumHits[d.key] *= 0.78;
            if (drumHits[d.key] < 0.001) {
                drumHits[d.key] = 0;
                if (d.isBass) d.mesh.position.x = 0;
                else if (d.isCymbal) d.mesh.rotation.x = 0;
                else d.mesh.position.y = d.origY;
            }
        }
    });

    hitLight.intensity *= 0.85;
    drums.filter(d => d.isCymbal).forEach(d => {
        if (drumHits[d.key] > 0.01) d.mesh.rotation.z = Math.sin(t * 30) * drumHits[d.key] * 0.06;
        else d.mesh.rotation.z *= 0.9;
    });
    rimL.intensity = 1.0 + 0.3 * Math.sin(t * 0.7);
    rimR.intensity = 0.6 + 0.2 * Math.sin(t * 0.5 + 1.5);

    updateVU();
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    const W2 = window.innerWidth, H2 = window.innerHeight;
    renderer.setSize(W2, H2); camera.aspect = W2 / H2; camera.updateProjectionMatrix();
});
