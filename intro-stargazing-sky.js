/* Prepared by: Codex. One deterministic ground-level sky shared across the
 * rooftop and birthday handoff. No planet textures or camera travel in space.
 */
export function createStargazingSky(THREE,{up='z'}={}){
  if(!['y','z'].includes(up))throw new TypeError('Sky up axis must be y or z.');
  const uniforms={night:{value:0},flattening:{value:0},rotation:{value:0},yUp:{value:up==='y'?1:0},inverseProjection:{value:new THREE.Matrix4()},cameraWorld:{value:new THREE.Matrix4()}};
  const material=new THREE.ShaderMaterial({uniforms,depthWrite:false,depthTest:false,toneMapped:false,
    vertexShader:'varying vec2 skyUv;void main(){skyUv=uv;gl_Position=vec4(position.xy,.999,1.);}',
    fragmentShader:`varying vec2 skyUv;uniform float night;uniform float flattening;uniform float rotation;uniform float yUp;uniform mat4 inverseProjection;uniform mat4 cameraWorld;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float starLayer(vec2 uv,float scale){
        vec2 grid=uv*vec2(scale,scale*.5),cell=floor(grid),local=fract(grid);
        float choice=hash(cell+31.7);vec2 center=vec2(hash(cell+3.1),hash(cell+7.9))*.64+.18;
        vec2 pixel=max(fwidth(grid),vec2(.001));float radius=mix(.65,1.3,pow(hash(cell+9.4),8.));
        float d=length((local-center)/pixel);
        return step(.989,choice)*(1.-smoothstep(radius*.25,radius,d))*(.23+.65*pow(hash(cell+19.2),3.));
      }
      void main(){
        vec4 ray=inverseProjection*vec4(skyUv*2.-1.,.5,1.);
        vec3 raw=normalize((cameraWorld*vec4(ray.xyz/ray.w,0.)).xyz);
        // Both conventions map to east, north, up. Y-up camera faces -Z.
        vec3 direction=mix(raw,vec3(raw.x,-raw.z,raw.y),yUp);
        float altitude=mix(max(direction.z,0.),skyUv.y,flattening);
        float ca=cos(rotation),sa=sin(rotation);
        direction.xy=mat2(ca,-sa,sa,ca)*direction.xy;
        vec3 day=mix(vec3(.51,.65,.73),vec3(.105,.32,.56),smoothstep(0.,.8,altitude));
        vec3 dusk=mix(vec3(.43,.24,.15),vec3(.045,.085,.17),smoothstep(0.,.7,altitude));
        vec3 dark=mix(vec3(.010,.014,.018),vec3(.0008,.0014,.0025),smoothstep(0.,.55,altitude));
        vec3 colour=mix(mix(day,dusk,smoothstep(0.,.5,night)),dark,smoothstep(.45,1.,night));
        vec2 skyCoord=vec2(.5+atan(direction.y,direction.x)/6.2831853,.5+asin(clamp(direction.z,-1.,1.))/3.14159265);
        float stars=starLayer(skyCoord,800.)+starLayer(skyCoord+vec2(.17,.23),430.)*.65;
        float visibility=smoothstep(.55,1.,night)*smoothstep(-.025,.14,altitude)*(1.-flattening);
        colour+=vec3(.88,.94,1.)*stars*visibility;
        gl_FragColor=vec4(colour,1.);
        #include <colorspace_fragment>
        gl_FragColor.rgb+=(hash(gl_FragCoord.xy)-.5)/255.;
      }`});
  const geometry=new THREE.PlaneGeometry(2,2),group=new THREE.Group();
  const sky=new THREE.Mesh(geometry,material);sky.frustumCulled=false;sky.renderOrder=-10;group.add(sky);
  return{group,update(camera,{night=1,flattening=0,rotation=0}={}){
    uniforms.night.value=Math.min(1,Math.max(0,night));uniforms.flattening.value=flattening;
    uniforms.rotation.value=rotation;
    uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);uniforms.cameraWorld.value.copy(camera.matrixWorld);
  },dispose(){geometry.dispose();material.dispose();group.clear();}};
}
