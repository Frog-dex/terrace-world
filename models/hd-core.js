// Human Design core math — Tier A (Sun/Earth), zero-dependency, client-side.
// Reverse-engineered spec verified against MicFell/human_design_engine (GPL — reimplemented,
// not copied), SharpAstrology.HumanDesign (MIT), jdempcy/hdkit (MIT), and published
// degree tables. Anchor: Gate 41 begins at exactly 2°00' Aquarius = 302.0° ecliptic.
// Design chart = 88.0 DEGREES of solar arc before birth (not 88 days).
// Sun: Meeus AA ch.25 low-accuracy series, ±0.01° (≈1% of a line) — gate+line exact.

export const WHEEL = [41,19,13,49,30,55,37,63,22,36,25,17,21,51,42,3,27,24,2,23,8,
  20,16,35,45,12,15,52,39,53,62,56,31,33,7,4,29,59,40,64,47,6,
  46,18,48,57,32,50,28,44,1,43,14,34,9,5,26,11,10,58,38,54,61,60];

// ecliptic longitude (deg 0..360) -> {gate, line, color, tone}
export function activation(lon){
  const x = ((lon + 58) % 360 + 360) % 360;    // rotate: WHEEL[0]=41 starts at 302° => +58
  const gate = WHEEL[Math.floor(x / 5.625)];
  const r = x % 5.625;
  const line = Math.floor(r / 0.9375) + 1;
  const color = Math.floor((r % 0.9375) / 0.15625) + 1;
  const tone = Math.floor((r % 0.15625) / (0.9375/36)) + 1;
  return { gate, line, color, tone, lon: ((lon%360)+360)%360 };
}

// Julian day from a JS Date (uses its UTC time)
export function julianDay(dt){
  let y = dt.getUTCFullYear(), m = dt.getUTCMonth()+1;
  const d = dt.getUTCDate() + (dt.getUTCHours() + dt.getUTCMinutes()/60 + dt.getUTCSeconds()/3600)/24;
  if (m <= 2){ y -= 1; m += 12; }
  const a = Math.floor(y/100), b = 2 - a + Math.floor(a/4);
  return Math.floor(365.25*(y+4716)) + Math.floor(30.6001*(m+1)) + d + b - 1524.5;
}

const D2R = Math.PI/180;
// apparent solar ecliptic longitude (deg), Meeus ch.25 low-accuracy, ±0.01°
export function sunLongitude(jd){
  const T = (jd - 2451545.0) / 36525;
  const L0 = 280.46646 + 36000.76983*T + 0.0003032*T*T;
  const M  = 357.52911 + 35999.05029*T - 0.0001537*T*T;
  const C  = (1.914602 - 0.004817*T - 0.000014*T*T)*Math.sin(M*D2R)
           + (0.019993 - 0.000101*T)*Math.sin(2*M*D2R)
           + 0.000289*Math.sin(3*M*D2R);
  const om = 125.04 - 1934.136*T;
  const lam = L0 + C - 0.00569 - 0.00478*Math.sin(om*D2R);
  return ((lam % 360) + 360) % 360;
}

// Simplified chart: personality Sun/Earth + design Sun/Earth (design Sun = Sun - 88° exactly)
export function chart(dt){
  const jd = julianDay(dt);
  const sun = sunLongitude(jd);
  const pSun   = activation(sun);
  const pEarth = activation(sun + 180);
  const dSun   = activation(sun - 88);
  const dEarth = activation(sun - 88 + 180);
  const profile = `${pSun.line}/${dSun.line}`;
  // valid profiles sanity set (any other output = math bug)
  const VALID = ['1/3','1/4','2/4','2/5','3/5','3/6','4/6','4/1','5/1','5/2','6/2','6/3'];
  return { sunLon: sun, pSun, pEarth, dSun, dEarth, profile,
           profileValid: VALID.includes(profile),
           cross: [pSun.gate, pEarth.gate, dSun.gate, dEarth.gate] };
}
