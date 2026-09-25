// Prepared by: Codex. Pixel-sampled original logo, never a redrawn mark.
// Motion derives from solar.html's spiral birth: stagger, signed swirl turns,
// rotated start directions, tilted bob, perspective and additive particles.
const tau=Math.PI*2;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const p=clamp((x-a)/(b-a));return p*p*(3-2*p);};
export function createLogoVortex(logo){
 const sample=document.createElement('canvas');sample.width=360;sample.height=360;
 const sx=sample.getContext('2d',{willReadFrequently:true});sx.drawImage(logo,0,0,360,360);
 const rgba=sx.getImageData(0,0,360,360).data,points=[];
 let seed=91016;
 const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let y=0;y<360;y+=2)for(let x=0;x<360;x+=2){
  const j=(y*360+x)*4,a=rgba[j+3]/255*(1-(rgba[j]+rgba[j+1]+rgba[j+2])/765);
  if(a<.18)continue;
  const angle=rand()*tau,z=rand()*1.6-.8,r=Math.sqrt(1-z*z);
  points.push({x:x/360-.5,y:y/360-.5,a,dx:Math.cos(angle)*r,dy:Math.sin(angle)*r,dz:z,
   radius:120+rand()*260,turns:.6+rand()*1.4,phase:rand()*tau,stagger:rand()*.3,band:Math.floor(rand()*3)});
 }
 const field=Array.from({length:700},()=>({a:rand()*tau,r:.08+rand()*.92,z:rand(),s:rand()}));
 const sprites=['255,244,216','255,206,139','190,221,221'].map(color=>{
  const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d');
  const g=x.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'#fff');g.addColorStop(.14,`rgba(${color},.95)`);g.addColorStop(.4,`rgba(${color},.26)`);g.addColorStop(1,`rgba(${color},0)`);x.fillStyle=g;x.fillRect(0,0,32,32);return c;
 });
 return {count:points.length,draw(ctx,u,w,h,{reduced=false}={}){
  const size=Math.min(w*.46,h*.52,440),unit=Math.min(w,h)/800,cx=w/2,cy=h/2;
  const inversion=smooth(.22,.7,u),value=Math.round(255*(1-inversion));
  ctx.save();ctx.globalAlpha=1;
  // The last portion reveals the real, running solar scene below this canvas.
  const cover=1-smooth(3.0,4.7,u);
  if(cover>0){
   ctx.fillStyle=`rgba(0,0,0,${cover})`;ctx.fillRect(0,0,w,h);
   // Light exposes space from the center, rather than washing the entire
   // white logo card through a flat gray midtone.
   if(u<.65){
    const r=Math.max(1,smooth(.18,.65,u)*Math.hypot(w,h));
    const exposure=ctx.createRadialGradient(cx,cy,0,cx,cy,r);
    exposure.addColorStop(0,'rgba(255,255,255,0)');exposure.addColorStop(.55,'rgba(255,255,255,0)');exposure.addColorStop(.96,'#fff');
    ctx.fillStyle=exposure;ctx.fillRect(0,0,w,h);
   }
  }
  if(reduced){ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(logo,cx-size/2,cy-size/2,size,size);ctx.restore();return;}
  const dissolve=smooth(0,.38,u);
  ctx.globalAlpha=1-dissolve;ctx.drawImage(logo,cx-size/2,cy-size/2,size,size);ctx.globalAlpha=1;
  const fade=1-smooth(4.4,5.1,u),flight=smooth(.4,2.8,u);
  ctx.globalCompositeOperation=inversion>.6?'lighter':'source-over';ctx.lineCap='round';
  const projected=(p,t)=>{
   const e=smooth(.12+p.stagger,2.8+p.stagger,t),ee=Math.pow(e,1.6);
   const ang=p.turns*e*tau*.45,ca=Math.cos(ang),sa=Math.sin(ang);
   const distance=p.radius*ee*5*unit;
   const z=(p.dz*.5+.65)*distance;
   if(z>610*unit)return null;
   const perspective=620*unit/(620*unit-z);
   const shrink=1-smooth(.05,.65,t)*.66;
   const lx=p.x*size*shrink,ly=p.y*size*shrink;
   const x=(lx*ca-ly*sa+(p.dx*ca+p.dz*sa)*distance)*perspective;
   const y=(lx*sa+ly*ca+p.dy*distance*.66+Math.sin(p.phase+e*tau)*9*unit*e)*perspective;
   return {x:cx+x,y:cy+y,scale:Math.min(4,perspective)};
  };
  for(let band=0;band<3;band++){
   const color=inversion<.6?'#171512':['#fff4d8','#ffce8b','#bedddd'][band];
   ctx.strokeStyle=color;ctx.fillStyle=color;ctx.globalAlpha=dissolve*fade*(.65+band*.12);
   ctx.lineWidth=(1+band*.25)*unit;ctx.beginPath();
   const heads=[];
   for(const p of points){if(p.band!==band)continue;const a=projected(p,u),b=projected(p,Math.max(0,u-.006-.012*flight));if(!a||!b)continue;
    if(Math.abs(a.x-cx)>w*.8||Math.abs(a.y-cy)>h*.8)continue;
    const dx=a.x-b.x,dy=a.y-b.y,cap=Math.min(1,22*unit/(Math.hypot(dx,dy)||1));
    ctx.moveTo(a.x-dx*cap,a.y-dy*cap);ctx.lineTo(a.x+unit*.3,a.y+unit*.3);heads.push(a);
   }ctx.stroke();
   if(inversion>.6)for(const a of heads){const s=(3+a.scale*1.8)*unit;ctx.drawImage(sprites[band],a.x-s/2,a.y-s/2,s,s);}
  }
  // Forward travel survives the iframe swap: projected stars streak past the
  // camera, not a captured frame scaled up over a second static picture.
  const stream=smooth(.65,1.8,u)*fade;
  ctx.strokeStyle='#e1d3b9';ctx.lineWidth=.8*unit;ctx.globalAlpha=stream*.22;ctx.beginPath();
  for(const p of field){
   const z=(p.z+u*(.15+p.s*.08))%1,depth=.15+z*.85;
   const angle=p.a+u*.08,r=p.r*90*unit/depth;
   const length=(2+Math.pow(1-depth,3)*65)*unit;
   const dx=Math.cos(angle),dy=Math.sin(angle);
   ctx.moveTo(cx+dx*r,cy+dy*r*.7);ctx.lineTo(cx+dx*(r+length),cy+dy*(r+length)*.7);
  }ctx.stroke();
  // One expanding release of light, not a sequence of flashing screens.
  const burst=Math.sin(Math.PI*smooth(.32,1.1,u));
  if(burst>0&&u<1.1){
   const radius=(24+smooth(.32,1.1,u)*Math.max(w,h))*.8;
   const light=ctx.createRadialGradient(cx,cy,0,cx,cy,radius);
   light.addColorStop(0,`rgba(255,251,232,${burst*.95})`);light.addColorStop(.13,`rgba(255,222,171,${burst*.4})`);light.addColorStop(1,'rgba(255,216,143,0)');
   ctx.globalAlpha=1;ctx.fillStyle=light;ctx.fillRect(0,0,w,h);
  }
  ctx.restore();
 }};
}

export async function loadLogoVortex(){
 const logo=new Image();logo.src='assets/intro-comet-v1/logo.png';await logo.decode();
 return createLogoVortex(logo);
}
