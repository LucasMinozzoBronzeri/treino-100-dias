const STORAGE_KEY = 'treino100Pro.v1';

const DEFAULT_WORKOUTS = [
  { id:'A', name:'Peito + Bíceps', focus:'Parte superior', exercises:[
    ex('a1','Supino inclinado com halter','halter'), ex('a2','Supino deitado/reto','halter/máquina'), ex('a3','Peck fly','máquina'),
    ex('a4','Rosca direta','barra/cabo'), ex('a5','Rosca martelo','halter'), ex('a6','Rosca Scott/máquina ou cabo','máquina/cabo'),
    ex('a7','Abdominal máquina','máquina'), ex('a8','Cardio','cardio')
  ]},
  { id:'B', name:'Perna - Quadríceps', focus:'Perna', exercises:[
    ex('b1','Agachamento hack','máquina'), ex('b2','Leg press 45°','máquina'), ex('b3','Cadeira extensora','máquina'),
    ex('b4','Cadeira flexora','máquina'), ex('b5','Cadeira abdutora','máquina'), ex('b6','Panturrilha sentado','máquina')
  ]},
  { id:'C', name:'Costas + Tríceps', focus:'Parte superior', exercises:[
    ex('c1','Pulley frente pegada aberta','máquina'), ex('c2','Pulley frente pegada supinada/neutra','máquina'), ex('c3','Remada baixa com triângulo','máquina'),
    ex('c4','Remada unilateral ou remada com apoio no peito','halter/máquina'), ex('c5','Peck fly inverso','máquina'), ex('c6','Tríceps barra no crossover','cabo'),
    ex('c7','Tríceps máquina/corda/francês','máquina/cabo'), ex('c8','Prancha','tempo'), ex('c9','Cardio','cardio')
  ]},
  { id:'D', name:'Ombro + Braços extra', focus:'Ombro e braços', exercises:[
    ex('d1','Desenvolvimento com halter ou máquina','halter/máquina'), ex('d2','Elevação lateral com halter','halter'), ex('d3','Elevação lateral na polia ou máquina','máquina/cabo'),
    ex('d4','Peck fly inverso ou face pull','máquina/cabo'), ex('d5','Rosca extra, tipo Scott/cabo','máquina/cabo'), ex('d6','Tríceps extra, tipo corda/francês','máquina/cabo'),
    ex('d7','Abdominal infra','solo/máquina')
  ]},
  { id:'E', name:'Posterior/Perna', focus:'Posterior', exercises:[
    ex('e1','Stiff com halter ou barra','halter/barra'), ex('e2','Mesa flexora','máquina'), ex('e3','Flexora em pé unilateral','máquina'),
    ex('e4','Leg press 45° unilateral ou bilateral','máquina'), ex('e5','Cadeira abdutora','máquina'), ex('e6','Panturrilha','máquina'), ex('e7','Abdominal máquina','máquina')
  ]}
];
function ex(id,name,type){return {id,name,type,target:'4x12'};}

let state = load();
let screen = 'home';
let activeModalWorkout = null;

function defaultState(){
  const lucas = newProfile('Lucas');
  lucas.height = '1,87'; lucas.weight = '83,2'; lucas.goal = 'Ganhar massa e dar uma secada'; lucas.focus = 'Parte superior';
  lucas.notes = 'Pé chato; desconforto no leg press/hack; foco em ombro e costas.';
  return { activeProfileId: lucas.id, profiles: [lucas], version: 1 };
}
function newProfile(name='Novo perfil'){
  return {
    id: 'p_' + Date.now() + '_' + Math.random().toString(16).slice(2), name, age:'', height:'', weight:'', goal:'', focus:'', notes:'',
    queue: ['A','B','C','D','E'], progress: 0, target: 100, workouts: structuredClone(DEFAULT_WORKOUTS),
    weights:{}, exerciseMeta:{}, tempDone:{}, tempStatus:{}, history:[], pendingAcademy:[], checkins:[], bio:[], createdAt: nowISO()
  };
}
function load(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultState(); } catch { return defaultState(); } }
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function profile(){ return state.profiles.find(p=>p.id===state.activeProfileId) || state.profiles[0]; }
function nowISO(){ return new Date().toISOString(); }
function todayBR(d=new Date()){ return d.toLocaleDateString('pt-BR'); }
function fmtDate(iso){ return new Date(iso).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric'}); }
function byId(id){ return document.getElementById(id); }
function esc(s){ return String(s ?? '').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function workoutById(p,id){ return p.workouts.find(w=>w.id===id); }
function currentWorkout(p=profile()){ return workoutById(p, p.queue[0]); }
function allExercises(p=profile()){ return p.workouts.flatMap(w=>w.exercises.map(e=>({...e, workoutId:w.id, workoutName:w.name}))); }

function init(){
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>setScreen(btn.dataset.screen)));
  byId('openProfileSwitcher').addEventListener('click', openProfileSwitcher);
  render();
}
function setScreen(s){ screen=s; render(); }
function titleFor(s){ return {home:'Início',workouts:'Treinos',progress:'Progresso',checkin:'Check-in',coach:'Análise',profile:'Perfil'}[s] || 'Início'; }
function render(){
  const p = profile();
  byId('screenTitle').textContent = titleFor(screen);
  byId('activeProfileName').textContent = p.name;
  byId('profileInitial').textContent = (p.name||'?').trim().charAt(0).toUpperCase();
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.screen===screen));
  const map = {home:renderHome, workouts:renderWorkouts, progress:renderProgress, checkin:renderCheckin, coach:renderCoach, profile:renderProfile};
  byId('content').innerHTML = map[screen]();
  bindScreen();
}

