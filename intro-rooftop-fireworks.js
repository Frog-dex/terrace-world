/* Prepared by: Codex.
 * A staggered stream of 2D fireworks over the live 3D school scene.
 * Absolute-time drawing keeps playback, scrubbing and capture identical.
 */

const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
export const ROOFTOP_FIREWORK_TIMING = Object.freeze({ launch: 25.4, burst: 27, end: 35 });
const SALVO=[
  {delay:0,x:.54,y:.34,size:.76}, {delay:.52,x:.30,y:.43,size:.57},
  {delay:1.04,x:.73,y:.38,size:.64}, {delay:1.64,x:.43,y:.24,size:.72},
  {delay:2.28,x:.65,y:.27,size:.74}, {delay:2.91,x:.23,y:.34,size:.50},
  {delay:3.55,x:.80,y:.44,size:.57}, {delay:4.18,x:.39,y:.38,size:.66},
  {delay:4.84,x:.59,y:.20,size:.84}
];

export function createRooftopFireworks(canvas, { reducedMotion = false } = {}) {
  if (!canvas?.getContext) throw new TypeError('A 2D overlay canvas is required.');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('The firework overlay requires a 2D drawing context.');
  const timing = ROOFTOP_FIREWORK_TIMING;
  let disposed = false, width = 0, height = 0, ratio = 1, seconds = 0, phase = 'before-launch';
  let drawCount = 0, motionEnabled = !reducedMotion, rocketHead = null;

  // Fixed variations, not per-frame randomness. The slightly uneven spacing
  // and velocity keep the burst authored without adding a shower of particles.
  let seed = 180917;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const sparks = Array.from({ length: 52 }, (_, index) => ({
    angle: index / 52 * Math.PI * 2 + (random() - .5) * .12,
    speed: .45 + random() * .65,
    depth: .82 + random() * .22,
    lifetime: 2.13 + random() * .52,
    tail: .21 + random() * .18,
    warm: index % 4 !== 0,
    weight: 1.2 + random() * .8
  }));

  let activeShot=SALVO[0],activeBursts=0;
  function rocketPoint(progress) {
    const p = clamp(progress);
    const climb = .18 * p + .82 * p * p;
    return [width * mix(.52,activeShot.x,climb)+width*.012*Math.sin(Math.PI*climb), height * mix(1.045, activeShot.y, climb)];
  }

  function drawRocket(progress) {
    // The wake is a tapered sequence of short strokes. It fades immediately;
    // no opaque trail or persistent overdraw is accumulated on the canvas.
    const age = clamp(progress), step = .015, line = Math.max(.75, Math.min(width, height) / 780);
    for (let i = 10; i > 0; i--) {
      const a = Math.max(0, age - i * step), b = Math.max(0, age - (i - 1) * step);
      if (b <= a) continue;
      const pa = rocketPoint(a), pb = rocketPoint(b);
      ctx.globalAlpha = .55 * (1 - i / 11) ** 1.5;
      ctx.strokeStyle = i < 4 ? '#fff1cb' : '#bc9560';
      ctx.lineWidth = line * (1 - i / 15);
      ctx.beginPath(); ctx.moveTo(...pa); ctx.lineTo(...pb); ctx.stroke();
      drawCount++;
    }
    const head = rocketPoint(age);
    rocketHead = [...head];
    // A small legible model rocket with a tapered nose and fins; the exhaust
    // flickers in time rather than leaving a motionless radial ornament.
    const prior = rocketPoint(Math.max(0, age - .01));
    ctx.save(); ctx.translate(...head); ctx.rotate(Math.atan2(head[1] - prior[1], head[0] - prior[0]) + Math.PI / 2);
    const size = Math.max(1, Math.min(width, height) / 740);
    ctx.scale(size, size); ctx.globalAlpha = 1;
    ctx.fillStyle = '#f4ecd7';
    ctx.beginPath(); ctx.moveTo(0,-8);ctx.lineTo(2.4,-2);ctx.lineTo(2.4,6);ctx.lineTo(-2.4,6);ctx.lineTo(-2.4,-2);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#bd593b';
    ctx.beginPath();ctx.moveTo(-2,1);ctx.lineTo(-5,7);ctx.lineTo(-2,6);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(2,1);ctx.lineTo(5,7);ctx.lineTo(2,6);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#ffe7af';
    ctx.beginPath();ctx.moveTo(-1.5,6);ctx.lineTo(0,12 + 3*Math.sin(seconds*62));ctx.lineTo(1.5,6);ctx.closePath();ctx.fill();
    ctx.restore();
    drawCount++;
  }

  function sparkPoint(spark, age, center, extent) {
    const travel = (1 - Math.exp(-age * 1.45)) / 1.45;
    return [
      center[0] + Math.cos(spark.angle) * extent * spark.speed * travel,
      center[1] + Math.sin(spark.angle) * extent * spark.speed * spark.depth * travel + height * .014 * age * age
    ];
  }

  function drawBurst(age, still) {
    const center = [width * activeShot.x, height * activeShot.y];
    const extent = Math.min(width, height) * .58 * activeShot.size;
    const line = Math.max(.7, Math.min(width, height) / 950);
    for (const spark of sparks) {
      const remaining = clamp(1 - age / spark.lifetime);
      const brightness = still ? .66 : smooth(age / .055) * remaining ** .75 * (.85 + .15 * Math.sin(age * 27 + spark.angle * 8));
      if (brightness <= .002) continue;
      // Four segments produce taper within one spark, not an additional set of
      // background motes or a blurred radial glow behind the firework.
      for (let segment = 3; segment >= 0; segment--) {
        const a = Math.max(0, age - spark.tail * (segment + 1) / 4);
        const b = Math.max(0, age - spark.tail * segment / 4);
        if (b <= a) continue;
        const pa = sparkPoint(spark, a, center, extent), pb = sparkPoint(spark, b, center, extent);
        ctx.globalAlpha = brightness * (1 - segment * .19);
        ctx.strokeStyle = spark.warm ? (segment > 1 ? '#b38a50' : '#efd2a0') : '#fff3d7';
        ctx.lineWidth = line * spark.weight * (1 - segment * .14);
        ctx.beginPath(); ctx.moveTo(...pa); ctx.lineTo(...pb); ctx.stroke();
        drawCount++;
      }
      const head = sparkPoint(spark, age, center, extent);
      ctx.globalAlpha = brightness;
      ctx.fillStyle = '#fff5da';
      ctx.beginPath(); ctx.arc(...head, line * spark.weight * .7, 0, Math.PI * 2); ctx.fill();
    }
    // A very small ignition core, never a full-frame flash. It is excluded
    // from reduced-motion mode; the longest radius is below 0.6% of the frame.
    if (!still && age < .15) {
      ctx.globalAlpha = .45 * (1 - age / .15);
      ctx.fillStyle = '#fff2d0';
      ctx.beginPath(); ctx.arc(...center, Math.max(1.5, Math.min(width, height) * .005 * (1 - age / .15)), 0, Math.PI * 2); ctx.fill();
      drawCount++;
    }
  }

  function render(time, cssWidth, cssHeight, dpr = 1, { motion = !reducedMotion } = {}) {
    if (disposed) return;
    if (![time, cssWidth, cssHeight, dpr].every(Number.isFinite) || cssWidth <= 0 || cssHeight <= 0 || dpr <= 0) {
      throw new TypeError('Firework time and positive viewport dimensions/device ratio must be finite.');
    }
    seconds = time; width = cssWidth; height = cssHeight; ratio = dpr; drawCount = 0; rocketHead = null; motionEnabled = motion;
    const pixelWidth = Math.max(1, Math.round(width * ratio)), pixelHeight = Math.max(1, Math.round(height * ratio));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    // CSS positioning, pointer-events and visibility belong to the root scene.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowBlur = 0;
    activeBursts=0;
    phase=time<timing.launch?'before-launch':time>=timing.end?'finished':motionEnabled?'firework-stream':'reduced-motion-still';
    if(time>=timing.launch&&time<timing.end){
      for(const shot of SALVO){
        activeShot=shot;
        const age=time-timing.burst-shot.delay;
        if(age<0&&age>=-1.6&&motionEnabled)drawRocket((age+1.6)/1.6);
        if(age>=0&&age<2.7){drawBurst(motionEnabled?age:.72,!motionEnabled);activeBursts++;}
      }
    }
    ctx.restore();
  }

  return {
    render,
    getState: () => ({ disposed, time: seconds, phase, width, height, dpr: ratio, reducedMotion, motionEnabled, rocketHead, timing: { ...timing }, sparks: sparks.length, shots:SALVO.length,activeBursts,drawCount,burstCenter: [width * .54, height * .34], sound: false, loops: false }),
    dispose() {
      if (disposed) return;
      disposed = true;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
}
