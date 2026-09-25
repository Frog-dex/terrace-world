// Prepared by: Codex. Read-only counterpart of Globe v81's live compositor.
// Never rebake a previous satellite render or write the user's editor state.
const WIDTH=4096,HEIGHT=2048;
const DEFAULT_LAYOUT={
 toga:{u:0.43276742709148897,v:0.4084277469674823,h:0.59,stretch:1.30,rot:0.05235987755982989},
 mogo:{u:0.9189354004271191,v:0.4367211261820565,h:0.56,stretch:0.90,rot:0.06981317007977318},
 ant:{u:0.50,v:null,h:null,stretch:1.00,rot:0,style:'a'}
};
const ROOT='work/globe-satellite-v77-one-pass/';
const COMPONENTS=[
 '01-asia_analogue.png','02-authored_island_02.png','03-authored_island_03.png',
 '04-far_left_uk_analogue.png','07-authored_island_07.png','08-authored_island_08.png',
 '09-south_africa_amazon_analogue.png','10-authored_island_10.png',
 '11-authored_island_11.png','12-authored_island_12.png','13-authored_island_13.png',
 '14-authored_island_14.png','15-authored_island_15.png','16-authored_island_16.png',
 '17-small_southern_island.png','18-oceania_australia_analogue.png','19-southern_offshore_landmass.png'
];
export function readTogaLayout(){
 let layout=structuredClone(DEFAULT_LAYOUT),source='approved-default';
 try{
  const saved=JSON.parse(localStorage.getItem('globeLayout_v1'));
  if(saved&&['toga','mogo'].every(name=>['u','v','h','stretch','rot'].every(key=>Number.isFinite(saved[name]?.[key])))){
   layout=saved;source='live-edit';
  }
 }catch{}
 return {layout,source};
}
function load(src){return new Promise((resolve,reject)=>{
 const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('TOGA layer failed to load: '+src));
 im.src=new URL('../'+src,import.meta.url).href;
});}
function canvas(){const c=document.createElement('canvas');c.width=WIDTH;c.height=HEIGHT;return c;}
function stamp(ctx,im,L){
 const h=L.h*HEIGHT,w=Math.min(WIDTH,im.width/im.height*h*L.stretch);
 for(const dx of[-WIDTH,0,WIDTH]){
  ctx.save();ctx.translate(L.u*WIDTH+dx,L.v*HEIGHT);ctx.rotate(L.rot);
  ctx.drawImage(im,-w/2,-h/2,w,h);ctx.restore();
 }
}
export async function loadTogaWorld(THREE,renderer){
 const {layout,source}=readTogaLayout();
 const paths=[ROOT+'refined-assets-v4/ocean-ice-base-v4.png',
  'work/globe-from-original-sketches-v3-earth-analogues/live-editor-topology/antarctica-alpha.png',
  ROOT+'refined-assets-v6/toga-terrain-frame-v6.png',
  ...COMPONENTS.map(name=>ROOT+'refined-assets-v6/mogo-components/'+name)];
 const [ocean,ice,toga,...mogo]=await Promise.all(paths.map(load));
 const surface=canvas(),mask=canvas(),ctx=surface.getContext('2d'),mx=mask.getContext('2d');
 // Match globe.html draw order, seam wraps, dimensions and default filtering.
 ctx.drawImage(ocean,0,0,WIDTH,HEIGHT);stamp(ctx,toga,layout.toga);
 for(const im of mogo)stamp(ctx,im,layout.mogo);
 mx.fillStyle='#fff';mx.fillRect(0,0,WIDTH,HEIGHT);mx.globalCompositeOperation='destination-out';
 mx.drawImage(ice,0,0,WIDTH,HEIGHT);stamp(mx,toga,layout.toga);
 for(const im of mogo)stamp(mx,im,layout.mogo);
 mx.globalCompositeOperation='source-over';
 const atlas=new THREE.CanvasTexture(surface),waterMask=new THREE.CanvasTexture(mask);
 atlas.colorSpace=THREE.SRGBColorSpace;
 for(const texture of[atlas,waterMask]){
  texture.wrapS=THREE.RepeatWrapping;
  texture.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
 }
 const phi=layout.toga.u*Math.PI*2,theta=layout.toga.v*Math.PI;
 const homeNormal=new THREE.Vector3(-Math.cos(phi)*Math.sin(theta),Math.cos(theta),Math.sin(phi)*Math.sin(theta));
 const facingRotation=Math.atan2(-homeNormal.x,homeNormal.z);
 window.__togaWorldProof={version:'v81-live-layout',layout,source,loaded:paths.length,width:WIDTH,height:HEIGHT,paths};
 // Diagnostic captures are the actual composed pixels, not a replacement map.
 window.__captureTogaAtlas=()=>surface.toDataURL('image/png');
 return {atlas,waterMask,homeNormal,facingRotation};
}