function renderHome(){
  const p = profile(); const w=currentWorkout(p); const pct=Math.min(100, Math.round(p.progress/p.target*100));
  const cycles = Math.floor(p.progress/5);
  return `
    <section class="hero">
      <div class="hero-row">
        <div>
          <p class="eyebrow">Perfil ativo</p>
          <h2>${esc(p.name)}</h2>
          <p>${esc(p.goal || 'Seu projeto de evolução em 100 treinos.')}</p>
          <div class="actions"><button class="btn" data-action="start-current">Iniciar ${w.id}</button><button class="btn secondary" data-screen-go="progress">Ver progresso</button></div>
        </div>
        <div class="progress-ring" style="--p:${pct}%"><div class="progress-ring-inner">${p.progress}/${p.target}<small>${pct}%</small></div></div>
      </div>
    </section>
    <section class="card">
      <div class="card-title"><h3>Próximo treino</h3><span class="badge orange">${w.id}</span></div>
      <div class="workout-card current" data-open-workout="${w.id}">
        <div class="workout-left"><div class="letter">${w.id}</div><div class="workout-name"><strong>${esc(w.name)}</strong><span>${w.exercises.length} exercícios • ${esc(w.focus)}</span></div></div>
        <span>›</span>
      </div>
    </section>
    <section class="grid three">
      <div class="stat"><strong>${cycles}</strong><span>ciclos completos</span></div>
      <div class="stat"><strong>${p.history.length}</strong><span>treinos no histórico</span></div>
      <div class="stat"><strong>${p.checkins.length}</strong><span>check-ins salvos</span></div>
    </section>
    <section class="card">
      <div class="card-title"><h3>Fila atual</h3><p>Somente o primeiro pode ser concluído</p></div>
      <div class="grid">${p.queue.map((id,i)=>workoutQueueCard(p,id,i===0)).join('')}</div>
    </section>`;
}
function pendingHTML(p){ return ''; }
function workoutQueueCard(p,id,current=false){ const w=workoutById(p,id); return `<div class="workout-card ${current?'current':''}" data-open-workout="${id}"><div class="workout-left"><div class="letter">${id}</div><div class="workout-name"><strong>${esc(w.name)}</strong><span>${current?'Liberado para concluir':'Modo consulta'} • ${w.exercises.length} exercícios</span></div></div><span class="badge ${current?'orange':''}">${current?'Atual':'Bloqueado'}</span></div>`; }
function renderWorkouts(){ const p=profile(); return `<section class="card"><div class="card-title"><div><h3>Treinos A–E</h3><p>Você pode abrir todos, mas só conclui o treino da ordem.</p></div><button class="btn sm secondary" data-action="edit-current-workout">Editar atual</button></div><div class="grid">${p.queue.map((id,i)=>workoutQueueCard(p,id,i===0)).join('')}</div></section><section class="card pro-tip"><div><span class="badge orange">PRO</span><h3>Editor liberado</h3><p>Agora você pode editar exercícios, ordem, nome, tipo e meta de reps direto no app.</p></div></section>`; }

