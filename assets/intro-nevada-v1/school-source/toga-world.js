/* TOGA-REG-001: source-photo coordinates, 1024 x 768. No invented geographic scale.
   Footprints are a visual trace, NOT surveyed geometry. Yellow is never a road.
   h is an art height; driving uses 3 simulation units per source pixel. */
(function(root){
  const geometry=typeof module!=='undefined'&&module.exports?require('./toga-geometry.js'):root.TogaGeometry;
  const road=(id,points,width=9,kind='road')=>({id,points,width,kind});
  const roads=[
    road('north-street',[[148,224],[239,221],[387,221],[504,222],[581,225]],12),
    road('main-street',[[290,373],[350,357],[401,357],[510,355],[623,350],[688,346],[846,344],[899,341]],13),
    road('central-spine',[[499,135],[505,190],[512,245],[511,355],[512,428],[514,510],[500,557],[476,625]],11),
    road('school-road',[[392,155],[389,218],[393,301],[390,355],[392,415],[380,468]],8),
    road('west-street',[[239,221],[239,246],[264,262],[221,306],[173,358],[142,388],[137,566]],8),
    road('airport-access',[[173,358],[236,357],[290,373],[306,410],[304,493],[276,528]],8),
    road('airport-link',[[236,357],[264,262]],7,'track'),
    road('west-farm',[[304,493],[347,490],[381,486]],7,'track'),
    road('west-field',[[350,357],[349,307],[344,269],[389,265]],7,'track'),
    road('town-row1',[[392,257],[457,255],[511,257],[575,254]],7),
    road('town-row2',[[392,300],[453,295],[513,296],[566,293],[618,287]],7),
    road('town-link',[[457,255],[455,295],[458,321]],6),
    road('town-east',[[576,188],[568,225],[571,283],[568,350],[566,426],[550,474],[528,550],[522,587],[568,625]],8),
    road('east-farm-road',[[621,201],[619,280],[622,349],[615,405],[600,424],[591,449],[625,454],[652,444],[677,413]],8),
    road('home-road',[[578,225],[620,225],[668,223],[676,273],[674,349],[675,404],[675,448],[648,487],[624,528],[572,566]],10),
    road('home-drive',[[668,223],[655,169],[670,148],[699,158],[736,158],[770,153]],7),
    road('home-east',[[674,349],[731,349],[735,316],[733,263],[724,215],[724,176],[768,185],[781,204],[782,259],[774,280],[778,339]],7),
    road('east-connection',[[846,344],[846,286],[848,235],[832,211],[816,197]],7),
    road('home-lane',[[848,235],[819,242],[811,290],[814,332],[846,344]],6),
    road('south-row',[[392,439],[449,437],[512,434],[566,426],[600,424]],8),
    road('farm-east',[[675,448],[721,460],[774,484],[799,462],[828,434],[845,381],[846,344]],8,'track'),
    road('farm-south',[[675,448],[687,495],[703,541],[669,554],[693,609],[620,622],[568,625],[522,587]],7,'track'),
    road('farm-diagonal',[[591,449],[559,489],[558,529],[594,571],[624,528],[648,487]],7,'track'),
    road('south-east-link',[[703,541],[750,519],[774,484]],7,'track'),
    road('school-drive',[[306,410],[358,410],[392,415]],7,'track'),
    road('air-apron',[[173,358],[200,314],[232,280],[264,262]],14,'apron'),
    road('runway-diagonal',[[44,494],[223,251]],11,'runway'),
    road('runway',[[84,582],[117,172]],17,'runway'),
    road('runway-join',[[110,420],[97,424]],10,'apron')
  ];
  const parcels=[
    [[305,228],[361,228],[358,314],[301,317]],[[282,325],[343,323],[351,355],[283,359]],
    [[319,378],[352,373],[357,405],[350,466],[322,462]],[[355,420],[385,418],[382,468],[355,468]],
    [[349,487],[385,480],[387,527],[352,527]],[[389,448],[450,442],[475,463],[475,494],[451,521],[466,542],[475,581],[388,587]],
    [[394,588],[470,590],[464,621],[408,608]],[[415,371],[470,366],[472,408],[418,415]],
    [[452,418],[501,414],[507,430],[451,432]],[[473,445],[507,440],[507,483],[478,482]],
    [[516,363],[562,361],[560,421],[517,425]],[[520,465],[548,464],[531,506],[519,539]],
    [[535,553],[554,544],[587,578],[563,610],[532,587]],[[574,582],[596,572],[615,619],[576,621]],
    [[600,571],[643,552],[672,576],[687,610],[624,619]],[[628,535],[653,490],[681,508],[698,540],[659,552]],
    [[687,460],[718,472],[746,491],[735,515],[708,534],[693,498]],[[718,445],[741,437],[781,467],[771,482]],
    [[696,390],[720,392],[720,430],[696,435]],[[735,391],[773,395],[774,430],[743,436]],
    [[785,394],[813,392],[811,432],[793,452],[781,446]],[[578,365],[605,362],[606,405],[578,418]],
    [[576,456],[610,460],[630,473],[615,504],[587,526],[565,516],[565,486]],
    [[422,148],[451,150],[479,173],[426,173]],[[508,163],[546,139],[557,130],[559,174],[538,207],[515,201]],
    [[567,132],[620,145],[633,176],[616,192],[589,178],[582,157]],[[592,203],[613,211],[612,274],[592,270]],
    [[594,292],[618,299],[618,337],[596,342]],[[625,233],[657,243],[658,303],[644,314],[626,316]],
    [[706,171],[718,169],[717,213],[704,241]],[[744,274],[771,280],[770,306],[744,313]]
  ].map((points,i)=>({id:`field-${String(i+1).padStart(2,'0')}`,points,crop:i%5}));
  // Each short tuple is read against the original photo, not a procedural settlement grid.
  const footprints=[
    [187,193,47,15],[263,195,27,10],[329,191,14,16],[352,195,15,13],[376,194,13,15],
    [425,196,11,14],[443,192,13,12],[465,197,12,13],[485,198,9,11],
    [401,241,13,13],[422,244,10,11],[438,240,13,12],[455,239,15,14],[478,239,13,13],[494,239,10,13],
    [405,272,12,16],[424,267,13,13],[443,277,11,11],[459,259,12,13],[461,278,14,15],[482,274,12,17],
    [405,310,12,13],[426,300,11,11],[445,300,11,12],[460,299,12,13],[486,302,10,14],
    [405,332,10,13],[432,330,14,13],[451,331,22,11],[378,298,11,22],
    [521,239,10,21],[540,247,14,13],[544,267,12,12],[520,270,12,13],[559,268,9,12],
    [520,300,12,12],[538,299,14,10],[557,291,10,14],[522,318,10,11],[540,317,11,15],
    [520,339,12,11],[537,340,12,9],[554,338,9,12],[573,330,13,13],[576,290,12,10],
    [660,153,14,14],[661,184,10,12],[668,207,10,12],[669,246,10,16],[669,276,10,20],
    [670,315,10,16],[688,315,10,18],[708,327,10,11],[729,318,18,17],[755,328,10,11],
    [690,363,10,13],[713,367,9,14],[764,363,10,15],[796,358,11,20],[829,360,9,17],
    [817,316,10,14],[830,279,12,17],[859,240,23,23],[854,316,12,16],[875,309,15,25],[898,327,20,16],
    [371,378,13,20],[312,375,8,12],[488,375,18,15],[309,486,13,12],
    [473,467,14,26],[490,466,10,12],[486,510,18,13],[306,514,8,14],
    [551,448,11,16],[628,416,12,17],[653,414,15,23],[662,438,8,17],[704,451,9,13],
    [574,474,15,23],[788,491,17,13],[708,493,12,12],
    [176,246,26,17],[151,288,19,28],[179,311,16,29]
  ];
  const buildings=footprints.map((a,i)=>({id:`building-${String(i+1).padStart(3,'0')}`,x:a[0],y:a[1],w:a[2],d:a[3],h:i>75?7:5+(i%3)*1.8,type:i>75?'barn':i<5?'commercial':'house',name:'',confidence:'visual trace'}));
  buildings.push({id:'home',name:'HOME',x:733,y:183,w:39,d:18,h:8,type:'house',confidence:'building assignment interpreted near Home label'},
    {id:'factory',name:'FACTORY / 3 STACKS',x:273,y:500,w:25,d:44,h:8,type:'factory',confidence:'factory confirmed by user'},
    {id:'hangar',name:'AIRFIELD HANGAR',x:218,y:274,w:22,d:22,h:12,type:'hangar',confidence:'angled source footprint approximated; function inferred'});
  const towers=[{id:'home-water',name:'HOME / WATER',x:816,y:197,r:8,h:45},{id:'school-water',name:'SCHOOL / WATER',x:287,y:378,r:6,h:34}];
  function nearestRoad(x,y){let best={distance:Infinity};for(const r of roads.filter(r=>r.kind!=='runway'))for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],dx=b[0]-a[0],dy=b[1]-a[1],f=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy))),q=[a[0]+dx*f,a[1]+dy*f],d=Math.hypot(x-q[0],y-q[1]);if(d<best.distance)best={point:q,distance:d,roadId:r.id};}return best;}
  function connect(){return buildings.flatMap(o=>{const x=o.x+o.w/2,y=o.y+o.d/2,n=nearestRoad(x,y);if(!n.point)return [];const q=geometry.point(o,n.point,true),dx=q[0]-x,dy=q[1]-y,k=Math.min(dx?o.w/2/Math.abs(dx):Infinity,dy?o.d/2/Math.abs(dy):Infinity);return [{id:'access-'+o.id,buildingId:o.id,roadId:n.roadId,points:[geometry.point(o,[x+dx*Math.min(1,k),y+dy*Math.min(1,k)]),n.point],width:5,kind:'driveway',inferred:true}];});}
  const world={W:1024,H:768,roads,buildings,parcels,towers,connect,nearestRoad,locations:{home:[776,224],town:[465,291],airport:[202,330],school:[318,450],farm:[617,499],overview:[511,380]},spawn:{x:778*3,y:339*3,heading:Math.PI},source:{image:'references/toga-original.jpeg',width:1024,height:768,url:'https://toga-region-001-reference.bluinman.chatgpt.site/',revision:'TOGA-REG-001 / 02',accuracy:'Visual trace; unconfirmed outlines and road interpretations remain reviewable.'}};
  world.geometry=geometry;
  world.aircraft={id:'blackbird',x:207,y:345,heading:-Math.PI/4,scale:.35};
  world.playerScale=.43;
  // Keep authored footprints and saved heights intact. This profile supplies coherent
  // shorter wall/roof proportions for small unnamed homes in both projections.
  world.buildingProfile=b=>{const small=b.type==='house'&&!b.name&&b.w*b.d<=260&&Math.max(b.w,b.d)<=24;let hash=0;for(const c of b.id)hash=(hash*31+c.charCodeAt(0))>>>0;const eave=small?Math.min(b.h,2.15+Math.min(b.w,b.d)*.13+(hash%5)*.13):b.h,roof=small?Math.max(.9,Math.min(1.8,Math.min(b.w,b.d)*.14)):4;return{small,eave,roof};};
  world.buildingZ=(b,z)=>{const p=world.buildingProfile(b);if(!p.small)return z;return z<=b.h?z*p.eave/b.h:p.eave+(z-b.h)*p.roof/4;};
  world.terrainTools=typeof module!=='undefined'&&module.exports?require('./toga-terrain.js'):root.TogaTerrain;
  world.terrain=world.terrainTools.create();
  // Second sketch pass: the two long airport service roofs follow the diagonal strip.
  Object.assign(buildings.find(b=>b.id==='building-084'),{angle:.65});
  Object.assign(buildings.find(b=>b.id==='building-085'),{angle:.65});
  Object.assign(buildings.find(b=>b.id==='hangar'),{angle:.65});
  world.spawn.y=345*3; // Centre the vehicle on paving, clear of the northern house row.
  world.driveWorld=()=>{const A=typeof module!=='undefined'&&module.exports?require('./toga-assets.js'):root.TogaAssets,C=typeof module!=='undefined'&&module.exports?require('./toga-civilian.js'):root.TogaCivilian,props=(world.props||[]).filter(p=>A?.spec(p.type)?.solid).map(p=>A.bounds(p)),solids=buildings.flatMap(b=>C?.role(b)?C.collision(b,geometry,world.buildingProfile(b)):[b]);return{vehicleScale:world.playerScale,bounds:{left:65*3,right:958*3,top:125*3,bottom:645*3},spawn:world.spawn,rectangles:[...solids,...props].map(o=>({x:o.x*3,y:o.y*3,w:o.w*3,h:o.d*3,angle:o.angle||0})),circles:towers.map(o=>({x:o.x*3,y:o.y*3,r:o.r*3}))};};
  if(typeof module!=='undefined'&&module.exports)module.exports=world;else root.TogaWorld=world;
})(typeof window!=='undefined'?window:this);
