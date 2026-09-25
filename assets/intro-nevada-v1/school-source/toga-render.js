/* Top-down 2.5D: ground stays planar; elevations, normal lighting and depth sorting
   are shared by the top-down and isometric views. No 3D engine or game assets. */
window.TogaRenderer=(()=>{
const TAU=Math.PI*2,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const poly=(c,p,fill,stroke,width=1)=>{c.beginPath();p.forEach((v,i)=>i?c.lineTo(...v):c.moveTo(...v));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}};
const line=(c,p,color,w=1)=>{c.beginPath();p.forEach((v,i)=>i?c.lineTo(...v):c.moveTo(...v));c.strokeStyle=color;c.lineWidth=w;c.stroke();};
const disk=(c,x,y,r,color)=>{c.beginPath();c.arc(x,y,r,0,TAU);c.fillStyle=color;c.fill();};
const random=(n)=>()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
const canvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
function solar(hour){const altitude=Math.sin((hour-6)/24*TAU),day=clamp((altitude+.13)/.5),warm=Math.exp(-Math.pow(altitude/.23,2));return{altitude,day,night:1-day,ambient:[.15+.85*day,.18+.80*day-warm*.07,.23+.70*day-warm*.13],sun:[Math.cos((hour-6)/24*TAU),.48,Math.max(.08,altitude)],warm};}
function make(world){
  const G=world.geometry,T=world.terrainTools;let drawingBuilding=null,layers={fields:true,roads:true,buildings:true,terrain:true,contours:false},layerKey='';
  const A=window.TogaAssets,Civil=window.TogaCivilian,assetMeshes=new Map(),civilMeshes=new Map();
  const placedCivil=new Map(),staticRadiance=new Map();let staticLights=[],dynamicLights=[],cacheRadiance=false,lightingEpoch='',groundEpoch=0,preparedEpoch=-1,maskKey='',shadedKey='',stats={};
  const buildingZ=(b,z)=>world.buildingZ?world.buildingZ(b,z):z;
  // Stable IDs retain the user's exact saved footprints, rotations and dimensions.
  const airportRoles={'hangar':'hangar','building-084':'hangar','building-085':'hangar','building-083':'workshop','building-001':'operations','building-002':'workshop','building-003':'operations'};
  function airframe(b){
    const w=b.w,d=b.d,faces=[{o:[b.x,b.y],u:[1,0],n:[0,-1],span:w},{o:[b.x+w,b.y],u:[0,1],n:[1,0],span:d},{o:[b.x+w,b.y+d],u:[-1,0],n:[0,1],span:w},{o:[b.x,b.y+d],u:[0,-1],n:[-1,0],span:d}];
    const pavement=world.roads.filter(r=>r.kind==='runway'||r.kind==='apron');
    for(const f of faces){const p=G.point(b,[f.o[0]+f.u[0]*f.span/2+f.n[0]*5,f.o[1]+f.u[1]*f.span/2+f.n[1]*5]);f.distance=G.nearest(pavement,p)?.distance??Infinity;}
    const f=faces.sort((a,b)=>a.distance-b.distance)[0];return {...f,p:(u,v,z=0)=>[f.o[0]+f.u[0]*u+f.n[0]*v,f.o[1]+f.u[1]*u+f.n[1]*v,z]};
  }
  const ground=canvas(3072,2304),g=ground.getContext('2d'),lm=canvas(1024,768),lg=lm.getContext('2d'),shaded=canvas(3072,2304),sc=shaded.getContext('2d');
  const preparedGround=canvas(3072,2304),pg=preparedGround.getContext('2d'),staticMask=canvas(1024,768),sm=staticMask.getContext('2d');
  const relief=canvas(256,192),rc=relief.getContext('2d');let terrainObject=null,terrainRevision=-1,contourStep=5,contourLines=[];
  function rebuildTerrain(interval=5){const t=world.terrain;for(let y=0;y<192;y++)for(let x=0;x<256;x++){const wx=x*4,wy=y*4,gx=(T.sample(t,wx+8,wy)-T.sample(t,wx-8,wy))/16,gy=(T.sample(t,wx,wy+8)-T.sample(t,wx,wy-8))/16,v=clamp(.96-gx*.18-gy*.22,.74,1);rc.fillStyle=`rgb(${Math.round(v*255)},${Math.round(v*254)},${Math.round(v*251)})`;rc.fillRect(x,y,1,1);}contourLines=T.contours(t,interval);terrainObject=t;terrainRevision=t.revision;contourStep=interval;preparedEpoch=-1;shadedKey='';}
  const original=new Image();original.src=world.source.image;let access=[],lamps=[],occluders=[],solarState,active=[],project,settings;
  function build(){
    groundEpoch++;preparedEpoch=-1;maskKey='';shadedKey='';lightingEpoch='';staticRadiance.clear();placedCivil.clear();civilMeshes.clear();
    const rnd=random(1980);g.setTransform(3,0,0,3,0,0);g.fillStyle='#b7a68a';g.fillRect(0,0,1024,768);
    for(let i=0;i<650;i++){const x=rnd()*1024,y=rnd()*768,r=10+rnd()*65,gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,i%2?'#a0814c0d':'#eee0b80f');gr.addColorStop(1,'transparent');g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);}
    for(let i=0;i<95000;i++){g.fillStyle=i%2?'#fff1ce20':'#4a41251e';g.fillRect(rnd()*1024,rnd()*768,.25+rnd()*.55,.23);}
    // Painted relief only: broad shallow valley sides, no mesh or displaced map coordinates.
    for(const [x,y,rx,ry,alpha] of [[-75,355,290,600,.15],[1100,380,340,590,.13],[485,-150,680,285,.09],[500,865,670,250,.08]]){g.save();g.translate(x,y);g.scale(rx,ry);const shade=g.createRadialGradient(0,0,.15,0,0,1);shade.addColorStop(0,`rgba(87,72,49,${alpha})`);shade.addColorStop(.62,`rgba(108,90,59,${alpha*.5})`);shade.addColorStop(1,'transparent');g.fillStyle=shade;g.fillRect(-1,-1,2,2);g.restore();}
    for(const f of layers.fields?world.parcels:[]){
      const colors=['#85916b','#70876b','#b09a78','#988c6e','#5f765b'];poly(g,f.points,colors[f.crop],'#948365',.8);g.save();poly(g,f.points);g.clip();
      const minX=Math.min(...f.points.map(p=>p[0])),maxX=Math.max(...f.points.map(p=>p[0])),minY=Math.min(...f.points.map(p=>p[1])),maxY=Math.max(...f.points.map(p=>p[1]));
      g.translate((minX+maxX)/2,(minY+maxY)/2);g.rotate(f.crop%2?.13:1.48);
      for(let y=-130;y<130;y+=.75){line(g,[[-140,y],[140,y]],f.crop===2?'#b8a87966':'#bac29238',.2);line(g,[[-140,y+.28],[140,y+.28]],'#403f311a',.16);}
      for(let i=0;i<700;i++){g.fillStyle='#302f1c0d';g.fillRect(rnd()*260-130,rnd()*260-130,.4,.4);}g.restore();
    }
    // Concrete service aprons stay attached to each rotated airfield building.
    if(layers.buildings&&layers.roads)for(const b of world.buildings.filter(b=>airportRoles[b.id])){
      const f=airframe(b),reach=airportRoles[b.id]==='hangar'?Math.min(18,f.span*.6):7,pt=(u,v)=>G.point(b,f.p(u,v)).slice(0,2),outline=[pt(-1,0),pt(f.span+1,0),pt(f.span+1,reach),pt(-1,reach)];
      poly(g,outline,'#a9aa9a','#8f907d',.45);g.save();poly(g,outline);g.clip();
      for(let u=-1;u<f.span+1;u+=6)line(g,[pt(u,0),pt(u,reach)],'#73796945',.18);
      for(let v=0;v<reach;v+=6)line(g,[pt(-1,v),pt(f.span+1,v)],'#73796945',.18);
      for(let k=0;k<8;k++){const p=pt(f.span*(.25+rnd()*.5),2+rnd()*(reach-2));disk(g,...p,.3+rnd()*.7,'#41493e12');}
      if(airportRoles[b.id]==='hangar'){line(g,[pt(f.span/2,2),pt(f.span/2,reach-1)],'#d0bd7277',.38);line(g,[pt(f.span/2-2,reach*.65),pt(f.span/2+2,reach*.65)],'#d0bd7277',.38);}
      g.restore();
    }
    access=world.connect();g.lineCap='round';g.lineJoin='round';
    const allRoads=layers.roads?[...world.roads,...access]:[];
    for(const r of allRoads){const dirt=r.kind==='track'||r.kind==='driveway';g.lineCap=r.kind==='runway'?'butt':'round';line(g,r.points,dirt?'#a49479':'#c4c0b1',r.width+(dirt?1.8:3));}
    g.lineCap='round';
    // One continuous pavement pass covers every shoulder at crossing and T junctions.
    for(const r of allRoads.filter(r=>r.kind==='track'||r.kind==='driveway'))line(g,r.points,'#a18f6b',r.width);
    for(const r of allRoads.filter(r=>r.kind!=='track'&&r.kind!=='driveway').sort((a,b)=>(a.kind==='runway')-(b.kind==='runway'))){g.lineCap=r.kind==='runway'?'butt':'round';line(g,r.points,r.kind==='runway'?'#686e67':r.kind==='apron'?'#969b8d':'#737c7e',r.width);}
    // Fine pavement grain is baked once. No per-frame pebble geometry.
    for(const r of allRoads.filter(r=>r.kind==='road'))for(let i=1;i<r.points.length;i++){
      const a=r.points[i-1],b=r.points[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len<.01)continue;
      for(let k=0;k<len*r.width*.8;k++){const t=rnd(),v=(rnd()-.5)*(r.width-.5);g.fillStyle=k%2?'#e0e2dc12':'#26343b14';g.fillRect(a[0]+dx*t-dy/len*v,a[1]+dy*t+dx/len*v,.13,.10);}
    }
    // Fine aggregate and rubber wear are clipped to the strip, not drawn across desert.
    for(const r of allRoads.filter(r=>r.kind==='runway')){const a=r.points[0],b=r.points.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,at=(u,v)=>[a[0]+dx*u+nx*v,a[1]+dy*u+ny*v];g.save();poly(g,[at(0,-r.width/2),at(1,-r.width/2),at(1,r.width/2),at(0,r.width/2)]);g.clip();
      for(let k=0;k<len*r.width*.9;k++){const p=at(rnd(),(rnd()-.5)*r.width);g.fillStyle=k%2?'#e4e2c511':'#252d2918';g.fillRect(...p,.12+rnd()*.25,.12+rnd()*.22);}
      for(const u of [.12,.78])for(let k=0;k<24;k++){const v=(rnd()-.5)*r.width*.37,start=u+rnd()*.08;line(g,[at(start,v),at(start+.025+rnd()*.035,v)],'#1c262019',.13+rnd()*.18);}
      for(let u=.2;u<.9;u+=.24)line(g,[at(u,-r.width/2),at(u+.002,0),at(u-.001,r.width/2)],'#404a402e',.12);g.restore();}
    g.lineCap='butt';
    // Separate subtraction clips avoid even-odd overlap islands at multi-way crossings.
    g.save();for(const j of G.junctions(world.roads)){g.beginPath();g.rect(0,0,1024,768);g.moveTo(j.x+j.r,j.y);g.arc(j.x,j.y,j.r,0,TAU);g.clip('evenodd');}
    for(const r of layers.roads?world.roads:[]){
      if(r.kind==='road'){g.setLineDash([3.8,5.2]);line(g,r.points,'#d7ca9588',.42);g.setLineDash([]);}
      if(r.kind==='apron'){g.save();for(const strip of world.roads.filter(r=>r.kind==='runway')){const a=strip.points[0],b=strip.points.at(-1),len=Math.hypot(b[0]-a[0],b[1]-a[1])||1,nx=-(b[1]-a[1])/len*(strip.width/2+.7),ny=(b[0]-a[0])/len*(strip.width/2+.7);g.beginPath();g.rect(0,0,1024,768);g.moveTo(a[0]+nx,a[1]+ny);g.lineTo(b[0]+nx,b[1]+ny);g.lineTo(b[0]-nx,b[1]-ny);g.lineTo(a[0]-nx,a[1]-ny);g.closePath();g.clip('evenodd');}line(g,r.points,'#d4bf77b0',.45);g.restore();}
      if(r.kind==='runway'){
        const [a,b]=r.points,dx=b[0]-a[0],dy=b[1]-a[1],len=Math.max(.001,Math.hypot(dx,dy)),nx=-dy/len,ny=dx/len;
        for(const side of [-1,1])line(g,[[a[0]+nx*(r.width/2-1)*side,a[1]+ny*(r.width/2-1)*side],[b[0]+nx*(r.width/2-1)*side,b[1]+ny*(r.width/2-1)*side]],'#d9d9c6',.5);
        g.setLineDash([9,13]);line(g,[a,b],'#d7d9c5',.9);g.setLineDash([]);
        for(const f of [.035,.92])for(const side of [-1,1])for(let j=0;j<3;j++)line(g,[[a[0]+dx*f+nx*side*(2+j*1.2),a[1]+dy*f+ny*side*(2+j*1.2)],[a[0]+dx*(f+.028)+nx*side*(2+j*1.2),a[1]+dy*(f+.028)+ny*side*(2+j*1.2)]],'#dce0cf',.65);
      }
    }
    g.restore();
    // Paving seams, grass verges and building thresholds sit in the same ground plane.
    for(const b of layers.buildings?world.buildings:[]){const role=Civil?.role(b),p=q=>G.point(b,q),lot=[[b.x-1,b.y-1],[b.x+b.w+1,b.y-1],[b.x+b.w+1,b.y+b.d+2],[b.x-1,b.y+b.d+2]];
      poly(g,lot.map(p),role==='house'?'#b9ad96':role==='trailer'?'#a9a58e':'#bcbbae','#817f7140',.22);
      // A narrow joint at the front threshold helps distinguish paving from sand.
      if(role&&role!=='trailer')line(g,[p([b.x-1,b.y+b.d+.8]),p([b.x+b.w+1,b.y+b.d+.8])],'#777e793d',.12);
    }
    for(let i=0;i<4200;i++){const x=70+rnd()*895,y=130+rnd()*510;
      if(world.buildings.some(b=>x>b.x-3&&x<b.x+b.w+3&&y>b.y-3&&y<b.y+b.d+3)||world.parcels.some(f=>inside(f.points,x,y))||world.nearestRoad(x,y).distance<13)continue;
      const r=.35+rnd()*.7;disk(g,x+.7,y+.7,r,'#5d533d22');disk(g,x,y,r,'#7b795840');}
    // Runway crossing keeps both strips connected; no plot boundaries are paved.
    occluders=world.buildings.map(b=>({...b,h:buildingZ(b,b.h)}));lamps=[];
    for(let i=0;i<world.buildings.length;i++){const b=world.buildings[i],f=airportRoles[b.id]?airframe(b):null,p=G.point(b,f?f.p(f.span*.5,1):[b.x+b.w*.65,b.y+b.d+1]);if(f||i%3===0||b.name)lamps.push({x:p[0],y:p[1],z:buildingZ(b,Math.min(6,b.h-1)),r:f?23:b.name?33:20,power:f?.38:.48,color:[1,.82,.55],owner:b.id});}
    for(const r of world.roads.filter(r=>r.kind==='road'&&r.width>=10))for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let d=20;d<len;d+=67){const t=d/len,x=a[0]+(b[0]-a[0])*t+4,y=a[1]+(b[1]-a[1])*t+r.width*.7;if(!occluders.some(o=>x>o.x&&x<o.x+o.w&&y>o.y&&y<o.y+o.d))lamps.push({x,y,z:15,r:38,power:.55,color:[1,.82,.52],pole:true});}}
    for(const t of world.towers)lamps.push({x:t.x+t.r+4,y:t.y+3,z:4,r:22,power:.38,color:[1,.81,.52],pole:true,tower:true});
    for(const l of lamps){l.occluders=nearOccluders(l);l.visibility=visibility(l);}
  }
  function inside(points,x,y){let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++) {const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
  function rayDistance(x,y,dx,dy,b){const p=G.point(b,[x,y],true),co=Math.cos(b.angle||0),si=Math.sin(b.angle||0);[x,y]=p;[dx,dy]=[dx*co+dy*si,-dx*si+dy*co];let near=0,far=Infinity;for(const [p,d,a,z]of [[x,dx,b.x,b.x+b.w],[y,dy,b.y,b.y+b.d]]){if(Math.abs(d)<1e-8){if(p<a||p>z)return Infinity;}else{let t1=(a-p)/d,t2=(z-p)/d;if(t1>t2)[t1,t2]=[t2,t1];near=Math.max(near,t1);far=Math.min(far,t2);}}return far>=near?near:Infinity;}
  function nearOccluders(l){return occluders.filter(b=>Math.hypot(b.x+b.w/2-l.x,b.y+b.d/2-l.y)<=l.r+Math.hypot(b.w,b.d)/2);}
  function visibility(l){const near=occluders.filter(b=>Math.hypot(b.x+b.w/2-l.x,b.y+b.d/2-l.y)<l.r+40),angles=Array.from({length:64},(_,i)=>i*TAU/64);for(const b of near)for(const [x,y]of G.corners(b)){const a=Math.atan2(y-l.y,x-l.x);angles.push(a-.0001,a,a+.0001);}return angles.sort((a,b)=>a-b).map(a=>{const dx=Math.cos(a),dy=Math.sin(a);let d=l.r;for(const b of near){const hit=rayDistance(l.x,l.y,dx,dy,b);if(hit>.1)d=Math.min(d,hit);}return[l.x+dx*d,l.y+dy*d];});}
  function radiance(x,y,z=0,n=[0,0,1]){
    const key=cacheRadiance?[x,y,z,...n].join(','):null,cached=key&&staticRadiance.get(key);let a;
    if(cached){a=cached.slice();stats.lightingCacheHits++;}else{const sun=solarState.sun,len=Math.hypot(...sun),dot=Math.max(0,(n[0]*sun[0]+n[1]*sun[1]+n[2]*sun[2])/len);a=solarState.ambient.map(v=>v*(.78+.22*dot));applyLights(a,x,y,z,n,staticLights);if(key&&staticRadiance.size<24000)staticRadiance.set(key,a.slice());}
    applyLights(a,x,y,z,n,dynamicLights);return a.map(v=>clamp(v));
  }
  function applyLights(a,x,y,z,n,lights){
    for(const l of lights){const dx=x-l.x,dy=y-l.y,d2=dx*dx+dy*dy;if(l.power<=0||d2>l.r*l.r||z>l.z+7)continue;const d=Math.sqrt(d2);let power=(1-d2/(l.r*l.r))**2*l.power;
      if(l.head){const u=dx*Math.cos(l.angle)+dy*Math.sin(l.angle),v=-dx*Math.sin(l.angle)+dy*Math.cos(l.angle);if(u<0)continue;power*=Math.exp(-4*(v/(3+u*.46))**2)*clamp(u/5);}
      if((l.occluders||occluders).some(b=>{if(l.owner===b.id&&G.contains(b,[x,y]))return false;const hit=rayDistance(l.x,l.y,dx/(d||1),dy/(d||1),b);return hit>.2&&hit<d-.2&&b.h>l.z+(z-l.z)*(hit/(d||1));}))continue;
      const ld=Math.hypot(dx,dy,z-l.z)||1,diff=.3+.7*Math.max(0,(-dx*n[0]-dy*n[1]+(l.z-z)*n[2])/ld);
      for(let k=0;k<3;k++)a[k]+=l.color[k]*power*diff;
    }
  }
  const color=(base,x,y,z,n)=>{const a=radiance(x,y,z,n);return `rgb(${base.map((v,i)=>Math.round(v*a[i])).join(',')})`;};
  function render(c,s){
    stats={buildingsDrawn:0,buildingsCulled:0,shapes:0,lightingCacheHits:0,lightMaskRebuilt:false,groundComposited:false,placedMeshes:0};cacheRadiance=false;
    const newLayers={fields:true,roads:true,buildings:true,terrain:true,contours:false,...s.layers},newKey=JSON.stringify(newLayers);if(newKey!==layerKey){const rebuildGround=newLayers.fields!==layers.fields||newLayers.roads!==layers.roads||newLayers.buildings!==layers.buildings;layers=newLayers;layerKey=newKey;if(rebuildGround)build();}
    if(world.terrain!==terrainObject||world.terrain.revision!==terrainRevision||(s.contourInterval||5)!==contourStep)rebuildTerrain(s.contourInterval||5);
    settings=s;const lightHour=s.cycle?Math.round(s.hour*60)/60:s.hour;solarState=solar(lightHour);const night=solarState.night,lp=clamp((1-solarState.day)*1.2),p=s.car;
    const camera=window.TogaCamera.axes(s.iso,s.cameraYaw||0);
    project=([x,y,z=0])=>{const q=camera.delta(x-s.cx,y-s.cy);return[s.width/2+q[0]*s.zoom,s.height/2+(q[1]-(s.iso?z:s.heightOn?z*.6:0))*s.zoom];};
    function inView(x,y,r,z=0,h=0){const q=project([x,y,z]),rx=(Math.abs(camera.right[0])+Math.abs(camera.right[1]))*r*s.zoom+12,ry=(Math.abs(camera.down[0])+Math.abs(camera.down[1]))*r*s.zoom+12,up=(s.iso?h:s.heightOn?h*.6:0)*s.zoom;return q[0]+rx>=0&&q[0]-rx<=s.width&&q[1]+ry>=0&&q[1]-ry-up<=s.height;}
    staticLights=s.lights&&lp>0?lamps.filter(l=>(!l.tower||layers.buildings)&&l.power*lp>0).map(l=>({...l,power:l.power*lp})):[];dynamicLights=[];
    if(s.lights){const scale=p.scale||1;for(const side of [-2.5,2.5])dynamicLights.push({x:p.x+(10*Math.cos(p.heading)-side*Math.sin(p.heading))*scale,y:p.y+(10*Math.sin(p.heading)+side*Math.cos(p.heading))*scale,z:3*scale,r:65*scale,power:.15+night*.65,color:[1,.96,.79],head:true,angle:p.heading});}
    if(s.lights&&night>.1)for(const car of s.traffic||[])dynamicLights.push({x:car.x+4*Math.cos(car.heading),y:car.y+4*Math.sin(car.heading),z:1.5,r:27,power:night*.36,color:[1,.91,.68],head:true,angle:car.heading});
    dynamicLights=dynamicLights.filter(l=>inView(l.x,l.y,l.r,0,l.z+12));for(const l of dynamicLights)l.occluders=nearOccluders(l);active=[...staticLights,...dynamicLights];
    const lightKey=[lightHour,!!s.lights,layers.buildings,groundEpoch].join('/');if(lightKey!==lightingEpoch){staticRadiance.clear();lightingEpoch=lightKey;}
    function paintLight(target,l){if(l.power<.01)return;target.save();poly(target,l.head?visibility(l):l.visibility);target.clip();const grad=target.createRadialGradient(l.x,l.y,0,l.x,l.y,l.r);grad.addColorStop(0,`rgba(${l.color.map(v=>Math.round(v*255)).join(',')},${l.power*.8})`);grad.addColorStop(.38,`rgba(${l.color.map(v=>Math.round(v*255)).join(',')},${l.power*.42})`);grad.addColorStop(1,'transparent');target.fillStyle=grad;if(l.head){target.beginPath();target.moveTo(l.x,l.y);target.arc(l.x,l.y,l.r,l.angle-.45,l.angle+.45);target.closePath();target.clip();}target.fillRect(l.x-l.r,l.y-l.r,l.r*2,l.r*2);target.restore();}
    if(maskKey!==lightKey){sm.globalCompositeOperation='source-over';sm.fillStyle=`rgb(${solarState.ambient.map(v=>Math.round(v*255)).join(',')})`;sm.fillRect(0,0,1024,768);sm.globalCompositeOperation='lighter';for(const l of staticLights)paintLight(sm,l);maskKey=lightKey;stats.lightMaskRebuilt=true;}
    const preparedKey=`${groundEpoch}/${layers.terrain}`;if(preparedEpoch!==preparedKey){pg.globalCompositeOperation='source-over';pg.drawImage(ground,0,0);if(layers.terrain){pg.globalCompositeOperation='multiply';pg.drawImage(relief,0,0,3072,2304);}pg.globalCompositeOperation='source-over';preparedEpoch=preparedKey;shadedKey='';}
    const compositeKey=lightKey+'/'+preparedKey+'/'+dynamicLights.map(l=>[l.x,l.y,l.angle,l.r,l.power].join(',')).join(';');if(compositeKey!==shadedKey){lg.globalCompositeOperation='source-over';lg.drawImage(staticMask,0,0);lg.globalCompositeOperation='lighter';for(const l of dynamicLights)paintLight(lg,l);sc.globalCompositeOperation='source-over';sc.drawImage(preparedGround,0,0);sc.globalCompositeOperation='multiply';sc.drawImage(lm,0,0,3072,2304);sc.globalCompositeOperation='source-over';shadedKey=compositeKey;stats.groundComposited=true;}
    c.setTransform(s.dpr,0,0,s.dpr,0,0);c.fillStyle='#252b27';c.fillRect(0,0,s.width,s.height);const origin=project([0,0]);
    c.save();c.transform(camera.right[0]*s.zoom,camera.down[0]*s.zoom,camera.right[1]*s.zoom,camera.down[1]*s.zoom,...origin);c.drawImage(shaded,0,0,1024,768);
    if(layers.contours){c.globalAlpha=.6;for(const q of contourLines)line(c,q.points,q.level%10===0?'#c6ba8c':'#85765a',q.level%10===0?.6:.3);c.globalAlpha=1;}
    // Height-dependent cast shadows change with the sun; they are never painted on the car.
    if(layers.buildings&&solarState.altitude>0){const factor=Math.min(2.5,.65/Math.max(.15,solarState.altitude)),dx=-solarState.sun[0]*factor,dy=-.48*factor;c.globalAlpha=.10*solarState.day;
      for(const b of world.buildings){const corners=G.corners(b),h=buildingZ(b,b.h);for(let i=0;i<4;i++){const a=corners[i],q=corners[(i+1)%4];poly(c,[a,q,[q[0]+dx*h,q[1]+dy*h],[a[0]+dx*h,a[1]+dy*h]],'#292d29');}}
      for(const t of world.towers){line(c,[[t.x,t.y],[t.x+t.h*dx,t.y+t.h*dy]],'#292d29',3);disk(c,t.x+t.h*dx,t.y+t.h*dy,t.r,'#292d29');}c.globalAlpha=1;
      if(A){c.globalAlpha=.12*solarState.day;for(const prop of world.props||[]){const b=A.bounds(prop),corners=G.corners(b);for(let i=0;i<4;i++){const a=corners[i],q=corners[(i+1)%4];poly(c,[a,q,[q[0]+dx*b.h,q[1]+dy*b.h],[a[0]+dx*b.h,a[1]+dy*b.h]],'#292d29');}}c.globalAlpha=1;}
    }
    const aircraft=s.sequence?.plane;if(aircraft){const scale=aircraft.scale||.35,z=aircraft.z||0;c.save();c.translate(aircraft.x+z*.35,aircraft.y+z*.2);c.rotate(aircraft.heading);c.scale(scale,scale);c.globalAlpha=.16/(1+z*.035);poly(c,[[-21,-5],[0,-7],[28,0],[0,7],[-21,5],[-12,0]],'#172019');c.restore();}
    for(const q of s.trail){const age=s.time-q.time;if(age>7)continue;const scale=q.scale||1;for(const side of [-1,1]){const x=q.x+(-6*Math.cos(q.heading)+side*4*Math.sin(q.heading))*scale,y=q.y+(-6*Math.sin(q.heading)-side*4*Math.cos(q.heading))*scale;disk(c,x,y,.42*scale,`rgba(34,36,32,${q.strength*(1-age/7)*.22})`);}}
    c.restore();
    const items=[],push=(depth,draw)=>items.push({depth,draw});
    const depth=camera.depth;
    const shape=(pts,base,n=[0,0,1],emit=null,center=null)=>{if(drawingBuilding){const b=drawingBuilding,ratio=pts.every(p=>p[2]>=b.h)?(buildingZ(b,b.h+4)-buildingZ(b,b.h))/4:buildingZ(b,b.h)/b.h;pts=pts.map(p=>G.point(b,[p[0],p[1],buildingZ(b,p[2])]));const a=b.angle||0;n=[n[0]*Math.cos(a)-n[1]*Math.sin(a),n[0]*Math.sin(a)+n[1]*Math.cos(a),n[2]/ratio];const len=Math.hypot(...n)||1;n=n.map(v=>v/len);}if(n[2]<-.1||!camera.visible(n)||(!s.iso&&!s.heightOn&&n[2]<.1))return;const mid=center||pts.reduce((v,p)=>v.map((x,i)=>x+p[i]/pts.length),[0,0,0]);stats.shapes++;poly(c,pts.map(project),emit||color(base,...mid,n));};
    function box(x,y,w,d,z,h,base){
      if(s.iso||s.heightOn){const q=[[x,y],[x+w,y],[x+w,y+d],[x,y+d]],ns=[[0,-1,0],[1,0,0],[0,1,0],[-1,0,0]];for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4];shape([[...a,z],[...b,z],[...b,z+h],[...a,z+h]],base,ns[i]);}}
      shape([[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]],base);
    }
    function rod(a,b,w,base){if(drawingBuilding){a=G.point(drawingBuilding,[a[0],a[1],buildingZ(drawingBuilding,a[2])]);b=G.point(drawingBuilding,[b[0],b[1],buildingZ(drawingBuilding,b[2])]);}line(c,[project(a),project(b)],color(base,...a,[0,1,0]),Math.max(.5,w*s.zoom));}
    function cylinder(x,y,r,z,h,base){for(let i=0;i<24;i++){const a=i*TAU/24,b=(i+1)*TAU/24;shape([[x+Math.cos(a)*r,y+Math.sin(a)*r,z],[x+Math.cos(b)*r,y+Math.sin(b)*r,z],[x+Math.cos(b)*r,y+Math.sin(b)*r,z+h],[x+Math.cos(a)*r,y+Math.sin(a)*r,z+h]],base,[Math.cos(a),Math.sin(a),0]);}shape(Array.from({length:32},(_,i)=>[x+Math.cos(i*TAU/32)*r,y+Math.sin(i*TAU/32)*r,z+h]),base);}
    function civilianBuilding(b){
      const key=JSON.stringify([b.id,b.w,b.d,b.h,b.type,b.architecture]),profile=world.buildingProfile(b);let cached=civilMeshes.get(b.id);if(!cached||cached.key!==key){cached={key,mesh:Civil.make(b,profile)};civilMeshes.set(b.id,cached);}const mesh=cached.mesh;
      // Geometry is fitted to this saved envelope; no x/y/angle/height is assigned here.
      drawingBuilding=null;const co=Math.cos(b.angle||0),si=Math.sin(b.angle||0),transform=p=>G.point(b,[b.x+p[0],b.y+p[1],p[2]]);
      const placedKey=key+`/${b.x}/${b.y}/${b.angle||0}`;let placed=placedCivil.get(b.id);
      if(!placed||placed.key!==placedKey){const pending=mesh.faces.map((f,i)=>{const pts=f.points.map(transform),mid=pts.reduce((a,p)=>a.map((v,k)=>v+p[k]/pts.length),[0,0,0]),n=[f.normal[0]*co-f.normal[1]*si,f.normal[0]*si+f.normal[1]*co,f.normal[2]];return{f,i,pts,mid,n,depth:0};});placed={key:placedKey,pending,cameraKey:null,byIndex:new Map(pending.map(p=>[p.i,p]))};placedCivil.set(b.id,placed);stats.placedMeshes++;}
      const cameraKey=`${s.iso}/${s.cameraYaw||0}`;if(placed.cameraKey!==cameraKey){for(const p of placed.pending)p.depth=depth(...p.mid);for(const p of placed.pending)if(p.f.support!==undefined&&placed.byIndex.has(p.f.support))p.depth=placed.byIndex.get(p.f.support).depth+.003+p.i*.000001;placed.pending.sort((a,b)=>Number(!!a.f.roofDetail)-Number(!!b.f.roofDetail)||a.depth-b.depth);placed.cameraKey=cameraKey;}
      for(const {f,pts,n,mid} of placed.pending){if(!camera.visible(n))continue;const base=f.color.map((v,i)=>v+(f.dayColor[i]-v)*solarState.day);shape(pts,base,n,f.glow&&s.lights&&night>.3?'#a89b70':null,mid);}
    }
    function airBuilding(b){
      const role=airportRoles[b.id],f=airframe(b),metal=role==='operations'?[167,157,128]:[143,151,143],roof=[153,160,151],eave=Math.max(2,b.h-1.5),ridge=b.h+.7;
      // All four facades are considered after rotation; the camera sees only outward faces.
      const corners=[[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.d],[b.x,b.y+b.d]],normals=[[0,-1],[1,0],[0,1],[-1,0]];
      for(let i=0;i<4;i++){
        const n=normals[i],a=b.angle||0,nx=n[0]*Math.cos(a)-n[1]*Math.sin(a),ny=n[0]*Math.sin(a)+n[1]*Math.cos(a);
        if(!(s.iso||s.heightOn)||!camera.visible([nx,ny,0]))continue;
        const p=corners[i],q=corners[(i+1)%4];shape([[...p,0],[...q,0],[...q,eave],[...p,eave]],metal,[...n,0]);
        const len=Math.hypot(q[0]-p[0],q[1]-p[1]);
        if(role!=='operations')for(let u=1;u<len;u+=1.25){const x=p[0]+(q[0]-p[0])*u/len,y=p[1]+(q[1]-p[1])*u/len;rod([x,y,.4],[x,y,eave-.15],.1,[124,136,128]);}
        const front=Math.abs(n[0]-f.n[0])+Math.abs(n[1]-f.n[1])<.1;
        if(front&&role!=='operations'){
          const doorWidth=f.span*.82,left=(f.span-doorWidth)/2,top=eave*.88;
          shape([f.p(left,.08,.15),f.p(left+doorWidth,.08,.15),f.p(left+doorWidth,.08,top),f.p(left,.08,top)],[70,82,77],[...n,0]);
          for(let k=0;k<4;k++){const x=left+k*doorWidth/4,w=doorWidth/4-.16;shape([f.p(x,.12,.2),f.p(x+w,.12,.2),f.p(x+w,.12,top-.15),f.p(x,.12,top-.15)],[130+k%2*6,140+k%2*6,132],[...n,0]);
            for(let u=x+.4;u<x+w;u+=1)rod(f.p(u,.15,.4),f.p(u,.15,top-.3),.09,[109,122,114]);
            shape([f.p(x+.3,.2,top*.62),f.p(x+w-.3,.2,top*.62),f.p(x+w-.3,.2,top*.82),f.p(x+.3,.2,top*.82)],[63,83,80],[...n,0]);
          }
          rod(f.p(left-.8,.25,top+.3),f.p(left+doorWidth+.8,.25,top+.3),.25,[87,101,97]);
        }else for(let u=2;u<len-2;u+=4.5){const pt=(along,z)=>[p[0]+(q[0]-p[0])*along/len+n[0]*.1,p[1]+(q[1]-p[1])*along/len+n[1]*.1,z];shape([pt(u,eave*.53),pt(u+1.6,eave*.53),pt(u+1.6,eave*.8),pt(u,eave*.8)],[62,80,76],[...n,0],s.lights&&night>.3&&role==='operations'?'#a79968':null);}
      }
      const x=b.x,y=b.y,w=b.w,d=b.d;
      if(role==='operations'){box(x-.35,y-.35,w+.7,d+.7,eave,.45,roof);box(x+w*.7,y+d*.35,2.2,2,eave+.45,.9,[118,127,116]);}
      else{
        // Shallow steel-truss gable, not an inflated modern terminal roof.
        for(const end of [y,y+d])shape([[x,end,eave],[x+w,end,eave],[x+w/2,end,ridge]],metal,[0,end===y?-1:1,0]);
        shape([[x-.3,y-.3,eave],[x+w/2,y-.3,ridge],[x+w/2,y+d+.3,ridge],[x-.3,y+d+.3,eave]],roof,[-.2,0,.98]);
        shape([[x+w/2,y-.3,ridge],[x+w+.3,y-.3,eave],[x+w+.3,y+d+.3,eave],[x+w/2,y+d+.3,ridge]],roof,[.2,0,.98]);
        for(let v=y+.8;v<y+d;v+=1.35){rod([x,v,eave+.06],[x+w/2,v,ridge+.06],.1,[127,140,130]);rod([x+w/2,v,ridge+.06],[x+w,v,eave+.06],.1,[127,140,130]);}
        rod([x+w/2,y,ridge+.12],[x+w/2,y+d,ridge+.12],.32,[166,172,158]);
      }
    }
    (layers.buildings?world.buildings:[]).forEach((b,i)=>{if(!inView(b.x+b.w/2,b.y+b.d/2,Math.hypot(b.w,b.d)/2+8,0,buildingZ(b,b.h+4)+24)){stats.buildingsCulled++;return;}stats.buildingsDrawn++;push(depth(b.x+b.w/2,b.y+b.d/2,buildingZ(b,b.h)),()=>{
      drawingBuilding=b;cacheRadiance=true;
      if(airportRoles[b.id]){airBuilding(b);drawingBuilding=null;cacheRadiance=false;return;}
      if(Civil?.role(b)){civilianBuilding(b);drawingBuilding=null;cacheRadiance=false;return;}
      const roof=b.type==='house'?[151+i%4*8,137+i%3*8,108+i%5*6]:b.type==='factory'?[117,123,114]:[147,154,146],wall=[174,168,144];
      box(b.x,b.y,b.w,b.d,0,b.h,wall);box(b.x-.6,b.y-.6,b.w+1.2,b.d+1.2,b.h,.7,roof);
      if(b.type==='house'){
        shape([[b.x-.8,b.y-.8,b.h+1],[b.x+b.w/2,b.y-.8,b.h+4],[b.x+b.w/2,b.y+b.d+.8,b.h+4],[b.x-.8,b.y+b.d+.8,b.h+1]],roof,[-.45,0,.9]);
        shape([[b.x+b.w/2,b.y-.8,b.h+4],[b.x+b.w+.8,b.y-.8,b.h+1],[b.x+b.w+.8,b.y+b.d+.8,b.h+1],[b.x+b.w/2,b.y+b.d+.8,b.h+4]],roof,[.45,0,.9]);
        for(let yy=b.y+2;yy<b.y+b.d;yy+=2.6)rod([b.x,yy,b.h+1.2],[b.x+b.w/2,yy,b.h+4.2],.12,[130,122,100]);
        box(b.x+b.w*.73,b.y+2,1.8,2,b.h+1,2.6,[137,122,101]);
      }else{
        for(let xx=b.x+1;xx<b.x+b.w;xx+=2)rod([xx,b.y,b.h+1],[xx,b.y+b.d,b.h+1],.18,[122,132,121]);
        box(b.x+b.w*.65,b.y+2,Math.min(3,b.w*.2),3,b.h+1,1.8,[120,128,122]);
      }
      // Glass is dim emissive, not a white bloom sticker; wall fixtures light nearby roofs.
      for(let x=b.x+2;x<b.x+b.w-2;x+=5)shape([[x,b.y+b.d+.2,2],[x+2,b.y+b.d+.2,2],[x+2,b.y+b.d+.2,b.h-1],[x,b.y+b.d+.2,b.h-1]],[57,77,74],[0,1,0],s.lights&&night>.3?`rgb(${Math.round(103+night*64)},${Math.round(96+night*43)},83)`:null);
      if(b.type==='factory')for(let k=0;k<3;k++){cylinder(b.x+4+k*8,b.y+8,1.7,b.h,16+k*2,[131,131,117]);cylinder(b.x+4+k*8,b.y+8,1.8,b.h+15+k*2,1.2,[59,67,61]);}
      drawingBuilding=null;cacheRadiance=false;
    });});
    for(const t of layers.buildings?world.towers:[])if(inView(t.x,t.y,t.r+10,0,t.h+4))push(depth(t.x,t.y,t.h),()=>{
      const feet=[[-6,-6],[6,-6],[6,6],[-6,6]];
      for(let i=0;i<4;i++){const a=feet[i],b=feet[(i+1)%4];rod([t.x+a[0],t.y+a[1],0],[t.x+a[0]*.75,t.y+a[1]*.75,t.h-9],.8,[106,117,112]);rod([t.x+a[0],t.y+a[1],2],[t.x+b[0]*.75,t.y+b[1]*.75,t.h-11],.35,[135,143,130]);rod([t.x+a[0]*.75,t.y+a[1]*.75,t.h-11],[t.x+b[0],t.y+b[1],2],.35,[135,143,130]);}
      cylinder(t.x,t.y,t.r,t.h-13,12,[150,161,150]);
      for(let i=0;i<24;i++){const a=i*TAU/24,b=(i+1)*TAU/24;shape([[t.x,t.y,t.h+2],[t.x+Math.cos(a)*t.r,t.y+Math.sin(a)*t.r,t.h],[t.x+Math.cos(b)*t.r,t.y+Math.sin(b)*t.r,t.h]],[164,173,159],[Math.cos(a)*.4,Math.sin(a)*.4,.85]);}
      for(let z=1;z<t.h;z+=2)rod([t.x+t.r,t.y-1,z],[t.x+t.r,t.y+1,z],.2,[166,168,148]);
      rod([t.x+t.r,t.y-1,0],[t.x+t.r,t.y-1,t.h],.3,[166,168,148]);rod([t.x+t.r,t.y+1,0],[t.x+t.r,t.y+1,t.h],.3,[166,168,148]);
      const pos=project([t.x,t.y,t.h+2]);disk(c,...pos,Math.max(.65,s.zoom*.32),night>.5&&s.time%2<1?'#b15b41':'#554e41');
    });
    if(A&&layers.buildings)for(const prop of world.props||[]){const spec=A.spec(prop.type);if(!spec||!inView(prop.x,prop.y,Math.hypot(spec.w,spec.d)*(prop.scale||1)+5,0,spec.h*(prop.scale||1)+5))continue;const a=prop.angle||0,co=Math.cos(a),si=Math.sin(a),scale=prop.scale||1,transform=p=>[prop.x+(p[0]*co-p[1]*si)*scale,prop.y+(p[0]*si+p[1]*co)*scale,p[2]*scale];if(!assetMeshes.has(prop.type))assetMeshes.set(prop.type,A.mesh(prop.type));const mesh=prop.type==='windsock'?A.mesh(prop.type,s.time,a):assetMeshes.get(prop.type);
      for(const face of mesh){const pts=face.points.map(transform),mid=pts.reduce((a,p)=>a.map((v,i)=>v+p[i]/pts.length),[0,0,0]);push(depth(...mid),()=>{const u=pts[1].map((v,i)=>v-pts[0][i]),v=pts[2].map((v,i)=>v-pts[0][i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n)||1;shape(pts,face.color,n.map(v=>v/len));});}
    }
    for(const l of lamps.filter(l=>l.pole&&(l.tower?layers.buildings:layers.roads)&&inView(l.x,l.y,3,0,l.z+1)))push(depth(l.x,l.y,l.z),()=>{rod([l.x,l.y,0],[l.x,l.y,l.z],.5,[123,132,122]);box(l.x-1.2,l.y-.6,2.4,1.2,l.z,.5,[83,94,90]);});
    if(s.sequence?.plane&&window.TogaBlackbird&&inView(s.sequence.plane.x,s.sequence.plane.y,40*(s.sequence.plane.scale||.35),s.sequence.plane.z||0,10)){const a=s.sequence.plane,co=Math.cos(a.heading),si=Math.sin(a.heading),scale=a.scale||window.TogaBlackbird.scale||1,v=p=>[a.x+(p[0]*co-p[1]*si)*scale,a.y+(p[0]*si+p[1]*co)*scale,p[2]*scale+(a.z||0)];
      for(const face of window.TogaBlackbird.faces){const pts=face.points.map(v),mid=pts.reduce((a,p)=>a.map((v,i)=>v+p[i]/pts.length),[0,0,0]);push(depth(...mid),()=>{const u=pts[1].map((v,i)=>v-pts[0][i]),v=pts[2].map((v,i)=>v-pts[0][i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n)||1;shape(pts,face.color,n.map(v=>v/len*(n[2]<0?-1:1)));});}
      if(s.sequence.phase==='takeoff')for(const side of [-8.2,8.2]){const p=v([-21,side,3.2]);push(depth(...p),()=>{const q=project(p);disk(c,...q,Math.max(.5,s.zoom*.75*scale),'#da9a5266');});}
    }
    if(s.sequence?.person){const p=s.sequence.person;push(depth(p.x,p.y,4),()=>{box(p.x-.6,p.y-.4,1.2,.8,0,1.8,[54,66,64]);box(p.x-.9,p.y-.6,1.8,1.2,1.6,1.5,[158,134,62]);cylinder(p.x,p.y,.65,3.1,1,[170,143,105]);});}
    for(const car of [p,...(s.traffic||[])])if(inView(car.x,car.y,15*(car.scale||1),0,8*(car.scale||1)))push(depth(car.x,car.y,5*(car.scale||1)),()=>{
      const p=car,scale=car.scale||1,cs=Math.cos(p.heading),sn=Math.sin(p.heading),v=(x,y,z)=>[p.x+(x*cs-y*sn)*scale,p.y+(x*sn+y*cs)*scale,z*scale],paint=car.paint||[150,166,145];
      const part=(x,y,w,d,z,h,base)=>{const q=[[x,y],[x+w,y],[x+w,y+d],[x,y+d]],lo=q.map(a=>v(...a,z)),hi=q.map(a=>v(...a,z+h));for(let i=0;i<4;i++){const j=(i+1)%4,n=[[sn,-cs,0],[cs,sn,0],[-sn,cs,0],[-cs,-sn,0]][i];shape([lo[i],lo[j],hi[j],hi[i]],base,n);}shape(hi,base);};
      for(const x of [-6,5])for(const y of [-5,3.7])part(x,y,3,1.3,.4,2,[30,35,31]);
      part(-9,-4,19,8,1.8,2.3,paint);
      if(car.type==='pickup'){part(-7.8,-3.2,8,6.4,3.9,.2,paint.map(v=>v*.65));part(.3,-3.6,4.6,7.2,4.1,1.9,paint.map(v=>v*1.05));part(4.5,-3.4,1.5,6.8,4,1.2,[62,92,91]);}
      else{part(car.type==='wagon'?-6.5:-3.8,-3.6,car.type==='wagon'?10.7:8,7.2,4.1,1.9,car.paint?paint.map(v=>v*1.1):[189,191,162]);part(4,-3.4,2,6.8,4,1.2,[62,92,91]);part(car.type==='wagon'?-7.5:-5.2,-3.4,1.5,6.8,3.7,1.4,[65,87,87]);}
      part(6,-3.8,3.8,7.6,3.8,.6,paint.map(v=>v*1.06));
      if(car.taxi)part(-.8,-1.1,2.6,2.2,6.1,.7,[205,193,147]);
      for(const y of [-3,2]){shape([v(10,y,2),v(10,y+1,2),v(10,y+1,3),v(10,y,3)],[225,223,183],[cs,sn,0],s.lights?'#e4dbad':null);shape([v(-9,y,2),v(-9,y+1,2),v(-9,y+1,3),v(-9,y,3)],[115,51,37],[-cs,-sn,0],s.brake?'#bb442b':null);}
      if(!s.iso&&!s.heightOn)for(const y of [-3,2]){shape([v(9,y,4),v(10,y,4),v(10,y+1,4),v(9,y+1,4)],[220,208,153],[0,0,1],s.lights?'#d8c998':null);shape([v(-9,y,4),v(-8,y,4),v(-8,y+1,4),v(-9,y+1,4)],[121,54,43],[0,0,1]);}
    });
    // Three industrial stacks and two domestic chimneys, all following one evolving wind.
    if(layers.buildings){const factory=world.buildings.find(b=>b.id==='factory'),home=world.buildings.find(b=>b.id==='home'),other=world.buildings.find(b=>b.type==='house'&&b.id!=='home'),emitters=[];
      if(factory)for(let k=0;k<3;k++)emitters.push({p:G.point(factory,[factory.x+4+k*8,factory.y+8,factory.h+16.2+k*2]),minDepth:depth(factory.x+factory.w/2,factory.y+factory.d,factory.h)+.1,rate:.65,index:k});
      for(const b of [home,other].filter(Boolean))emitters.push({p:G.point(b,[b.x+b.w*.73+.9,b.y+3,buildingZ(b,b.h+3.7)]),minDepth:depth(b.x+b.w/2,b.y+b.d,buildingZ(b,b.h))+.1,rate:.32,index:emitters.length});
      const wind=t=>{if(A){const w=A.wind(t);return[w.x,w.y];}const a=.5+Math.sin(t*.013)*1.1+Math.sin(t*.0047)*1.8;return[Math.cos(a),Math.sin(a)];},hash=n=>{const v=Math.sin(n*127.1+31.7)*43758.5453;return v-Math.floor(v);};
      for(const e of emitters)for(let k=0;k<25;k++){const slot=Math.floor(s.time/1.15)-k,birth=slot*1.15,age=s.time-birth;if(birth<0||age>24||hash(Math.floor(birth/18)*7+e.index)>e.rate)continue;let dx=0,dy=0;for(let j=0;j<6;j++){const w=wind(birth+age*(j+.5)/6);dx+=w[0]*age/6;dy+=w[1]*age/6;}const z=e.p[2]+age*.7,pt=[e.p[0]+dx,e.p[1]+dy,z],size=(.75+age*.28)*(e.index<3?1:.6),alpha=Math.min(1,age/1.7)*(1-age/24)*(e.index<3?.2:.12);
        push(Math.max(depth(...pt),e.minDepth),()=>{const q=project(pt),r=size*s.zoom,light=radiance(...pt),col=light.map(v=>Math.round((e.index<3?152:184)*v)),gr=c.createRadialGradient(...q,0,...q,r);gr.addColorStop(0,`rgba(${col.join(',')},${alpha})`);gr.addColorStop(.45,`rgba(${col.join(',')},${alpha*.55})`);gr.addColorStop(1,'transparent');c.fillStyle=gr;c.fillRect(q[0]-r,q[1]-r,2*r,2*r);});
      }
    }
    items.sort((a,b)=>a.depth-b.depth);for(const i of items)i.draw();
    for(const q of s.trail){const age=s.time-q.time;if(age>2.4||q.strength<.08)continue;const scale=q.scale||1,pt=project([q.x+age*4*scale,q.y-age*scale,age*1.8*scale]),r=(1+age*4)*s.zoom*scale,grad=c.createRadialGradient(...pt,0,...pt,r);grad.addColorStop(0,`rgba(172,169,150,${q.strength*(1-age/2.4)*.09})`);grad.addColorStop(1,'transparent');c.fillStyle=grad;c.fillRect(pt[0]-r,pt[1]-r,r*2,r*2);}
    // Repeating runway edge fixtures are small points with restrained halos.
    if(layers.roads){
    for(const r of world.roads.filter(r=>r.kind==='apron'))for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len<1)continue;for(let d=6;d<len;d+=18)for(const side of [-1,1]){const pos=project([a[0]+dx*d/len-dy/len*(r.width*.5+.6)*side,a[1]+dy*d/len+dx/len*(r.width*.5+.6)*side,.25]);disk(c,...pos,Math.max(.4,s.zoom*.19),s.lights&&night>.2?'#688cae':'#677770');}}
    for(const r of world.roads.filter(r=>r.kind==='runway')){const[a,b]=r.points,dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);for(let d=4;d<len;d+=15)for(const side of [-1,1]){const pos=project([a[0]+dx*d/len-dy/len*r.width*.55*side,a[1]+dy*d/len+dx/len*r.width*.55*side,0]);disk(c,...pos,Math.max(.5,s.zoom*.27),s.lights&&night>.2?'#d5d5a6':'#929b8a');if(s.lights&&night>.2){const gr=c.createRadialGradient(...pos,0,...pos,s.zoom*1.5);gr.addColorStop(0,'#dbd1a238');gr.addColorStop(1,'transparent');c.fillStyle=gr;c.fillRect(pos[0]-s.zoom*1.5,pos[1]-s.zoom*1.5,s.zoom*3,s.zoom*3);}}}
    }
    if(s.overlay&&original.complete&&original.naturalWidth){c.save();const o=project([0,0]);c.transform(camera.right[0]*s.zoom,camera.down[0]*s.zoom,camera.right[1]*s.zoom,camera.down[1]*s.zoom,...o);c.globalAlpha=s.opacity;c.drawImage(original,0,0,1024,768);c.restore();}
    if(s.edit){for(const b of layers.buildings?world.buildings:[]){const pts=G.corners(b).map(p=>project(p));poly(c,pts,null,b.id===s.selected?'#fff2b0':'#36d5cd',1);if(b.id===s.selected){for(const p of pts)disk(c,...p,4,'#fff2b0');const top=project(G.point(b,[b.x+b.w/2,b.y])),handle=project(G.point(b,[b.x+b.w/2,b.y-20/s.zoom]));line(c,[top,handle],'#fff2b0',1);disk(c,...handle,5,'#fff2b0');}}for(const r of layers.roads?world.roads:[]){const pts=r.points.map(p=>project(p)),selected=r.id===s.selectedRoad;line(c,pts,selected?'#ffe49b':r.kind==='runway'?'#b4bef4':'#89baf2',selected?2:1);pts.forEach((p,i)=>disk(c,...p,selected&&s.selectedNode===i?5:3,selected?'#ffe49b':'#89baf2'));}
      if(A&&layers.buildings)for(const prop of world.props||[]){const pts=G.corners(A.bounds(prop)).map(project);poly(c,pts,null,prop.id===s.selectedProp?'#fff2b0':'#36d5cd',prop.id===s.selectedProp?2:1);}
      if(s.draft?.length){line(c,s.draft.map(project),'#fff1b7',3);s.draft.forEach(p=>disk(c,...project(p),4,'#fff1b7'));}
      if(s.ghost)poly(c,G.corners(s.ghost).map(project),'#45c5bc35','#8aeee0',1);
      if(world.aircraft&&layers.buildings){const a=world.aircraft,co=Math.cos(a.heading),si=Math.sin(a.heading),scale=a.scale||.35,pts=[[-23,-15],[30,-15],[30,15],[-23,15]].map(([x,y])=>project([a.x+(x*co-y*si)*scale,a.y+(x*si+y*co)*scale]));poly(c,pts,null,s.selectedAircraft===a.id?'#fff2b0':'#36d5cd',s.selectedAircraft===a.id?2:1);}
      for(const t of layers.buildings?world.towers:[]){const p=project([t.x,t.y]),r=t.r*s.zoom+3;c.beginPath();c.arc(...p,r,0,TAU);c.strokeStyle=t.id===s.selectedTower?'#fff2b0':'#36d5cd';c.lineWidth=t.id===s.selectedTower?2:1;c.stroke();if(t.id===s.selectedTower){line(c,[[p[0]-5,p[1]],[p[0]+5,p[1]]],'#fff2b0',1);line(c,[[p[0],p[1]-5],[p[0],p[1]+5]],'#fff2b0',1);}}
      if(['raise','lower','smooth'].includes(s.mode)&&s.brushPosition){const p=project(s.brushPosition);c.beginPath();c.arc(...p,s.brushRadius*s.zoom,0,TAU);c.strokeStyle=s.mode==='lower'?'#c3d7ed':'#f5e1ad';c.lineWidth=1.5;c.stroke();}
    }
    return {project,solar:solarState,stats:{...stats,lightingEntries:staticRadiance.size,placedEntries:placedCivil.size}};
  }
  build();return {render,rebuild:build,ground,inside};
}
return {make,solar};
})();