function renderProgress(){
  const p=profile(); const gains = exerciseGains(p); const cycles=Math.floor(p.progress/5);
  return `<section class="hero"><div class="hero-row"><div><p class="eyebrow">Evolução</p><h2>${p.progress}/${p.target} treinos</h2><p>${cycles} ciclos completos. Acompanhe cargas, consistência e estagnações.</p></div><div class="progress-ring" style="--p:${Math.round(p.progress/p.target*100)}%"><div class="progress-ring-inner">${p.progress}<small>treinos</small></div></div></div></section>
  <section class="grid two"><div class="stat"><strong>${gains.filter(g=>g.delta>0).length}</strong><span>exercícios com evolução</span></div><div class="stat"><strong>${stagnated(p).length}</strong><span>possíveis estagnados</span></div></section>
  <section class="card"><div class="card-title"><h3>Top evolução de carga</h3><p>Comparando primeiro e último registro</p></div>${gains.length?gains.slice(0,8).map(g=>`<div class="history-row"><div><strong>${esc(g.name)}</strong><span>${g.first} → ${g.last}</span></div><span class="badge green">+${g.delta}</span></div>`).join(''):'<div class="empty">Ainda não há histórico suficiente.</div>'}</section>
  <section class="card"><div class="card-title"><h3>Últimos treinos</h3></div>${p.history.slice(-8).reverse().map(h=>`<div class="history-row"><div><strong>${h.workoutId} — ${esc(h.workoutName)}</strong><span>${fmtDate(h.date)} • ${h.doneCount} concluídos • ${h.skippedCount} pulados</span></div><span class="badge">${h.score}%</span></div>`).join('') || '<div class="empty">Nenhum treino finalizado ainda.</div>'}</section>`;
}
function exerciseGains(p){
  const first={}, last={};
  p.history.forEach(h=>Object.entries(h.weights||{}).forEach(([id,val])=>{ const n=parseFloat(String(val).replace(',','.')); if(!isNaN(n)){ if(first[id]===undefined) first[id]=n; last[id]=n; }}));
  const exs=allExercises(p); return Object.keys(last).map(id=>{const e=exs.find(x=>x.id===id); return {id,name:e?.name||id,first:first[id],last:last[id],delta:+(last[id]-first[id]).toFixed(2)}}).filter(x=>x.delta>0).sort((a,b)=>b.delta-a.delta);
}
function stagnated(p){
  const recent = p.history.slice(-15), map={};
  recent.forEach(h=>Object.entries(h.weights||{}).forEach(([id,val])=>{ if(!map[id]) map[id]=[]; map[id].push(val); }));
  return Object.entries(map).filter(([id,arr])=>arr.length>=3 && new Set(arr.slice(-3).map(String)).size===1).map(([id])=>id);
}

function renderCheckin(){
  const p=profile();
  return `<section class="card"><div class="card-title"><h3>Check-in físico</h3><p>Fotos e dados corporais por ciclo.</p></div>
    <div class="actions"><button class="btn" data-action="new-checkin">Novo check-in</button><button class="btn secondary" data-action="new-bio">Inserir bioimpedância</button></div>
  </section>
  <section class="card"><div class="card-title"><h3>Fotos por ciclo</h3></div>${p.checkins.length?`<div class="grid">${p.checkins.slice().reverse().map(c=>`<div class="stat"><strong>Ciclo ${c.cycle}</strong><span>${fmtDate(c.date)} • ${c.weight?c.weight+' kg':''}</span><div class="timeline">${['front','side','back'].map(k=>c.photos?.[k]?`<img class="mini-photo" src="${c.photos[k]}" alt="${k}">`:'' ).join('')}</div></div>`).join('')}</div>`:'<div class="empty">Nenhum check-in salvo ainda.</div>'}</section>
  <section class="card"><div class="card-title"><h3>Bioimpedância / medidas</h3></div>${p.bio.length?p.bio.slice().reverse().map(b=>`<div class="history-row"><div><strong>${fmtDate(b.date)} — ${b.weight||'--'} kg</strong><span>Gordura: ${b.bodyFat||'--'}% • Massa magra: ${b.leanMass||'--'} kg • Cintura: ${b.waist||'--'} cm</span></div><span class="badge orange">Bio</span></div>`).join(''):'<div class="empty">Nenhuma avaliação inserida.</div>'}</section>`;
}

function renderCoach(){ const insights=generateInsights(profile()); return `<section class="hero"><p class="eyebrow">Coach local</p><h2>Análise inteligente</h2><p>Esta análise usa regras locais do app. Não é IA online ainda, mas já cruza treino, cargas, cardio, check-ins e bioimpedância.</p></section><section class="grid">${insights.map(i=>`<div class="alert ${i.type==='orange'?'orange':''}"><div>${i.icon}</div><div><strong>${esc(i.title)}</strong><p>${esc(i.text)}</p></div></div>`).join('')}</section>`; }
function generateInsights(p){
  const out=[]; const cycles=Math.floor(p.progress/5); const st=stagnated(p);
  out.push({icon:'🔥',title:`${p.progress}/${p.target} treinos concluídos`,text:`Você completou ${cycles} ciclos. Próxima meta: ${Math.min(p.target, (cycles+1)*5)} treinos.`,type:'orange'});
  if(st.length) out.push({icon:'⚠️',title:'Possível estagnação de carga',text:`Há ${st.length} exercício(s) com mesma carga nos últimos registros. Se a execução estiver boa, planeje subir pouco ou melhorar reps.`,type:'orange'});
  const skipped = p.history.slice(-5).reduce((a,h)=>a+(h.skippedCount||0),0); if(skipped) out.push({icon:'🟡',title:'Exercícios pulados recentemente',text:`Nos últimos 5 treinos, você pulou ${skipped} exercício(s). Veja se isso está atrapalhando ombro/costas.`,type:'orange'});
  const lateralSkipped = p.history.slice(-12).some(h=>h.status?.d3==='skipped' || h.status?.d3===undefined && h.workoutId==='D'); if(lateralSkipped) out.push({icon:'💪',title:'Prioridade para ombro lateral',text:'Não deixe a elevação lateral na polia/máquina virar opcional. Ela é uma das chaves para ombro mais largo.',type:'orange'});
  if(p.bio.length>=2){ const a=p.bio[p.bio.length-2], b=p.bio[p.bio.length-1]; out.push({icon:'📊',title:'Bioimpedância comparada',text:compareBio(a,b),type:'orange'}); }
  if(!p.checkins.length) out.push({icon:'📸',title:'Comece os check-ins visuais',text:'Ao fechar cada ciclo, tire fotos de frente, lado e costas nas mesmas condições para comparar evolução.'});
  return out;
}
function compareBio(a,b){ const parts=[]; [['weight','Peso','kg'],['bodyFat','Gordura','%'],['leanMass','Massa magra','kg'],['waist','Cintura','cm']].forEach(([k,n,u])=>{const x=parseFloat(a[k]), y=parseFloat(b[k]); if(!isNaN(x)&&!isNaN(y)){ const d=+(y-x).toFixed(1); parts.push(`${n}: ${d>0?'+':''}${d}${u}`); }}); return parts.length?parts.join(' • '):'Duas avaliações salvas; preencha mais campos para comparação melhor.'; }

