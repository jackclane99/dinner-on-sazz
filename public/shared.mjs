export const LABELS = ['Would rather go somewhere else','Not my first choice','Happy to go','Really want to go','My top pick'];
export const googleURL = name => `https://www.google.com/search?q=${encodeURIComponent(name+' Chicago restaurant')}`;

export function leaderboard(session) {
 const ballots=session.participants.filter(p=>p.ratings && session.restaurants.every(r=>Number.isInteger(p.ratings[r.id])&&p.ratings[r.id]>=1&&p.ratings[r.id]<=5));
 const rows=session.restaurants.map(r=>{
  const ratings=ballots.map(p=>({name:p.name,score:p.ratings[r.id]}));
  const total=ratings.reduce((s,r)=>s+r.score,0),fives=ratings.filter(r=>r.score===5).length;
  return {...r,total,average:ballots.length?total/ballots.length:0,fives,voters:ballots.length,ratings};
 }).sort((a,b)=>b.total-a.total||b.fives-a.fives||a.name.localeCompare(b.name));
 let last=null,rank=0;
 return rows.map((r,i)=>{if(!last||r.total!==last.total||r.fives!==last.fives)rank=i+1;last=r;return {...r,rank};});
}
