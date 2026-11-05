import {LABELS,googleURL} from './shared.mjs';

const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search);
let sessionId=params.get('s')||'',isHost=params.get('view')==='host',state=null,pollTimer,revealTimer,fetching=false,busy=false,local=false;
let draft={name:'',restaurant:''},ratings={},ratingsLoaded=false,editNomination=false,editVotes=false,lastVersion=-1,error='',lastSeen=0;
const cacheKey=(role,id=sessionId)=>`sazz:${role}:${id}`;
function readLocal(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
function writeLocal(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{throw Error('Enable browser storage so you can resume your session safely.');}}
const credentials=()=>readLocal(cacheKey(isHost?'host':'member'));
function secret(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');}
function link(host=false){const u=new URL('/',location.origin);u.searchParams.set('s',sessionId);if(host)u.searchParams.set('view','host');return u.href;}
function toast(message){$('#toast').textContent=message;setTimeout(()=>{$('#toast').textContent='';},4500);}
const lookup=name=>`<a class="lookup" href="${esc(googleURL(name))}" target="_blank" rel="noopener noreferrer">Look it up ↗</a>`;
const button=(text,action,style='coral')=>`<button class="btn ${style}" data-action="${action}" ${busy?'disabled':''}>${text}</button>`;
const banner=()=>local?'<div class="rehearsal-banner">LOCAL REHEARSAL · Shared by browsers on this local server only. Temporary test storage; not connected to MongoDB.</div>':'';
function artwork(){return `<div class="dinner-art" aria-hidden="true"><svg viewBox="0 0 400 380" xmlns="http://www.w3.org/2000/svg"><ellipse cx="203" cy="300" rx="130" ry="24" fill="#d5ccbc"/><circle cx="200" cy="200" r="129" fill="#fffdfa" stroke="#dfd7ca" stroke-width="3"/><circle cx="200" cy="200" r="103" fill="none" stroke="#e9e2d7" stroke-width="2"/><circle cx="200" cy="200" r="87" fill="#f5eee3"/><path d="M51 95v72m12-72v72m12-72v72m-24-22h24m-12 22v138" fill="none" stroke="#687462" stroke-width="6" stroke-linecap="round"/><path d="M348 95v211m0-211c-20 25-22 80 0 80" fill="none" stroke="#687462" stroke-width="7" stroke-linecap="round"/><rect x="147" y="148" width="106" height="106" rx="14" fill="#d1573b" transform="rotate(15 200 200)"/><path d="M172 190l18 19 39-38" stroke="#fff9ec" fill="none" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="298" cy="49" r="26" fill="none" stroke="#8c9a7d" stroke-width="3"/><path d="M298 75v34m-17 0h34" stroke="#8c9a7d" stroke-width="3"/><path d="M285 51q13 9 26 0" stroke="#d1573b" stroke-width="4" fill="none"/><path d="M118 49l6-13m-28 25l-13-4m49 11l14 3" stroke="#d1573b" stroke-width="3" stroke-linecap="round"/></svg><span class="art-tag">Your taste. Our shortlist. Sazz’s treat.</span></div>`;}
function landing(){
 const last=readLocal('sazz:lastHost');
 return `<section class="hero"><div><div class="eyebrow">THE CHICAGO DINNER DECISION</div><h1>Good company.<br>Great dinner.<br><em>On Sazz.</em></h1><p class="intro">One restaurant nomination each. A few honest ratings. One delicious group decision.</p><div class="hero-actions">${button('Host a dinner →','show-host')}${button('Join a dinner','show-join','light')}</div>${last?`<p class="quiet"><a href="/?s=${esc(last)}&view=host">Resume your last host session →</a></p>`:''}<p class="quiet">No participant accounts. Just an invitation link and an appetite.</p></div>${artwork()}</section><section class="steps"><div class="step"><h3><span class="step-num">01</span>Put a place on the table</h3><p>Everyone nominates one Chicago restaurant.</p></div><div class="step"><h3><span class="step-num">02</span>Rate your appetite</h3><p>Give every spot a score from 1 to 5. Votes stay hidden.</p></div><div class="step"><h3><span class="step-num">03</span>Make it a reveal</h3><p>The host unveils the group’s top picks, together.</p></div></section>`;
}
function hostForm(){return `<section class="narrow card"><div class="eyebrow">YOU’RE SETTING THE TABLE</div><h2>Host a dinner.</h2><p>Create a fresh session, then send the participant link to your group.</p><form id="host-form"><label class="field">Host password<input name="password" type="password" autocomplete="current-password" required minlength="16" placeholder="Your private host password"><small>Set by you during app setup. Participants don’t need it.</small></label>${local?'<div class="notice">Local test password: <strong>rehearsal-host-only</strong></div>':''}<div class="form-actions"><button class="btn coral full" type="submit">Create dinner session →</button></div></form><div class="inline-actions">${button('Back','home','light small')}</div></section>`;}
function joinForm(){return `<section class="narrow card"><div class="eyebrow">PULL UP A CHAIR</div><h2>Have an invitation?</h2><p>Paste the full link from your host.</p><form id="join-link-form"><label class="field">Invitation link<input type="url" name="link" placeholder="https://…/?s=…" required></label><div class="form-actions"><button class="btn coral full">Join dinner →</button></div></form><div class="inline-actions">${button('Back','home','light small')}</div></section>`;}
function progress(){return `<nav class="progress" aria-label="Session stage">${[['nominate','Nominate'],['vote','Vote'],['results','Reveal']].map(([key,title],i)=>`${i?'<span class="rule"></span>':''}<span class="stage ${state.phase===key?'active':(['nominate','vote','results'].indexOf(state.phase)>i?'complete':'')}"><b>${i+1}</b>${title}</span>`).join('')}</nav>`;}
function people(){return state.participants?.map(p=>`<div class="person"><span class="avatar">${esc(p.name.slice(0,1).toUpperCase())}</span><div class="person-name"><strong>${esc(p.name)}</strong><small>${esc(state.restaurants.find(r=>r.id===p.restaurantId)?.name||'')}</small></div><span class="status ${p.submitted?'done':''}">${state.phase==='nominate'?'Nominated':p.submitted?'✓ Submitted':'Not submitted'}</span></div>`).join('')||'<div class="empty">The table is open. Share the invitation to get started.</div>';}
function hostPage(){
 if(state.role!=='host')return `<section class="narrow card"><h2>This is the host view.</h2><p>Open it in the browser where you created this dinner session. The participant link does not grant host access.</p><div class="inline-actions"><a class="btn light" href="${esc(link())}">Go to participant view</a></div></section>`;
 if(state.phase==='results')return resultsPage(true);
 const done=state.participants.filter(p=>p.submitted).length;
 return `${progress()}<div class="page-head"><div><div class="eyebrow">HOST’S TABLE</div><h1>${state.phase==='nominate'?'Where could we go?':'Let good taste decide.'}</h1><p>${state.phase==='nominate'?'Gather the nominations, then give everyone a say.':'Scores stay hidden until you reveal the results—even from you.'}</p></div><a class="btn light small" href="${esc(link())}" target="_blank" rel="noopener">Join as a participant ↗</a></div><div class="layout"><section class="card"><div class="card-heading"><h2>${state.phase==='nominate'?'The dinner shortlist':'Who’s at the table?'}</h2><span class="count">${state.phase==='nominate'?`${state.restaurants.length} restaurants`:`${done} of ${state.participants.length} voted`}</span></div>${state.phase==='nominate'?state.restaurants.map(r=>`<div class="restaurant"><div><h3>${esc(r.name)}</h3><p>Nominated by ${state.participants.filter(p=>p.restaurantId===r.id).map(p=>esc(p.name)).join(', ')}</p></div>${lookup(r.name)}</div>`).join('')||'<div class="empty">The first nomination is always the hardest.<br>Share the link and let the ideas arrive.</div>':people()}${state.phase==='nominate'&&state.restaurants.length>1?mergeSection():''}</section><aside class="stack"><section class="card"><div class="eyebrow">INVITE THE GROUP</div><h2>One link. Everyone in.</h2><p>Send this participant link in the meeting chat. Keep your host view open.</p><div class="join-link"><input id="participant-link" readonly value="${esc(link())}" aria-label="Participant invitation link"><button class="btn light small" data-action="copy-link">Copy link</button></div><div class="host-actions">${state.phase==='nominate'?`${button('Start voting →','open-voting')}<p class="quiet">Requires at least two people and two restaurants. Nominations lock when voting starts.</p>`:`<div class="big-count">${done}<small> / ${state.participants.length}</small></div><p>Complete ballots received</p><div class="form-actions">${button('Where are we going on Sazz?','reveal')}</div><p class="quiet">Revealing closes voting. Only complete ballots count.</p>`}</div></section>${state.phase==='nominate'?`<section class="card"><div class="card-heading"><h2>Your dinner party</h2><span class="count">${state.participants.length} joined</span></div>${people()}</section>`:''}</aside></div>`;
}
function mergeSection(){return `<details><summary>Two nominations for the same place? Merge them.</summary><form id="merge-form" class="merge-fields"><label class="field">Duplicate nomination<select name="source">${state.restaurants.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}</select></label><label class="field">Keep this name<select name="target">${state.restaurants.map((r,i)=>`<option value="${esc(r.id)}" ${i===1?'selected':''}>${esc(r.name)}</option>`).join('')}</select></label><button class="btn light small">Merge nominations</button></form></details>`;}
function nomination(){
 return `${progress()}<div class="page-head"><div><div class="eyebrow">ONE PERSON. ONE GREAT SUGGESTION.</div><h1>Put your pick<br><em>on the table.</em></h1><p>Where should the group eat in Chicago? Nominate one restaurant, then we’ll vote.</p></div><span class="pill">${state.participantCount} joined</span></div><div class="layout"><section class="card"><h2>${state.me?'Update your nomination':'Pull up a chair.'}</h2><form id="nomination-form"><label class="field">Your first name<input name="name" maxlength="32" required autocomplete="given-name" value="${esc(draft.name)}" placeholder="e.g. Jack"><small>If someone shares your name, add your last initial.</small></label><label class="field">Your restaurant nomination<input name="restaurant" maxlength="90" required value="${esc(draft.restaurant)}" placeholder="A Chicago restaurant you’d love to try"><small>Be specific—include the location if the name could be ambiguous.</small></label><div class="notice">You’ll rate every restaurant from 1–5. Scores stay hidden until the reveal; then everyone can see individual ratings.</div><div class="form-actions"><button class="btn coral full">${state.me?'Save nomination':'I’m in. Submit my pick →'}</button></div></form></section><aside class="card aside-note"><div class="eyebrow">HOW THIS WORKS</div><h2>A little collective taste.</h2><ol><li>Everyone brings one restaurant idea.</li><li>Your host opens voting once the shortlist is ready.</li><li>Rate each spot independently, including your own.</li><li>See where the group lands when the host reveals.</li></ol><p class="quiet">No booking or payment happens in this app. Sazz is covering dinner, not necessarily joining us.</p></aside></div>`;
}
function nomineeWaiting(){const r=state.restaurants.find(r=>r.id===state.me.restaurantId);return `${progress()}<div class="layout"><section class="card waiting"><div class="seal">✓</div><div class="eyebrow">YOUR NOMINATION IS IN</div><h2>Nice choice, ${esc(state.me.name)}.</h2><p>You put <strong>${esc(r?.name)}</strong> on the table.<br>Your host will open voting when everyone is ready.</p>${button('Edit my nomination','edit-nomination','light')}<p class="quiet">This screen advances automatically. You can leave it open.</p></section><aside class="card"><div class="card-heading"><h2>On the shortlist</h2><span class="count">${state.restaurants.length} places</span></div>${state.restaurants.map(r=>`<div class="restaurant"><h3>${esc(r.name)}</h3>${lookup(r.name)}</div>`).join('')}</aside></div>`;}
function votePage(){
 if(state.role!=='participant')return closedJoin();
 if(state.me.ratings&&!editVotes)return `${progress()}<section class="narrow card waiting"><div class="seal">✓</div><div class="eyebrow">GOOD TASTE, RECORDED</div><h2>You’re in, ${esc(state.me.name)}.</h2><p>Your ratings are saved. The host will reveal the results when everyone is ready.</p>${button('Review / edit my ratings','edit-votes','light')}<p class="quiet">Keep this page open for the big reveal.</p></section>`;
 const count=state.restaurants.filter(r=>Number.isInteger(ratings[r.id])).length;
 return `${progress()}<div class="page-head"><div><div class="eyebrow">YOUR TASTE GETS A VOTE</div><h1>How hungry are you<br><em>for each option?</em></h1><p>Hi ${esc(state.me.name)}. Rate every spot—including your own. Equal scores are welcome.</p></div><span class="pill">${count} / ${state.restaurants.length} rated</span></div><div class="layout"><form id="vote-form"><div>${state.restaurants.map((r,i)=>`<fieldset class="rating-card"><legend class="sr-only">Rate ${esc(r.name)}</legend><div class="rating-head"><div><h3>${esc(r.name)}</h3><small>${r.id===state.me.restaurantId?'Your nomination':'Restaurant '+(i+1)}</small></div>${lookup(r.name)}</div><div class="rating-options">${LABELS.map((label,j)=>`<label title="${esc(label)}"><input type="radio" name="${esc(r.id)}" value="${j+1}" data-rating="${esc(r.id)}" ${ratings[r.id]===j+1?'checked':''} required><span>${j+1}</span><small>${esc(label)}</small></label>`).join('')}</div></fieldset>`).join('')}</div><div class="vote-footer"><p>Individual ratings become visible after the reveal.</p><button class="btn coral">${state.me.ratings?'Update my ratings':'Submit my ratings →'}</button></div></form><aside class="card aside-note"><div class="eyebrow">NO NEED TO GAME IT</div><h2>Be honest. Be hungry.</h2><p>Give several places a 5 if you love them all. This is enthusiasm, not a forced ranking.</p><div class="notice">Not familiar with a restaurant? “Look it up” opens a Google search in another tab. Your ratings stay here.</div><p class="quiet">The highest average wins. A tie goes to the restaurant with more 5s; if still tied, we celebrate joint winners.</p></aside></div>`;
}
function closedJoin(){return `<section class="narrow card waiting"><div class="eyebrow">THE SHORTLIST IS SET</div><h2>${state.phase==='results'?'Dinner has been decided.':'Voting is already underway.'}</h2><p>New participants can join only during nominations. If you already joined, reopen this invitation in the same browser you used before.</p></section>`;}
function resultsPage(host=false){
 if(!state.results)return closedJoin();
 const remaining=Math.max(0,Math.ceil((new Date(state.revealAt).getTime()-Date.now())/1000));
 if(remaining>0){clearTimeout(revealTimer);revealTimer=setTimeout(render,250);return `<section class="reveal"><div class="eyebrow">THE GROUP HAS SPOKEN</div><h1>Where are we going<br><em>on Sazz?</em></h1><div class="number" aria-live="polite">${remaining}</div><p>Good taste is worth the suspense.</p></section>`;}
 const winners=state.results.filter(r=>r.rank===1),votes=state.results[0]?.voters||0;
 return `${progress()}<section class="winner"><div class="eyebrow">${winners.length>1?'A DELICIOUS TIE':'THE GROUP’S DINNER PICK'}</div><p>Where are we going on Sazz?</p><h1>${winners.map(r=>esc(r.name)).join(' &amp; ')}</h1><div class="score">${winners[0]?.average.toFixed(1)} <span class="host-title">/ 5</span></div><p>${votes} complete ${votes===1?'ballot':'ballots'} · ${winners[0]?.fives} top-pick ratings</p>${winners.map(r=>lookup(r.name)).join(' &nbsp; ')}</section><div class="page-head"><div><h2>The full dinner order.</h2><p>Equal-weight average scores. Expand a restaurant to see everyone’s ratings.</p></div>${host?button('Start a fresh dinner','new-session','light small'):''}</div>${state.results.map(r=>`<article class="ranking"><div class="rank-head"><span class="rank-num">${r.rank.toString().padStart(2,'0')}</span><div class="rank-title"><h3>${esc(r.name)}</h3><small>${r.fives} ${r.fives===1?'person':'people'} gave it a 5</small></div><div class="rank-score">${r.average.toFixed(1)} <small>/ 5</small></div></div><details><summary>See individual ratings</summary>${r.ratings.map(v=>`<div class="ballot"><span>${esc(v.name)}</span><strong>${v.score} / 5</strong></div>`).join('')}</details></article>`).join('')}<p class="result-foot">Average = total ratings ÷ complete ballots. Ties use the number of 5s, then share a rank. Unfinished ballots are excluded. This is our shortlist—confirm availability and dietary accommodations before booking.</p>`;
}
function render(){
 const active=document.activeElement,focus=active?.name?{name:active.name,start:active.selectionStart,end:active.selectionEnd}:null;
 const openDetails=[...document.querySelectorAll('details')].map(d=>d.open);
 const panel=state?(isHost?hostPage():state.phase==='nominate'?(state.me&&!editNomination?nomineeWaiting():nomination()):state.phase==='vote'?votePage():resultsPage()):landing();
 $('#main').innerHTML=banner()+(error?`<div class="error" role="alert">${esc(error)}</div>`:'')+panel;
 $('#role-tag').innerHTML=state?`<span class="pill">${isHost?'Host':state.role==='participant'?'Participant':'Guest'}</span>`:'';
 document.querySelectorAll('details').forEach((d,i)=>{if(openDetails[i])d.open=true;});
 if(focus){const el=[...document.querySelectorAll('input,select')].find(n=>n.name===focus.name);if(el){el.focus();if(typeof focus.start==='number'&&el.setSelectionRange&&el.type!=='radio')el.setSelectionRange(focus.start,focus.end);}}
}
async function api(action,payload={},cred=credentials()){
 const token=cred?.token||'';const headers={};if(token)headers.Authorization='Bearer '+token;
 const opts=action==='state'?{headers,cache:'no-store'}:{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({action,id:sessionId,payload})};
 const response=await fetch('/api/session'+(action==='state'?`?id=${encodeURIComponent(sessionId)}`:''),{...opts,signal:AbortSignal.timeout(15000)});
 let result;try{result=await response.json();}catch{throw Error('The app could not reach its server. Please retry.');}
 if(!response.ok)throw Error(result.error||'Something went wrong. Please retry.');
 return result;
}
function applyState(next){
 if(state&&state.id===next.id&&next.version<state.version)return;
 state=next;lastSeen=Date.now();$('#connection').textContent='';
 if(state.me&&!draft.name){draft.name=state.me.name;draft.restaurant=state.restaurants.find(r=>r.id===state.me.restaurantId)?.name||'';}
 if(state.me?.ratings&&!ratingsLoaded){ratings={...state.me.ratings};ratingsLoaded=true;}
 if(next.version!==lastVersion){lastVersion=next.version;render();}
}
async function poll(){
 if(!sessionId||fetching||busy)return;
 fetching=true;
 try{applyState(await api('state'));}
 catch(e){$('#connection').textContent=`${e.message} Retrying automatically…`;if(!state){$('#main').innerHTML=`<section class="narrow card"><h2>We couldn’t load this dinner.</h2><div class="error">${esc(e.message)}</div>${button('Retry connection','retry','light')}<p class="quiet">Your browser’s saved session credentials have been kept.</p></section>`;}}
 finally{fetching=false;}
}
function startPolling(){clearInterval(pollTimer);pollTimer=setInterval(poll,2000);}
async function perform(action,payload={},cred){
 if(busy)return;busy=true;error='';document.querySelectorAll('button').forEach(b=>b.disabled=true);
 try{const result=await api(action,payload,cred);busy=false;lastVersion=-1;applyState(result);return result;}
 catch(e){error=e.message;busy=false;render();throw e;}
 finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}
}
document.addEventListener('input',event=>{
 const el=event.target;
 if(el.form?.id==='nomination-form')draft[el.name]=el.value;
 if(el.dataset.rating)ratings[el.dataset.rating]=+el.value;
});
document.addEventListener('change',event=>{
 const el=event.target;
 if(el.dataset.rating){ratings[el.dataset.rating]=+el.value;const count=state.restaurants.filter(r=>Number.isInteger(ratings[r.id])).length;const pill=$('.page-head .pill');if(pill)pill.textContent=`${count} / ${state.restaurants.length} rated`;}
});
document.addEventListener('submit',async event=>{
 event.preventDefault();const form=event.target,data=Object.fromEntries(new FormData(form));
 try{
  if(form.id==='host-form'){
   let pending=readLocal('sazz:pendingHost');if(!pending){pending={id:crypto.randomUUID(),token:secret()};writeLocal('sazz:pendingHost',pending);}
   sessionId=pending.id;isHost=true;writeLocal(cacheKey('host'),{token:pending.token});
   const result=await perform('create',{password:data.password},{token:pending.token});
   if(result){writeLocal('sazz:lastHost',sessionId);localStorage.removeItem('sazz:pendingHost');history.replaceState({},'',link(true));startPolling();}
  }else if(form.id==='join-link-form'){
   const u=new URL(data.link);const id=u.searchParams.get('s');if(!id)throw Error('Paste the full invitation link containing ?s=.');location.href='/?s='+encodeURIComponent(id);
  }else if(form.id==='nomination-form'){
   let cred=readLocal(cacheKey('member'));if(!cred){cred={id:crypto.randomUUID(),token:secret()};writeLocal(cacheKey('member'),cred);}
   await perform('nominate',{memberId:cred.id,name:data.name,restaurant:data.restaurant},cred);editNomination=false;render();
  }else if(form.id==='vote-form'){
   await perform('vote',{ratings});editVotes=false;render();toast('Your ratings are saved.');
  }else if(form.id==='merge-form')await perform('merge',data);
 }catch(e){
  error=e.message;
  if(form.id==='host-form'&&!state){$('#main').innerHTML=banner()+`<div class="error" role="alert">${esc(error)}</div>`+hostForm();}
  else render();
 }
});
document.addEventListener('click',async event=>{
 const action=event.target.closest('[data-action]')?.dataset.action;if(!action)return;
 try{
  if(action==='show-host'){$('#main').innerHTML=banner()+hostForm();return;}
  if(action==='show-join'){$('#main').innerHTML=banner()+joinForm();return;}
  if(action==='home'){location.href='/';return;}
  if(action==='retry'){await poll();return;}
  if(action==='copy-link'){
   try{await navigator.clipboard.writeText(link());toast('Participant link copied.');}catch{const input=$('#participant-link');input.focus();input.select();toast('Select and copy the invitation link.');}return;
  }
  if(action==='edit-nomination'){draft={name:state.me.name,restaurant:state.restaurants.find(r=>r.id===state.me.restaurantId)?.name||''};editNomination=true;render();return;}
  if(action==='edit-votes'){editVotes=true;ratings={...state.me.ratings};render();return;}
  if(action==='open-voting'){if(confirm('Open voting? Nominations will lock for this session.'))await perform('open-voting');return;}
  if(action==='reveal'){
   const missing=state.participants.filter(p=>!p.submitted);
   if(missing.length&&!confirm(`${missing.map(p=>p.name).join(', ')} ${missing.length===1?'has':'have'} not submitted. Reveal now and exclude unfinished ballots?`))return;
   await perform('reveal',{confirmEarly:missing.length>0});return;
  }
  if(action==='new-session'){if(confirm('Start a separate dinner? This dinner and its results will remain available.'))location.href='/?host=1';}
 }catch{/* perform renders a safe error without discarding inputs. */}
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
window.addEventListener('online',poll);
try{const r=await fetch('/api/config');if(r.ok)local=(await r.json()).localRehearsal===true;}catch{/* Production has no local-test config endpoint. */}
if(sessionId){await poll();startPolling();}else if(params.has('host'))$('#main').innerHTML=banner()+hostForm();else render();