function renderProfile(){ const p=profile(); return `<section class="card"><div class="card-title"><h3>Perfil</h3><p>Dados locais, sem login.</p></div><div class="form-grid">
  ${inputHTML('name','Nome',p.name)}${inputHTML('age','Idade',p.age,'number')}${inputHTML('height','Altura',p.height)}${inputHTML('weight','Peso inicial/atual',p.weight)}${inputHTML('goal','Objetivo',p.goal)}${inputHTML('focus','Foco',p.focus)}
  <div class="field" style="grid-column:1/-1"><label>Observações</label><textarea data-profile-field="notes">${esc(p.notes)}</textarea></div></div><div class="actions"><button class="btn" data-action="save-profile">Salvar perfil</button><button class="btn secondary" data-action="new-profile">Novo perfil</button><button class="btn secondary" data-action="backup">Exportar backup</button><button class="btn secondary" data-action="import-backup">Importar backup</button><input id="backupInput" type="file" accept="application/json" hidden></div></section>
  <section class="card"><div class="card-title"><h3>Perfis</h3><p>${state.profiles.length} perfil(is)</p></div><div class="profile-list">${state.profiles.map(x=>`<div class="profile-option"><div class="workout-left"><div class="avatar-dot">${esc(x.name.charAt(0).toUpperCase())}</div><div><strong>${esc(x.name)}</strong><div class="small">${x.progress}/${x.target} treinos</div></div></div><button class="btn sm ${x.id===state.activeProfileId?'green':'secondary'}" data-switch-profile="${x.id}">${x.id===state.activeProfileId?'Ativo':'Usar'}</button></div>`).join('')}</div></section>
  <section class="card"><div class="card-title"><h3>Zona perigosa</h3></div><button class="btn danger full" data-action="reset-profile">Resetar perfil ativo</button></section>`; }
function inputHTML(id,label,val,type='text'){ return `<div class="field"><label>${label}</label><input class="input" type="${type}" data-profile-field="${id}" value="${esc(val)}"></div>`; }

function bindScreen(){
  document.querySelectorAll('[data-screen-go]').forEach(el=>el.onclick=()=>setScreen(el.dataset.screenGo));
  document.querySelectorAll('[data-open-workout]').forEach(el=>el.onclick=()=>openWorkout(el.dataset.openWorkout));
  document.querySelectorAll('[data-action]').forEach(el=>el.onclick=()=>handleAction(el.dataset.action));
  document.querySelectorAll('[data-switch-profile]').forEach(el=>el.onclick=()=>{state.activeProfileId=el.dataset.switchProfile; save(); render();});
}
function handleAction(a){
  if(a==='start-current') openWorkout(currentWorkout().id);
  if(a==='new-profile') createProfileFlow();
  if(a==='save-profile') saveProfileForm();
  if(a==='backup') exportBackup();
  if(a==='import-backup') byId('backupInput').click();
  if(a==='reset-profile') resetProfileFlow();
  if(a==='new-checkin') openCheckinModal();
  if(a==='new-bio') openBioModal();
  if(a==='edit-current-workout') openEditWorkout(currentWorkout().id);
}

function saveProfileForm(){ const p=profile(); document.querySelectorAll('[data-profile-field]').forEach(f=>p[f.dataset.profileField]=f.value); save(); toast('Perfil salvo.'); render(); }
function createProfileFlow(){ const name=prompt('Nome do novo perfil:'); if(!name) return; const p=newProfile(name); state.profiles.push(p); state.activeProfileId=p.id; save(); render(); toast('Perfil criado.'); }
function resetProfileFlow(){ const p=profile(); if(!confirm(`Resetar TODO o perfil ${p.name}? Isso apaga treinos, cargas, histórico, check-ins e bioimpedância.`)) return; const t=prompt('Digite RESETAR para confirmar:'); if(t!=='RESETAR') return toast('Reset cancelado.'); const fresh=newProfile(p.name); fresh.id=p.id; state.profiles[state.profiles.findIndex(x=>x.id===p.id)] = fresh; save(); render(); toast('Perfil resetado.'); }


