// Prepared by: Codex. Additive motion study; canonical images are read-only.
import * as THREE from './lib/three.module.js';
import {createLogoVortex} from './intro-logo-vortex.js?v=originals-v2';
import {loadTogaWorld} from './models/toga-world.js?v=contrast-v3';
import {colourOriginal,keyBlackSignature,FLAT_COLOURS} from './intro-art-colour.js?v=semantic-fill-v1';
import {creaturePose,VISIBLE_CAST} from './intro-creature-flow.js?v=readable-depth-v4';

const query=new URLSearchParams(location.search);
// Only the approved creature opening is public; archived query strings do
// not revive the old comet-flight or birthday journey.
const flight=false;
const earthEnergy=true;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const OPENING=earthEnergy
 ? {characters:2.2,stagger:.14,lifetime:2.4,title:7.6,release:8.75,end:10.04}
 : {characters:2.4,stagger:.32,lifetime:3.4,title:14.1,release:17.2,end:19.2};
const duration=flight?16:OPENING.end, $=id=>document.getElementById(id);
const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,t)=>{const p=clamp((t-a)/(b-a));return p*p*(3-2*p);};
let time=clamp(Number(query.get('t'))||0,0,duration),playing=false,ready=false,ended=false;
let playbackMotion=!reduced; // Explicit Play/Replay opts into this animation.
let width=innerWidth,height=innerHeight,scale=1,last=0,raf=0;
const ink=$('ink'),ctx=ink.getContext('2d');
let renderer,scene,camera,planet,comet,rock,flare,tail,impact,water;
const path=new THREE.CubicBezierCurve3(new THREE.Vector3(-6,2.8,4),new THREE.Vector3(-3,1.8,3),new THREE.Vector3(-1.2,.35,1.8),new THREE.Vector3(-.46,.08,.884));
const hit=path.getPoint(1),noiseSeed=614;
let seed=noiseSeed;
const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const stars=Array.from({length:640},()=>({x:random(),y:random(),r:.2+random()*.85,a:.12+random()*.55}));
const dust=Array.from({length:2500},()=>({r:random(),a:random()*Math.PI*2,s:random(),c:random()}));
// Exact original sheet cutouts, not the generated character-reference set.
// Keep source card identifiers: card titles are not standalone faction models.
const CAST=Array.from({length:29},(_,i)=>({id:`card-${String(i+1).padStart(2,'0')}`,file:`card-${String(i+1).padStart(2,'0')}.png`}));
const images=[];
function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Could not load '+src));img.src=src;});}

