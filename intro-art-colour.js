// Prepared by: Codex. Flat display mattes only; source drawings are read-only.
// Explicit bases, never sampled from a generated/painted reference image.
const TEAL='#41A8A7',RED='#9E0303',GREEN='#41A841',NEUTRAL='#A9A7A7';
export const FLAT_COLOURS=[
 TEAL,'#8E7BC4',TEAL,NEUTRAL,NEUTRAL,NEUTRAL,RED,RED,NEUTRAL,NEUTRAL,
 GREEN,NEUTRAL,NEUTRAL,NEUTRAL,NEUTRAL,NEUTRAL,NEUTRAL,TEAL,NEUTRAL,TEAL,
 '#8E7BC4','#DF771F',NEUTRAL,TEAL,RED,'#E4D34E',NEUTRAL,GREEN,TEAL
];

// A scanned ink gap is not a transparent body part. Close tiny breaks only in
// the hidden fill barrier; never dilate or redraw the displayed source ink.
// The card-specific points below identify actual negative space, not colours.
// Coordinates refer to the read-only original card pixels.
const FILL_GUIDES={
 'card-01':{size:[280,496],holes:[[80,269],[187,241]]},
 'card-03':{size:[463,501],holes:[[151,267]],rightEdge:[[336,383]]},
 'card-04':{size:[404,345],radius:3},
 'card-08':{size:[252,421]},
 'card-18':{size:[391,403],holes:[[85,99],[133,100],[137,144]]},
 'card-21':{size:[435,434]},
 'card-24':{size:[357,459],holes:[[127,200]]},
 // This narrow space under the rider's raised arm is smaller than the gap
 // closure kernel. Its reviewed matte aperture follows the original ink;
 // the original line itself is composited later and is never erased.
 'card-25':{size:[487,438],radius:3,cutouts:[[[226,176],[233,177],[247,168],[250,176],[253,181],[242,180],[236,182],[231,188],[229,194],[225,197],[227,186]]]},
 'card-29':{size:[240,467],holes:[[75,235]]}
};
function closeFillBarrier(ink,w,h,radius){
 const morph=(source,dilate)=>{
  const stride=w+1,table=new Uint32Array(stride*(h+1)),result=new Uint8Array(w*h);
  for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){row+=source[y*w+x];table[(y+1)*stride+x+1]=table[y*stride+x+1]+row;}}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const a=Math.max(0,x-radius),b=Math.min(w,x+radius+1),c=Math.max(0,y-radius),d=Math.min(h,y+radius+1);
   const count=table[d*stride+b]-table[c*stride+b]-table[d*stride+a]+table[c*stride+a];
   result[y*w+x]=dilate?Number(count>0):Number(count===(b-a)*(d-c));
  }
  return result;
 };
 const barrier=Uint8Array.from(ink,value=>Number(value>.18));
 return morph(morph(barrier,true),false);
}

export function colourOriginal(line,colour=NEUTRAL){
 const w=line.naturalWidth,h=line.naturalHeight,n=w*h;
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(line,0,0);
 const original=ctx.getImageData(0,0,w,h).data,ink=new Float32Array(n);
 let x0=w,y0=h,x1=0,y1=0;
 for(let p=0;p<n;p++){
  const k=p*4;ink[p]=original[k+3]/255*(1-(original[k]+original[k+1]+original[k+2])/765);
  if(ink[p]>.15){const x=p%w,y=Math.floor(p/w);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 }
 const card=(line.currentSrc||line.src||'').match(/card-\d+/)?.[0];
 const candidate=FILL_GUIDES[card];
 // Do not apply pixel annotations to a substituted or differently sized image.
 const guide=candidate?.size[0]===w&&candidate?.size[1]===h?candidate:null;
 const barrier=guide?closeFillBarrier(ink,w,h,guide.radius??2):Uint8Array.from(ink,value=>Number(value>.25));
 // The fishing card intentionally crops the fish at the right paper edge.
 // Terminate that matte at the exact existing crop, without inventing anatomy.
 for(const [a,b] of guide?.rightEdge||[])for(let y=a;y<=b;y++)barrier[y*w+w-1]=1;
 // Exterior paper and explicitly reviewed enclosed negative spaces remain
 // transparent. Closed contours supply the body matte underneath original ink.
 const outside=new Uint8Array(n),queue=new Uint32Array(n);let head=0,tail=0;
 const add=p=>{if(!outside[p]&&!barrier[p]){outside[p]=1;queue[tail++]=p;}};
 for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}
 for(let y=1;y<h-1;y++){add(y*w);add(y*w+w-1);}
 for(const [x,y] of guide?.holes||[])add(y*w+x);
 while(head<tail){const p=queue[head++],x=p%w;if(x>0)add(p-1);if(x<w-1)add(p+1);if(p>=w)add(p-w);if(p<n-w)add(p+w);}
 const rgb=colour.slice(1).match(/../g).map(v=>parseInt(v,16));
 const out=ctx.createImageData(w,h),d=out.data;
 for(let p=0;p<n;p++){if(outside[p])continue;const k=p*4;d[k]=rgb[0];d[k+1]=rgb[1];d[k+2]=rgb[2];d[k+3]=255;}
 ctx.putImageData(out,0,0);
 for(const points of guide?.cutouts||[]){
  ctx.save();ctx.globalCompositeOperation='destination-out';ctx.beginPath();
  points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();ctx.restore();
 }
 const inkCanvas=document.createElement('canvas');inkCanvas.width=w;inkCanvas.height=h;
 const ix=inkCanvas.getContext('2d'),id=ix.createImageData(w,h);
 for(let p=0;p<n;p++)id.data[p*4+3]=Math.min(255,ink[p]*340);
 ix.putImageData(id,0,0);
 for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.drawImage(inkCanvas,Math.cos(a)*.65,Math.sin(a)*.65);}
 ctx.drawImage(inkCanvas,0,0);
 const left=Math.max(0,x0-4),top=Math.max(0,y0-4);
 return {canvas,box:[left,top,Math.min(w,x1+5)-left,Math.min(h,y1+5)-top]};
}

// The original signature is white ink on pure black. Recover its coverage,
// then unmatte to white RGB so partial-alpha edges carry no black fringe.
export function keyBlackSignature(source){
 const canvas=document.createElement('canvas');canvas.width=source.naturalWidth;canvas.height=source.naturalHeight;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),d=pixels.data;
 for(let i=0;i<d.length;i+=4){const coverage=Math.max(d[i],d[i+1],d[i+2])/255;d[i+3]=Math.round(d[i+3]*coverage);d[i]=d[i+1]=d[i+2]=255;}
 ctx.putImageData(pixels,0,0);return canvas;
}