function exerciseHTML(p,w,e,isCurrent){
  const done=!!p.tempDone[e.id];
  const status=p.tempStatus[e.id];
  const m=p.exerciseMeta[e.id] || {};
  const weight=p.weights[e.id] || '';
  const locked=!isCurrent;
  return `<div class="exercise ${done?'done':''} ${status==='skipped'?'skipped':''}" data-exercise-card="${e.id}">
    <div class="exercise-top">
      <div><h4>${esc(e.name)}</h4><div class="small">${esc(e.type||'exercício')} • meta ${esc(e.target||'4x12')}</div></div>
      <span class="badge ${done?'green':status==='skipped'?'yellow':''}">${done?'Concluído':status==='skipped'?'Pulado':isCurrent?'Pendente':'Consulta'}</span>
    </div>
    <div class="exercise-controls">
      <div class="field"><label>Carga atual</label><input class="input" data-weight="${e.id}" value="${esc(weight)}" placeholder="ex: 40 kg"></div>
      <div class="field"><label>Próxima meta</label><input class="input" data-meta="targetWeight" data-ex-id="${e.id}" value="${esc(m.targetWeight||'')}" placeholder="ex: 45 kg"></div>
      <div class="field"><label>Dificuldade</label><select class="select" data-meta="difficulty" data-ex-id="${e.id}">
        ${['','Fácil','Boa','Pesada','Muito pesada'].map(x=>`<option ${m.difficulty===x?'selected':''}>${x}</option>`).join('')}
      </select></div>
      <div class="field"><label>Dor/desconforto</label><select class="select" data-meta="pain" data-ex-id="${e.id}">
        ${['','Não','Leve','Média','Forte'].map(x=>`<option ${m.pain===x?'selected':''}>${x}</option>`).join('')}
      </select></div>
      <div class="field full-field"><label>Observação</label><input class="input" data-meta="note" data-ex-id="${e.id}" value="${esc(m.note||'')}" placeholder="ex: pé doeu, ajustar postura..."></div>
    </div>
    <div class="actions">
      <button class="btn sm green" ${locked?'disabled':''} data-toggle-ex="${e.id}">${done?'Desmarcar':'Concluir'}</button>
      <button class="btn sm secondary" ${locked?'disabled':''} data-skip-ex="${e.id}">Pular</button>
    </div>
  </div>`;
}

function openWorkout(id){
  activeModalWorkout=id;
  const p=profile(); const w=workoutById(p,id); const isCurrent=p.queue[0]===id; const layer=byId('modalLayer');
  layer.innerHTML = `<div class="modal"><div class="modal-head"><div><p class="eyebrow">${isCurrent?'Treino liberado':'Modo consulta'}</p><h2>${w.id} — ${esc(w.name)}</h2><p class="muted">${isCurrent?'Você pode concluir exercícios e finalizar.':'Você pode consultar cargas, mas não concluir fora da ordem.'}</p></div><button class="close" data-close>×</button></div>
  <div class="actions modal-actions-top"><button class="btn sm secondary" data-edit-workout="${w.id}">Editar treino</button><button class="btn sm secondary" data-close>Fechar</button></div>
  ${w.exercises.map(e=>exerciseHTML(p,w,e,isCurrent)).join('')}
  <div class="divider"></div><div class="actions"><button class="btn green" ${isCurrent?'':'disabled'} data-finalize-workout="${w.id}">Finalizar treino</button><button class="btn secondary" data-close>Fechar</button></div></div>`;
  layer.classList.remove('hidden');
  wireWorkoutModal();
}
function wireWorkoutModal(){
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  document.querySelectorAll('[data-weight]').forEach(inp=>inp.oninput=()=>{ const p=profile(); p.weights[inp.dataset.weight]=inp.value; save(); });
  document.querySelectorAll('[data-meta]').forEach(inp=>inp.oninput=inp.onchange=()=>{ const p=profile(); const id=inp.dataset.exId; if(!p.exerciseMeta[id]) p.exerciseMeta[id]={}; p.exerciseMeta[id][inp.dataset.meta]=inp.value; save(); });
  document.querySelectorAll('[data-toggle-ex]').forEach(b=>b.onclick=()=>toggleDone(b.dataset.toggleEx));
  document.querySelectorAll('[data-skip-ex]').forEach(b=>b.onclick=()=>skipExercise(b.dataset.skipEx));
  document.querySelectorAll('[data-finalize-workout]').forEach(b=>b.onclick=()=>finalizeWorkout(b.dataset.finalizeWorkout));
  document.querySelectorAll('[data-edit-workout]').forEach(b=>b.onclick=()=>openEditWorkout(b.dataset.editWorkout));
}

