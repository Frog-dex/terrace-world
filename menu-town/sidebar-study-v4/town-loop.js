// Prepared by: Codex. The generated town is a keyed video plate, not a new 3D model.
// Source scene and live sign remain independently editable.
export async function createTownLoop(THREE, onChange = () => {}) {
  const video = document.createElement('video');
  video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'auto';
  const base = new URL('.', import.meta.url);
  const sourceUrl=new URL('town-loop-green-v11.mp4', base).href;
  // The local static preview does not serve byte ranges. Blob-backed playback
  // provides reliable seeking and gapless loop restarts on that same server.
  const response=await fetch(sourceUrl);
  if(!response.ok)throw new Error(`Town video returned HTTP ${response.status}.`);
  // Explicit in-memory bytes also avoid the preview browser's large streamed
  // Response.blob() failure (the same asset plays correctly from this buffer).
  const objectUrl=URL.createObjectURL(new Blob([await response.arrayBuffer()],{type:'video/mp4'}));video.src=objectUrl;
  let error = '', disposed = false, playing = false, greenPreview = false,hasFrame=false;
  const poster = await new THREE.TextureLoader().loadAsync(new URL('town-school-poster-v11.png', base).href);
  // Key in encoded RGB and write the original plate values without a second
  // exposure or transfer curve. Video and PNG must have identical brightness.
  poster.colorSpace = THREE.NoColorSpace;
  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.NoColorSpace;
  const uniforms = {plate: {value:poster}, showGreen: {value:0}};
  const material = new THREE.ShaderMaterial({
    uniforms, transparent:true, depthTest:false, depthWrite:false, toneMapped:false,
    vertexShader:'varying vec2 uvPlate; void main(){uvPlate=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`
      uniform sampler2D plate;
      uniform float showGreen;
      varying vec2 uvPlate;
      float skyKey(vec3 c){return smoothstep(.06,.34,c.g-max(c.r,c.b))*smoothstep(.23,.58,c.g);}
      void main(){
        vec4 color=texture2D(plate,uvPlate);
        // Key only strongly saturated green. The ochre vegetation is retained.
        float excess=color.g-max(color.r,color.b);
        float key=skyKey(color.rgb);
        // A tiny edge choke catches chroma-compression fringe at the roofline,
        // but requires adjacent keyed sky so interior grass/windows stay solid.
        vec2 pixel=vec2(1./1800.,1./1200.);
        float adjacent=max(skyKey(texture2D(plate,uvPlate+vec2(0.,pixel.y)).rgb),skyKey(texture2D(plate,uvPlate-vec2(0.,pixel.y)).rgb));
        adjacent=max(adjacent,max(skyKey(texture2D(plate,uvPlate+vec2(pixel.x,0.)).rgb),skyKey(texture2D(plate,uvPlate-vec2(pixel.x,0.)).rgb)));
        key=max(key,adjacent*smoothstep(.02,.13,excess));
        float alpha=mix(1.-key,1.,showGreen);
        if(alpha<.003)discard;
        // Despill the fractional roof edge without tinting solid architecture.
        float edge=max(1.-alpha,smoothstep(.015,.12,excess)*step(.42,uvPlate.y))*(1.-showGreen);
        color.g=mix(color.g,min(color.g,max(color.r,color.b)),edge);
        gl_FragColor=vec4(color.rgb,alpha);
      }`
  });
  const geometry=new THREE.PlaneGeometry(2,2);
  const quad=new THREE.Mesh(geometry,material);quad.frustumCulled=false;
  const scene=new THREE.Scene();scene.add(quad);
  const camera=new THREE.Camera();
  const changed=()=>{if(!disposed)onChange();};
  video.addEventListener('loadeddata',()=>{hasFrame=true;uniforms.plate.value=texture;changed();});
  video.addEventListener('error',()=>{error='Town video could not load. Original 3D town is still available.';playing=false;changed();});
  video.load();
  return {
    render(renderer){
      // loadeddata can precede the poster decode, and seeks may be paused.
      // Select/upload the current decoded video frame on every visible render.
      if(video.readyState>=2){hasFrame=true;uniforms.plate.value=texture;texture.needsUpdate=true;}
      renderer.render(scene,camera);
    },
    setGreen(value){greenPreview=!!value;uniforms.showGreen.value=greenPreview?1:0;},
    setPlaying(value){
      const next=!!value&&!disposed&&!error;
      if(next===playing)return;
      playing=next;
      if(next)video.play().then(()=>{error='';changed();}).catch(e=>{error=e.message;playing=false;changed();});
      else video.pause();
    },
    async seek(time){
      if(video.readyState<2)return;
      const target=Math.max(0,Math.min(time,video.duration-.04));
      if(Math.abs(video.currentTime-target)<.002)return;
      await new Promise(resolve=>{video.addEventListener('seeked',resolve,{once:true});video.currentTime=target;});changed();
    },
    getState(){return {ready:hasFrame||video.readyState>=2,readyState:video.readyState,seeking:video.seeking,buffered:Array.from({length:video.buffered.length},(_,i)=>[video.buffered.start(i),video.buffered.end(i)]),seekable:Array.from({length:video.seekable.length},(_,i)=>[video.seekable.start(i),video.seekable.end(i)]),error,playing:!video.paused,time:video.currentTime,duration:Number.isFinite(video.duration)?video.duration:null,greenPreview,source:sourceUrl};},
    dispose(){disposed=true;video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(objectUrl);poster.dispose();texture.dispose();material.dispose();geometry.dispose();}
  };
}
