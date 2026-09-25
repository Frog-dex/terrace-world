// ToGA Calendar — canon per "The ToGA Calendar" artifact (2026-07-08, supersedes the
// seam layout in SPIRIT-STRIKERS-COSMOLOGY.md where they differ) + months.json factions.
//
// Base units: 1 day = 1 finger · 1 week = a HAND = 5 days · 1 month = 5 hands = 25 days.
// SOLAR year 365 = body (14 x 25 = 350) + tail 15:
//   Starting Week 5  +  Ending Days 5  +  Lunar Days 4  +  Sunday (the day out of time) 1
// LUNAR year 354 = same 350 body + Lunar Days 4 only. Earth = Moon + 11.
// LEAP year 366 = Sunday doubles (tail 16) — "a second Sunday the calendar already expects".
//   Four-year cycle: 11 + 11 + 11 + 12 = 45.
// THE FORTY-NINE: 49 = 7x7 deck on top. 16+8+25 · 48+1 · 25+15+9 · 4+5+6+7+8+9+10.
//
// PLACEMENT INTERPRETATION (flagged for Blu): "Starting Week" opens the year (the dawn =
// the Spirit seam, one open hand), the Ending Days + Lunar Days + Sunday close it
// (the dusk = the Soul seam, two hands joined, 5+4+1 = 10). Leap Sunday -> Soul 11.
// EPOCH still an open ruling — assumed: year-day 1 = March 21.

export const MONTHS = [
  { idx: 1, name:'Spirit',     kind:'seam', sign:'', faction:'spirit', days:5,
    lore:'the Starting Week · one open hand · the turning of the year' },
  { idx: 2, name:'Aries',      kind:'sign', sign:'Aries',       faction:'fire',     days:25 },
  { idx: 3, name:'Taurus',     kind:'sign', sign:'Taurus',      faction:'wood',     days:25 },
  { idx: 4, name:'Gemini',     kind:'sign', sign:'Gemini',      faction:'electric', days:25 },
  { idx: 5, name:'Cancer',     kind:'sign', sign:'Cancer',      faction:'water',    days:25 },
  { idx: 6, name:'Leo',        kind:'sign', sign:'Leo',         faction:'fire',     days:25 },
  { idx: 7, name:'Virgo',      kind:'sign', sign:'Virgo',       faction:'wood',     days:25 },
  { idx: 8, name:'Libra',      kind:'sign', sign:'Libra',       faction:'earth',    days:25 },
  { idx: 9, name:'Scorpio',    kind:'sign', sign:'Scorpio',     faction:'water',    days:25 },
  { idx:10, name:'Ophiuchus',  kind:'sign', sign:'Ophiuchus',   faction:'spirit',   days:25 },
  { idx:11, name:'Sagittarius',kind:'sign', sign:'Sagittarius', faction:'metal',    days:25 },
  { idx:12, name:'Capricorn',  kind:'sign', sign:'Capricorn',   faction:'earth',    days:25 },
  { idx:13, name:'Aquarius',   kind:'sign', sign:'Aquarius',    faction:'electric', days:25 },
  { idx:14, name:'Pisces',     kind:'sign', sign:'Pisces',      faction:'spirit',   days:25 },
  { idx:15, name:'Cetus',      kind:'sign', sign:'Cetus',       faction:'metal',    days:25 },
  { idx:16, name:'Soul',       kind:'seam', sign:'', faction:'soul', days:10,
    lore:'the year’s close · two hands joined · 11 in a leap year',
    sub:[ {n:5, label:'Ending Days', hex:0xdfe7ff},
          {n:4, label:'Lunar Days',  hex:0xaeb6c6},
          {n:1, label:'Sunday — the day out of time', hex:0xd6a24e} ] },
];

export const YEAR = {
  total: MONTHS.reduce((a,m)=>a+m.days,0),   // 365
  body: 350,                                  // 14 x 25 — shared by both skies
  lunarTotal: 354,                            // body + the 4 Lunar Days · Earth = Moon + 11
  leapCycle: [11,11,11,12],                   // -> 45, the breathing gap
  deck: 49,                                   // 7 x 7, laid on top
  epoch: { gMonth:3, gDay:21 },               // ASSUMED (open ruling)
};

// Gregorian date -> ToGA year-day (1..365). Extra Gregorian day folds into the Sunday.
export function dayOfYearFromGregorian(dt){
  const y = dt.getFullYear();
  let anchor = new Date(y, YEAR.epoch.gMonth-1, YEAR.epoch.gDay);
  if (dt < anchor) anchor = new Date(y-1, YEAR.epoch.gMonth-1, YEAR.epoch.gDay);
  const days = Math.floor((dt - anchor) / 86400000);
  return Math.min(YEAR.total, days + 1);
}

export function monthOfYearDay(yd){
  let d = yd;
  for (const m of MONTHS){
    if (d <= m.days) return { month:m, dayInMonth:d };
    d -= m.days;
  }
  const last = MONTHS[MONTHS.length-1];
  return { month:last, dayInMonth:last.days };
}

export function bodyPartOfDay(d, month){
  if (month && month.kind === 'seam'){
    if (month.name === 'Spirit') return `Starting Week · finger ${d} of the open hand`;
    if (d <= 5) return `Ending Day ${d} · left hand`;
    if (d <= 9) return `Lunar Day ${d-5} · right hand`;
    return `Sunday — the day out of time`;
  }
  if (d<=5)  return `Head · day ${d}`;
  if (d<=10) return `Right Hand · finger ${d-5}`;
  if (d<=15) return `Left Hand · finger ${d-10}`;
  if (d<=20) return `Right Foot · toe ${d-15}`;
  return `Left Foot · toe ${d-20}`;
}