function openEditWorkout(id){
  activeModalWorkout=id;
  const p=profile(); const w=workoutById(p,id); const layer=byId('modalLayer');
  layer.innerHTML = `<div class="modal"><div class="modal-head"><div><p class="eyebrow">Editor de treino</p><h2>${w.id} — ${esc(w.name)}</h2><p class="muted">Mude nomes, ordem, tipo e meta. As cargas salvas dos exercícios antigos são mantidas.</p></div><button class="close" data-close>×</button></div>
  <section class="editor-panel"><div class="form-grid"><div class="field"><label>Nome do treino</label><input class="input" id="editWorkoutName" value="${esc(w.name)}"></div><div class="field"><label>Foco</label><input class="input" id="editWorkoutFocus" value="${esc(w.focus||'')}"></div></div></section>
  <div class="edit-list">${w.exercises.map((e,i)=>editExerciseRow(e,i,w.exercises.length)).join('')}</div>
  <div class="actions"><button class="btn" data-add-exercise="${w.id}">Adicionar exercício</button><button class="btn secondary" data-back-workout="${w.id}">Voltar ao treino</button><button class="btn secondary" data-close>Fechar</button></div></div>`;
  layer.classList.remove('hidden');
  wireEditWorkoutModal(id);
}
function editExerciseRow(e,i,total){
  return `<div class="edit-exercise-row" data-edit-row="${e.id}">
    <div class="edit-index">${i+1}</div>
    <div class="form-grid edit-grid">
      <div class="field"><label>Exercício</label><input class="input" data-edit-ex="name" data-ex-id="${e.id}" value="${esc(e.name)}"></div>
      <div class="field"><label>Tipo</label><input class="input" data-edit-ex="type" data-ex-id="${e.id}" value="${esc(e.type||'')}"></div>
      <div class="field"><label>Meta</label><input class="input" data-edit-ex="target" data-ex-id="${e.id}" value="${esc(e.target||'4x12')}"></div>
    </div>
    <div class="row-tools"><button class="btn sm secondary" ${i===0?'disabled':''} data-move-ex="up" data-ex-id="${e.id}">↑</button><button class="btn sm secondary" ${i===total-1?'disabled':''} data-move-ex="down" data-ex-id="${e.id}">↓</button><button class="btn sm danger" data-delete-ex="${e.id}">Excluir</button></div>
  </div>`;
}
function wireEditWorkoutModal(id){
  const p=profile(); const w=workoutById(p,id);
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  byId('editWorkoutName').oninput=()=>{ w.name=byId('editWorkoutName').value; save(); };
  byId('editWorkoutFocus').oninput=()=>{ w.focus=byId('editWorkoutFocus').value; save(); };
  document.querySelectorAll('[data-edit-ex]').forEach(inp=>inp.oninput=()=>{ const e=w.exercises.find(x=>x.id===inp.dataset.exId); if(e){ e[inp.dataset.editEx]=inp.value; save(); }});
  document.querySelectorAll('[data-move-ex]').forEach(b=>b.onclick=()=>{ const idx=w.exercises.findIndex(x=>x.id===b.dataset.exId); if(idx<0) return; const ni=b.dataset.moveEx==='up'?idx-1:idx+1; if(ni<0||ni>=w.exercises.length) return; [w.exercises[idx],w.exercises[ni]]=[w.exercises[ni],w.exercises[idx]]; save(); openEditWorkout(id); });
  document.querySelectorAll('[data-delete-ex]').forEach(b=>b.onclick=()=>{ if(!confirm('Excluir este exercício do treino?')) return; w.exercises=w.exercises.filter(x=>x.id!==b.dataset.deleteEx); save(); openEditWorkout(id); });
  document.querySelector('[data-add-exercise]').onclick=()=>{ const name=prompt('Nome do exercício:'); if(!name) return; w.exercises.push(ex(id.toLowerCase()+'_'+Date.now(), name, 'personalizado')); save(); openEditWorkout(id); };
  document.querySelector('[data-back-workout]').onclick=()=>openWorkout(id);
}

function meta(id){ const p=profile(); if(!p.exerciseMeta[id]) p.exerciseMeta[id]={}; return p.exerciseMeta[id]; }
function toggleDone(id){ const p=profile(); p.tempDone[id]=!p.tempDone[id]; if(p.tempDone[id]) p.tempStatus[id]='done'; else delete p.tempStatus[id]; save(); openWorkout(activeModalWorkout); }
function skipExercise(id){ const p=profile(); p.tempDone[id]=false; p.tempStatus[id]='skipped'; save(); openWorkout(activeModalWorkout); }
function closeModal(){ byId('modalLayer').classList.add('hidden'); byId('modalLayer').innerHTML=''; render(); }
function finalizeWorkout(id){ const p=profile(); if(p.queue[0]!==id) return toast(`Bloqueado. O próximo treino correto é ${p.queue[0]}.`); const w=workoutById(p,id); const doneCount=w.exercises.filter(e=>p.tempDone[e.id]).length; const skippedCount=w.exercises.filter(e=>p.tempStatus[e.id]==='skipped').length;
  if(!confirm(`Finalizar o treino ${id}?\n\nConcluídos: ${doneCount}\nPulados: ${skippedCount}`)) return;
  const weights={}, status={}, metaSnap={}; w.exercises.forEach(e=>{ if(p.weights[e.id]) weights[e.id]=p.weights[e.id]; if(p.tempStatus[e.id]) status[e.id]=p.tempStatus[e.id]; if(p.exerciseMeta[e.id]) metaSnap[e.id]={...p.exerciseMeta[e.id]}; });
  const score = Math.max(0, Math.round(((doneCount + skippedCount*.35) / w.exercises.length) * 100));
  p.history.push({id:'h_'+Date.now(), date:nowISO(), workoutId:id, workoutName:w.name, doneCount, skippedCount, score, weights, status, meta:metaSnap});
  p.progress = Math.min(p.target, p.progress + 1); p.queue.push(p.queue.shift()); p.tempDone={}; p.tempStatus={};
  save(); closeModal(); toast('Treino finalizado com sucesso.');
}

