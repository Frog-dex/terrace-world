// Prepared by: Codex. All visible mechanism parts share this scene and light rig.
// The original SVG stays usable until this renderer and its artwork are ready.
import * as THREE from '../../store-book/assets/three.module.js';
import { createTownEnvironment } from './town-environment.js?v=9';
import { createTownTraffic } from './town-traffic.js?v=9';
import { createTownSky } from './town-sky.js?v=11b';
import { createTownLoop } from './town-loop.js?v=school-life-11';
import { createSignFooting } from './sign-footing.js?v=11';
import { createPortalReflections } from './portal-reflections.js?v=11';

const menu = document.querySelector('.drawn-menu');
const svg = menu.querySelector('svg');
const host = document.querySelector('.assembly-scene');
const status = document.querySelector('#study-status');
const earthButton = document.querySelector('#earth');
const togaButton = document.querySelector('#toga');
const closeButton = document.querySelector('#close');
const pauseButton = document.querySelector('#pause');
const links = [...menu.querySelectorAll('.choices a')];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const smooth = t => { t = THREE.MathUtils.clamp(t, 0, 1); return t*t*t*(t*(t*6-15)+10); };
const defaults = {width:640,delay:3.6,stagger:.2,turn:.65,sweep:3.8,hold:2,'fan-size':212,speed:2,view:11,energy:.85};
const settings = {...defaults};
const autoControl=document.querySelector('#auto-cycle'), timeline=document.querySelector('#timeline');
const labels = {menu:'Menu ready · move close to keep it open',waiting:'Cursor away · idle before the first turn',opening:'Engraved bands turning right, one by one',entering:'Copper globe entering from the left',holding:'Hollow copper globe · belt and both fans engaged',leaving:'Globe travelling out to the right',closing:'Menu bands returning around from the left',returning:'Cursor nearby · returning the menu mechanically'};
const textureLoader = new THREE.TextureLoader();
const textures = new Map();
const rotors = [], bands = [], cleats = [], resources = new Set();
const reflectiveRims=[];
const togaCentre = Math.PI/2 - Math.PI*2*.5874895465458243;
const togaOnly = { value: 0 }, globeLongitude={value:0};
const letteringYaw={value:0},energyTime={value:0},energyAmount={value:0};
let renderer, scene, camera, assembly, globe, globeMaterial, beltCurve, beltLength, fan, rearFan;
let studioCamera, townCamera, signRoot, environment, cameraRig, motorMount, sunDirection;
let signBounds=null, cleanPlate=false;
let traffic,worldTime=0;
let sky,skyScene,townFilm,footing,reflections,captureSource=false,filmChoiceMade=false;
let ready=false, phase='menu', kind='earth', cycleTime=0, active=false, manualIdle=false;
let driveDistance=0, globeTime=0, paused=false, last=0, raf=0, hoverMenu=false, skipHold=false, textureReady=false, autoStarted=false;
let error='', loadSerial=0, resizeObserver, needsRender=true;
let returnMotion=null,nearPointer=false,pointerX=null,pointerY=null,lastHitView=null;
const originalHitPaths=links.map(a=>a.querySelector('.hit').getAttribute('d'));
let portalVideo,portalUrl,portalTexture,portalLogo,post,sparks,portalPlaybackError='';
const townControl=document.querySelector('#town-scene');
const hideControl=document.querySelector('#hide-sign');
const backdropControl=document.querySelector('#town-backdrop'),greenControl=document.querySelector('#green-preview');
const filmTimeline=document.querySelector('#town-film-time'),filmStatus=document.querySelector('#town-film-status');
const sceneMotion=document.querySelector('#scene-motion'),cloudSpeed=document.querySelector('#cloud-speed');
const embeddedMenu=parent!==window&&new URLSearchParams(location.search).get('embed')==='main-menu';
let parentVisible=true,hostNotified=false,mobileStreetView='sign';
const visibleFrame=()=>!document.hidden&&parentVisible;
if(embeddedMenu){
  links.forEach(link=>link.addEventListener('click',event=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();parent.postMessage({type:'spirit-menu-select',destination:link.dataset.destination},location.origin);
  }));
  addEventListener('message',event=>{
    if(event.source!==parent||event.origin!==location.origin)return;
    if(event.data?.type==='spirit-menu-visibility'&&typeof event.data.visible==='boolean'){
      parentVisible=event.data.visible;needsRender=true;run();
    }else if(event.data?.type==='spirit-menu-view'&&['sign','school'].includes(event.data.view)){
      mobileStreetView=event.data.view;resize();
    }else if(event.data?.type==='spirit-menu-motion'&&typeof event.data.enabled==='boolean'){
      manualIdle=true;autoControl.checked=event.data.enabled;paused=false;
      if(event.data.enabled){if(menu.contains(document.activeElement))document.activeElement.blur();hoverMenu=false;nearPointer=false;pointerX=null;}
      else returnToMenu();
      needsRender=true;run();
    }
  });
}

