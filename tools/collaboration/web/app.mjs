import { totalDuration, stepFrame } from './timeline.mjs';
const $ = (id) => document.getElementById(id);
let state = null, review = null, track = null, trackIndex = 0, frame = 0, playing = false, last = 0, elapsed = 0, selectedKey = '', images = new Map(), pending = [], sendingKey = null, baseline = 380;
function el(tag, text, cls) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }
async function api(path, body, headers = {}) {
  const opts = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Collab-Request': '1', ...headers }, body: JSON.stringify(body) };
  const res = await fetch(path, opts), data = await res.json();
  if (!res.ok) throw Error(data.error || `HTTP ${res.status}`);
  return data;
}
function choices(id, values, selected) { const s = $(id); s.replaceChildren(...[...new Set(values)].map(v => { const o = el('option', v); o.value = v; return o; })); if (values.includes(selected)) s.value = selected; }
function previewInfo(a) {
  const type = a.media_type || '';
  if (['image/png','image/jpeg','image/webp','image/gif'].includes(type)) return 'image preview';
  if (['video/mp4','video/webm'].includes(type)) return 'browser video preview';
  return 'download; inline preview unavailable';
}
function attachment(a) {
  const line = el('div'); const link = el('a', `${a.name} · ${(a.bytes / 1024).toFixed(1)} KiB · ${previewInfo(a)}`, 'attachment');
  link.href = '/artifacts/' + a.sha256; link.download = a.name; line.append(link);
  const d = el('details'); d.append(el('summary', 'Integrity & storage'), el('code', `SHA-256 ${a.sha256} · local-machine · retained until archived`)); line.append(d);
  if(['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm'].includes(a.media_type)){
    const preview=el('details');preview.append(el('summary','Preview original attachment'));
    const media=el(a.media_type.startsWith('video/')?'video':'img');media.src='/artifacts/'+a.sha256;media.className='attachment-preview';
    if(media.tagName==='VIDEO'){media.controls=true;media.preload='metadata';}else{media.alt=a.name;media.loading='lazy';}
    media.onerror=()=>preview.append(el('p','This browser could not decode the preview. Download preserves the original.','hint'));preview.append(media);line.append(preview);
  }
  return line;
}
function renderMailbox() {
  const f = $('filter').value.toLowerCase(); const entries = state.messages.filter(m => !f || m.thread_id.toLowerCase().includes(f));
  $('messages').replaceChildren(...entries.slice().reverse().map(m => {
    const node = el('article', undefined, 'message'), meta = el('div', undefined, 'meta');
    meta.append(el('strong', `${m.actor === 'human' ? 'Human via ' : ''}${m.sender_session || m.sender} → ${m.recipient_session || m.recipient}`), el('span', m.kind || m.type), el('span', m.delivery.state, 'state ' + m.delivery.state));
    node.append(meta, el('p', m.body, 'body'), el('small', `${m.thread_id} · ${new Date(m.created_at).toLocaleString()}`));
    for (const a of m.attachments || []) node.append(attachment(a));
    if (m.delivery.error) node.append(el('p', m.delivery.error, 'error'));
    const d = el('details'); d.append(el('summary', `Delivery evidence · ${m.delivery.attempts || 0} attempt(s)`), el('code', `${m.message_id} · AMP ack: ${m.amp_ack || 'none'} · receipt session: ${m.delivery.session || 'none'}`)); node.append(d);
    return node;
  }));
  if (!entries.length) $('messages').append(el('p', 'No messages for this task yet.', 'empty'));
}
function renderParticipants() {
  $('participants').replaceChildren(...state.participants.map(p => {
    const node = el('div', undefined, 'person'); node.append(el('strong', p.label), el('small', p.mode === 'desktop' ? 'User turn required · no push adapter' : p.mode === 'worker' ? (p.enabled ? 'Automatic CLI worker configured' : 'CLI worker disabled') : 'Adapter unverified'));
    node.append(el('small', p.id)); if (p.conversation_url) { const a = el('a', 'Open owning conversation ↗'); a.href = p.conversation_url; a.target = '_blank'; a.rel = 'noreferrer'; node.append(a); }
    const health=el('small'); for(const cap of ['read','write','artifact','automatic_wake']){const test=state.capabilities?.find(t=>t.session===p.id&&t.capability===cap); const b=el('span',`${cap.replace('_',' ')}: ${test?.state||'unverified'}`, 'capability '+(test?.state||''));if(test)b.title=test.evidence;health.append(b);}node.append(health);
    return node;
  }));
  const old = $('recipient').value; $('recipient').replaceChildren(...state.participants.filter(p => p.id !== 'codex-desktop').map(p => { const o = el('option', p.label); o.value = p.id; o.disabled=p.mode==='unverified'; return o; })); if ([...$('recipient').options].some(o => o.value === old)) $('recipient').value = old;
  $('boundary').textContent = state.desktop_boundary;
  $('ownership').textContent = state.ownership.map(l => `${l.area}: ${l.owner} (${l.task})`).join(' · ') || 'No file areas claimed yet.';
}
function renderTasks(){
  const oldDomain=$('task-domain-filter').value;choices('task-domain-filter',['All domains',...state.tasks.map(t=>t.domain)].sort((a,b)=>a==='All domains'?-1:a.localeCompare(b)),oldDomain);
  const domain=$('task-domain-filter').value,status=$('task-status-filter').value;
  const opened=new Set([...$('tasks').querySelectorAll('details[open]')].map(d=>d.dataset.task));
  const tasks=state.tasks.filter(t=>(domain==='All domains'||t.domain===domain)&&(status==='all'||t.status===status));
  $('tasks').replaceChildren(...tasks.map(t=>{
    const card=el('details',undefined,'task-card');card.dataset.task=t.id;card.open=opened.has(t.id);
    const summary=el('summary');summary.append(el('span',t.title,'task-title'),el('span',t.domain,'badge'),el('span',t.status,'badge'),el('span',`${t.owner} · v${t.version}`,'task-owner'));card.append(summary);
    card.append(el('p',t.summary||t.id));
    for(const item of t.items||[]){const line=el('p',undefined,'task-item');line.append(el('strong',item.classification.replaceAll('_',' ')+': '),el('span',item.text));card.append(line);}
    const unresolved=(t.open_questions||[]).filter(q=>!(t.resolved_questions||[]).includes(q));
    if(unresolved.length)card.append(el('p','Open questions: '+unresolved.join(' · '),'task-open'));
    if(t.dependencies?.length)card.append(el('p','Dependencies: '+t.dependencies.join(', ')));
    for(const a of t.artifacts||[])if(a.sha256)card.append(attachment(a));
    const provenance=el('details');provenance.append(el('summary','Provenance & update history'));
    for(const p of t.provenance||[]){const line=el('p',p.summary||p.message_id||p.type);if(p.url&&/^(https?:|codex:)/.test(p.url)){const a=el('a',' Open source ↗');a.href=p.url;a.target='_blank';a.rel='noreferrer';line.append(a);}if(p.message_id)line.append(el('code',' '+p.message_id));provenance.append(line);}
    for(const event of state.task_events.filter(e=>e.task_id===t.id))provenance.append(el('p',`${new Date(event.created*1000).toLocaleString()} · ${event.author} · ${event.summary||event.status||'requirements updated'} · ${event.event_key}`));
    card.append(provenance); const edit=el('button','Update task');edit.type='button';edit.onclick=()=>{for(const [id,value]of Object.entries({'task-id':t.id,'task-title':t.title,'task-domain':t.domain,'task-owner':t.owner,'task-status':t.status}))$(id).value=value;$('task-form').parentElement.open=true;$('task-form').scrollIntoView({block:'center'});};card.append(edit);return card;
  }));
  if(!tasks.length)$('tasks').append(el('p','No tasks match this view.','empty'));
}
function chooseReview() {
  review = state.reviews.find(r => r.id === $('review').value) || null;
  if (!review) { track = null; draw(); return; }
  $('provenance').textContent = `${review.task} · revision ${review.revision} · ${review.provenance || 'Provenance not supplied'} · ${review.approval || 'Approval not recorded'}`;
  choices('character', review.tracks.map(t => t.character)); chooseCharacter();
}
function chooseCharacter() { choices('action', review.tracks.filter(t => t.character === $('character').value).map(t => t.action)); chooseAction(); }
function chooseAction() { choices('direction', review.tracks.filter(t => t.character === $('character').value && t.action === $('action').value).map(t => t.direction)); chooseTrack(); }
function chooseTrack() {
  trackIndex = review.tracks.findIndex(t => t.character === $('character').value && t.action === $('action').value && t.direction === $('direction').value);
  track = review.tracks[trackIndex]; frame = 0; elapsed = 0; playing = false; $('play').textContent = 'Play';
  $('scrub').max = String((track?.frames.length || 1) - 1);
  renderFeedback(); draw();
}
function loadImage(hash) {
  if (!images.has(hash)) { const img = new Image(); const entry = { image: img, ready: false, error: false }; images.set(hash, entry); img.onload = () => { entry.ready = true; draw(); }; img.onerror = () => { entry.error = true; $('stage-note').textContent = 'Frame preview failed; original remains downloadable.'; }; img.src = '/artifacts/' + hash; }
  return images.get(hash);
}
function paintFrame(ctx, f, center, height, opacity=1) {
  const entry = loadImage(f.sha256); if (!entry.ready) return;
  const image = entry.image, c = f.crop || [0,0,image.naturalWidth,image.naturalHeight], width = c[2] / c[3] * height;
  ctx.save(); ctx.globalAlpha = opacity;
  if (track.mirrored) { ctx.translate(center * 2,0); ctx.scale(-1,1); }
  ctx.drawImage(image,...c,center - width / 2,baseline-height,width,height); ctx.restore();
}
function draw() {
  const c = $('stage'), ctx = c.getContext('2d'), bg = $('background').value;
  // Logical canvas pixels equal CSS pixels: selecting 64 px really displays 64 px.
  c.width = Math.max(1, Math.round(c.clientWidth)); c.height = Math.max(1, Math.round(c.clientHeight));
  const W=c.width,H=c.height; baseline=H-24;
  ctx.fillStyle = bg === 'dark' ? '#333936' : bg === 'terrain' ? '#d8dec5' : '#f2f0e8'; ctx.fillRect(0,0,W,H);
  if (bg === 'terrain') { ctx.strokeStyle = '#a5b291'; ctx.lineWidth = 1; for (let x=0;x<W;x+=40) { ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke(); } for (let y=0;y<H;y+=40) {ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();} }
  ctx.strokeStyle = bg === 'dark' ? '#a9c7ac' : '#688670';ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(0,baseline);ctx.lineTo(W,baseline);ctx.stroke();ctx.setLineDash([]);
  if (!track) return;
  const h = Math.min(Number($('scale').value),H-36), comp = $('compare').value;
  ctx.strokeStyle = '#bac0b6';ctx.setLineDash([3,6]); for (const x of comp === 'previous' || comp === 'first' ? [W*.27,W*.73] : [W*.5]) {ctx.beginPath();ctx.moveTo(x,20);ctx.lineTo(x,H-8);ctx.stroke();}ctx.setLineDash([]);
  if (comp === 'previous' || comp === 'first') { paintFrame(ctx,track.frames[comp==='first'?0:stepFrame(frame,-1,track.frames.length)],W*.27,h);paintFrame(ctx,track.frames[frame],W*.73,h); }
  else {if(comp==='onion')paintFrame(ctx,track.frames[stepFrame(frame,-1,track.frames.length)],W*.5,h,.25);paintFrame(ctx,track.frames[frame],W*.5,h);}
  $('frame-label').textContent = `${frame+1} / ${track.frames.length}`; $('scrub').value = String(frame);
  $('timing').textContent = `${track.frames[frame].duration_ms ?? 100} ms this frame · ${totalDuration(track.frames)} ms loop · ${h} CSS px canvas height · ${track.mirrored ? 'mirrored, explicitly marked safe' : 'original facing'}`;
  $('stage-note').textContent = comp === 'previous' ? 'Previous frame ← → Current frame' : comp === 'first' ? 'First frame ← → Current frame' : `${track.character} · ${track.action} · ${track.direction}`;
}
function renderFeedback() { if (!review) return; $('feedback-list').replaceChildren(...state.feedback.filter(f => f.review_id === review.id).map(f => el('p', `${f.decision.toUpperCase()} · track ${f.track+1}, frame ${f.frame+1} · ${f.revision}: ${f.note || '(no note)'} · ${f.notification?.delivered ? 'notification queued in AMP' : 'notification pending'}${f.notification?.error ? ': '+f.notification.error : ''}`, 'feedback-entry'))); }
async function refresh() {
  try { state = await api('/api/state'); $('connection').textContent = 'Connected · local'; renderParticipants(); renderMailbox();renderTasks();
    const old = $('review').value; $('review').replaceChildren(...state.reviews.map(r => {const o=el('option',`${r.title || r.task} · ${r.revision}`);o.value=r.id;return o;})); if(state.reviews.some(r=>r.id===old))$('review').value=old;
    if (selectedKey !== $('review').value) { selectedKey = $('review').value; chooseReview(); } else renderFeedback();
  } catch(e) { $('connection').textContent = 'Disconnected'; $('connection').title=e.message; }
}
$('filter').addEventListener('input',()=>state&&renderMailbox());
for(const id of ['task-domain-filter','task-status-filter'])$(id).addEventListener('change',()=>state&&renderTasks());
$('task-form').onsubmit=async(e)=>{e.preventDefault();try{const event={task_id:$('task-id').value,title:$('task-title').value,domain:$('task-domain').value,owner:$('task-owner').value,status:$('task-status').value,event_key:crypto.randomUUID()};if($('task-update').value)event.items=[{classification:$('task-class').value,text:$('task-update').value}];if($('task-dependencies').value)event.dependencies=$('task-dependencies').value.split(',').map(s=>s.trim()).filter(Boolean);if($('task-question').value)event.open_questions=[$('task-question').value];if($('task-source').value)event.provenance=[{type:'manual',summary:$('task-source').value,...(/^https?:|^codex:/.test($('task-source').value)?{url:$('task-source').value}:{message_id:$('task-source').value})}];await api('/api/tasks',event);$('task-status-message').textContent='Task update saved; earlier requirements and history preserved.';$('task-update').value='';await refresh();}catch(err){$('task-status-message').textContent=err.message;}};
$('review').addEventListener('change',()=>{selectedKey=$('review').value;chooseReview();});
$('character').addEventListener('change',chooseCharacter);$('action').addEventListener('change',chooseAction);$('direction').addEventListener('change',chooseTrack);
for(const id of ['scale','background','compare'])$(id).addEventListener('change',draw);
function step(n) { if(!track)return;playing=false;$('play').textContent='Play';frame=stepFrame(frame,n,track.frames.length);elapsed=0;draw(); }
$('previous').onclick=()=>step(-1);$('next').onclick=()=>step(1);$('scrub').oninput=()=>{playing=false;$('play').textContent='Play';frame=Number($('scrub').value);elapsed=0;draw();};
$('play').onclick=()=>{if(!track)return;playing=!playing;$('play').textContent=playing?'Pause':'Play';last=performance.now();};
function animate(t) {if(playing&&track){elapsed+=Math.min(t-last,250);while(elapsed>=(track.frames[frame].duration_ms??100)){elapsed-=track.frames[frame].duration_ms??100;frame=stepFrame(frame,1,track.frames.length);}draw();}last=t;requestAnimationFrame(animate);}requestAnimationFrame(animate);
async function upload(file) {const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');const res=await fetch('/api/artifacts',{method:'POST',headers:{'X-Collab-Request':'1','X-Filename':encodeURIComponent(file.name),'X-SHA256':hash},body:file});const data=await res.json();if(!res.ok)throw Error(data.error);return data;}
$('files').onchange=async()=>{try{$('uploads').textContent='Verifying and uploading…';for(const file of $('files').files)pending.push(await upload(file));$('uploads').textContent=pending.map(a=>a.name).join(', ');}catch(e){$('uploads').textContent=e.message;}};
$('compose').onsubmit=async(e)=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{sendingKey ||= crypto.randomUUID();await api('/api/messages',{recipient_session:$('recipient').value,kind:$('kind').value,task:$('task').value,body:$('body').value,attachments:pending,idempotency_key:sendingKey});pending=[];sendingKey=null;$('body').value='';$('files').value='';$('uploads').textContent='';$('send-status').textContent='Queued in AMP. Acknowledgement appears when the exact recipient responds.';await refresh();}catch(err){$('send-status').textContent=err.message;}finally{button.disabled=false;}};
$('feedback').onsubmit=async(e)=>{e.preventDefault();try{if(!review)throw Error('Load a review first');await api('/api/feedback',{review_id:review.id,track:trackIndex,frame,decision:$('decision').value,note:$('note').value,idempotency_key:crypto.randomUUID()});$('note').value='';$('feedback-status').textContent=`Saved against ${review.revision}, frame ${frame+1}.`;await refresh();}catch(err){$('feedback-status').textContent=err.message;}};
$('manifest').onchange=async()=>{try{await api('/api/reviews',JSON.parse(await $('manifest').files[0].text()));$('manifest-status').textContent='Review loaded; originals preserved.';await refresh();}catch(e){$('manifest-status').textContent=e.message;}};
await refresh();setInterval(refresh,2500);
window.addEventListener('resize',draw);