function openProfileSwitcher(){ const layer=byId('modalLayer'); layer.innerHTML=`<div class="modal"><div class="modal-head"><div><p class="eyebrow">Perfil</p><h2>Quem está treinando?</h2></div><button class="close" data-close>×</button></div><div class="profile-list">${state.profiles.map(p=>`<div class="profile-option"><div class="workout-left"><div class="avatar-dot">${esc(p.name.charAt(0).toUpperCase())}</div><div><strong>${esc(p.name)}</strong><div class="small">${p.progress}/${p.target} treinos</div></div></div><button class="btn sm ${p.id===state.activeProfileId?'green':'secondary'}" data-modal-switch-profile="${p.id}">${p.id===state.activeProfileId?'Ativo':'Usar'}</button></div>`).join('')}</div><div class="actions"><button class="btn" data-modal-new-profile>Novo perfil</button></div></div>`; layer.classList.remove('hidden'); document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal); document.querySelectorAll('[data-modal-switch-profile]').forEach(b=>b.onclick=()=>{state.activeProfileId=b.dataset.modalSwitchProfile; save(); closeModal();}); document.querySelector('[data-modal-new-profile]').onclick=()=>{closeModal(); createProfileFlow();}; }

function openCheckinModal(){ const p=profile(), cycle=Math.floor(p.progress/5); const layer=byId('modalLayer'); layer.innerHTML=`<div class="modal"><div class="modal-head"><div><p class="eyebrow">Check-in</p><h2>Ciclo ${cycle}</h2><p class="muted">Tente usar sempre a mesma luz, pose e distância.</p></div><button class="close" data-close>×</button></div><div class="form-grid">${inputPlain('checkWeight','Peso do dia')} ${inputPlain('checkWaist','Cintura')}<div class="field" style="grid-column:1/-1"><label>Observação do ciclo</label><textarea id="checkNotes"></textarea></div></div><div class="photo-grid"><label class="photo-box"><span>Frente<br><small>toque para enviar</small></span><input type="file" accept="image/*" data-photo="front" hidden></label><label class="photo-box"><span>Lado<br><small>toque para enviar</small></span><input type="file" accept="image/*" data-photo="side" hidden></label><label class="photo-box"><span>Costas<br><small>toque para enviar</small></span><input type="file" accept="image/*" data-photo="back" hidden></label></div><div class="actions"><button class="btn" data-save-checkin>Salvar check-in</button><button class="btn secondary" data-close>Cancelar</button></div></div>`; layer.classList.remove('hidden'); const photos={}; document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal); document.querySelectorAll('[data-photo]').forEach(inp=>inp.onchange=async()=>{ const img=await compressImage(inp.files[0]); photos[inp.dataset.photo]=img; inp.parentElement.innerHTML=`<img src="${img}" alt="foto ${inp.dataset.photo}">`; }); document.querySelector('[data-save-checkin]').onclick=()=>{ p.checkins.push({id:'c_'+Date.now(), date:nowISO(), cycle, weight:byId('checkWeight').value, waist:byId('checkWaist').value, notes:byId('checkNotes').value, photos}); save(); closeModal(); toast('Check-in salvo.'); }; }
function inputPlain(id,label){ return `<div class="field"><label>${label}</label><input class="input" id="${id}"></div>`; }
function compressImage(file){ return new Promise((resolve,reject)=>{ if(!file) return resolve(''); const r=new FileReader(); r.onload=()=>{ const img=new Image(); img.onload=()=>{ const max=900, scale=Math.min(1,max/img.width); const c=document.createElement('canvas'); c.width=Math.round(img.width*scale); c.height=Math.round(img.height*scale); c.getContext('2d').drawImage(img,0,0,c.width,c.height); resolve(c.toDataURL('image/jpeg',.72)); }; img.onerror=reject; img.src=r.result; }; r.onerror=reject; r.readAsDataURL(file); }); }

