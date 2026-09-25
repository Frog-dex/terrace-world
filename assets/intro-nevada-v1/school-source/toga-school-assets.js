/* Shared reference-derived silhouettes. All dimensions are local ground units.
   Details behind the pencil drawing are interpretations, not claimed source data. */
(function(root){
function make(kind,w,d,h,variant=0){
 let variantName=kind;
 const faces=[],solids=[],lights=[],C={wall:'#c5b69e',cream:'#ded3bc',brick:'#a2856b',roof:'#807d71',edge:'#bbb4a0',glass:'#536765',dark:'#374744',metal:'#9caaa4',rubber:'#303d3b',stripe:variant%2?'#8d6650':'#7f8777'};
 function face(v,c,flag='shell',decal=false){const a=v[1].map((x,i)=>x-v[0][i]),b=v[2].map((x,i)=>x-v[0][i]),n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],l=Math.hypot(...n);if(l<1e-8)return;faces.push({v,c,n:n.map(x=>x/l),flag,decal});}
 function box(x,y,z,W,D,H,c,top=c,flag='shell'){if(W<=0||D<=0||H<=0)return;const p=[[x,y,z],[x+W,y,z],[x+W,y+D,z],[x,y+D,z]],q=p.map(v=>[v[0],v[1],z+H]);for(let i=0;i<4;i++)face([p[i],p[(i+1)%4],q[(i+1)%4],q[i]],c,flag);face(q,top,flag);}
 function plane(x,y,W,D,z,c,flag='shell'){face([[x,y,z],[x+W,y,z],[x+W,y+D,z],[x,y+D,z]],c,flag,z>.1);}
 function east(x,y,z,W,H,c,flag='shell'){face([[x,y,z],[x,y+W,z],[x,y+W,z+H],[x,y,z+H]],c,flag,true);}
 function south(x,y,z,W,H,c,flag='shell'){face([[x+W,y,z],[x,y,z],[x,y,z+H],[x+W,y,z+H]],c,flag,true);}
 function north(x,y,z,W,H,c){face([[x,y,z],[x+W,y,z],[x+W,y,z+H],[x,y,z+H]],c,'shell',true);}
 function west(x,y,z,W,H,c){face([[x,y+W,z],[x,y,z],[x,y,z+H],[x,y+W,z+H]],c,'shell',true);}
 function cylinder(x,y,z,r,H,c,n=12){const ring=[];for(let i=0;i<n;i++){const a=i*Math.PI*2/n,b=(i+1)*Math.PI*2/n,p=[x+Math.cos(a)*r,y+Math.sin(a)*r,z],q=[x+Math.cos(b)*r,y+Math.sin(b)*r,z];face([p,q,[q[0],q[1],z+H],[p[0],p[1],z+H]],c);ring.push([p[0],p[1],z+H]);}face(ring,c);}
 function flat(x,y,W,D,z){box(x,y,z,W,D,.12,C.edge,C.roof);for(const yy of [y,y+D-.16])box(x,yy,z+.12,W,.16,.28,C.wall,C.edge);for(const xx of [x,x+W-.16])box(xx,y,z+.12,.16,D,.28,C.wall,C.edge);for(let yy=y+.8;yy<y+D;yy+=2)plane(x+.18,yy,W-.36,.035,z+.135,'#666f67');}
 function hip(x,y,W,D,z,rise){const inset=Math.min(W,D)*.23,a=[[x,y,z],[x+W,y,z],[x+W,y+D,z],[x,y+D,z]],b=[[x+inset,y+inset,z+rise],[x+W-inset,y+inset,z+rise],[x+W-inset,y+D-inset,z+rise],[x+inset,y+D-inset,z+rise]];for(let i=0;i<4;i++)face([a[i],a[(i+1)%4],b[(i+1)%4],b[i]],C.roof);face(b,C.roof);}
 function gable(x,y,W,D,z,rise){face([[x+W,y,z],[x+W/2,y,z+rise],[x,y,z]],C.wall);face([[x,y+D,z],[x+W/2,y+D,z+rise],[x+W,y+D,z]],C.wall);face([[x,y,z],[x+W/2,y,z+rise],[x+W/2,y+D,z+rise],[x,y+D,z]],C.roof);face([[x+W/2,y,z+rise],[x+W,y,z],[x+W,y+D,z],[x+W/2,y+D,z+rise]],C.roof);}
 function barrel(x,y,W,D,z,rise,segments=12){const arc=Array.from({length:segments+1},(_,i)=>[x+W*(1-Math.cos(i*Math.PI/segments))/2,z+rise*Math.sin(i*Math.PI/segments)]);for(let i=0;i<segments;i++){const a=arc[i],b=arc[i+1];face([[a[0],y,a[1]],[b[0],y,b[1]],[b[0],y+D,b[1]],[a[0],y+D,a[1]]],C.roof);}face(arc.map(p=>[p[0],y+D,p[1]]),C.wall);face(arc.slice().reverse().map(p=>[p[0],y,p[1]]),C.wall);}
 function window(x,y,z,W,H,side=false){const pane=side?east:south;pane(x,y,z,W,H,C.cream);pane(x+(side?.025:.09),y+(side?.09:.025),z+.09,W-.18,H-.18,C.glass);pane(x+(side?.04:W*.49),y+(side?W*.49:.04),z+.1,.055,H-.2,C.edge);}
 function lamp(x,y,z,r=10){box(x-.16,y-.12,z,.32,.24,.1,C.edge,C.cream);lights.push({x,y,z,r,power:.38,color:[1,.83,.59]});}
 function roofDetail(draw){const start=faces.length;draw();for(let i=start;i<faces.length;i++)faces[i].roofDetail=true;}
 if(kind==='school'){
  // Full lower storey; the offset upper hall and taller corner stairwell break
  // the former monolithic roof. Side door location is shared with walking logic.
  const low=h*.47,doorY=d*8.5/18,doorW=Math.min(2.6,d*.17);
  box(0,0,0,w,d,low,C.wall,C.roof);faces.pop();box(0,0,0,w,d,.36,C.brick,C.brick);faces.pop();
  box(0,d*.17,low,w*.66,d*.83,h*.41,C.wall);faces.pop();hip(-.14,d*.17-.14,w*.66+.28,d*.83+.28,h*.88,h*.10);
  box(w*.66,d*.25,low,w*.34,d*.75,h*.53,C.wall);flat(w*.66,d*.25,w*.34,d*.75,h);
  flat(0,0,w,d*.17,low);flat(w*.66,d*.17,w*.34,d*.08,low);
  // Paired tall classroom windows, corner pilasters, sill and cornice bands.
  for(const z of [h*.13,h*.58]){for(let x=w*.10;x<w*.86;x+=w*.25)window(x,d+.025,z,w*.16,h*.23);for(let y=d*.10;y<d*.90;y+=d*.26)if(z>h*.5||Math.abs(y+d*.07-doorY)>doorW)window(w+.025,y,z,d*.15,h*.23,true);}
  // The reference hides these facades: continue its classroom-window rhythm
  // plausibly, so the reverse camera view is not an unfinished solid wall.
  for(const z of [h*.13,h*.58])for(let y=d*.30;y<d*.85;y+=d*.25){west(-.025,y,z,d*.14,h*.23,C.cream);west(-.04,y+.08,z+.08,d*.14-.16,h*.23-.16,C.glass);}
  for(let x=w*.1;x<w*.82;x+=w*.24){north(x,-.025,h*.13,w*.14,h*.23,C.cream);north(x+.08,-.04,h*.13+.08,w*.14-.16,h*.23-.16,C.glass);}
  for(const x of [0,w*.65,w-.18])box(x,d+.015,.36,.18,.12,h*.62,C.brick,C.cream);
  for(const y of [d*.25,d-.16])box(w+.015,y,.36,.13,.16,h*.92,C.brick,C.cream);
  box(0,d+.04,low-.10,w,.14,.15,C.edge,C.cream);box(w+.04,0,low-.10,.14,d,.15,C.edge,C.cream);
  east(w+.045,doorY-doorW/2,.2,doorW,h*.44,C.dark);
  east(w+.065,doorY-doorW/2,.2,doorW,h*.44,'#3d5652','door');
  for(const side of [-1,1])east(w+.08,doorY+side*doorW*.25-doorW*.19,.85,doorW*.38,h*.27,'#849892','door');
  box(w+.09,doorY-.05,1,.10,.10,.48,C.cream,C.cream,'door');
  // Short entrance hood, not a large free-standing portico.
  box(w-.05,doorY-doorW*.75,h*.48,1.2,doorW*1.5,.14,C.edge,C.roof);
  box(w,doorY-doorW*.72,0,.7,doorW*1.44,.12,C.brick,C.cream,'');
  lamp(w+.2,doorY+doorW*.95,h*.49,11);
  box(w*.13,d*.42,h*.98,.6,.65,.55,C.brick,C.edge);box(w*.79,d*.52,h+.42,.95,.72,.37,C.metal);
  solids.push({x:0,y:0,w,d,h});
 }else if(kind==='service'){
  // Source close-up: long horizontal eave, rounded garage roof, then a lower
  // straight-front attached room. The previous triangular gable was incorrect.
  const bx=w*.05,by=d*.06,bw=w*.61,bd=d*.62,e=h*.78;
  box(bx,by,0,bw,bd,e,C.cream);faces.pop();barrel(bx-.10,by-.10,bw+.20,bd+.20,e,h*.40);box(bx-.1,by+bd+.10,e-.09,bw+.2,.11,.14,C.edge);
  box(bx+bw,by+bd*.34,0,w*.29,bd*.66,e*.63,C.wall);face([[bx+bw,by+bd*.34,e*.75],[w*.95,by+bd*.34,e*.58],[w*.95,by+bd,e*.58],[bx+bw,by+bd,e*.75]],C.roof);
  south(bx+bw*.09,by+bd+.04,.1,bw*.37,e*.73,C.dark);south(bx+bw*.10,by+bd+.055,.15,bw*.35,e*.68,C.metal);for(let z=.3;z<e*.68;z+=.28)south(bx+bw*.10,by+bd+.07,z,bw*.35,.025,'#65776f');
  window(bx+bw*.54,by+bd+.04,e*.30,bw*.29,e*.43);south(w*.76,by+bd+.05,.06,w*.10,e*.51,C.dark);window(w*.95+.02,by+bd*.47,e*.22,bd*.23,e*.31,true);
  for(const x of [w*.32,w*.65]){box(x-.4,d*.85,.05,.8,.65,.13,C.metal,C.cream);box(x-.19,d*.87,.17,.38,.35,.95,'#ab7154',C.cream);south(x-.145,d*.87+.36,.76,.29,.25,C.dark);box(x+.21,d*.9,.25,.06,.08,.69,C.dark);}
  box(w*.12,d*.88,0,.08,.08,2.5,C.metal);box(w*.12-.37,d*.88,1.8,.82,.08,.50,'#a28362',C.cream);
  lamp(bx+bw*.7,by+bd+.2,e*.9,9);solids.push({x:bx,y:by,w:bw,d:bd,h:e},{x:bx+bw,y:by+bd*.34,w:w*.29,d:bd*.66,h:e*.63});
 }else if(kind==='motorhome'||kind==='caravan'){
  const style=kind==='caravan'?(variant%3===1?'singlewide':'compact'):['coach','cabover','campervan'][variant%3],short=style==='compact'||style==='campervan',mobile=style==='singlewide';
  variantName=style;
  const lengthRatio=({compact:.60,singlewide:.94,coach:.90,campervan:.72,cabover:.85})[style],bw=Math.min(w*(short?.75:mobile?.77:.86),d*.31),bd=Math.min(d*lengthRatio,bw*(mobile?4.3:short?2.55:3.35)),x=(w-bw)/2,y=(d-bd)/2,H=Math.min(h,style==='campervan'?2.25:2.8),base=mobile?.20:.37,top=H*(mobile?.88:.82),body=style==='compact'?'#c9c7b8':mobile?'#b9b79a':style==='coach'?'#bac5bf':style==='campervan'?'#d0b58c':'#ddd8c4';
  C.stripe=({compact:'#7d928c',singlewide:'#777f70',coach:'#576f76',campervan:'#956c4d',cabover:'#946c51'})[style];
  box(x+.08,y+.15,.14,bw-.16,bd-.3,.22,C.dark);box(x,y,base,bw,bd,top-base,body,C.cream);faces.pop();
  // Bevels make a low arched/rolled roof silhouette rather than a house roof.
  if(mobile){C.roof='#9ba89e';gable(x-.06,y-.06,bw+.12,bd+.12,top,.30);for(let z=.4;z<top;z+=.25){east(x+bw+.02,y,z,bd,.025,C.stripe);west(x-.02,y,z,bd,.025,C.stripe);}box(x,y,0,bw,bd,.26,'#8e998d');}
  else if(style==='compact'){C.roof='#c2cabf';barrel(x,y,bw,bd,top,.32,8);}
  else{const r=bw*.12;face([[x,y,top],[x+r,y,top+.18],[x+r,y+bd,top+.18],[x,y+bd,top]],C.edge);plane(x+r,y,bw-r*2,bd,top+.18,C.cream);face([[x+bw-r,y,top+.18],[x+bw,y,top],[x+bw,y+bd,top],[x+bw-r,y+bd,top+.18]],C.edge);}
  for(const z of [.64,.82]){east(x+bw+.01,y,z,bd,.095,C.stripe);south(x,y+bd+.01,z,bw,.095,C.stripe);north(x,y-.01,z,bw,.095,C.stripe);}
  for(const u of (mobile?[.13,.40,.72]:style==='compact'?[.17,.65]:style==='coach'?[.16,.37,.60,.79]:[.29,.66])){const yy=y+bd*u,ww=bd*(style==='coach'?.12:short?.21:.14);east(x+bw+.025,yy,H*.48,ww,H*.21,C.dark);east(x+bw+.035,yy+.06,H*.50,ww-.12,H*.17,C.glass);}
  for(const z of [.64,.82])west(x-.01,y,z,bd,.095,C.stripe);
  for(let yy=y+bd*.24;yy<y+bd*.8;yy+=bd*.30){west(x-.025,yy,H*.48,bd*.14,H*.21,C.dark);west(x-.04,yy+.06,H*.50,bd*.14-.12,H*.17,C.glass);}
  const doorY=y+bd*.50;east(x+bw+.05,doorY,.4,Math.min(.65,bd*.1),H*.61,C.edge);east(x+bw+.065,doorY+.08,H*.62,.44,H*.17,C.glass);box(x+bw,doorY,.10,.35,.74,.14,C.metal);
  // Tires lie on an axle, with their circular faces on the vehicle sides.
  if(!mobile)for(const xx of [x-.05,x+bw-.15])for(const yy of (style==='compact'?[y+bd*.58]:[y+bd*.22,y+bd*.76])){
   const radius=H*.16,cz=radius+.03,ring=Array.from({length:10},(_,i)=>[xx,yy+Math.cos(i*Math.PI/5)*radius,cz+Math.sin(i*Math.PI/5)*radius]),outer=ring.map(p=>[p[0]+.22,p[1],p[2]]);
   for(let i=0;i<ring.length;i++){const j=(i+1)%ring.length;face([ring[i],ring[j],outer[j],outer[i]],C.rubber);}
   face(ring.slice().reverse(),C.rubber);face(outer,C.rubber);
   for(const side of [-1,1]){const hub=ring.map(p=>[xx+(side>0?.235:-.015),yy+(p[1]-yy)*.42,cz+(p[2]-cz)*.42]);face(side>0?hub:hub.reverse(),C.metal);}
  }
  if(kind==='motorhome'){north(x+bw*.08,y-.025,H*.43,bw*.84,H*.28,C.glass);north(x+bw*.49,y-.04,H*.43,.045,H*.28,C.edge);if(style==='cabover')box(x-.05,y-.20,H*.78,bw+.1,bd*.25,.32,C.edge,C.cream);if(style==='campervan'){box(x+.06,y-.24,.5,bw-.12,.55,.40,body);box(x+bw*.2,y+bd*.20,top+.18,bw*.6,bd*.36,.38,'#ece5d2',C.cream);}for(const xx of [x+.13,x+bw-.36])north(xx,y-.04,.43,.23,.13,'#d8d1a9');}
  else if(!mobile){box(x+bw*.44,y-.7,.22,bw*.12,.75,.12,C.metal);cylinder(x+bw*.35,y-.3,.34,.17,.36,C.edge);}
  if(mobile){const pw=Math.min(w*.16,.65);box(x+bw,doorY-.45,.18,pw,1.8,.15,'#a38c6e');for(const yy of [doorY-.43,doorY+1.23])box(x+bw+pw-.07,yy,0,.07,.07,1.1,C.edge);}
  roofDetail(()=>{if(!short)box(x+bw*.25,y+bd*.4,top+(mobile?.31:.18),bw*.5,.8,.22,C.metal,C.cream);if(!mobile)plane(x+bw*.28,y+bd*.67,bw*.4,.42,top+(style==='compact'?.335:.195),'#99aaa7');cylinder(x+bw*.7,y+bd*.78,top+.18,.08,.19,C.metal);});
  box(x+bw+.06,y+bd*.35,H*.86,.10,bd*.39,.10,C.stripe);lamp(x+bw+.05,doorY,H*.78,4);
  solids.push({x,y,w:bw,d:bd,h:top});
 }
 // Attach decals to their own plane before depth sorting in either renderer.
 for(const f of faces.filter(f=>f.decal)){const mid=f.v[0].map((_,i)=>f.v.reduce((s,p)=>s+p[i],0)/f.v.length);let nearest=.17;for(let i=0;i<faces.length;i++){const b=faces[i];if(b.decal||f.n.reduce((s,v,k)=>s+v*b.n[k],0)<.999)continue;const distance=Math.abs(mid.reduce((s,v,k)=>s+(v-b.v[0][k])*b.n[k],0));if(distance>nearest)continue;const axes=[0,1,2].filter(k=>Math.abs(b.n[k])<.5);if(axes.every(k=>mid[k]>=Math.min(...b.v.map(p=>p[k]))-.1&&mid[k]<=Math.max(...b.v.map(p=>p[k]))+.1)){nearest=distance;f.support=i;}}}
 // Preserve the established night materials; clearer daylight colors do not tint lamps.
 const dayPalette={'#c5b69e':'#ccc8bd','#ded3bc':'#e1ddd0','#a2856b':'#ad8670','#807d71':'#73818a','#bbb4a0':'#b6bcb9','#536765':'#46636e','#9caaa4':'#9eafb3','#ddd8c4':'#dddcd2','#c9c7b8':'#c8cfc9','#d0b58c':'#cfb79b'};
 for(const f of faces)f.dayC=dayPalette[f.c]||f.c;
 return{faces,solids,lights,kind,variant:variantName,door:kind==='school'?{x:w,y:d*8.5/18,width:Math.min(2.6,d*.17)}:null};
}
const api={make};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TogaSchoolAssets=api;
})(typeof window==='undefined'?this:window);
