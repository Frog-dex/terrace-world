/* Original, reusable ground-support meshes. Map units, not manufacturer dimensions. */
(function(root){
const C={steel:[146,156,144],dark:[58,70,63],rubber:[34,39,34],cream:[184,181,150],yellow:[180,155,79],red:[144,70,46],glass:[65,97,94]};
const catalog=[
 {type:'fuel-tank',label:'Fuel storage tank',w:10,d:5,h:4,solid:true},
 {type:'tug',label:'Aircraft towing tractor',w:6,d:3.6,h:2.7,solid:true},
 {type:'towbar',label:'Aircraft tow bar',w:6,d:1.5,h:.8},
 {type:'cart',label:'Open equipment cart',w:5,d:3,h:2,solid:true},
 {type:'gpu',label:'Ground power trailer',w:5,d:3,h:2.7,solid:true},
 {type:'stairs',label:'Rolling maintenance stairs',w:5,d:3,h:4,solid:true},
 {type:'chocks',label:'Pair of wheel chocks',w:2,d:2,h:.5},
 {type:'cone',label:'Safety cone',w:1.2,d:1.2,h:1.5},
 {type:'drums',label:'Service oil drums',w:3,d:2.7,h:1.6,solid:true},
 {type:'bench',label:'Maintenance workbench',w:4,d:2,h:2,solid:true},
 {type:'windsock',label:'Windsock mast',w:2,d:2,h:12,solid:true},
 {type:'fence',label:'Chain-link fence section',w:12,d:.6,h:3,solid:true}
];
const spec=type=>catalog.find(s=>s.type===type);
function wind(time){const hash=n=>{const v=Math.sin(n*127.1+31.7)*43758.5453;return v-Math.floor(v);},slot=Math.floor(time/65),f=time/65-slot,s=f*f*(3-2*f),a=hash(slot)*Math.PI*2,b=hash(slot+1)*Math.PI*2,delta=Math.atan2(Math.sin(b-a),Math.cos(b-a)),angle=a+delta*s,speed=1.1+.2*Math.sin(time*.17);return{x:Math.cos(angle)*speed,y:Math.sin(angle)*speed,angle};}
function mesh(type,time=0,rotation=0){const faces=[],add=(points,color)=>faces.push({points,color});
 function box(x,y,z,w,d,h,col){const p=[[x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z]],q=p.map(v=>[v[0],v[1],z+h]);for(let i=0;i<4;i++)add([p[i],p[(i+1)%4],q[(i+1)%4],q[i]],col);add(q,col);}
 function beam(a,b,r,col){const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),u=len>1e-8?[-dy/len*r,dx/len*r,0]:[r,0,0],v=len>1e-8?[-(b[2]-a[2])*dx/(Math.hypot(...b.map((x,i)=>x-a[i]))*len)*r,-(b[2]-a[2])*dy/(Math.hypot(...b.map((x,i)=>x-a[i]))*len)*r,len/Math.hypot(...b.map((x,i)=>x-a[i]))*r]:[0,r,0];const ring=p=>[[1,1],[-1,1],[-1,-1],[1,-1]].map(([s,t])=>p.map((x,i)=>x+s*u[i]+t*v[i])),p=ring(a),q=ring(b);for(let i=0;i<4;i++)add([p[i],p[(i+1)%4],q[(i+1)%4],q[i]],col);add(q,col);}
 function cylinder(x,y,z,r,length,axis,col){const ring=end=>Array.from({length:16},(_,i)=>{const a=i*Math.PI/8;return axis==='x'?[x+end,y+Math.cos(a)*r,z+Math.sin(a)*r]:[x+Math.cos(a)*r,y+Math.sin(a)*r,z+end];}),a=ring(0),b=ring(length);for(let i=0;i<16;i++)add([a[i],a[(i+1)%16],b[(i+1)%16],b[i]],col);add(a.slice().reverse(),col);add(b,col);}
 function wheels(w,d){for(const x of [-w/2+.7,w/2-.7])for(const y of [-d/2-.15,d/2-.35])box(x-.45,y,.12,.9,.5,.75,C.rubber);}
 if(type==='fuel-tank'){
  box(-5,-2.5,0,10,5,.22,[132,135,118]);for(const x of [-3.4,2.6])box(x,-1.5,.22,.8,3,1.3,C.steel);
  cylinder(-4.2,0,2.4,1.6,8.4,'x',C.cream);for(const x of [-2.7,2.7]){const pts=Array.from({length:17},(_,i)=>[x,Math.cos(i*Math.PI/8)*1.63,2.4+Math.sin(i*Math.PI/8)*1.63]);for(let i=1;i<pts.length;i++)beam(pts[i-1],pts[i],.06,C.dark);}
  cylinder(.4,0,3.8,.3,.4,'z',C.steel);box(4.15,-2,.25,.65,.7,1.8,C.red);beam([4.1,-1.9,1.5],[4.1,-1.5,.5],.07,C.rubber);beam([-3,1.7,.3],[-3,1.7,3.4],.07,C.dark);
 }
 if(type==='tug'){
  wheels(5.6,3);box(-3,-1.5,.6,6,3,1.05,C.yellow);box(.3,-1.3,1.65,2.6,2.6,.65,C.yellow);box(-1.9,-.8,1.6,1.2,1.6,.4,C.dark);box(-2.1,-.8,1.8,.3,1.6,.9,C.dark);beam([-.1,-.4,1.5],[.1,-.4,2.5],.08,C.steel);box(2.95,-1,.9,.08,2,.5,C.dark);for(const y of [-1.2,.85])box(3,y,1.4,.08,.35,.25,C.cream);box(-3.3,-.3,.5,.4,.6,.35,C.steel);
 }
 if(type==='cart'||type==='gpu'||type==='stairs'){
  wheels(4,2.6);box(-2,-1.3,.65,4,2.6,.28,C.steel);beam([2,0,.6],[3,0,.35],.08,C.dark);
  if(type==='cart'){box(-1.9,-1.2,.95,3.8,2.4,.15,[116,112,85]);for(const y of [-1.25,1.25]){for(const x of [-1.8,1.8])beam([x,y,.9],[x,y,1.8],.065,C.steel);beam([-1.8,y,1.8],[1.8,y,1.8],.06,C.steel);}box(-1.5,-.8,1.1,1.3,1.5,.7,[138,124,86]);}
  if(type==='gpu'){box(-1.8,-1.1,.95,3.5,2.2,1.55,[133,145,119]);for(let x=-1.4;x<.7;x+=.3)box(x,1.105,1.3,.13,.05,.8,C.dark);box(1.71,-.8,1.3,.04,1.6,.9,C.dark);beam([2,-.9,1],[2.7,-1.3,.15],.08,C.rubber);box(-.7,-.55,2.5,1.4,1.1,.16,C.steel);}
  if(type==='stairs'){for(let i=0;i<6;i++)box(-2+i*.58,-1.1,.92+i*.43,.62,2.2,.12,C.steel);for(const y of [-1.1,1.1]){beam([-1.8,y,1.8],[1.4,y,4],.065,C.yellow);for(const x of [-1.8,1.4])beam([x,y,x<0?1:3.1],[x,y,x<0?1.8:4],.06,C.yellow);}beam([1.3,-1,.9],[1.3,-1,3.3],.09,C.steel);beam([1.3,1,.9],[1.3,1,3.3],.09,C.steel);}
 }
 if(type==='towbar'){beam([-3,0,.35],[2.7,0,.35],.12,C.yellow);for(const y of [-.65,.65])beam([-2.4,y,.35],[-1.5,0,.35],.1,C.yellow);box(0,-.8,.05,.6,1.6,.3,C.dark);}
 if(type==='chocks'){for(const y of [-.8,.5]){add([[-.9,y,0],[.9,y,0],[.45,y,.5],[-.45,y,.5]],C.yellow);box(-.5,y,0,1,.35,.35,C.yellow);}beam([0,-.65,.05],[0,.65,.05],.025,C.dark);}
 if(type==='cone'){box(-.6,-.6,0,1.2,1.2,.12,C.dark);for(let j=0;j<3;j++){const z=.12+j*.43,r=.48-j*.13,nr=r-.13;for(let i=0;i<8;i++){const a=i*Math.PI/4,b=a+Math.PI/4;add([[Math.cos(a)*r,Math.sin(a)*r,z],[Math.cos(b)*r,Math.sin(b)*r,z],[Math.cos(b)*nr,Math.sin(b)*nr,z+.43],[Math.cos(a)*nr,Math.sin(a)*nr,z+.43]],j===1?C.cream:C.red);}}}
 if(type==='drums')for(const [x,y] of [[-.8,-.5],[.65,.5]]){cylinder(x,y,0,.62,1.6,'z',C.red);for(const z of [.3,1.3])cylinder(x,y,z,.65,.09,'z',C.dark);cylinder(x+.2,y,1.6,.09,.04,'z',C.steel);}
 if(type==='bench'){for(const x of [-1.7,1.7])for(const y of [-.7,.7])box(x,y,0,.16,.16,1.8,C.dark);box(-2,-1,1.8,4,2,.18,[144,131,101]);box(-1.6,-.7,1.98,1.3,.9,.7,C.red);box(.8,-.5,1.98,.65,.7,.35,C.steel);}
 if(type==='windsock'){box(-.7,-.7,0,1.4,1.4,.3,C.steel);beam([0,0,.3],[0,0,11.5],.12,C.steel);const angle=wind(time).angle-rotation+Math.sin(time*.8)*.035,turn=p=>[p[0]*Math.cos(angle)-p[1]*Math.sin(angle),p[0]*Math.sin(angle)+p[1]*Math.cos(angle),p[2]];for(let j=0;j<5;j++){const r=.75-j*.1,nr=r-.1;for(let i=0;i<12;i++){const a=i*Math.PI/6,b=a+Math.PI/6;add([[j,Math.cos(a)*r,11+Math.sin(a)*r-j*.13],[j,Math.cos(b)*r,11+Math.sin(b)*r-j*.13],[j+1,Math.cos(b)*nr,11+Math.sin(b)*nr-(j+1)*.13],[j+1,Math.cos(a)*nr,11+Math.sin(a)*nr-(j+1)*.13]].map(turn),j%2?C.cream:C.red);}}}
 if(type==='fence'){for(const x of [-6,0,6])beam([x,0,0],[x,0,3],.08,C.steel);for(const z of [.3,2.8])beam([-6,0,z],[6,0,z],.045,C.steel);for(let x=-6;x<6;x+=.7){beam([x,0,.3],[Math.min(6,x+2.5),0,2.8],.018,[121,132,117]);beam([x,0,2.8],[Math.min(6,x+2.5),0,.3],.018,[121,132,117]);}}
 return faces;
}
function bounds(p){const s=spec(p.type);return{x:p.x-s.w*p.scale/2,y:p.y-s.d*p.scale/2,w:s.w*p.scale,d:s.d*p.scale,angle:p.angle||0,h:s.h*p.scale};}
function seed(world){if(Array.isArray(world.props))return false;world.props=[];const G=world.geometry,anchors=['hangar','building-084','building-085','building-083','building-001'];
 const kinds=['tug','gpu','towbar','cart','stairs','chocks','cone','fuel-tank','drums','bench','windsock','fence','cone','cart','chocks','drums'];
 for(let i=0;i<kinds.length;i++){const type=kinds[i],s=spec(type),anchor=world.buildings.find(b=>b.id===anchors[i%anchors.length]);if(!anchor)continue;
  let best=null;for(let n=0;n<48;n++){const angle=n*Math.PI/24,rx=anchor.w/2+4+s.w/2,ry=anchor.d/2+4+s.d/2,q=G.point(anchor,[anchor.x+anchor.w/2+Math.cos(angle)*rx,anchor.y+anchor.d/2+Math.sin(angle)*ry]);const r=Math.hypot(s.w,s.d)/2;
   if(q[0]<r||q[1]<r||q[0]>world.W-r||q[1]>world.H-r)continue;
   if(world.buildings.some(b=>{const p=G.point(b,q,true);return p[0]>b.x-r&&p[0]<b.x+b.w+r&&p[1]>b.y-r&&p[1]<b.y+b.d+r;}))continue;
   if(world.roads.some(road=>G.nearest([road],q).distance<road.width/2+r+1))continue;
   if(world.props.some(p=>Math.hypot(p.x-q[0],p.y-q[1])<Math.hypot(spec(p.type).w,spec(p.type).d)/2+r+1))continue;
   if(world.towers.some(t=>Math.hypot(t.x-q[0],t.y-q[1])<t.r+r+2))continue;
   if(world.aircraft&&Math.hypot(world.aircraft.x-q[0],world.aircraft.y-q[1])<13+r)continue;
   const score=G.nearest(world.roads.filter(r=>r.kind==='apron'||r.kind==='runway'),q).distance+(type==='windsock'?-n*.04:n*.01);
   if(!best||score<best.score)best={q,score};
  }
  if(best)world.props.push({id:'airport-prop-'+i,type,x:best.q[0],y:best.q[1],angle:anchor.angle||0,scale:1});
 }return true;
}
const api={catalog,spec,mesh,bounds,seed,wind};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TogaAssets=api;
})(typeof window!=='undefined'?window:this);
