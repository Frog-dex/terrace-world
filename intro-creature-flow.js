// Prepared by: Codex. Original drawings carried by the approved portal.
// Match the footage's clockwise acceleration; let each foreground drawing read.
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
const ENERGY=[[2.2,18],[3,28],[4,50],[5,82],[6,124],[7,156],[8.8,172]];
function energyPhase(t){
 let degrees=0;
 for(let i=0;i<ENERGY.length-1;i++){
  const [a,va]=ENERGY[i],[b,vb]=ENERGY[i+1],dt=Math.max(0,Math.min(t,b)-a);
  degrees+=va*dt+(vb-va)*dt*dt/(2*(b-a));
 }
 return degrees*Math.PI/180;
}
// Card index, entry, lifetime, azimuth, radius, scale, bank.
// Frame study: a readable foreground lead, smaller supporting depths, then
// recession and body roll. Stagger different edges, not a single-file path.
export const CREATURE_CUES=[
 [0,2.30,2.28,-2.55,.49,2.05,-.12],
 [7,2.73,2.10,-.42,.82,.82,.10],
 [2,3.28,2.14,1.54,.72,1.02,-.08],
 [17,4.00,2.28,2.45,.49,2.12,.14],
 [20,4.42,2.08,-1.28,.86,.69,-.12],
 [3,4.98,2.10,.56,.76,.96,.12],
 [24,5.69,2.28,-2.33,.49,2.10,-.10],
 [23,6.17,2.08,-.18,.81,.80,.08],
 [28,6.76,1.96,1.29,.75,1.04,-.08]
];
export const VISIBLE_CAST=CREATURE_CUES.map(c=>c[0]);
export function creaturePose(index,t,width,height){
 const cue=CREATURE_CUES.find(c=>c[0]===index);
 if(!cue)return null;
 const [,enter,life,phase,radius,scale,bank]=cue,p=(t-enter)/life;
 if(p<0||p>=1)return null;
 // About 0.65 seconds at readable scale, while still moving. The inward
 // acceleration and body roll follow that beat, not a static freeze.
 const pull=Math.pow(ease((p-.22)/.78),1.12);
 const angle=phase+energyPhase(t)-energyPhase(enter);
 const r=radius*(1-.98*pull),far=(Math.sin(angle)+1)/2;
 const unit=Math.min(540*Math.max(width/1920,height/1080),width*.47,height*.50);
 const perspective=(1-.92*pull)*(1-.08*far);
 return {id:index,p,x:width/2+Math.cos(angle)*r*unit,
  y:height/2+Math.sin(angle)*r*unit*.82,
  size:Math.min(unit*.62,Math.min(width,height)*.29)*scale*perspective,
  // Counter-bank into the turn, then roll away as depth increases. Body
  // rotation is independent of the footage's clockwise orbital current.
  rotation:bank+Math.sin(angle-.4)*.20-2.65*ease((p-.30)/.62),
  squash:.92+.08*(1-far),depth:2/scale+pull*4+far*.15,
  alpha:ease(p/.085)*(1-ease((p-.65)/.33))};
}