function own(resource) { resources.add(resource); return resource; }
function metal(colour, roughness = .52, metalness = .48) {
  return own(new THREE.MeshStandardMaterial({ color: colour, roughness, metalness }));
}
function mesh(geometry, material, parent = assembly) {
  const result = new THREE.Mesh(own(geometry), material);
  parent.add(result); return result;
}
function shapeFromPath(path) {
  const shape = new THREE.Shape(), length = path.getTotalLength();
  const count = Math.max(48, Math.ceil(length/3));
  for (let i=0;i<=count;i++) { const p = path.getPointAtLength(length*i/count); if(i) shape.lineTo(p.x,-p.y); else shape.moveTo(p.x,-p.y); }
  shape.closePath(); return shape;
}
function slab(shape, depth, bevel, material, z = 0, parent = assembly) {
  const result = mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled:true, bevelThickness:bevel, bevelSize:bevel, bevelSegments:3, steps:1, curveSegments:32 }), material, parent);
  result.position.z = z; return result;
}
function ring(x, y, radius, tube, z, material, parent = assembly) {
  const result = mesh(new THREE.TorusGeometry(radius,tube,10,100),material,parent);
  result.position.set(x,-y,z); return result;
}
function pin(x,y,z,radius,material,parent=assembly) {
  const result = mesh(new THREE.CylinderGeometry(radius,radius,7,24),material,parent);
  result.rotation.x=Math.PI/2; result.position.set(x,-y,z); return result;
}
function axle(x,y,back,front,radius,material){
  const result=mesh(new THREE.CylinderGeometry(radius,radius,front-back,20),material);
  result.rotation.x=Math.PI/2;result.position.set(x,-y,(front+back)/2);return result;
}
function gear(x,y,radius,teeth,z,material,inner=0,parent=assembly) {
  const shape = new THREE.Shape();
  for(let i=0;i<teeth*4;i++) { const a=i*Math.PI*2/(teeth*4); const r=radius*(i%4===0||i%4===3?.9:1); const px=r*Math.cos(a),py=r*Math.sin(a); if(i)shape.lineTo(px,py);else shape.moveTo(px,py); }
  shape.closePath();
  if(inner) { const hole=new THREE.Path();hole.absarc(0,0,inner,0,Math.PI*2,true);shape.holes.push(hole); }
  else for(let i=0;i<5;i++) { const a=i*Math.PI*2/5;const hole=new THREE.Path();hole.absarc(Math.cos(a)*radius*.53,Math.sin(a)*radius*.53,radius*.125,0,Math.PI*2,true);shape.holes.push(hole); }
  const rotor = new THREE.Group();parent.add(rotor);rotor.position.set(x,-y,z);
  slab(shape,5,.9,material,-2.5,rotor);
  if(!inner)pin(0,0,5,radius*.18,material,rotor);
  const record={object:rotor,radius,sign:1,offset:0};rotors.push(record);return record;
}
async function svgTexture(source) {
  const url=URL.createObjectURL(new Blob([source],{type:'image/svg+xml'}));
  try { const texture=own(await textureLoader.loadAsync(url));texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture; }
  finally { URL.revokeObjectURL(url); }
}
async function letteringTexture() {
  const ns='http://www.w3.org/2000/svg';
  const art=document.createElementNS(ns,'svg');
  for(const [name,value]of Object.entries({xmlns:ns,width:1536,height:1536,viewBox:'34 27 260 260'}))art.setAttribute(name,value);
  const defs=svg.querySelector('defs').cloneNode(true);defs.querySelectorAll('image').forEach(e=>e.remove());art.append(defs);
  const style=document.createElementNS(ns,'style');
  style.textContent='.hit{fill:none;stroke:none}.choices text{fill:#160b06;font:700 31px Georgia,serif;text-anchor:middle;letter-spacing:.35px}.choices .intro-label{font-size:26px}.engraving{fill:none;stroke:#6b422d;stroke-width:1.15}';art.append(style);
  art.append(svg.querySelector('.choices').cloneNode(true));
  return svgTexture(new XMLSerializer().serializeToString(art));
}
function makeBelt(copper, rubber, tread) {
  const lower=new THREE.Vector2(172,-450),upper=new THREE.Vector2(274,-268);
  const direction=upper.clone().sub(lower).normalize(),normal=new THREE.Vector2(-direction.y,direction.x);
  const points=[];
  // Open belt around two equal pitch pulleys: both axles turn in the same direction.
  const r=24;
  for(let i=0;i<=32;i++){const a=Math.PI*i/32;const p=upper.clone().addScaledVector(normal,Math.cos(a)*r).addScaledVector(direction,Math.sin(a)*r);points.push(new THREE.Vector3(p.x,p.y,35));}
  for(let i=0;i<=32;i++){const a=Math.PI*i/32;const p=lower.clone().addScaledVector(normal,-Math.cos(a)*r).addScaledVector(direction,-Math.sin(a)*r);points.push(new THREE.Vector3(p.x,p.y,35));}
  beltCurve=new THREE.CatmullRomCurve3(points,true,'centripetal');beltLength=beltCurve.getLength();
  mesh(new THREE.TubeGeometry(beltCurve,220,4.1,6,true),rubber);
  const count=Math.ceil(beltLength/6);
  const treadGeometry=own(new THREE.BoxGeometry(8.5,1.8,3.5));
  for(let i=0;i<count;i++){const item=new THREE.Mesh(treadGeometry,tread);assembly.add(item);cleats.push(item);}
  gear(172,450,24,18,40,copper).sign=1;
  gear(274,268,24,18,40,copper).sign=1;
}
function makeWindmill(copper, dark, bright) {
  fan=new THREE.Group();assembly.add(fan);fan.position.set(172,-450,52);
  // Six pitched, rounded sails on the same axle as the lower belt pulley.
  const shape=new THREE.Shape();shape.moveTo(7,-2);shape.quadraticCurveTo(22,-8,39,-5);shape.quadraticCurveTo(45,-4,43,3);shape.lineTo(36,15);shape.quadraticCurveTo(20,10,8,6);shape.closePath();
  for(let i=0;i<6;i++){const arm=new THREE.Group();fan.add(arm);arm.rotation.z=i*Math.PI/3;const sail=slab(shape,2.5,.8,copper,0,arm);sail.rotation.x=.23;}
  pin(0,0,7,9,bright,fan);pin(0,0,11,3,dark,fan);
  rearFan=fan.clone();assembly.add(rearFan);rearFan.position.z=-64;
  rearFan.scale.setScalar(settings['fan-size']/90);
  axle(172,450,-72,63,5,dark);
}
function makePlanet(copper) {
  globe=new THREE.Group();assembly.add(globe);globe.position.set(164,-157,0);globe.rotation.y=-Math.PI;
  globeMaterial=metal(0xb87f4b,.55,.45);globeMaterial.side=THREE.DoubleSide;
  globeMaterial.onBeforeCompile=shader=>{
    shader.uniforms.togaOnly=togaOnly;shader.uniforms.globeLongitude=globeLongitude;
    shader.fragmentShader='uniform float togaOnly; uniform float globeLongitude;\n'+shader.fragmentShader.replace('#include <map_fragment>',`
      #ifdef USE_MAP
      vec2 atlas=vec2(fract(vMapUv.x*.5+globeLongitude),vMapUv.y);
      vec3 source=texture2D(map,atlas).rgb;
      float blueRatio=(source.b-source.r)/max(max(source.r,source.g),max(source.b,.0001));
      float water=smoothstep(.08,.35,blueRatio);
      if(togaOnly>.5 && (atlas.x<.42 || atlas.x>.83)) water=1.;
      if(water>.42) discard;
      diffuseColor.rgb*=.95+dot(source,vec3(.2126,.7152,.0722))*.12;
      #endif
    `);
  };
  mesh(new THREE.SphereGeometry(125,128,64,0,Math.PI),globeMaterial,globe);
  const inner=mesh(new THREE.SphereGeometry(123.6,128,64,0,Math.PI),globeMaterial,globe);
  inner.material=globeMaterial;
  const cage=metal(0x795034,.67,.38);
  // Ribs beneath the continent cutouts belong to the same rotating hemisphere.
  for(let k=0;k<=8;k++){
    const phi=k*Math.PI/8,points=[];
    for(let j=0;j<=80;j++){const a=j*Math.PI/80;points.push(new THREE.Vector3(-120*Math.cos(phi)*Math.sin(a),120*Math.cos(a),120*Math.sin(phi)*Math.sin(a)));}
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),80,1.1,6,false),cage,globe);
  }
  // No straight latitude crossbars through the continent silhouette.
  // A fixed front-facing housing hides every rearward track, never an opacity fade.
  const backing=mesh(new THREE.CircleGeometry(148,128),own(new THREE.MeshBasicMaterial({color:0x080706})));backing.position.set(164,-157,4);backing.renderOrder=-1;
  reflectiveRims.push(ring(164,157,151,3.4,8,copper));
  reflectiveRims.push(ring(164,157,148,.8,11,copper));
}
function makeEnergy() {
  const material=own(new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    uniforms:{clock:energyTime,strength:energyAmount,film:{value:portalTexture},hasFilm:{value:portalTexture?1:0}},
    vertexShader:'varying vec2 point; void main(){point=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 point; uniform float clock; uniform float strength; uniform sampler2D film; uniform float hasFilm;
      void main(){float r=length(point);if(r>.98)discard;
        float a=atan(point.y,point.x),turn=a*5.+r*17.-clock*1.4;
        float thread=pow(max(0.,sin(turn)),28.);
        float secondary=pow(max(0.,sin(a*8.-r*24.+clock*.8)),44.)*.38;
        float broken=.35+.65*pow(max(0.,sin(a*3.+r*9.-clock*.4)),2.);
        float envelope=smoothstep(.12,.35,r)*(1.-smoothstep(.72,.98,r));
        float light=(thread+secondary)*broken*envelope*.18;
        if(hasFilm>.5)light=pow(dot(texture2D(film,point*.5+.5).rgb,vec3(.2126,.7152,.0722)),.64);
        float edge=1.-smoothstep(.86,.98,r);
        vec3 sand=mix(vec3(.66,.60,.50),vec3(.98,.97,.93),smoothstep(.18,.68,light));
        gl_FragColor=vec4(vec3(.006,.005,.004)+sand*light*strength,edge);
      }`}));
  const field=mesh(new THREE.PlaneGeometry(296,296),material);field.position.set(164,-157,6);
}
async function loadPortal(){
  portalVideo=document.createElement('video');portalVideo.muted=true;portalVideo.loop=true;portalVideo.playsInline=true;portalVideo.preload='auto';
  const response=await fetch('./portal-sand-loop-v9.mp4');if(!response.ok)throw new Error('Portal clip unavailable');
  portalUrl=URL.createObjectURL(await response.blob());portalVideo.src=portalUrl;
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Portal decode timed out')),10000);portalVideo.onloadeddata=()=>{clearTimeout(timer);resolve();};portalVideo.onerror=()=>{clearTimeout(timer);reject(new Error('Portal decode failed'));};});
  portalTexture=own(new THREE.VideoTexture(portalVideo));portalTexture.colorSpace=THREE.SRGBColorSpace;
  portalVideo.addEventListener('seeked',()=>{if(ready){needsRender=true;pose();}});
}
function makeMountAndMotor(copper,dark,logo){
  post=new THREE.Group();assembly.add(post);post.visible=false;
  const shaft=mesh(new THREE.BoxGeometry(20,656,18),dark,post);shaft.position.set(172,-473,-180);
  const face=mesh(new THREE.BoxGeometry(10,650,1.5),copper,post);face.position.set(169,-473,-169.8);
  for(const y of [157,456,503]){const collar=mesh(new THREE.BoxGeometry(38,13,32),copper,post);collar.position.set(172,-y,-169);}
  axle(164,157,-185,-6,7,dark);
  const logoMaterial=own(new THREE.MeshBasicMaterial({map:logo,color:0xffffff,transparent:true,opacity:0,depthWrite:false,depthTest:false,toneMapped:false}));
  logoMaterial.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','vec4 mark=texture2D(map,vMapUv); diffuseColor.rgb=vec3(1.);diffuseColor.a*=mark.a;');};
  portalLogo=mesh(new THREE.PlaneGeometry(112,112),logoMaterial);portalLogo.position.set(164,-154,10);portalLogo.renderOrder=3;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(Array.from({length:36},()=>0),3));
  geometry.setAttribute('seed',new THREE.Float32BufferAttribute(Array.from({length:12},(_,i)=>(i+.5)/12),1));
  const sparkMaterial=own(new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{clock:energyTime},
    vertexShader:`attribute float seed; uniform float clock; varying float light;
      void main(){float burst=mod(clock,5.8);float age=burst-seed*.15;float live=step(0.,age)*(1.-step(.48,age));
        vec3 p=position+vec3(age*(24.+seed*23.),age*(36.-seed*27.)-age*age*70.,0.);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=2.;light=live*(1.-clamp(age/.48,0.,1.));}`,
    fragmentShader:'varying float light;void main(){float dot=1.-smoothstep(.05,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(1.,.78,.42,light*dot);}'}));
  sparks=new THREE.Points(own(geometry),sparkMaterial);assembly.add(sparks);sparks.position.set(204,-438,68);sparks.frustumCulled=false;
  motorMount=new THREE.Group();assembly.add(motorMount);motorMount.position.set(172,-450,0);
  const casing=mesh(new THREE.CylinderGeometry(31,31,34,32),dark,motorMount);casing.rotation.x=Math.PI/2;casing.position.z=-24;
  for(const x of [-25,25]){const seat=mesh(new THREE.BoxGeometry(8,10,37),copper,motorMount);seat.position.set(x,-26,-24);}
  for(const part of [fan,rearFan,sparks])motorMount.attach(part);
}
const seams=[[78.5,.00285],[130,.00255],[183,.00305],[235,.004]];
function makeSchoolSign(){
  // A provisional entrance nameplate, not a fabricated school crest.
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=224;
  const c=canvas.getContext('2d');c.fillStyle='#d2c3a4';c.fillRect(0,0,1024,224);
  c.strokeStyle='#444b42';c.lineWidth=12;c.strokeRect(9,9,1006,206);
  c.fillStyle='#303d3b';c.textAlign='center';c.textBaseline='middle';c.font='bold 110px Georgia';c.fillText('TOGA SCHOOL',512,118,925);
  const texture=own(new THREE.CanvasTexture(canvas));texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
  const school=environment.school,x=school.x+school.w+.075,y=school.y+school.d*.46,z=3.5,w=7.2,h=1.48;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([x,y-w/2,z-h/2,x,y+w/2,z-h/2,x,y+w/2,z+h/2,x,y-w/2,z+h/2],3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();
  const sign=mesh(geometry,own(new THREE.MeshBasicMaterial({map:texture,toneMapped:false})),environment.group);sign.name='TOGA SCHOOL entrance nameplate';
}
function seamHeight(index,x){return 157-seams[index][0]-seams[index][1]*x*x;}
function shellPatch(index){
  const positions=[],normals=[],indices=[];const nx=128,ny=24,r=130,track=130+index*4;
  for(let ix=0;ix<=nx;ix++){
    const x=-r+2*r*ix/nx,edge=Math.sqrt(Math.max(0,r*r-x*x));
    const upper=index===0?edge:THREE.MathUtils.clamp(seamHeight(index-1,x),-edge,edge);
    const lower=index===4?-edge:THREE.MathUtils.clamp(seamHeight(index,x),-edge,edge);
    for(let iy=0;iy<=ny;iy++){
      const y=lower+(upper-lower)*iy/ny,z=Math.sqrt(Math.max(0,track*track-x*x-y*y));
      positions.push(x,y,z);normals.push(x/track,y/track,z/track);
      if(ix<nx&&iy<ny){const a=ix*(ny+1)+iy,b=a+ny+1;indices.push(a,b,a+1,b,b+1,a+1);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(positions.flatMap((v,i)=>i%3===2?[]:[v/260+.5]),2));geometry.setIndex(indices);return geometry;
}
function makeShell(texture,copper) {
  const material=metal(0xc99567,.54,.44);material.side=THREE.DoubleSide;material.map=texture;
  material.onBeforeCompile=s=>{
    s.uniforms.letteringYaw=letteringYaw;
    s.vertexShader='varying vec3 shellPoint;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nshellPoint=position;');
    s.fragmentShader='varying vec3 shellPoint; uniform float letteringYaw;\n'+s.fragmentShader.replace('#include <map_fragment>',`vec2 facePoint=vec2(shellPoint.x*cos(letteringYaw)+shellPoint.z*sin(letteringYaw),shellPoint.y);
      vec4 ink=texture2D(map,facePoint/260.+.5);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.012,.006,.003),ink.a);
      diffuseColor.a=1.;`);
  };
  // Curved cut lines follow the authored menu, not unrelated latitude stripes.
  for(let i=0;i<5;i++){
    const group=new THREE.Group();assembly.add(group);group.position.set(164,-157,0);
    const geometry=shellPatch(i);mesh(geometry,material,group);
    // A real inner copper wall remains visible while a band is edge-on.
    const inside=mesh(geometry,copper,group);inside.scale.setScalar(.984);inside.material.side=THREE.DoubleSide;
    for(const boundary of [i-1,i]){
      if(boundary<0||boundary>3)continue;
      const points=[];for(let j=0;j<=160;j++){const x=-130+j*260/160,y=seamHeight(boundary,x),r=130+i*4,z2=r*r-x*x-y*y;if(130*130-x*x-y*y>0)points.push(new THREE.Vector3(x,y,Math.sqrt(z2)));}
      mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),100,.65,6,false),copper,group);
    }
    bands.push(group);
  }
  // Play's bearing is beneath the face and outside the complete shell sweep.
  const playRing=gear(164,61,35,28,-169,copper,30);playRing.sign=1;
}
async function prepare() {
  const request=++loadSerial;
  const copper=metal(0xc39269,.5,.45),dark=metal(0x543722,.67,.35),bright=metal(0xd8aa7e,.4,.52);
  const rubber=metal(0x171411,.92,0),tread=metal(0x514337,.85,.05);
  renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.max(1,Math.min(devicePixelRatio||1,2)));
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();fallback('3D preview paused by the browser. Reload to restore it; the menu links still work.');});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  scene=new THREE.Scene();signRoot=new THREE.Group();scene.add(signRoot);assembly=new THREE.Group();signRoot.add(assembly);studioCamera=new THREE.OrthographicCamera(-16,370,156,-568,.1,2400);studioCamera.position.z=1000;camera=studioCamera;
  scene.add(new THREE.HemisphereLight(0xb8ced8,0x766047,.8));
  // Sun from camera-right; the opposite side receives only the soft sky fill.
  const key=new THREE.DirectionalLight(0xfff0d8,2.8);key.position.set(.60,.73,.32);scene.add(key);
  const fill=new THREE.DirectionalLight(0xd2dee2,1.05);fill.position.set(-.28,-.12,.95);scene.add(fill);
  const edge=new THREE.DirectionalLight(0xffd4a1,.15);edge.position.set(-.4,.24,-.1);scene.add(edge);
  const [letters,logo,emblem]=await Promise.all([letteringTexture(),textureLoader.loadAsync('../../images/brand/spirit-striker-wordmark-original-letter-shapes-v11.png'),textureLoader.loadAsync('../../images/striker-symbol-gold.png'),loadPortal().catch(e=>{console.warn(e.message);})]);own(logo);own(emblem);logo.colorSpace=emblem.colorSpace=THREE.SRGBColorSpace;
  if(request!==loadSerial||renderer.getContext().isContextLost())return;
  slab(shapeFromPath(svg.querySelector('.curl')),12,3,copper,-18);
  for(const path of svg.querySelectorAll('.nameplate-supports path:not(.support-light)'))slab(shapeFromPath(path),12,2.4,copper,8);
  slab(shapeFromPath(svg.querySelector('#nameplate-shape')),22,4,copper,-5);
  // Original alpha is only a runtime engraving mask. No source image is altered.
  const logoMaterial=metal(0x362014,.77,.25);logoMaterial.map=logo;logoMaterial.transparent=true;
  logoMaterial.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','vec4 engraving=texture2D(map,vMapUv); diffuseColor.a*=engraving.a;');};
  const logoMesh=mesh(new THREE.PlaneGeometry(249,86.77),logoMaterial);logoMesh.position.set(164.5,69.615,21.2);
  for(const [x,y]of [[54,-13],[276,-13],[164,-31]]){pin(x,y,24,3.3,dark);pin(x,y,27,1,bright);}
  makePlanet(bright);makeEnergy();makeShell(letters,copper);makeBelt(copper,rubber,tread);makeWindmill(copper,dark,bright);
  makeMountAndMotor(copper,dark,emblem);
  reflections=createPortalReflections(THREE,renderer,{portalTexture,intensity:.82,refreshHz:8,resolution:64});
  reflections.attach([...reflectiveRims,...bands]);
  // Rear drive plane clears the full 146-unit sweep. One side gear peeks out.
  axle(274,268,-172,40,5,dark);gear(274,268,24,18,-169,copper).sign=1;
  const train=[[298,226,24,20,-1],[318,177,29,24,1],[318,124,24,20,-1],[307,75,26,22,1],[283,42,15,16,-1],[312,10,28,24,1]];
  for(const [x,y,r,t,sign]of train){axle(x,y,-181,y<50?-6:-157,4,dark);const g=gear(x,y,r,t,-169,dark);g.sign=sign;g.offset=.04;}
  // Crown-side medium gear and small idler. All teeth clear the turning bands.
  gear(312,10,28,24,-14,copper).sign=1;gear(283,42,15,16,-14,copper).sign=-1;
  environment=await createTownEnvironment(THREE,scene);
  makeSchoolSign();
  traffic=createTownTraffic(THREE,environment);
  environment.group.traverse(o=>{if(o.material?.map){o.material.map.anisotropy=renderer.capabilities.getMaxAnisotropy();o.material.map.needsUpdate=true;}});
  townCamera=new THREE.PerspectiveCamera(54,1.5,.05,150000);
  townCamera.position.copy(environment.toWorld([518,397,3.1]));
  townCamera.lookAt(environment.toWorld([503,235,3.7]));
  townCamera.updateMatrixWorld(true);
  skyScene=new THREE.Scene();sky=createTownSky(THREE,townCamera);skyScene.add(sky.group);
  const forward=new THREE.Vector3();townCamera.getWorldDirection(forward);
  const right=new THREE.Vector3().crossVectors(forward,townCamera.up).normalize();
  const signAnchor=townCamera.position.clone().addScaledVector(forward,10.5).addScaledVector(right,-3.1);
  signAnchor.y=environment.terrainHeight(signAnchor.x,-signAnchor.z);
  cameraRig={anchor:signAnchor,yaw:Math.atan2(townCamera.position.x-signAnchor.x,townCamera.position.z-signAnchor.z)};
  footing=createSignFooting(THREE);scene.add(footing.group);
  for(const light of [key,fill,edge]){
    const direction=light.position.clone().normalize().applyAxisAngle(new THREE.Vector3(0,1,0),cameraRig.yaw);light.position.copy(signAnchor).addScaledVector(direction,80);light.target.position.copy(signAnchor);scene.add(light.target);
  }
  sunDirection=key.position.clone().sub(key.target.position).normalize();
  sky.setOptions({sunDirection:sunDirection.toArray()});
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:150});key.shadow.bias=-.0004;
  assembly.traverse(o=>{if(o.isMesh&&!o.material.transparent){o.castShadow=true;o.receiveShadow=true;}});
  const contact=mesh(new THREE.PlaneGeometry(22,22),own(new THREE.ShadowMaterial({opacity:.24})),scene);
  contact.rotation.x=-Math.PI/2;contact.position.copy(signAnchor);contact.position.y+=.02;contact.receiveShadow=true;contact.name='sign-ground-shadow';
  host.append(renderer.domElement);resizeObserver=new ResizeObserver(resize);resizeObserver.observe(menu);resize();
  await Promise.all(['earth','toga'].map(async type=>{
    const texture=own(await textureLoader.loadAsync(type==='earth'?'../../assets/intro-earth-energy-v1/earth-nasa-july-5400.jpg':'../../images/globe/versions/2026-08-16-satellite-v81-intro.png'));
    texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;textures.set(type,texture);
  }));
  if(request!==loadSerial||renderer.getContext().isContextLost())return;
  textureReady=true;selectPlanet('earth');ready=true;menu.classList.add('scene-ready');
  document.querySelectorAll('.study-controls fieldset').forEach(e=>e.disabled=false);autoControl.disabled=false;townControl.disabled=false;hideControl.disabled=false;document.querySelector('#capture-plate').disabled=false;
  for(const [name,value]of Object.entries(defaults)){document.getElementById(name).value=value;document.getElementById(name+'-value').value=format(name,value);}
  document.documentElement.style.setProperty('--study-width',settings.width+'px');
  sceneMotion.disabled=false;cloudSpeed.disabled=false;
  autoControl.checked=!reduced.matches;setTownScene();updateControls();pose();run();
  // The public menu renders the actual saved town. Generated footage remains
  // an optional experiment only, and never gates the live menu's readiness.
  if(!embeddedMenu)createTownLoop(THREE,()=>{if(!ready)return;updateFilmControls();needsRender=true;run();}).then(film=>{
    if(request!==loadSerial){film.dispose();return;}townFilm=film;updateFilmControls();needsRender=true;run();
  }).catch(e=>{filmStatus.textContent='Video unavailable. The original 3D town remains active.';console.warn(e);});
}
function filmActive(){return !embeddedMenu&&townControl.checked&&backdropControl.value==='film'&&townFilm?.getState().ready&&!townFilm.getState().error;}
function updateFilmControls(){
  const state=townFilm?.getState();
  backdropControl.disabled=!ready||!townControl.checked;
  backdropControl.querySelector('[value="film"]').disabled=!state?.ready||!!state?.error;
  if(embeddedMenu)backdropControl.value='native';
  else if(state?.ready&&!state.error&&!filmChoiceMade){backdropControl.value='film';filmChoiceMade=true;}
  if(embeddedMenu&&ready&&!hostNotified){hostNotified=true;parent.postMessage({type:'spirit-menu-ready'},location.origin);}
  if(state?.error&&backdropControl.value==='film')backdropControl.value='native';
  greenControl.disabled=!ready||!townControl.checked;
  filmTimeline.disabled=!filmActive();
  if(state?.duration){filmTimeline.max=state.duration;filmTimeline.value=state.time;document.querySelector('#town-film-value').value=state.time.toFixed(1)+' s';}
  filmStatus.textContent=embeddedMenu?'Original 3D town, source buildings, road traffic and live sky.':state?.error?state.error:state?.ready?((paused||!sceneMotion.checked)?'Town and sky paused. ':'Town and sky running. ')+'30-second school loop; clouds move independently.':'Original 3D town is active while the film loads.';
}
function renderFrame(){
  const town=townControl.checked,film=filmActive()&&!captureSource;
  const visible=environment.group.visible,background=scene.background;
  reflections?.update(worldTime+driveDistance/48,{quaternion:assembly.getWorldQuaternion(new THREE.Quaternion()),sunDirection,strength:settings.energy,force:needsRender});
  renderer.autoClear=false;renderer.clear();
  if(town&&!captureSource){
    scene.background=null;
    if(greenControl.checked)renderer.setClearColor(0x00ff00,1);
    else renderer.setClearColor(0x000000,0);
    renderer.clear();
    if(!greenControl.checked){sky.update(worldTime);renderer.render(skyScene,townCamera);}
    if(film){townFilm.setGreen(greenControl.checked);townFilm.render(renderer);environment.group.visible=false;}
    renderer.clearDepth();
  }
  renderer.render(scene,camera);
  environment.group.visible=visible;scene.background=background;
}
function schedule(){
  const start=settings.delay,out=start+4*settings.stagger+settings.turn,enter=out+1.12;
  const hold=enter+settings.sweep,leave=hold+settings.hold,back=leave+settings.sweep+.12;
  return {start,out,enter,hold,leave,back,end:back+4*settings.stagger+settings.turn};
}
function resize(){
  if(!renderer)return;
  const bounds=menu.getBoundingClientRect();
  renderer.setSize(bounds.width,bounds.height,false);
  if(townCamera){
    townCamera.clearViewOffset();townCamera.aspect=bounds.width/bounds.height;
    // A phone gets a deliberate window into the same real street camera,
    // rather than stretching a 3:2 film or scrolling an oversized iframe.
    // Sign / School changes that camera window without moving world geometry.
    if(embeddedMenu&&bounds.width<=600&&bounds.width<bounds.height){
      const fullWidth=bounds.height*1.5;
      const centre=mobileStreetView==='school'?.69:.30;
      const offset=THREE.MathUtils.clamp(fullWidth*centre-bounds.width*.5,0,fullWidth-bounds.width);
      townCamera.setViewOffset(fullWidth,bounds.height,offset,0,bounds.width,bounds.height);
    }
    townCamera.updateProjectionMatrix();
  }
  lastHitView=null;needsRender=true;if(ready)pose();
}
function idleAllowed(){return !reduced.matches||manualIdle||autoControl.checked;}
function scenePlaying(){return townControl.checked&&sceneMotion.checked;}
function animationWanted(){return scenePlaying()||active||idleAllowed();}
function selectPlanet(type){
  kind=type;globeMaterial.map=textures.get(type);togaOnly.value=type==='toga'?1:0;globeMaterial.needsUpdate=true;menu.dataset.globe=type;
}
function updateControls(){
  const s=schedule();timeline.max=s.end;timeline.value=cycleTime;
  document.querySelector('#timeline-value').value=cycleTime.toFixed(2)+' s';
  earthButton.disabled=togaButton.disabled=!ready||active;
  closeButton.disabled=!ready||!active;pauseButton.disabled=!ready;
  pauseButton.textContent=paused?'Resume':!animationWanted()?'Play scene':'Pause';
  const reducedNote=reduced.matches&&!manualIdle&&!autoControl.checked?' · Menu stays open until Play; town motion has its own switch':'';
  status.textContent=(paused?'Paused · ':'')+(labels[phase]||labels.menu)+reducedNote;
  const covered=!active||(!returnMotion&&(cycleTime<=s.start||cycleTime>=s.end));
  const interactive=covered&&!hideControl.checked;
  menu.classList.toggle('study-open',!interactive);
  links.forEach(a=>{if(interactive)a.removeAttribute('tabindex');else a.setAttribute('tabindex','-1');});
  if(covered&&nearPointer)status.textContent='Menu ready · cursor nearby';
}
function phaseAt(t,s){
  if(!active)return 'menu';if(t<s.start)return 'waiting';if(t<s.enter)return 'opening';
  if(t<s.hold)return 'entering';if(t<s.leave)return 'holding';if(t<s.back)return 'leaving';return 'closing';
}
function pose(){
  if(!globe)return;
  const s=schedule(),t=active?cycleTime:0;
  bands.forEach((band,i)=>{
    const outbound=smooth((t-s.start-i*settings.stagger)/settings.turn);
    const inbound=smooth((t-s.back-i*settings.stagger)/settings.turn);
    band.rotation.y=Math.PI*(outbound+inbound);
  });
  globe.rotation.y=-Math.PI+Math.PI*smooth((t-s.enter)/settings.sweep)+Math.PI*smooth((t-s.leave)/settings.sweep);
  if(returnMotion){
    const r=returnMotion;
    globe.rotation.y=r.globe+(r.globeTarget-r.globe)*smooth(r.time/Math.max(.001,r.globeDuration));
    bands.forEach((b,i)=>{const from=r.bands[i],to=from<.001?0:Math.PI*2;b.rotation.y=from+(to-from)*smooth((r.time-r.globeDuration-i*.08)/1.25);});
  }
  // Rotate source geography without ever showing the unfinished hemisphere.
  const travel=globeTime;
  const worldAngle=kind==='toga'?togaCentre+.24*Math.sin(travel*.48):-.7+travel*.3;
  globeLongitude.value=-worldAngle/(Math.PI*2);
  rearFan.scale.setScalar(settings['fan-size']/90);
  assembly.rotation.y=THREE.MathUtils.degToRad(settings.view);
  letteringYaw.value=assembly.rotation.y;
  // Rotate around the assembled device's own centre, not the world's origin.
  assembly.position.x=164*(1-Math.cos(assembly.rotation.y));assembly.position.z=164*Math.sin(assembly.rotation.y);
  rotors.forEach(({object,radius,sign,offset})=>object.rotation.z=-sign*driveDistance/radius+offset);
  fan.rotation.z=rearFan.rotation.z=-driveDistance/24;
  energyTime.value=driveDistance/48;
  energyAmount.value=settings.energy;
  // A rigid motor rocks on its mounts. Nothing stretches or changes scale.
  const vibration=Math.sin(energyTime.value*31)*.85+Math.sin(energyTime.value*47)*.25;
  motorMount.position.y=-450+vibration;motorMount.rotation.z=Math.sin(energyTime.value*19)*.008;
  // The authored emblem stays visible during the entire portal/globe interval.
  // The engraving on the fixed nameplate remains visible with the menu closed.
  portalLogo.material.opacity=returnMotion?Math.max(0,1-smooth(returnMotion.time/.7)):active?smooth((t-s.out)/.35)*(1-smooth((t-s.back)/.35)):0;
  cleats.forEach((cleat,i)=>{const u=(i/cleats.length+driveDistance/beltLength)%1;const p=beltCurve.getPointAt(u),tangent=beltCurve.getTangentAt(u);cleat.position.copy(p);cleat.position.z+=2;cleat.rotation.z=Math.atan2(tangent.y,tangent.x)-Math.PI/2;});
  updateSignPlacement();phase=returnMotion?'returning':phaseAt(cycleTime,s);syncHitTargets();updateControls();updateFilmControls();renderFrame();needsRender=false;
}
function syncHitTargets(){
  if(active||lastHitView===settings.view+'-'+townControl.checked)return;
  signRoot.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  bands.forEach((band,i)=>{
    const position=band.children[0].geometry.attributes.position,outline=[];
    for(let x=0;x<=128;x++)outline.push(x*25+24);
    for(let x=128;x>=0;x--)outline.push(x*25);
    const points=outline.map(n=>{const p=new THREE.Vector3().fromBufferAttribute(position,n);band.localToWorld(p);p.project(camera);return [(-16+(p.x+1)*193).toFixed(2),(-156+(1-p.y)*362).toFixed(2)];});
    links[i].querySelector('.hit').setAttribute('d','M'+points.map(p=>p.join(',')).join('L')+'Z');
  });
  lastHitView=settings.view+'-'+townControl.checked;
}
function updateSignPlacement(){
  const town=townControl.checked;
  if(town&&cameraRig){
    const scale=.0065*settings.width/520;signRoot.scale.setScalar(scale);signRoot.rotation.y=cameraRig.yaw;
    const foot=new THREE.Vector3(172,-806,-180).multiplyScalar(scale).applyQuaternion(signRoot.quaternion);
    signRoot.position.copy(cameraRig.anchor).sub(foot);
  }else{signRoot.scale.setScalar(1);signRoot.rotation.set(0,0,0);signRoot.position.set(0,0,0);}
  signRoot.visible=!cleanPlate&&!hideControl.checked;signRoot.updateMatrixWorld(true);
  footing?.update(assembly.localToWorld(new THREE.Vector3(172,-806,-180)),signRoot.rotation.y+assembly.rotation.y,town&&!cleanPlate&&!hideControl.checked,signRoot.scale.x/(.0065*640/520));
  scene.getObjectByName('sign-ground-shadow').visible=town&&!cleanPlate&&!hideControl.checked;
  const points=[[0,135,0],[350,135,0],[0,-555,0],[350,-555,0]].map(p=>new THREE.Vector3(...p).applyMatrix4(assembly.matrixWorld).project(camera));
  const bounds=menu.getBoundingClientRect();
  signBounds={left:bounds.left+(Math.min(...points.map(p=>p.x))+1)*bounds.width/2,right:bounds.left+(Math.max(...points.map(p=>p.x))+1)*bounds.width/2,top:bounds.top+(1-Math.max(...points.map(p=>p.y)))*bounds.height/2,bottom:bounds.top+(1-Math.min(...points.map(p=>p.y)))*bounds.height/2};
}
function setTownScene(){
  if(!camera)return;const town=townControl.checked;document.body.classList.toggle('town-view',town);post.visible=town;environment.group.visible=town;
  camera=town?townCamera:studioCamera;scene.background=town?new THREE.Color(0xbec8c4):null;
  hideControl.disabled=!town;document.querySelector('#capture-plate').disabled=!town;
  scene.getObjectByName('sign-ground-shadow').visible=town;
  if(town)svg.setAttribute('preserveAspectRatio','none');else svg.removeAttribute('preserveAspectRatio');
  lastHitView=null;resize();needsRender=true;run();
}
function returnToMenu(){
  if(!active||returnMotion)return;
  if(cycleTime<=settings.delay){active=false;cycleTime=0;needsRender=true;run();return;}
  const angle=globe.rotation.y,visible=angle>-Math.PI/2&&angle<Math.PI/2;
  returnMotion={time:0,bands:bands.map(b=>b.rotation.y),globe:angle,globeTarget:visible?Math.PI:angle,globeDuration:visible?1.05:0};
  needsRender=true;run();
}
function updateProximity(){
  if(pointerX===null)return;
  const b=signBounds||menu.getBoundingClientRect(),margin=35;
  nearPointer=pointerX>b.left-margin&&pointerX<b.right+margin&&pointerY>b.top-margin&&pointerY<b.bottom+margin;
  hoverMenu=nearPointer||menu.contains(document.activeElement);
  if(hoverMenu&&autoControl.checked&&!paused)returnToMenu();
}
function advance(dt){
  if(scenePlaying()){worldTime+=dt;traffic?.update(worldTime);}
  if(returnMotion){
    returnMotion.time+=dt;globeTime+=dt;
    if(returnMotion.time>=returnMotion.globeDuration+1.57){returnMotion=null;active=false;cycleTime=0;lastHitView=null;}
  }else if(active){
    const s=schedule();if(cycleTime>=s.enter)globeTime+=dt;cycleTime+=dt;
    if(skipHold&&cycleTime>=s.hold&&cycleTime<s.leave)cycleTime=s.leave;
    if(cycleTime>=s.end){cycleTime=0;active=false;skipHold=false;lastHitView=null;}
  }else if(autoControl.checked&&!hoverMenu&&!menu.contains(document.activeElement)){
    selectPlanet(Math.random()<.5?'earth':'toga');active=true;autoStarted=true;cycleTime=0;globeTime=0;
  }
  driveDistance+=dt*(active?48:idleAllowed()?12:0)*settings.speed;
  pose();
}
function tick(now){raf=0;const dt=Math.max(0,(now-last)/1000);last=now;if(!paused&&visibleFrame())advance(dt);if(ready&&!paused&&visibleFrame()&&animationWanted())raf=requestAnimationFrame(tick);}
function run(){cancelAnimationFrame(raf);last=performance.now();raf=0;townFilm?.setPlaying(filmActive()&&!paused&&visibleFrame()&&scenePlaying());if(portalVideo){if(!paused&&visibleFrame()&&(active||idleAllowed()))portalVideo.play().then(()=>{portalPlaybackError='';}).catch(e=>{portalPlaybackError=e.message;});else portalVideo.pause();}if(ready&&visibleFrame()){if(needsRender)pose();if(!paused)raf=requestAnimationFrame(tick);}}
function fallback(message){
  loadSerial++;cancelAnimationFrame(raf);raf=0;ready=false;active=false;phase='menu';portalVideo?.pause();
  document.body.classList.remove('town-view');menu.classList.remove('scene-ready','study-open');menu.style.pointerEvents='';svg.removeAttribute('preserveAspectRatio');
  links.forEach((a,i)=>{a.removeAttribute('tabindex');a.querySelector('.hit').setAttribute('d',originalHitPaths[i]);});host.hidden=true;
  earthButton.disabled=togaButton.disabled=closeButton.disabled=pauseButton.disabled=true;autoControl.disabled=townControl.disabled=hideControl.disabled=true;document.querySelector('#capture-plate').disabled=true;
  document.querySelectorAll('.study-controls fieldset').forEach(e=>e.disabled=true);error=message;status.textContent=message;
}
function play(type){if(!ready||active)return;selectPlanet(type);paused=false;manualIdle=true;active=true;autoStarted=false;returnMotion=null;cycleTime=0;globeTime=0;skipHold=false;needsRender=true;run();}
function close(){
  if(!active)return;autoControl.checked=false;paused=false;returnToMenu();needsRender=true;run();
}
earthButton.addEventListener('click',()=>play('earth'));togaButton.addEventListener('click',()=>play('toga'));closeButton.addEventListener('click',close);
pauseButton.addEventListener('click',()=>{if(!animationWanted()){manualIdle=true;paused=false;}else paused=!paused;needsRender=true;updateProximity();run();});
autoControl.addEventListener('change',()=>{manualIdle=true;needsRender=true;updateProximity();run();});
timeline.addEventListener('input',()=>{if(!ready)return;autoControl.checked=false;autoStarted=false;returnMotion=null;paused=true;active=true;cycleTime=Number(timeline.value);globeTime=Math.max(0,cycleTime-schedule().enter);driveDistance=cycleTime*48*settings.speed;skipHold=false;if(portalVideo?.readyState>=2)portalVideo.currentTime=cycleTime%portalVideo.duration;needsRender=true;run();});
const format=(name,value)=>name==='energy'?Math.round(value*100)+'%':name==='width'?value+' px':name==='fan-size'?String(value):name==='view'?value+'°':name==='speed'?value.toFixed(2)+'×':value.toFixed(name==='stagger'||name==='turn'?2:1)+' s';
for(const name of Object.keys(defaults)){
  const input=document.getElementById(name);
  input.addEventListener('input',()=>{
    const fraction=cycleTime/schedule().end;settings[name]=Number(input.value);document.getElementById(name+'-value').value=format(name,settings[name]);
    if(name==='width'){document.documentElement.style.setProperty('--study-width',settings.width+'px');lastHitView=null;}
    if(['delay','stagger','turn','sweep','hold'].includes(name)){cycleTime=fraction*schedule().end;if(active)paused=true;}
    needsRender=true;run();
  });
}
document.querySelector('#reset').addEventListener('click',()=>{
  Object.assign(settings,defaults);for(const [name,value]of Object.entries(defaults)){document.getElementById(name).value=value;document.getElementById(name+'-value').value=format(name,value);}
  document.documentElement.style.setProperty('--study-width',settings.width+'px');active=false;returnMotion=null;lastHitView=null;cycleTime=0;globeTime=0;paused=false;skipHold=false;autoControl.checked=false;sceneMotion.checked=true;cloudSpeed.value=38;document.querySelector('#cloud-speed-value').value=38;sky?.setOptions({cloudSpeed:38});needsRender=true;run();
});
document.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;pointerX=e.clientX;pointerY=e.clientY;updateProximity();});
document.addEventListener('pointerleave',()=>{pointerX=null;nearPointer=false;hoverMenu=menu.contains(document.activeElement);});
menu.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&active){e.preventDefault();close();}});
menu.addEventListener('focusin',()=>{hoverMenu=true;if(!paused)returnToMenu();});
menu.addEventListener('focusout',()=>{queueMicrotask(()=>{hoverMenu=nearPointer||menu.contains(document.activeElement);run();});});
townControl.addEventListener('change',setTownScene);
sceneMotion.addEventListener('change',()=>{needsRender=true;run();});
cloudSpeed.addEventListener('input',()=>{sky?.setOptions({cloudSpeed:Number(cloudSpeed.value)});document.querySelector('#cloud-speed-value').value=cloudSpeed.value;needsRender=true;run();});
backdropControl.addEventListener('change',()=>{filmChoiceMade=true;needsRender=true;run();});
greenControl.addEventListener('change',()=>{needsRender=true;run();});
filmTimeline.addEventListener('input',()=>{if(!townFilm)return;const time=Number(filmTimeline.value);paused=true;manualIdle=true;run();townFilm.seek(time).then(()=>{needsRender=true;run();});});
hideControl.addEventListener('change',()=>{menu.style.pointerEvents=hideControl.checked?'none':'';needsRender=true;run();});
document.querySelector('#capture-plate').addEventListener('click',()=>{const a=document.createElement('a');a.href=window.SIDEBAR_STUDY.capture({hideSign:true});a.download='town-clean-plate-v10.png';a.click();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
document.addEventListener('visibilitychange',run);reduced.addEventListener('change',()=>{if(reduced.matches)autoControl.checked=false;run();});
addEventListener('pagehide',e=>{cancelAnimationFrame(raf);portalVideo?.pause();townFilm?.setPlaying(false);if(e.persisted)return;loadSerial++;resizeObserver?.disconnect();townFilm?.dispose();sky?.dispose();footing?.dispose();reflections?.dispose();traffic?.dispose();environment?.dispose();resources.forEach(r=>r.dispose());renderer?.dispose();if(portalUrl)URL.revokeObjectURL(portalUrl);});
addEventListener('pageshow',e=>{if(e.persisted){resize();run();}});
window.SIDEBAR_STUDY={
  getPortalBounds:()=>{
    if(!ready)return null;
    const bounds=menu.getBoundingClientRect(),point=new THREE.Vector3(164,-157,6),edge=point.clone().add(new THREE.Vector3(151,0,0));
    assembly.localToWorld(point).project(camera);assembly.localToWorld(edge).project(camera);
    return {x:bounds.left+(point.x+1)*bounds.width/2,y:bounds.top+(1-point.y)*bounds.height/2,radius:Math.abs(edge.x-point.x)*bounds.width/2};
  },
  getState:()=>({phase,kind,ready,textureReady,active,cycleTime,paused,error,nearPointer,returning:!!returnMotion,
    portalReady:!!portalTexture,portalTime:portalVideo?.currentTime,portalSeeking:portalVideo?.seeking,portalPaused:portalVideo?.paused,portalPlaybackError,portalLogoOpacity:portalLogo?.material.opacity,reflections:reflections?.getState(),
    town:townControl.checked,hiddenSign:hideControl.checked,driveDistance,rotation:globe?.rotation.y,bandAngles:bands.map(b=>b.rotation.y),
    gears:rotors.map(r=>r.object.rotation.z),windmill:fan?.rotation.z,rearWindmill:rearFan?.rotation.z,motorY:motorMount?.position.y,motorScale:motorMount?.scale.toArray(),
    settings:{...settings},autoCycle:autoControl.checked,schedule:schedule(),rendering:!!raf,width:menu.getBoundingClientRect().width,signBounds,traffic:traffic?.getState(),environment:environment?.getState(),
    camera:camera?.isPerspectiveCamera?{position:camera.position.toArray(),matrix:camera.matrixWorld.toArray(),projection:camera.projectionMatrix.toArray(),aspect:camera.aspect,view:camera.view?{...camera.view}:null}:null,sky:sky?.getState(),film:townFilm?.getState(),footing:footing?.getState(),sceneMotion:sceneMotion.checked,embeddedMenu,parentVisible,backdrop:backdropControl.value,attachment:embeddedMenu?'native-town-v13':'school-life-v11'}),
  capture:({hideSign=false,hideTraffic=false,greenSky=false,width=1800,height=1200}={})=>{
    const size=renderer.getSize(new THREE.Vector2()),ratio=renderer.getPixelRatio();
    const background=scene.background,trafficVisible=traffic.group.visible;
    try{
      cleanPlate=hideSign;captureSource=greenSky;
      if(hideTraffic)traffic.group.visible=false;
      if(greenSky)scene.background=new THREE.Color(0x00ff00);
      renderer.setPixelRatio(1);renderer.setSize(width,height,false);pose();
      return renderer.domElement.toDataURL('image/png');
    }finally{
      scene.background=background;traffic.group.visible=trafficVisible;cleanPlate=false;captureSource=false;
      renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);pose();
    }
  }
};
earthButton.disabled=togaButton.disabled=true;
prepare().catch(e=>{console.error(e);fallback('The 3D mechanism could not load. Original menu links remain available.');});
