/* Original low-poly Blackbird-inspired study; not an exact or licensed SR-71 asset.
   Visual reference: https://www.nasa.gov/gallery/sr-71-blackbird/ */
(function(root){const faces=[],add=(points,color=[61,68,66])=>faces.push({points,color});
const hull=[[28,0,2],[15,-1.7,2],[3,-3.8,2],[-18,-3,2],[-21,0,2],[-18,3,2],[3,3.8,2],[15,1.7,2]];
for(let i=0;i<hull.length;i++)add([hull[i],hull[(i+1)%hull.length],[1,0,5.4]],i%2?[70,76,72]:[53,61,61]);
for(const side of [-1,1]){
 add([[11,side*2,2.2],[-13,side*13,2.2],[-20,side*11,2.2],[-18,side*2,2.2]],[63,71,70]);
 add([[11,side*2,2.2],[-18,side*2,2.2],[4,side*4,3.3]],[83,89,84]);
 const rings=[[-19,1.8],[-11,2.1],[7,1.8],[10,1.4]];
 for(let k=1;k<rings.length;k++)for(let i=0;i<10;i++){const a=i*Math.PI/5,b=(i+1)*Math.PI/5,[x0,r0]=rings[k-1],[x1,r1]=rings[k];add([[x0,side*8.2+Math.cos(a)*r0,3.2+Math.sin(a)*r0],[x1,side*8.2+Math.cos(a)*r1,3.2+Math.sin(a)*r1],[x1,side*8.2+Math.cos(b)*r1,3.2+Math.sin(b)*r1],[x0,side*8.2+Math.cos(b)*r0,3.2+Math.sin(b)*r0]],[63+i*2,68+i*2,66+i*2]);}
 for(let i=0;i<10;i++){const a=i*Math.PI/5,b=(i+1)*Math.PI/5;add([[10,side*8.2+Math.cos(a)*1.4,3.2+Math.sin(a)*1.4],[15,side*8.2,3.2],[10,side*8.2+Math.cos(b)*1.4,3.2+Math.sin(b)*1.4]],[38,44,43]);}
 add([[-10,side*8,4],[-16,side*10.8,10],[-20,side*10.5,8],[-18,side*8,4]],[47,56,55]);
 add([[-10,side*8,4],[-18,side*8,4],[-20,side*11,8],[-16,side*11.3,10]],[79,87,81]);
}
add([[18,-.9,3.6],[18,.9,3.6],[13,1.3,5.8],[13,-1.3,5.8]],[71,101,103]);
add([[12,-1.3,5.8],[12,1.3,5.8],[8,1.4,5.6],[8,-1.4,5.6]],[61,86,89]);
const model={name:'Blackbird-inspired prototype',scale:.35,faces,reference:'https://www.nasa.gov/gallery/sr-71-blackbird/'};if(typeof module!=='undefined'&&module.exports)module.exports=model;else root.TogaBlackbird=model;
})(typeof window!=='undefined'?window:this);
