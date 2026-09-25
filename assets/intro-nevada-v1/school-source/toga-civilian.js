/* Original code-built desert architecture. The saved rectangle is a lot envelope;
   every vertex, surface and collision part follows its rotation and dimensions. */
(function(root){
const catalog=[
 {type:'house',label:'Desert bungalow',w:12,d:14,h:5},
 {type:'trailer',label:'Single-wide trailer',w:8,d:19,h:4},
 {type:'shop',label:'Main street shops',w:28,d:12,h:6},
 {type:'gas-station',label:'Service station and pump canopy',w:24,d:20,h:6},
 {type:'school',label:'School and courtyard',w:42,d:25,h:7},
 {type:'motel',label:'Courtyard motel',w:30,d:22,h:6},
 {type:'workshop',label:'Farm workshop',w:17,d:23,h:7},
 {type:'parking',label:'Parking lot',w:24,d:20,h:1}
];
// Function assignments are interpretations, not labels claimed by the sketch.
const defaults={'building-042':'shop','building-053':'shop','building-004':'shop','building-005':'shop','building-063':'gas-station','building-046':'motel',
 'building-049':'trailer','building-050':'trailer','building-051':'trailer','building-052':'trailer','building-057':'trailer','building-059':'trailer','building-060':'trailer'};
const airport=new Set(['hangar','building-001','building-002','building-003','building-083','building-084','building-085']);
const spec=type=>catalog.find(s=>s.type===type);
function role(b){return spec(b.architecture)?b.architecture:b.id==='building-029'?'reference-school':airport.has(b.id)||b.type==='factory'||b.id==='school'?null:defaults[b.id]||(b.type==='house'?'house':null);}
const hash=id=>{let n=0;for(const c of id)n=(Math.imul(n,31)+c.charCodeAt(0))>>>0;return n;};
function make(b,profile,detail=true){
 const kind=role(b),w=b.w,d=b.d,H=profile?.eave||b.h,seed=hash(b.id),faces=[],solids=[],lights=[];
 const Kit=typeof module!=='undefined'&&module.exports?require('./toga-school-assets.js'):root.TogaSchoolAssets;
 if(Kit&&['reference-school','gas-station','trailer'].includes(kind)){
  const mesh=Kit.make(kind==='reference-school'?'school':kind==='gas-station'?'service':seed%2?'caravan':'motorhome',w,d,kind==='trailer'?Math.min(H,2.8):H,seed),rgb=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));
  return{...mesh,faces:mesh.faces.map(f=>({points:f.v,normal:f.n,color:rgb(f.c),dayColor:rgb(f.dayC||f.c),glow:f.c==='#536765',decal:f.decal,support:f.support,roofDetail:f.roofDetail})),kind};
 }
 if(!kind)return {faces,solids,lights,kind};
 const C={wall:[178+seed%9,165+seed%8,139],roof:[143+seed%14,143+seed%9,126],trim:[130,135,119],glass:[62,84,81],dark:[55,65,60],brick:[147,116,89],red:[151,81,58],paint:[199,192,161],paving:[145,144,128],asphalt:[108,117,108],yellow:[190,170,101]};
 function face(points,color,options={}){const a=points[1].map((v,i)=>v-points[0][i]),b=points[2].map((v,i)=>v-points[0][i]),n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=Math.hypot(...n);if(len<1e-7)return;faces.push({points,color,normal:n.map(v=>v/len),...options});}
 function box(x,y,z,ww,dd,hh,col,options={}){if(ww<=0||dd<=0||hh<=0)return;const p=[[x,y,z],[x+ww,y,z],[x+ww,y+dd,z],[x,y+dd,z]],q=p.map(v=>[v[0],v[1],z+hh]);for(let i=0;i<4;i++)face([p[i],p[(i+1)%4],q[(i+1)%4],q[i]],col,options);face(q,col,options);}
 function block(x,y,ww,dd,h,col=C.wall,openRoof=false){box(x,y,0,ww,dd,h,col);if(openRoof)faces.pop();solids.push({x,y,w:ww,d:dd,h});}
 function plane(x,y,ww,dd,z,col,options={}){face([[x,y,z],[x+ww,y,z],[x+ww,y+dd,z],[x,y+dd,z]],col,{ground:z<.15,decal:z>.15,...options});}
 function stripe(x,y,ww,dd,col=C.paint){plane(x,y,ww,dd,.025,col);}
 function front(x,y,z,ww,hh,col=C.glass,glow=false){face([[x+ww,y,z],[x,y,z],[x,y,z+hh],[x+ww,y,z+hh]],col,{glow,decal:true});}
 function back(x,y,z,ww,hh,col=C.glass){face([[x+ww,y,z],[x,y,z],[x,y,z+hh],[x+ww,y,z+hh]],col);}
 function side(x,y,z,dd,hh,col=C.glass){face([[x,y,z],[x,y+dd,z],[x,y+dd,z+hh],[x,y,z+hh]],col,{decal:true});}
 function flatRoof(x,y,ww,dd,h){box(x,y,h,ww,dd,.23,C.roof);for(const yy of [y,y+dd-.22])box(x,yy,h,ww,.22,.65,C.wall);for(const xx of [x,x+ww-.22])box(xx,y,h,.22,dd,.65,C.wall);if(detail){for(let yy=y+2;yy<y+dd;yy+=3.5)plane(x+.3,yy,ww-.6,.06,h+.25,C.trim);}}
 function ac(x,y,z,size=1){box(x,y,z,1.5*size,1.25*size,.72*size,C.trim);plane(x+.2*size,y+.2*size,.75*size,.75*size,z+.73*size,C.dark);if(detail)for(let k=0;k<4;k++)front(x+.1*size,y+1.26*size,z+.12+k*.12*size,1.3*size,.045*size,C.dark);}
 function steps(x,y,width,z=.8){for(let i=0;i<3;i++)box(x,y+i*.4,0,width,.42,z*(1-i/3),C.paving);}
 function windowRow(x,y,ww,h,spacing=3.4){for(let u=1;u<ww-1.2;u+=spacing){const width=Math.min(2,ww-u-.5);front(x+u,y+.025,h*.38,width,h*.35,C.glass,true);if(detail){front(x+u,y+.04,h*.37,width,.1,C.paint);front(x+u+width/2,y+.04,h*.38,.07,h*.35,C.trim);}}}
 function parking(x,y,ww,dd){plane(x,y,ww,dd,.012,C.asphalt);const slot=3.2,depth=Math.min(5,dd*.44);for(let u=.65;u<ww-1;u+=slot){stripe(x+u,y+.6,.09,depth);if(detail)stripe(x+u+.45,y+.5,.8,.23,[163,164,141]);if(dd>12)stripe(x+u,y+dd-depth-.6,.09,depth);}stripe(x+.65,y+.6,Math.max(.1,ww-1.3),.09);if(dd>12)stripe(x+.65,y+dd-.65,Math.max(.1,ww-1.3),.09);}
 function lowFence(x,y,ww){if(!detail)return;for(let u=0;u<=ww;u+=3)box(x+u,y,0,.12,.12,1.5,C.trim);box(x,y,.9,ww,.08,.08,C.trim);box(x,y,1.42,ww,.08,.08,C.trim);}
 function light(x,y,z,r=15,power=.22){lights.push({x,y,z,r,power,color:[1,.85,.62]});box(x-.22,y-.13,z,.44,.26,.15,C.paint);}
 plane(0,0,w,d,.005,[165,155,128]);
 if(kind==='house'){
  const eave=H,porch=Math.min(2,d*.14),bodyD=d-porch,rise=profile?.roof||Math.min(w*.2,2.3);
  // The pitched roof closes the shell: an internal box lid can paint over its far slope.
  block(0,0,w,bodyD,eave,C.wall,true);plane(0,bodyD,w,porch,.03,C.paving);
  if(seed%3===0){
   const inset=Math.min(w,bodyD)*.28,ridgeA=[w/2,inset,eave+rise],ridgeB=[w/2,bodyD-inset,eave+rise];
   face([[0,0,eave],[w,0,eave],ridgeA],C.roof);face([[w,0,eave],[w,bodyD,eave],ridgeB,ridgeA],C.roof);
   face([[w,bodyD,eave],[0,bodyD,eave],ridgeB],C.roof);face([[0,bodyD,eave],[0,0,eave],ridgeA,ridgeB],C.roof);
  }else{
   face([[w,0,eave],[w/2,0,eave+rise],[0,0,eave]],C.wall);face([[0,bodyD,eave],[w/2,bodyD,eave+rise],[w,bodyD,eave]],C.wall);
   face([[0,0,eave],[w/2,0,eave+rise],[w/2,bodyD,eave+rise],[0,bodyD,eave]],C.roof);
   face([[w/2,0,eave+rise],[w,0,eave],[w,bodyD,eave],[w/2,bodyD,eave+rise]],C.roof);
  }
  box(w*.17,bodyD,eave*.71,w*.64,porch,.18,C.trim);for(const x of [w*.19,w*.79])box(x,bodyD+porch-.2,0,.16,.16,eave*.71,C.paint);
  for(const xx of [w*.10,w*.70]){front(xx,bodyD+.025,eave*.33,w*.19,eave*.36,C.glass,true);front(xx,bodyD+.04,eave*.31,w*.19,.09,C.paint);if(detail)front(xx+w*.093,bodyD+.045,eave*.33,.06,eave*.36,C.paint);}
  front(w*.46,bodyD+.08,.1,Math.min(1.3,w*.18),eave*.62,C.dark);steps(w*.44,d-1,Math.min(2,w*.22),.4);
  if(detail){for(const yy of [bodyD*.20,bodyD*.67]){side(w+.025,yy,eave*.36,Math.min(1.7,bodyD*.17),eave*.33,C.glass);side(w+.04,yy,eave*.34,Math.min(1.7,bodyD*.17),.07,C.paint);}}
  if(detail){for(let z=.5;z<eave;z+=.65)front(0,bodyD+.035,z,w,.045,[153,148,125]);ac(w*.7,bodyD*.28,eave+rise*.65,.72);box(w*.2,.8,eave,1,1.1,rise+1,C.brick);}
  light(w*.65,bodyD+.15,eave*.7,15,.18);
 }else if(kind==='trailer'){
  const h=Math.min(H,4.4),bx=w*.07,bw=w*.74,bd=d*.91;
  block(bx,.2,bw,bd,h,[188,185,158]);box(bx,.2,0,bw,bd,.55,C.trim);box(bx-.08,.12,h,bw+.16,bd+.16,.2,[180,185,169]);
  if(detail){for(let z=.7;z<h;z+=.42){front(bx,bd+.22,z,bw,.055,C.trim);side(bx+bw+.02,.2,z,bd,.045,C.trim);}for(let yy=1;yy<bd;yy+=1.1)plane(bx,yy,bw,.08,h+.22,C.trim);}
  windowRow(bx,bd+.22,bw,h,3.3);for(let yy=2;yy<bd-2;yy+=4)side(bx+bw+.03,yy,1.4,1.5,1.25,C.glass);
  side(bx+bw+.08,bd*.49,.4,1.25,h*.65,C.dark);box(bx+bw,bd*.42,.3,w*.17,2.5,.18,C.paving);box(bx+bw,bd*.42,h*.8,w*.17,2.8,.12,C.cream||C.paint);
  ac(bx+bw*.3,bd*.4,h+.22,.7);if(detail)box(bx+bw*.3,bd*.7,h+.2,.4,.4,.35,C.trim);light(bx+bw+.12,bd*.5,h*.75,12,.17);
 }else if(kind==='school'){
  const wing=d*.43,sideW=w*.25,h=H;block(0,0,w,wing,h,[178,161,131]);block(0,wing,sideW,d-wing,h*.86,C.brick);block(w-sideW,wing,sideW,d-wing,h*.86,C.brick);
  flatRoof(0,0,w,wing,h);flatRoof(0,wing,sideW,d-wing,h*.86);flatRoof(w-sideW,wing,sideW,d-wing,h*.86);
  plane(sideW,wing,w-sideW*2,d-wing,.016,C.paving);windowRow(0,wing,w,h,3.3);windowRow(0,d,sideW,h*.86,3);windowRow(w-sideW,d,sideW,h*.86,3);
  const doorW=Math.min(3,w*.13);front(w/2-doorW/2,wing+.08,.1,doorW,h*.67,C.dark);box(w*.37,wing,h*.7,w*.26,2,.2,C.trim);for(const x of [w*.38,w*.61])box(x,wing+1.8,0,.18,.18,h*.7,C.paint);
  if(detail){ac(w*.18,wing*.27,h+.25);ac(w*.73,wing*.27,h+.25);for(const x of [sideW+.7,w-sideW-1.8]){box(x,d*.77,.4,1.1,2.5,.2,C.trim);}lowFence(sideW+.6,d-.35,w-2*sideW-1.2);}
  // Court stripes and hopscotch remain paint on the courtyard, not raised tiles.
  const cw=w*.24,ch=(d-wing)*.57,cx=(w-cw)/2,cy=wing+(d-wing)*.3;stripe(cx,cy,cw,.09);stripe(cx,cy+ch,cw,.09);stripe(cx,cy,.09,ch);stripe(cx+cw,cy,.09,ch);stripe(cx,cy+ch/2,cw,.08);
  light(w*.36,wing+.3,h*.7,20,.24);light(w*.65,wing+.3,h*.7,20,.24);
 }else if(kind==='shop'){
  const bd=d*.77,h=H,n=Math.max(1,Math.round(w/11)),unit=w/n;plane(0,bd,w,d-bd,.025,C.paving);
  for(let i=0;i<n;i++){const x=i*unit;block(x,0,unit,bd,h);flatRoof(x,0,unit,bd,h);front(x+.5,bd+.03,1,unit*.62,h*.48,C.glass,true);front(x+unit*.75,bd+.05,.05,unit*.17,h*.65,C.dark);
   box(x+.2,bd-.05,h*.65,unit-.4,Math.min(1.8,d*.2),.16,i%2?C.trim:C.red);front(x+.35,bd+.02,h*.82,unit-.7,h*.12,C.trim);if(detail){front(x+unit*.31,bd+.04,1,.07,h*.48,C.paint);ac(x+unit*.42,bd*.25,h+.25,.85);}light(x+unit*.5,bd+.12,h*.65,16,.24);}
  if(detail){box(w-.9,bd+1,0,.6,.6,1.1,[108,123,105]);for(let u=.8;u<w;u+=4)stripe(u,bd+.1,.05,d-bd-.15,[135,140,123]);}
 }else if(kind==='gas-station'){
  const bd=d*.34,h=H;block(0,0,w,bd,h);flatRoof(0,0,w,bd,h);plane(0,bd,w,d-bd,.015,C.paving);
  front(.7,bd+.04,1,w*.37,h*.45,C.glass,true);front(w*.45,bd+.05,.05,1.5,h*.68,C.dark);front(w*.63,bd+.05,.2,w*.31,h*.72,C.trim);if(detail)for(let z=.6;z<h*.7;z+=.42)front(w*.64,bd+.065,z,w*.29,.045,C.dark);
  const cy=bd+(d-bd)*.23,cw=w*.82,cd=(d-bd)*.52,cx=(w-cw)/2,ch=h*.68;
  for(const xx of [cx+.5,cx+cw-.7]){block(xx,cy+cd/2,.2,.2,ch,C.paint);}box(cx,cy,ch,cw,cd,.24,C.paint);box(cx,cy+cd-.09,ch,cw,.09,.27,C.red);if(detail)plane(cx+.15,cy+.15,cw-.3,cd-.3,ch+.25,C.roof);
  for(const xx of [w*.32,w*.68]){box(xx-1,cy+cd/2-.65,.04,2,1.3,.15,C.trim);block(xx-.34,cy+cd/2-.25,.68,.5,1.4,C.paint);front(xx-.23,cy+cd/2+.26,.78,.46,.39,C.dark);box(xx-.34,cy+cd/2-.25,0,.68,.5,.43,C.red);light(xx,cy+cd/2,ch-.15,12,.22);}
  if(detail){ac(w*.18,bd*.3,h+.25,.85);stripe(.3,d-1.2,w-.6,.1,C.yellow);}
 }else if(kind==='motel'){
  const row=d*.38,wing=w*.23;block(0,0,w,row,H);block(0,row,wing,d-row,H);flatRoof(0,0,w,row,H);flatRoof(0,row,wing,d-row,H);parking(wing+.5,row+.6,w-wing-1,d-row-1.1);
  for(let x=1;x<w-3;x+=5){front(x,row+.05,.1,1.1,H*.64,C.red);front(x+1.6,row+.05,1.3,1.8,H*.32,C.glass,true);}box(.2,row,H*.72,w-.4,1.1,.15,C.trim);if(detail)ac(w*.7,row*.3,H+.25,.85);light(w*.4,row+.3,H*.7,20,.2);
 }else if(kind==='workshop'){
  const h=H,rise=Math.min(2,w*.16);block(0,0,w,d,h,[144,146,122],true);face([[w,0,h],[w/2,0,h+rise],[0,0,h]],C.trim);face([[0,d,h],[w/2,d,h+rise],[w,d,h]],C.trim);
  face([[0,0,h],[w/2,0,h+rise],[w/2,d,h+rise],[0,d,h]],C.roof);face([[w/2,0,h+rise],[w,0,h],[w,d,h],[w/2,d,h+rise]],C.roof);
  front(w*.15,d+.02,.1,w*.68,h*.8,C.dark);front(w*.17,d+.04,.15,w*.64,h*.77,C.trim);if(detail){for(let x=w*.2;x<w*.8;x+=.8)front(x,d+.06,.2,.065,h*.74,C.dark);for(let y=1;y<d;y+=2){side(w+.02,y,.4,.06,h-.5,C.trim);}}
  light(w*.5,d+.12,h*.83,19,.22);
 }else if(kind==='parking'){parking(0,0,w,d);if(detail){for(const x of [.2,w-.4])box(x,.2,0,.2,d-.4,.16,C.paving);}}
 // Keep coplanar glazing, siding and roof seams immediately after their support
 // surface. Mean-depth alone would let a wide wall erase half its own windows.
 for(const f of faces.filter(f=>f.decal)){const mid=f.points.reduce((s,p)=>s.map((v,i)=>v+p[i]/f.points.length),[0,0,0]);let nearest=.18;for(let i=0;i<faces.length;i++){const base=faces[i];if(base.decal||base.ground||f.normal.reduce((s,v,k)=>s+v*base.normal[k],0)<.999)continue;const distance=Math.abs(mid.reduce((s,v,k)=>s+(v-base.points[0][k])*base.normal[k],0));if(distance>nearest)continue;const axes=[0,1,2].filter(k=>Math.abs(base.normal[k])<.5);if(!axes.every(k=>mid[k]>=Math.min(...base.points.map(p=>p[k]))-.1&&mid[k]<=Math.max(...base.points.map(p=>p[k]))+.1))continue;nearest=distance;f.support=i;}}
 // Day-only civilian palette. Original material values remain available for night.
 const dayMap=new Map([[C.wall,[[220,214,199],[194,202,193],[216,192,174],[198,207,210],[215,208,180]][seed%5]],[C.roof,[[111,91,80],[88,103,113],[138,105,85],[100,111,109]][seed%4]],[C.trim,[132,145,144]],[C.glass,[53,78,88]],[C.brick,[161,99,76]],[C.red,[170,73,52]],[C.paint,[231,223,206]],[C.paving,[180,180,169]],[C.asphalt,[91,104,110]]]);
 for(const f of faces)f.dayColor=dayMap.get(f.color)||f.color;
 return {faces,solids,lights,kind};
}
function worldRect(b,r,G){const p=G.point(b,[b.x+r.x+r.w/2,b.y+r.y+r.d/2]);return {x:p[0]-r.w/2,y:p[1]-r.d/2,w:r.w,d:r.d,h:r.h,angle:b.angle||0,id:b.id};}
function collision(b,G,profile){if(!role(b))return[b];return make(b,profile,false).solids.map(r=>worldRect(b,r,G));}
const api={catalog,spec,role,make,worldRect,collision};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TogaCivilian=api;
})(typeof window!=='undefined'?window:this);
