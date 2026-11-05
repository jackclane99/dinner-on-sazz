import {createHash,timingSafeEqual,randomUUID} from 'node:crypto';
import {leaderboard} from '../public/shared.mjs';

export class AppError extends Error { constructor(message,status=400){super(message);this.status=status;} }
const fail=(m,s)=>{throw new AppError(m,s);};
export const hash = value=>createHash('sha256').update(String(value)).digest('hex');
export function equalSecret(a,b){return timingSafeEqual(Buffer.from(hash(a)),Buffer.from(hash(b)));}
export const uuid = s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export function tokenValid(t){return typeof t==='string'&&/^[0-9a-f]{64}$/.test(t);}
function text(s,label,max){if(typeof s!=='string')fail(`Enter ${label}.`);const t=s.trim().replace(/\s+/g,' ');if(!t||t.length>max||/[\u0000-\u001f\u007f]/u.test(t))fail(`Enter ${label} using 1–${max} characters.`);return t;}
const normal=s=>s.normalize('NFKC').toLocaleLowerCase('en-US').replace(/[’']/g,'').replace(/\s+/g,' ').trim();
export function authenticate(session,token){
 if(!tokenValid(token))return {role:'guest'};
 const digest=hash(token);
 if(equalSecret(session.hostHash,digest))return {role:'host'};
 const member=session.participants.find(p=>equalSecret(p.hash,digest));
 return member?{role:'participant',id:member.id}:{role:'guest'};
}
export function createSession(id,token,now=Date.now()){
 if(!uuid(id)||!tokenValid(token))fail('Invalid session credentials.');
 return {_id:id,version:0,title:'Dinner on Sazz',hostHash:hash(token),phase:'nominate',participants:[],restaurants:[],createdAt:new Date(now).toISOString(),expiresAt:new Date(now+7*86400000),revealAt:null};
}
export function assertActive(s,now=Date.now()){
 if(!s||new Date(s.expiresAt).getTime()<=now)fail('This dinner session was not found or has expired.',404);
}
export function visibleSession(s,actor){
 const base={id:s._id,version:s.version,title:s.title,phase:s.phase,participantCount:s.participants.length,revealAt:s.revealAt};
 if(actor.role==='guest')return {...base,role:'guest'};
 const me=actor.role==='participant'?s.participants.find(p=>p.id===actor.id):null;
 const visible={...base,role:actor.role,restaurants:s.restaurants.map(({id,name})=>({id,name})),participants:s.participants.map(p=>({id:p.id,name:p.name,restaurantId:p.restaurantId,submitted:!!p.ratings})),me:me?{id:me.id,name:me.name,restaurantId:me.restaurantId,ratings:me.ratings}:null};
 if(s.phase==='results')visible.results=leaderboard(s);
 return visible;
}
export function mutateSession(original,action,payload,token,now=Date.now()){
 assertActive(original,now);const s=structuredClone(original),actor=authenticate(s,token);
 const host=()=>{if(actor.role!=='host')fail('Only the host can do that.',403);};
 const phase=p=>{if(s.phase!==p)fail('The host has moved this session to the next stage. Refresh to continue.',409);};
 if(action==='nominate'){
  phase('nominate');if(!tokenValid(token)||!uuid(payload.memberId))fail('Invalid participant credentials.');
  if(actor.role==='host')fail('Use the participant link to submit your own nomination.',403);
  const name=text(payload.name,'your name',32),restaurant=text(payload.restaurant,'a restaurant name',90);
  let member=s.participants.find(p=>p.id===payload.memberId);
  if(member&&!equalSecret(member.hash,hash(token)))fail('This participant belongs to another browser.',403);
  if(actor.role==='participant'&&actor.id!==payload.memberId)fail('You can only change your own nomination.',403);
  if(!member){
   if(s.participants.length>=30)fail('This session is full (30 people maximum).');
   if(s.participants.some(p=>normal(p.name)===normal(name)))fail('That name is already in use. Add your last initial.');
   member={id:payload.memberId,hash:hash(token),name,restaurantId:null,ratings:null};s.participants.push(member);
  }else if(s.participants.some(p=>p.id!==member.id&&normal(p.name)===normal(name)))fail('That name is already in use. Add your last initial.');
  let r=s.restaurants.find(r=>normal(r.name)===normal(restaurant));
  if(!r){r={id:randomUUID(),name:restaurant};s.restaurants.push(r);}
  member.name=name;member.restaurantId=r.id;
  s.restaurants=s.restaurants.filter(r=>s.participants.some(p=>p.restaurantId===r.id));
 }else if(action==='merge'){
  host();phase('nominate');const {source,target}=payload;
  if(source===target||!s.restaurants.some(r=>r.id===source)||!s.restaurants.some(r=>r.id===target))fail('Choose two different restaurants to merge.');
  s.participants.forEach(p=>{if(p.restaurantId===source)p.restaurantId=target;});s.restaurants=s.restaurants.filter(r=>r.id!==source);
 }else if(action==='open-voting'){
  host();if(s.phase==='vote')return s;phase('nominate');
  if(s.participants.length<2||s.restaurants.length<2)fail('Add at least two people and two different restaurants before voting.');
  s.phase='vote';
 }else if(action==='vote'){
  phase('vote');if(actor.role!=='participant')fail('Join as a participant before voting.',403);
  const ratings=payload.ratings;
  if(!ratings||Array.isArray(ratings)||typeof ratings!=='object'||Object.keys(ratings).length!==s.restaurants.length||s.restaurants.some(r=>!Number.isInteger(ratings[r.id])||ratings[r.id]<1||ratings[r.id]>5))fail('Rate every restaurant from 1 to 5 before submitting.');
  s.participants.find(p=>p.id===actor.id).ratings=Object.fromEntries(s.restaurants.map(r=>[r.id,ratings[r.id]]));
 }else if(action==='reveal'){
  host();if(s.phase==='results')return s;phase('vote');
  const complete=s.participants.filter(p=>p.ratings).length;
  if(!complete)fail('At least one complete ballot is needed to reveal results.');
  if(complete<s.participants.length&&payload.confirmEarly!==true)fail('Some people have not submitted. Confirm an early close to exclude unfinished ballots.',409);
  s.phase='results';s.revealAt=new Date(now+4500).toISOString();
 }else fail('Unknown action.');
 return s;
}
