/* Geometry shared by the flat editor, lighting and driving collision system. */
(function(root){
const rotate=(p,c,a)=>{const x=p[0]-c[0],y=p[1]-c[1],co=Math.cos(a),si=Math.sin(a);return[c[0]+x*co-y*si,c[1]+x*si+y*co,...p.slice(2)];};
const point=(b,p,inverse=false)=>rotate(p,[b.x+b.w/2,b.y+b.d/2],(b.angle||0)*(inverse?-1:1));
const corners=b=>[[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.d],[b.x,b.y+b.d]].map(p=>point(b,p));
const contains=(b,p,pad=0)=>{const q=point(b,p,true);return q[0]>=b.x-pad&&q[0]<=b.x+b.w+pad&&q[1]>=b.y-pad&&q[1]<=b.y+b.d+pad;};
const projectSegment=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],f=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1))),q=[a[0]+dx*f,a[1]+dy*f];return {point:q,distance:Math.hypot(p[0]-q[0],p[1]-q[1]),f};};
function nearest(roads,p,exclude=null){let best={distance:Infinity};for(const r of roads)for(let i=1;i<r.points.length;i++){if(exclude?.r===r&&(i===exclude.i||i-1===exclude.i))continue;const q=projectSegment(p,r.points[i-1],r.points[i]);if(q.distance<best.distance)best={...q,r,i};}return best;}
function insert(hit){if(hit.f<.001)return hit.i-1;if(hit.f>.999)return hit.i;hit.r.points.splice(hit.i,0,[...hit.point]);return hit.i;}
function junctions(roads){const out=[],segments=[];for(const r of roads.filter(r=>r.kind==='road'||r.kind==='apron'||r.kind==='runway'))for(let i=1;i<r.points.length;i++)segments.push({r,i,a:r.points[i-1],b:r.points[i]});
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){const a=segments[i],b=segments[j];if(a.r===b.r)continue;const ux=a.b[0]-a.a[0],uy=a.b[1]-a.a[1],vx=b.b[0]-b.a[0],vy=b.b[1]-b.a[1],det=ux*vy-uy*vx;if(Math.abs(det)<1e-6)continue;const dx=b.a[0]-a.a[0],dy=b.a[1]-a.a[1],t=(dx*vy-dy*vx)/det,u=(dx*uy-dy*ux)/det;if(t<-.001||t>1.001||u<-.001||u>1.001)continue;const p=[a.a[0]+t*ux,a.a[1]+t*uy],radius=Math.max(a.r.width,b.r.width)*.7;if(!out.some(q=>Math.hypot(q.x-p[0],q.y-p[1])<1))out.push({x:p[0],y:p[1],r:radius});}return out;}
function resize(b,corner,p){const opposite=corners(b)[(corner+2)%4],a=b.angle||0,co=Math.cos(a),si=Math.sin(a),dx=p[0]-opposite[0],dy=p[1]-opposite[1],sx=corner===0||corner===3?-1:1,sy=corner<2?-1:1,w=Math.max(3,sx*(dx*co+dy*si)),d=Math.max(3,sy*(-dx*si+dy*co)),cx=opposite[0]+(sx*w*co-sy*d*si)/2,cy=opposite[1]+(sx*w*si+sy*d*co)/2;return {...b,x:cx-w/2,y:cy-d/2,w,d};}
const api={rotate,point,corners,contains,projectSegment,nearest,insert,junctions,resize};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TogaGeometry=api;
})(typeof window!=='undefined'?window:this);