// Ink mattes are ephemeral compositing layers. Keep antialiasing and original
// proportions; never trace, smooth, or regenerate the supplied character shapes.
function inkMatte(img,tint,filled=false){
 const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
 const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0);
 const pixels=x.getImageData(0,0,c.width,c.height),d=pixels.data;
 const col=new THREE.Color(tint);col.convertLinearToSRGB();
 const coverage=new Float32Array(c.width*c.height),outside=new Uint8Array(coverage.length);
 for(let p=0;p<coverage.length;p++){const i=p*4;coverage[p]=(d[i+3]/255)*(1-(d[i]+d[i+1]+d[i+2])/765);}
 // Fill only regions already enclosed by the supplied ink. A border flood
 // removes the paper without inventing a traced outline or altering the file.
 if(filled){
  const queue=new Uint32Array(coverage.length);let head=0,end=0;
  const add=p=>{if(!outside[p]&&coverage[p]<.25){outside[p]=1;queue[end++]=p;}};
  for(let x=0;x<c.width;x++){add(x);add((c.height-1)*c.width+x);}
  for(let y=1;y<c.height-1;y++){add(y*c.width);add(y*c.width+c.width-1);}
  while(head<end){const p=queue[head++],x=p%c.width;if(x>0)add(p-1);if(x<c.width-1)add(p+1);if(p>=c.width)add(p-c.width);if(p<coverage.length-c.width)add(p+c.width);}
 }
 let x0=c.width,y0=c.height,x1=0,y1=0;
 for(let i=0;i<d.length;i+=4){const p=i/4,solid=filled&&!outside[p],a=solid?255:coverage[p]*255,tone=solid?1-coverage[p]*.86:1;
  d[i]=col.r*255*tone;d[i+1]=col.g*255*tone;d[i+2]=col.b*255*tone;d[i+3]=a;
  if(a>45){const p=i/4,px=p%c.width,py=Math.floor(p/c.width);x0=Math.min(x0,px);y0=Math.min(y0,py);x1=Math.max(x1,px);y1=Math.max(y1,py);}}
 x.putImageData(pixels,0,0);
 return {canvas:c,box:[Math.max(0,x0-5),Math.max(0,y0-5),Math.min(c.width-x0+5,x1-x0+11),Math.min(c.height-y0+5,y1-y0+11)]};
}
let logo,signature,vortex,portalVideo,portalFrame,portalBlobURL;
const portalTime=t=>clamp(t,0,Math.max(0,(portalVideo?.duration||OPENING.end)-.035));
function paintPortal(alpha=1){
 if(!portalVideo||!portalFrame)return;
 if(portalVideo.readyState>=2)portalFrame.getContext('2d').drawImage(portalVideo,0,0,portalFrame.width,portalFrame.height);
 const fit=Math.max(width/portalFrame.width,height/portalFrame.height),w=portalFrame.width*fit,h=portalFrame.height*fit;
 ctx.globalAlpha=alpha;ctx.drawImage(portalFrame,(width-w)/2,(height-h)/2,w,h);ctx.globalAlpha=1;
}
function syncPortal(t){
 if(!portalVideo)return;
 const active=playing&&t<OPENING.end;
 const target=portalTime(t);
 if(Math.abs(portalVideo.currentTime-target)>(active?.40:.025))portalVideo.currentTime=target;
 if(active&&portalVideo.paused)portalVideo.play().catch(()=>{});
 if(!active&&!portalVideo.paused)portalVideo.pause();
}
function resize(){
 width=Math.max(1,innerWidth);height=Math.max(1,innerHeight);scale=Math.min(width/1440,height/900);
 const dpr=Math.min(2,earthEnergy?Math.max(1,devicePixelRatio||1):(devicePixelRatio||1));ink.width=Math.round(width*dpr);ink.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
 if(renderer){renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
 if(ready)draw(time);
}
function background(t){
 ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);
 const alpha=smooth(2.7,4,t);
 for(const s of stars){ctx.fillStyle=`rgba(222,227,232,${s.a*alpha})`;ctx.beginPath();ctx.arc(s.x*width,s.y*height,s.r,0,Math.PI*2);ctx.fill();}
}
function mark(img,size,alpha){ctx.globalAlpha=clamp(alpha);ctx.drawImage(img,width/2-size/2,height/2-size/2,size,size);ctx.globalAlpha=1;}
function opening(t){
 ctx.clearRect(0,0,width,height);
 // The portal exits onto white. Keep its playback controls legible there too.
 document.body.classList.toggle('dark',earthEnergy?t<9.78:t<2.12||(t>OPENING.release+.5&&playbackMotion));
 // Later logo-to-solar release is retained, not used to open the sequence.
 if(t>=OPENING.release){
  if(!earthEnergy){vortex.draw(ctx,t-OPENING.release,width,height,{reduced:!playbackMotion});return;}
  const p=smooth(OPENING.release,OPENING.end,t);
  ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);
  paintPortal();
  mark(logo,Math.min(width*.46,height*.52,440)*(1+p*.65),1-p);
  // Match the approved clip's existing white exit, never add another burst.
  const white=smooth(9.78,OPENING.end,t);
  ctx.fillStyle=`rgba(255,255,255,${white})`;ctx.fillRect(0,0,width,height);
  return;
 }
 ctx.fillStyle=t<2.18||earthEnergy?'#000':'#fff';ctx.fillRect(0,0,width,height);
 if(earthEnergy)paintPortal(smooth(1.35,2.85,t));
 if(t<(earthEnergy?2.65:2.18)){
  const w=Math.min(width*.72,680),h=w*230/520;
  if(earthEnergy)ctx.globalAlpha=smooth(.35,.95,t)*(1-smooth(1.65,2.65,t));
  ctx.drawImage(signature,700,420,520,230,width/2-w/2,height/2-h/2,w,h);
  ctx.globalAlpha=1;
  // Exactly two seconds of signature, then one fast white release. No
  // particles, gray wash, prolonged contraction, or logo behind the cast.
  if(t>=2&&!earthEnergy){
   ctx.fillStyle='#fff';
   if(!playbackMotion)ctx.fillRect(0,0,width,height);
   else{const p=clamp((t-2)/.18),r=Math.hypot(width/2,height/2)*1.05*Math.pow(p,.6);
    ctx.beginPath();ctx.arc(width/2,height/2,r,0,Math.PI*2);ctx.fill();}
  }
  if(!earthEnergy||t<OPENING.characters)return;
 }
 // A genuinely empty, full-white beat separates the signature and drawings.
 if(t<OPENING.characters)return;
 if(earthEnergy){
  // The decoded portal frame is the motion clock, not an unrelated spiral.
  const flowTime=portalVideo?.readyState>=2?portalVideo.currentTime:t;
  const poses=VISIBLE_CAST.map(i=>creaturePose(i,flowTime,width,height)).filter(Boolean).sort((a,b)=>b.depth-a.depth);
  for(const pose of poses){
   const art=images[pose.id],ratio=art.box[2]/art.box[3];
   const w=ratio>1?pose.size:pose.size*ratio,h=ratio>1?pose.size/ratio:pose.size;
   ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(pose.rotation);ctx.scale(1,pose.squash);ctx.globalAlpha=pose.alpha;
   ctx.drawImage(art.canvas,...art.box,-w/2,-h/2,w,h);ctx.restore();
  }
 }else for(let i=0;i<images.length;i++){
  const enter=OPENING.characters+i*OPENING.stagger,p=(t-enter)/OPENING.lifetime;
  if(p<0||p>=1)continue;
  const inward=smooth(.55,1,p);
  const angle=i*2.399-t*.35;
  const orbit=(1-inward*.96)*Math.min(width*.35,height*.34);
  const depth=.78+.22*Math.sin(angle);
  const size=Math.min(215,width*.225,height*.24,images[i].box[2],images[i].box[3])*(1-inward*.9)*depth;
  const ratio=images[i].box[2]/images[i].box[3];
  const w=ratio>1?size:size*ratio,h=ratio>1?size/ratio:size;
  ctx.save();ctx.translate(width/2+Math.cos(angle)*orbit,height/2+Math.sin(angle)*orbit*.9);
  // Let the drawing read before it recedes. The orbit carries the motion;
  // each original stays upright with only a small, slow bank, never a spin.
  ctx.rotate((i%3-1)*.08+Math.sin(p*Math.PI)*.09);
  ctx.globalAlpha=smooth(0,earthEnergy?.18:.09,p)*(1-smooth(earthEnergy?.65:.86,1,p));
  const [sx,sy,sw,sh]=images[i].box;ctx.drawImage(images[i].canvas,sx,sy,sw,sh,-w/2,-h/2,w,h);ctx.restore();
 }
 // The last drawings converge into the original black mark, still on white.
 if(t>=OPENING.title)mark(logo,Math.min(width*.46,height*.52,440),smooth(OPENING.title,OPENING.title+.9,t));
}
function texture(src){return new Promise((resolve,reject)=>new THREE.TextureLoader().load(src,t=>{t.colorSpace=THREE.SRGBColorSpace;t.wrapS=THREE.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());resolve(t);},undefined,reject));}
async function initFlight(){
 renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
 scene=new THREE.Scene();scene.background=new THREE.Color(0x000000);camera=new THREE.PerspectiveCamera(42,1,.05,100);
 const world=await loadTogaWorld(THREE,renderer),atlas=world.atlas,mask=world.waterMask;
 planet=new THREE.Mesh(new THREE.SphereGeometry(1,128,80),new THREE.MeshStandardMaterial({map:atlas,roughness:.84,emissive:0xffffff,emissiveMap:atlas,emissiveIntensity:.24}));planet.rotation.y=world.facingRotation;scene.add(planet);
 planet.updateMatrixWorld();hit.copy(world.homeNormal).applyMatrix4(planet.matrixWorld);path.v3.copy(hit);
 scene.add(new THREE.AmbientLight(0xc4d3e4,1.7));const sun=new THREE.DirectionalLight(0xffeee0,2.7);sun.position.set(-4,3,5);scene.add(sun);
 water=new THREE.Mesh(new THREE.SphereGeometry(1.0008,128,80),new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{map:{value:mask}},vertexShader:`varying vec2 vUv;varying vec3 vN;varying vec3 vV;void main(){vUv=uv;vN=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);vV=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,fragmentShader:`uniform sampler2D map;varying vec2 vUv;varying vec3 vN;varying vec3 vV;void main(){float m=smoothstep(.72,.98,texture2D(map,vUv).a);float edge=pow(1.-max(dot(vN,vV),0.),1.55);gl_FragColor=vec4(mix(vec3(.08,.34,.46),vec3(.23,.58,.72),edge),m*(.10+edge*.18));}`}));planet.add(water);
 const atm=new THREE.Mesh(new THREE.SphereGeometry(1.04,96,64),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.BackSide,blending:THREE.AdditiveBlending,vertexShader:`varying vec3 n;varying vec3 v;void main(){n=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,fragmentShader:`varying vec3 n;varying vec3 v;void main(){float f=pow(smoothstep(0.,1.,clamp(max(-dot(n,v),0.)/.30,0.,1.)),1.3)*.46;gl_FragColor=vec4(vec3(.30,.58,1.)*f,f);}`}));planet.add(atm);
 const points=new Float32Array(1500*3);for(let i=0;i<points.length;i+=3){const a=random()*Math.PI*2,z=random()*2-1,r=25*Math.sqrt(1-z*z);points[i]=Math.cos(a)*r;points[i+1]=z*25;points[i+2]=Math.sin(a)*r;}
 const starsGeo=new THREE.BufferGeometry();starsGeo.setAttribute('position',new THREE.BufferAttribute(points,3));scene.add(new THREE.Points(starsGeo,new THREE.PointsMaterial({size:.025,color:0xc8d4df,transparent:true,opacity:.65})));
 comet=new THREE.Group();
 // Reuse the existing rock geometry. Directional light, material variation,
 // and a close tracking camera reveal its volume instead of an unlit dot.
 const rockMaterial=new THREE.MeshStandardMaterial({color:0x71655a,roughness:.98,flatShading:true});
 rockMaterial.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 vRock;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRock=position;');
  shader.fragmentShader=`varying vec3 vRock;
    float rockHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
    float rockNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(mix(rockHash(i),rockHash(i+vec3(1,0,0)),f.x),mix(rockHash(i+vec3(0,1,0)),rockHash(i+vec3(1,1,0)),f.x),f.y),
        mix(mix(rockHash(i+vec3(0,0,1)),rockHash(i+vec3(1,0,1)),f.x),mix(rockHash(i+vec3(0,1,1)),rockHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
    `+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec3 p=vRock*380.;
    float strata=rockNoise(p)*.55+rockNoise(p*3.1)*.30+rockNoise(p*10.3)*.15;
    diffuseColor.rgb*=.36+.74*strata;`);
 };
 rock=new THREE.Mesh(new THREE.IcosahedronGeometry(.021,2),rockMaterial);
 rock.scale.set(4.1,3.2,3.6);comet.add(rock);scene.add(comet);
 const flareCanvas=document.createElement('canvas');flareCanvas.width=128;flareCanvas.height=128;const f=flareCanvas.getContext('2d'),g=f.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'#fff');g.addColorStop(.06,'#fff9df');g.addColorStop(.18,'rgba(235,178,90,.6)');g.addColorStop(1,'rgba(190,125,50,0)');f.fillStyle=g;f.fillRect(0,0,128,128);
 flare=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(flareCanvas),blending:THREE.AdditiveBlending,depthWrite:false,opacity:0}));flare.scale.set(.24,.24,1);comet.add(flare);
 const tailGeo=new THREE.BufferGeometry(),uv=[],indices=[];
 for(let i=0;i<=120;i++){uv.push(0,i/120,1,i/120);if(i<120){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}
 tailGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(121*2*3),3));tailGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));tailGeo.setIndex(indices);
 tail=new THREE.Mesh(tailGeo,new THREE.ShaderMaterial({transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vUv;void main(){float edge=abs(vUv.x*2.-1.);float core=exp(-edge*edge*32.);float soft=pow(1.-edge,2.);float fade=pow(1.-vUv.y,1.4);vec3 color=mix(vec3(.67,.39,.15),vec3(1.,.94,.79),core);gl_FragColor=vec4(color,(core*.8+soft*.3)*fade);}`}));tail.frustumCulled=false;scene.add(tail);
 impact=new THREE.Mesh(new THREE.RingGeometry(.965,1,160),new THREE.MeshBasicMaterial({color:0xf4d1a1,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));impact.userData.local=impact.geometry.attributes.position.array.slice();impact.frustumCulled=false;scene.add(impact);
 resize();
}
function drawFlight(t){
 document.body.classList.add('dark');ctx.clearRect(0,0,width,height);
 const travel=clamp(t/10.6),p=path.getPoint(travel),tangent=path.getTangent(travel);
 comet.position.copy(p);comet.visible=t<10.6;tail.visible=comet.visible;
 rock.rotation.set(t*.23,t*.31,t*.12);
 flare.material.opacity=smooth(7.5,10.6,t)*.7;
 const approach=smooth(2,15.5,t),narrow=Math.max(1,1/(width/height));
 const wide=new THREE.Vector3(mix(0,-.25,approach),mix(.35,.1,approach),mix(7,3.35,approach)*narrow);
 const track=p.clone().addScaledVector(tangent,-.56*narrow).add(new THREE.Vector3(0,.13,.06));
 const pullback=smooth(1.4,5.6,t);
 camera.position.copy(track).lerp(wide,pullback);
 // Keep both the rock and its destination in frame through the pullback.
 const aim=p.clone().addScaledVector(tangent,.23).lerp(p.clone().multiplyScalar(.45),pullback);
 camera.lookAt(aim);
 // Reframe the actual 3D bounds, including narrow viewports. Neither the
 // destination nor the tracked rock should be sliced by the pullback.
 for(let pass=0;pass<2;pass++){
  camera.updateMatrixWorld();let extent=.88;
  for(const [centre,radius] of [[new THREE.Vector3(),1.05],[p,.095]]){
   for(const x of[-1,1])for(const y of[-1,1])for(const z of[-1,1]){
    const q=centre.clone().add(new THREE.Vector3(x*radius,y*radius,z*radius)).project(camera);
    extent=Math.max(extent,Math.abs(q.x),Math.abs(q.y));
   }
  }
  if(extent>.88)camera.position.sub(aim).multiplyScalar(extent/.88).add(aim);
 }
 const pos=tail.geometry.attributes.position;
 for(let i=0;i<=120;i++){
  const s=i/120,back=Math.max(0,travel-s*.23),pt=path.getPoint(back);
  const side=new THREE.Vector3().crossVectors(path.getTangent(back),camera.position.clone().sub(pt)).normalize();
  const width=(.010+.048*Math.sin(s*Math.PI))*(1-s*.94);
  const left=pt.clone().addScaledVector(side,-width),right=pt.clone().addScaledVector(side,width);
  pos.setXYZ(i*2,left.x,left.y,left.z);pos.setXYZ(i*2+1,right.x,right.y,right.z);
 }pos.needsUpdate=true;
 const after=Math.max(0,t-10.6),wave=smooth(0,2.2,after);
 impact.visible=t>=10.6&&t<13.8;impact.material.opacity=(1-wave)*.65;
 const ring=impact.geometry.attributes.position,local=impact.userData.local,rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),hit.clone().normalize()),radius=.012+wave*.7;
 for(let i=0;i<ring.count;i++){const p=new THREE.Vector3(local[i*3]*radius,local[i*3+1]*radius,1).applyQuaternion(rotation).normalize().multiplyScalar(1.004);ring.setXYZ(i,p.x,p.y,p.z);}ring.needsUpdate=true;
 renderer.render(scene,camera);
 if(after>0&&after<1.0&&!reduced){
  const screen=hit.clone().project(camera),x=(screen.x*.5+.5)*width,y=(-screen.y*.5+.5)*height;
  const a=Math.sin(Math.PI*clamp(after/1.0))*.7,r=(18+after*150)*scale;
  const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(255,244,213,${a})`);g.addColorStop(.22,`rgba(244,207,143,${a*.55})`);g.addColorStop(1,'rgba(240,185,80,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
 }
}
function draw(t){if(!ready)return;syncPortal(t);flight?drawFlight(t):opening(t);$('time').value=t;$('clock').value=`${t.toFixed(1)} / ${duration}`;$('play').textContent=playing?'Pause':'Play';}
function setPlaying(value){playing=value&&ready;last=performance.now();syncPortal(time);$('play').textContent=playing?'Pause':'Play';}
function seek(value){time=clamp(value,0,duration);ended=false;draw(time);}
function advance(){
 if(parent!==window)parent.postMessage({type:'toga:intro-next',source:flight?'comet':'creature-opening',transition:!flight&&playbackMotion?'logo-vortex':null},location.origin);
 else location.href='intro-sequence.html?cut=earth-energy&stage=1';
}
$('play').onclick=()=>{playbackMotion=true;if(time>=duration)seek(0);setPlaying(!playing);};
$('replay').onclick=()=>{playbackMotion=true;seek(0);setPlaying(true);};
$('time').oninput=e=>{setPlaying(false);seek(Number(e.target.value));};
$('next').onclick=advance;
addEventListener('resize',resize,{passive:true});
document.addEventListener('visibilitychange',()=>{last=performance.now();});
addEventListener('pagehide',()=>{cancelAnimationFrame(raf);renderer?.dispose();renderer?.forceContextLoss();portalVideo?.pause();if(portalBlobURL)URL.revokeObjectURL(portalBlobURL);});
function tick(now){
 // This is an authored timeline, not a physics simulation. Capping delta
 // stretches a 16-second cut into minutes on a throttled renderer.
 if(playing&&!document.hidden){time=Math.min(duration,time+Math.max(0,(now-last)/1000));draw(time);if(time>=duration){setPlaying(false);if(!ended){ended=true;if(query.get('autoplay')==='1'&&playbackMotion)advance();}}}
 // A paused or backgrounded study does not redraw either canvas.
 last=now;raf=requestAnimationFrame(tick);
}
try{
 logo=await loadImage('assets/intro-comet-v1/logo.png');
 if(flight){$('note').textContent='Comet study · landing location not yet locked';$('next').textContent='Open globe';await initFlight();}
 else{
  signature=await loadImage('assets/intro-originals-v2/designed-by-blu-caption-below.png');vortex=createLogoVortex(logo);
  if(earthEnergy){
   signature=keyBlackSignature(signature);
   logo=inkMatte(logo,'#ffffff').canvas;
   portalVideo=document.createElement('video');portalVideo.muted=true;portalVideo.playsInline=true;portalVideo.preload='auto';
   // The existing local static server does not serve HTTP byte ranges. A
   // complete local Blob makes frame seeking reliable without changing that
   // shared server or any other website route.
   const response=await fetch('assets/intro-earth-energy-v1/portal-approved-web.mp4',{cache:'no-store'});
   if(!response.ok)throw new Error('Portal footage unavailable: '+response.status);
   portalBlobURL=URL.createObjectURL(await response.blob());
   portalVideo.src=portalBlobURL;portalVideo.playbackRate=1;
   await new Promise((resolve,reject)=>{portalVideo.onloadeddata=resolve;portalVideo.onerror=()=>reject(new Error('Portal footage unavailable'));portalVideo.load();});
   portalFrame=document.createElement('canvas');portalFrame.width=portalVideo.videoWidth;portalFrame.height=portalVideo.videoHeight;
   portalVideo.addEventListener('seeked',()=>{if(ready&&!playing)opening(time);});
  }
  const loaded=[];
  for(const item of CAST){
   const original=await loadImage('assets/intro-originals-v2/'+item.file);
   const art=earthEnergy?colourOriginal(original,FLAT_COLOURS[loaded.length]):inkMatte(original,'#050505');
   loaded.push({...art,id:item.id});
  }
  images.push(...loaded);$('next').textContent='Solar system';$('note').textContent=`${earthEnergy?VISIBLE_CAST.length:29} original drawings · Blu Inman`;
 }
 $('time').max=duration;
 ready=true;document.body.classList.add('ready');for(const id of ['play','replay','time','next'])$(id).disabled=false;
 resize();if(reduced&&!query.has('t'))seek(flight?15:0);setPlaying(!reduced&&!query.has('t'));
 window.introStudy={seek:t=>{setPlaying(false);seek(t);},play:()=>setPlaying(true),pause:()=>setPlaying(false),getState:()=>({time,playing,mode:flight?'flight':'opening',ready,cast:flight?[]:(earthEnergy?VISIBLE_CAST.map(i=>CAST[i].id):CAST.map(c=>c.id)),visibleCreatures:earthEnergy?VISIBLE_CAST.map(i=>creaturePose(i,portalVideo?.currentTime??time,width,height)).filter(p=>p&&p.alpha>.05).length:null,duration,artStyle:earthEnergy?'flat-original-ink':'original-ink',motion:earthEnergy?'scattered-energy-pull':'legacy-orbit',particleCount:vortex?.count||0,portal:portalVideo?{time:portalVideo.currentTime,readyState:portalVideo.readyState,seeking:portalVideo.seeking,paused:portalVideo.paused,error:portalVideo.error?.message,duration:portalVideo.duration}:null})};
 window.__captureFrame=()=>{const c=document.createElement('canvas');c.width=ink.width;c.height=ink.height;const x=c.getContext('2d');if(renderer)x.drawImage($('scene'),0,0,c.width,c.height);x.drawImage(ink,0,0);return c.toDataURL('image/jpeg',.86);};
 last=performance.now();raf=requestAnimationFrame(tick);
}catch(error){$('loading').textContent='The animation could not load. Your existing intro is still available.';$('error').textContent=error.message||String(error);console.error(error);}
