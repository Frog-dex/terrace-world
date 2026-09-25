/* Prepared by: Codex. Read-only cinematic adapter. Original geometry and saves stay untouched. */
import * as THREE from './lib/three.module.js';
import { createTownPerspective } from './intro-town-perspective.js?v=terrain-flat-v4';
import { createRegionalRelief } from './intro-nevada-relief.js?v=complete-regional-v5';
import { createRegionalRoads } from './intro-regional-roads.js?v=terrain-flat-v4';
import { createAirportRoof } from './intro-airport-roof.js?v=clear-rockets-4';
import { createRooftopFireworks } from './intro-rooftop-fireworks.js?v=school-fireworks-v2';
import { createStargazingSky } from './intro-stargazing-sky.js?v=rocket-1983-v1';

const DURATION=35.4, SOURCE=new URL('assets/intro-nevada-v1/school-source/',document.baseURI);
const params=new URLSearchParams(location.search), $=id=>document.getElementById(id);
const canvas=$('town'),viewport=$('viewport'),playButton=$('play'),replayButton=$('replay'),timeline=$('timeline');
const fireworkCanvas=$('fireworks');
const fireworks=createRooftopFireworks(fireworkCanvas,{reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
let motionAllowed=!matchMedia('(prefers-reduced-motion: reduce)').matches;
const captureCanvas=document.createElement('canvas');
const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
const smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
let seconds=0,playing=false,ready=false,error=null,disposed=false,raf=0,lastTick=0,width=1,height=1,dpr=1;
let world,town,relief,roads,props,authoredWorld,renderer,scene,camera,sky,ambient,sun,cameraKeys,targetKeys,cameraState,lighting;
const ortho=new THREE.OrthographicCamera(-1,1,1,-1,.12,100000);
if(params.get('controls')==='0')document.body.dataset.chrome='hidden';
if(window.parent!==window)document.body.dataset.embedded='true';

// Time-aware Hermite curves share velocity across every road bend. The final
// tangent is zero, settling at roof height without a separate snap or zoom.
function curve(keys,time){
  const t=clamp(time,keys[0].t,keys.at(-1).t);let i=0;
  while(i<keys.length-2&&t>keys[i+1].t)i++;
  const a=keys[i],b=keys[i+1],span=b.t-a.t,u=(t-a.t)/span;
  const tangent=j=>{if(j===keys.length-1)return[0,0,0];const l=keys[Math.max(0,j-1)],r=keys[j+1];return l.p.map((v,k)=>(r.p[k]-v)/(r.t-l.t));};
  const ma=tangent(i),mb=tangent(i+1);
  return a.p.map((v,k)=>(2*u**3-3*u*u+1)*v+(u**3-2*u*u+u)*span*ma[k]+(-2*u**3+3*u*u)*b.p[k]+(u**3-u*u)*span*mb[k]);
}
function makeSky(){
  sky=createStargazingSky(THREE,{up:'z'});scene.add(sky.group);
}
function phase(){return seconds<5?'regional-flight':seconds<9?'airport-approach':seconds<13?'road-to-school':seconds<17?'roof-arrival':seconds<20?'rooftop-perspective':seconds<24?'look-up':seconds<27.5?'look-to-stars':'firework';}
function controls(){
  playButton.textContent=playing?'Pause':'Play';playButton.setAttribute('aria-label',playing?'Pause camera sequence':'Play camera sequence');
  timeline.value=String(seconds);timeline.setAttribute('aria-valuetext',`${seconds.toFixed(1)} of ${DURATION} seconds`);$('clock').textContent=`${seconds.toFixed(1)} / ${DURATION.toFixed(1)}s`;
  $('caption').textContent=({'regional-flight':'Nevada · Regional approach','airport-approach':'TOGA · Takeoff','road-to-school':'TOGA · School approach','roof-arrival':'TOGA · Rooftop','rooftop-perspective':'TOGA · Rooftop perspective','look-up':'TOGA · Looking up','look-to-stars':'TOGA · Stargazing','firework':'TOGA · First spark'})[phase()];
  const caption=$('story-caption');
  caption.hidden=seconds<15.5||seconds>20.5;
  caption.style.opacity=String(smooth((seconds-15.5)/.45)*(1-smooth((seconds-19.8)/.7)));
}
function render(){
  if(!ready||disposed)return;
  const p=curve(cameraKeys,seconds),target=curve(targetKeys,seconds);
  const approach=smooth((seconds-17)/3),lookUp=smooth((seconds-20)/4);
  const flatBlend=smooth((seconds-13)/4)*(1-approach);
  // Preserve the exact approved 0..17-second flight. Only after its flat
  // arrival do we enter the right rooftop corner at a seated eye height.
  // Character placements remain provisional until Blu marks the reference.
  if(seconds>17){
    const right=Math.max(...town.roofMetadata.outline.map(p=>p[0]))-1.7;
    const front=Math.max(...town.roofMetadata.outline.map(p=>p[1]))-1.5;
    const eye=[right,front,town.roof[2]+1.6];
    for(let i=0;i<3;i++)p[i]=mix(p[i],eye[i],approach);
    const pitch=lookUp*62*Math.PI/180,distance=17;
    target[0]=p[0];target[1]=p[1]-Math.cos(pitch)*distance;target[2]=p[2]+Math.sin(pitch)*distance;
  }
  const inTown=p[0]>=0&&p[0]<=world.W&&p[1]>=0&&p[1]<=world.H;
  const ground=inTown?town.terrainHeight(p[0],p[1]):relief.sampleSurface(p[0],p[1]);
  p[2]=Math.max(p[2],ground+3,seconds>13?town.roof[2]+1.55:-Infinity);
  const flatHeight=Math.max(10.5,20/(width/height)),flatWidth=flatHeight*width/height;
  const focusDistance=Math.hypot(...p.map((v,i)=>v-target[i]));
  // The old flat-to-perspective handoff widened the frame by 65 percent,
  // reading as a pull-back although the camera moved forward. Match the
  // last flat frame's height at the focus plane throughout the roof approach.
  const roofFov=2*Math.atan(flatHeight/(2*focusDistance))*180/Math.PI;
  camera.fov=mix(mix(44,width<height?62:54,smooth(seconds/7)),roofFov,smooth((seconds-13)/4));camera.updateProjectionMatrix();
  // Source drawing uses Y south. Reflect at the render boundary, so physical
  // X/Y/Z are East/North/Up, exactly matching the globe's tangent frame.
  camera.position.set(p[0],-p[1],p[2]);camera.lookAt(target[0],-target[1],target[2]);camera.updateMatrixWorld();
  // Homogeneous projection interpolation keeps the focus plane continuous.
  // At 1 this is EXACTLY an orthographic projection, not a tiny-FOV imitation.
  ortho.left=-flatWidth/2;ortho.right=flatWidth/2;ortho.top=flatHeight/2;ortho.bottom=-flatHeight/2;ortho.updateProjectionMatrix();
  for(let i=0;i<16;i++)camera.projectionMatrix.elements[i]=mix(camera.projectionMatrix.elements[i]/focusDistance,ortho.projectionMatrix.elements[i],flatBlend);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  const nightProgress=smooth((seconds-22)/5),hour=mix(16,21.5,nightProgress),townBlend=smooth((seconds-1.5)/3);
  document.body.dataset.night=String(nightProgress>.4);
  lighting=town.updateLighting(hour);relief.updateLighting(hour,lighting.groundLinear);relief.setStyleBlend(.64*smooth((seconds-1)/7));relief.setTownBlend(townBlend);town.setBlend(townBlend);
  props?.update(seconds,{groundLinear:lighting.groundLinear,camera});
  props.silhouette.rotation.z=mix((town.school.angle||0)-Math.PI/4,0,flatBlend);
  roads?.updateLighting(lighting.groundLinear);roads?.setBlend(townBlend);
  ambient.color.setRGB(...lighting.groundLinear);ambient.intensity=2.2;sun.color.setRGB(...lighting.groundLinear);sun.intensity=.75;
  sky.update(camera,{night:smooth(nightProgress),flattening:flatBlend,rotation:motionAllowed?Math.max(0,seconds-24)*.012:0});
  scene.fog.color.setRGB(...[.51,.65,.73].map((v,i)=>mix(v,[.010,.014,.018][i],smooth(nightProgress))));
  scene.fog.near=mix(12000,48,flatBlend**4);scene.fog.far=mix(52000,145,flatBlend**4);renderer.render(scene,camera);fireworks.render(seconds,width,height,dpr,{motion:motionAllowed});
  cameraState={position:p,target,physicalPosition:camera.position.toArray(),viewingSide:flatBlend===1?'authored +Y front; no reverse facades':'authored +X/+Y; geographic southeast',projection:flatBlend===1?'orthographic':'perspective-to-orthographic',flatBlend,flatViewport:[flatWidth,flatHeight],heightAboveRoof:p[2]-town.roof[2],terrainClearance:p[2]-ground,elevationDeg:Math.atan2(p[2]-target[2],Math.hypot(target[0]-p[0],target[1]-p[1]))*180/Math.PI,fov:camera.fov};controls();
}
function project(point){if(!ready)return null;const q=new THREE.Vector3(point[0],-point[1],point[2]).project(camera);return[(q.x+1)*width/2,(1-q.y)*height/2,q.z];}
function getState(){return{version:'school-fireworks-v2',ready,error,disposed,playing,time:seconds,duration:DURATION,phase:phase(),width,height,dpr,camera:cameraState,hour:lighting?.hour,lighting,storyCaption:$('story-caption').hidden?null:$('story-caption').textContent,roofWorld:town?.roof,roof:town?.roofMetadata,schoolId:town?.school.id,source:'TOGA-REG-001 / unchanged city-current.json',stats:town?.getState(),regional:relief?.getState(),roads:roads?.getState(),additions:props?.getState(),fireworks:fireworks.getState(),render:renderer?.info.render};}
function tick(now){raf=0;if(!playing||disposed)return;if(lastTick)seconds=Math.min(DURATION,seconds+Math.max(0,now-lastTick)/1000);lastTick=now;if(seconds>=DURATION)playing=false;render();if(playing)raf=requestAnimationFrame(tick);else{window.dispatchEvent(new CustomEvent('nevadaintro:ended',{detail:getState()}));if(window.parent!==window)window.parent.postMessage({type:'toga:intro-next'},location.origin);}}
function play(){if(!ready||playing||disposed)return getState();if(seconds>=DURATION)seconds=0;motionAllowed=true;playing=true;lastTick=0;render();raf=requestAnimationFrame(tick);return getState();}
function pause(){playing=false;cancelAnimationFrame(raf);raf=0;lastTick=0;controls();return getState();}
function seek(time,{manual=true}={}){const v=Number(time);if(!Number.isFinite(v))throw new TypeError('NEVADA_INTRO.seek expects a finite time.');pause();if(manual)motionAllowed=true;seconds=clamp(v,0,DURATION);render();return getState();}
function resize(){const b=viewport.getBoundingClientRect();width=Math.max(1,Math.round(b.width));height=Math.max(1,Math.round(b.height));dpr=Math.min(window.devicePixelRatio||1,1.5);if(renderer){renderer.setPixelRatio(dpr);renderer.setSize(width,height,false);}if(camera){camera.aspect=width/height;camera.fov=width<height?62:54;camera.updateProjectionMatrix();}render();}
function dispose(){if(disposed)return;pause();disposed=true;window.removeEventListener('resize',resize);town?.dispose();relief?.dispose();roads?.dispose();props?.dispose();fireworks.dispose();sky?.dispose();renderer?.dispose();renderer?.forceContextLoss();}

playButton.addEventListener('click',()=>playing?pause():play());replayButton.addEventListener('click',()=>{seek(0);play();});timeline.max=String(DURATION);timeline.addEventListener('input',()=>seek(timeline.value));
document.addEventListener('keydown',event=>{if(event.code!=='Space'||event.repeat||/^(INPUT|BUTTON|A|TEXTAREA|SELECT)$/.test(event.target.tagName))return;event.preventDefault();if(playing)pause();else play();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('resize',resize);
const api={duration:DURATION,play,pause,seek,getState,project,dispose};window.NEVADA_INTRO=api;
window.__captureFrame=time=>{if(!ready||disposed)return null;if(time!==undefined)seek(time);else render();if(captureCanvas.width!==canvas.width||captureCanvas.height!==canvas.height){captureCanvas.width=canvas.width;captureCanvas.height=canvas.height;}const context=captureCanvas.getContext('2d');context.drawImage(canvas,0,0);context.drawImage(fireworkCanvas,0,0);return captureCanvas.toDataURL('image/jpeg',.94);};
api.ready=(async()=>{
  try{
    const response=await fetch(new URL('city-current.json',SOURCE));if(!response.ok)throw new Error(`Original town checkpoint returned HTTP ${response.status}.`);
    const city=await response.json();if(!city.terrain?.values?.length||!city.buildings?.length||!city.roads?.length)throw new Error('Incomplete town checkpoint.');
    world=window.TogaWorld;for(const key of ['buildings','roads','towers','parcels'])if(Array.isArray(city[key]))world[key].splice(0,world[key].length,...city[key]);
    if(city.props)world.props=city.props;if(city.aircraft)world.aircraft=city.aircraft;world.terrain=city.terrain;world.source={...world.source,image:new URL('references/toga-original.jpeg',SOURCE).href};
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
    scene=new THREE.Scene();scene.fog=new THREE.Fog(0xbdd3df,12000,52000);camera=new THREE.PerspectiveCamera(54,1,.12,100000);camera.up.set(0,0,1);
    ambient=new THREE.AmbientLight(0xffffff,2.2);scene.add(ambient);sun=new THREE.DirectionalLight(0xffffff,.75);sun.position.set(-1000,-600,1600);scene.add(sun);makeSky();
    authoredWorld=new THREE.Group();authoredWorld.name='Authored XY south to physical ENU';authoredWorld.scale.y=-1;scene.add(authoredWorld);
    relief=await createRegionalRelief(THREE,{center:[512,384],metresPerUnit:2});authoredWorld.add(relief.group);town=createTownPerspective(THREE,world);authoredWorld.add(town.group);
    roads=createRegionalRoads(THREE,{world,metresPerUnit:2,sampleSurface:(x,y)=>x>=0&&x<=world.W&&y>=0&&y<=world.H?town.terrainHeight(x,y):relief.sampleRenderedSurface(x,y)});authoredWorld.add(roads.group);
    props=createAirportRoof(THREE,{world,roof:town.roof,roofMetadata:town.roofMetadata});authoredWorld.add(props.group);
    const[rx,ry,rz]=town.roof;
    const diagonal=8400/Math.sqrt(2);
    const roofCenterX=(town.roofMetadata.outline.reduce((sum,p)=>sum+p[0],0)/town.roofMetadata.outline.length);
    cameraKeys=[{t:0,p:[512+diagonal,384+diagonal,6000]},{t:3,p:[1650,1850,1650]},{t:5,p:[415,700,215]},{t:7.5,p:[250,480,110]},{t:9,p:[405,500,96]},{t:11,p:[530,410,50]},{t:13,p:[518,362,24]},{t:15.5,p:[roofCenterX+1.5,ry+17,rz+4.2]},{t:17,p:[roofCenterX,ry+17,rz+3.4]}];
    targetKeys=[{t:0,p:[512,384,0]},{t:3,p:[250,450,0]},{t:5,p:[105,455,2]},{t:7.5,p:[108,300,12]},{t:9,p:[300,340,6]},{t:11,p:[460,334,7]},{t:13,p:[rx,ry,rz+.8]},{t:15.5,p:[roofCenterX,ry,rz+2.9]},{t:17,p:[roofCenterX,ry,rz+3.4]}];
    ready=true;$('status').hidden=true;playButton.disabled=false;replayButton.disabled=false;timeline.disabled=false;resize();seek(params.has('t')?Number(params.get('t')):0,{manual:false});
    window.dispatchEvent(new CustomEvent('nevadaintro:ready',{detail:getState()}));if(params.get('autoplay')==='1'&&!matchMedia('(prefers-reduced-motion: reduce)').matches)play();return getState();
  }catch(cause){error=String(cause?.message||cause);$('status').hidden=false;$('status').textContent=`School approach could not load: ${error}`;console.error(cause);return getState();}
})();