function openBioModal(){ const p=profile(); const layer=byId('modalLayer'); layer.innerHTML=`<div class="modal"><div class="modal-head"><div><p class="eyebrow">Bioimpedância</p><h2>Inserir avaliação</h2><p class="muted">Você pode preencher manualmente ou tentar extrair texto de um PDF.</p></div><button class="close" data-close>×</button></div><div class="field"><label>PDF da bioimpedância opcional</label><input class="input" id="bioPdf" type="file" accept="application/pdf"></div><div class="actions"><button class="btn secondary" data-parse-pdf>Tentar ler PDF</button></div><div class="form-grid">${['date:Data','weight:Peso','height:Altura','imc:IMC','bodyFat:% gordura','fatMass:Massa gorda','leanMass:Massa magra','water:% água','visceral:Gordura visceral','metabolicAge:Idade metabólica','waist:Cintura','abdomen:Abdômen','hip:Quadril','arm:Braço','thigh:Coxa','calf:Panturrilha'].map(x=>{const [id,label]=x.split(':'); return `<div class="field"><label>${label}</label><input class="input" id="bio_${id}"></div>`}).join('')}<div class="field" style="grid-column:1/-1"><label>Observações</label><textarea id="bio_notes"></textarea></div></div><div class="actions"><button class="btn" data-save-bio>Salvar avaliação</button><button class="btn secondary" data-close>Cancelar</button></div></div>`; layer.classList.remove('hidden'); byId('bio_date').value = new Date().toISOString().slice(0,10); document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal); document.querySelector('[data-save-bio]').onclick=()=>{ const obj={id:'b_'+Date.now(), date:byId('bio_date').value?new Date(byId('bio_date').value).toISOString():nowISO()}; ['weight','height','imc','bodyFat','fatMass','leanMass','water','visceral','metabolicAge','waist','abdomen','hip','arm','thigh','calf'].forEach(k=>obj[k]=byId('bio_'+k)?.value || ''); obj.notes=byId('bio_notes')?.value || ''; p.bio.push(obj); save(); closeModal(); toast('Bioimpedância salva.');}; document.querySelector('[data-parse-pdf]').onclick=parseBioPdf; }
async function parseBioPdf(){ const file=byId('bioPdf').files[0]; if(!file) return toast('Selecione um PDF.'); if(!window.pdfjsLib) return toast('Leitor PDF indisponível. Preencha manualmente.'); try{ pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; const buf=await file.arrayBuffer(); const pdf=await pdfjsLib.getDocument({data:buf}).promise; let text=''; for(let i=1;i<=pdf.numPages;i++){ const page=await pdf.getPage(i); const content=await page.getTextContent(); text += ' ' + content.items.map(it=>it.str).join(' '); } fillBioFromText(text); toast('PDF lido. Confira os dados antes de salvar.'); }catch(e){ toast('Não consegui ler esse PDF. Preencha manualmente.'); } }
function fillBioFromText(t){ const get=(re)=>{const m=t.match(re); return m?m[1].replace(',', '.'):''}; const date=t.match(/Data[:\s]+(\d{2}\/\d{2}\/\d{4})/i); if(date){ const [d,m,y]=date[1].split('/'); byId('bio_date').value=`${y}-${m}-${d}`; } const map={ weight:/Peso\s+(\d+[,.]?\d*)\s*Kg/i, height:/Altura\s+(\d+[,.]?\d*)\s*m/i, imc:/IMC\s+(\d+[,.]?\d*)/i, fatMass:/Massa Gorda\s+(\d+[,.]?\d*)\s*Kg/i, bodyFat:/%\s*Massa Gorda\s+(\d+[,.]?\d*)%?/i, leanMass:/Massa Magra\s+(\d+[,.]?\d*)\s*Kg/i, water:/%\s*Água Corporal\s+(\d+[,.]?\d*)%?/i, visceral:/Gordura Visceral\s+(\d+[,.]?\d*)%?/i, metabolicAge:/Idade Metabólica\s+(\d+)/i, waist:/Cintura\s+(\d+[,.]?\d*)\s*cm/i, abdomen:/Abdômen\s+(\d+[,.]?\d*)\s*cm/i, hip:/Quadril\s+(\d+[,.]?\d*)\s*cm/i, calf:/Panturrilha direita\s+(\d+[,.]?\d*)\s*cm/i}; Object.entries(map).forEach(([k,re])=>{ const v=get(re); if(v && byId('bio_'+k)) byId('bio_'+k).value=v; }); }

function exportBackup(){ state.lastBackupAt=nowISO(); save(); const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`treino100-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href); }
document.addEventListener('change', e=>{ if(e.target?.id==='backupInput'){ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ try{ const data=JSON.parse(r.result); if(!data.profiles) throw new Error(); if(confirm('Importar backup e substituir dados atuais?')){ state=data; save(); render(); toast('Backup importado.'); } }catch{ toast('Backup inválido.'); }}; r.readAsText(f); }});
function toast(msg){ const t=byId('toast'); t.textContent=msg; t.classList.remove('hidden'); clearTimeout(window.__toast); window.__toast=setTimeout(()=>t.classList.add('hidden'),2800); }

init();
