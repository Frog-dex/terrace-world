/* Camera yaw is independent of object yaw and does not touch the city save. */
(function(root){
function axes(iso,yaw=0,coefficient=.8){const a=(iso?Math.PI/4:0)+yaw,c=Math.cos(a),s=Math.sin(a),horizontal=iso?coefficient*Math.SQRT2:1,vertical=iso?coefficient/Math.SQRT2:1,right=[c*horizontal,-s*horizontal],down=[s*vertical,c*vertical],front=[s,c];return{right,down,front,delta:(x,y)=>[right[0]*x+right[1]*y,down[0]*x+down[1]*y],inverse:(x,y)=>[(x/horizontal)*c+(y/vertical)*s,-(x/horizontal)*s+(y/vertical)*c],depth:(x,y,z=0)=>((x*s+y*c)*(iso?Math.SQRT2:1)+z*(iso?coefficient:.04)),visible:n=>n[2]>.1||n[0]*s+n[1]*c>-.0001};}
function wrap(a){return Math.atan2(Math.sin(a),Math.cos(a));}
const api={axes,wrap};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TogaCamera=api;
})(typeof window==='undefined'?this:window);
