const STORAGE_KEY = 'treino100Pro.v1';
const AI_ENDPOINT_PATH = '/api/workout-report';
const AI_PLAN_ENDPOINT_PATH = '/api/workout-plan';
const AI_BACKEND_URL = 'https://treino-100-api.vercel.app';
const AI_REQUIRES_LOGIN = true;
const SUPABASE_URL = 'https://ppmlzpyxqtsgyhsyiuuh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwbWx6cHl4cXRzZ3loc3lpdXVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NjkwMTEsImV4cCI6MjEwNzI0NTAxMX0.M_wDmwtVh2KkLmfbAIy0T76YeG379eW6QdW_OXfjO9c';
let supabaseClient = null;
let cloudUser = null;
let cloudReady = false;

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

let state = migrateState(load());
let screen = 'home';
let activeModalWorkout = null;
let onboardingView = 'login';

function defaultState(){
  const initialProfile = newProfile('');
  return { activeProfileId: initialProfile.id, profiles: [initialProfile], version: 3, onboardingDone: false, entryMode: null };
}
function newProfile(name='Novo perfil'){
  return {
    id: 'p_' + Date.now() + '_' + Math.random().toString(16).slice(2), name, age:'', height:'', weight:'', goal:'', focus:'', notes:'', experience:'', daysPerWeek:'',
    queue: ['A','B','C','D','E'], progress: 0, target: 100, workouts: structuredClone(DEFAULT_WORKOUTS), planMeta:{source:'default', cycle:1, title:'Treino padrão'},
    weights:{}, exerciseMeta:{}, tempDone:{}, tempStatus:{}, history:[], pendingAcademy:[], checkins:[], bio:[], ai:{autoWorkoutReport:true}, createdAt: nowISO()
  };
}
function load(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultState(); } catch { return defaultState(); } }
function hasMeaningfulProfileData(p){
  if(!p) return false;
  return !!(String(p.name||'').trim() || String(p.goal||'').trim() || (p.history&&p.history.length) || (p.progress&&p.progress>0) || (p.checkins&&p.checkins.length) || (p.bio&&p.bio.length));
}
function migrateState(s){
  if(!s || !Array.isArray(s.profiles)) s = defaultState();
  if(typeof s.onboardingDone !== 'boolean') s.onboardingDone = s.profiles.some(hasMeaningfulProfileData);
  if(!('entryMode' in s)) s.entryMode = s.onboardingDone ? 'local' : null;
  if(!s.version || s.version < 3) s.version = 3;
  return s;
}
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function profile(){ const p = state.profiles.find(p=>p.id===state.activeProfileId) || state.profiles[0]; return ensureProfile(p); }
function ensureProfile(p){
  if(!p) return p;
  if(!p.ai) p.ai={autoWorkoutReport:true};
  if(!p.planMeta) p.planMeta={source:'default', cycle:1, title:'Treino padrão'};
  if(!('experience' in p)) p.experience='';
  if(!('daysPerWeek' in p)) p.daysPerWeek='';
  p.ai.apiUrl = AI_BACKEND_URL;
  if(typeof p.ai.autoWorkoutReport !== 'boolean') p.ai.autoWorkoutReport = true;
  if(!Array.isArray(p.history)) p.history=[];
  if(!Array.isArray(p.checkins)) p.checkins=[];
  if(!Array.isArray(p.bio)) p.bio=[];
  return p;
}
function nowISO(){ return new Date().toISOString(); }
function todayBR(d=new Date()){ return d.toLocaleDateString('pt-BR'); }
function fmtDate(iso){ return new Date(iso).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric'}); }
function byId(id){ return document.getElementById(id); }
function esc(s){ return String(s ?? '').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function workoutById(p,id){ return p.workouts.find(w=>w.id===id); }
function currentWorkout(p=profile()){ return workoutById(p, p.queue[0]); }
function allExercises(p=profile()){ return p.workouts.flatMap(w=>w.exercises.map(e=>({...e, workoutId:w.id, workoutName:w.name}))); }


function normalizeSupabaseUrl(url){
  return String(url||'').replace(/\/rest\/v1\/?$/,'').replace(/\/+$/,'');
}
function setupSupabase(){
  try{
    if(window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY){
      supabaseClient = window.supabase.createClient(normalizeSupabaseUrl(SUPABASE_URL), SUPABASE_ANON_KEY);
      cloudReady = true;
      refreshCloudUser(false);
      supabaseClient.auth.onAuthStateChange((_event, session)=>{
        cloudUser = session?.user || null;
        render();
      });
    }
  }catch(e){
    console.warn('Supabase indisponível:', e);
    cloudReady = false;
  }
}
async function refreshCloudUser(shouldRender=true){
  if(!supabaseClient) return null;
  try{
    const { data } = await supabaseClient.auth.getUser();
    cloudUser = data?.user || null;
  }catch(e){ cloudUser = null; }
  if(shouldRender) render();
  return cloudUser;
}
async function getCurrentCloudUser(){
  if(cloudUser) return cloudUser;
  return await refreshCloudUser(false);
}
function isLocalMode(){ return state.entryMode === 'local'; }
function isAnonymousCloudUser(){ return !!(cloudUser?.is_anonymous || cloudUser?.app_metadata?.provider === 'anonymous' || isLocalMode()); }
function hasCloudAccount(){ return !!(cloudUser && !isAnonymousCloudUser() && state.entryMode === 'account'); }
function cloudStatusHTML(){
  if(!cloudReady) return '<span class="badge red">indisponível</span>';
  if(hasCloudAccount()) return '<span class="badge green">conectado</span>';
  if(isLocalMode()) return '<span class="badge yellow">modo local</span>';
  return '<span class="badge yellow">desconectado</span>';
}
function isOffline(){ return !navigator.onLine; }
function canUseOnlineAI(){ return !!(AI_BACKEND_URL && !isOffline() && cloudUser); }
function shouldShowOnboarding(){
  const p = profile();
  return !state.onboardingDone && !hasMeaningfulProfileData(p) && !cloudUser;
}
function onlineNoticeHTML(){
  if(isOffline()) return '<section class="offline-banner"><b>Modo offline</b><span>Você pode treinar normalmente, mas nuvem e IA ficam pausadas. Quando a internet voltar, use Sincronizar histórico.</span></section>';
  return '';
}
async function getCloudAccessToken(){
  if(!supabaseClient) return '';
  const { data } = await supabaseClient.auth.getSession();
  return data?.session?.access_token || '';
}
function init(){
  setupSupabase();
  window.addEventListener('online', () => { toast('Você voltou para o modo online.'); render(); });
  window.addEventListener('offline', () => { toast('Modo offline: treino salvo só neste aparelho.'); render(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>setScreen(btn.dataset.screen)));
  byId('openProfileSwitcher').addEventListener('click', openProfileSwitcher);
  render();
}
function setScreen(s){ screen=s; render(); }
function titleFor(s){ return {home:'Início',workouts:'Treinos',progress:'Progresso',checkin:'Check-in',coach:'Análise',profile:'Perfil'}[s] || 'Início'; }
function render(){
  const p = profile();
  if(shouldShowOnboarding()){
    document.body.classList.add('onboarding-active');
    byId('screenTitle').textContent = 'Bem-vindo';
    byId('activeProfileName').textContent = 'Começar';
    byId('profileInitial').textContent = '+';
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    byId('content').innerHTML = onlineNoticeHTML() + renderOnboarding();
    bindOnboarding();
    return;
  }
  document.body.classList.remove('onboarding-active');
  byId('screenTitle').textContent = titleFor(screen);
  byId('activeProfileName').textContent = p.name || (isLocalMode() ? 'Modo local' : 'Perfil');
  byId('profileInitial').textContent = (p.name||'?').trim().charAt(0).toUpperCase();
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.screen===screen));
  const map = {home:renderHome, workouts:renderWorkouts, progress:renderProgress, checkin:renderCheckin, coach:renderCoach, profile:renderProfile};
  byId('content').innerHTML = onlineNoticeHTML() + map[screen]();
  bindScreen();
}

function renderOnboarding(){
  if(onboardingView === 'signup') return renderSignupOnboarding();
  if(onboardingView === 'local') return renderLocalOnboarding();
  return `<section class="welcome-hero login-hero">
    <div class="welcome-copy">
      <p class="eyebrow">Treino 100 Dias Pro</p>
      <h2>Seu treino, seus dados, sua evolução.</h2>
      <p>Entre para sincronizar na nuvem, gerar relatórios com IA e acompanhar sua evolução por ciclos.</p>
      <div class="mini-status"><span>${cloudStatusHTML()}</span><span>${isOffline()?'offline':'online'}</span></div>
    </div>
  </section>
  <section class="auth-center">
    <div class="card auth-card">
      <div class="card-title"><div><h3>Entrar</h3><p>Acesse sua conta para continuar.</p></div></div>
      <div class="form-grid single">
        <div class="field"><label>E-mail</label><input class="input" id="loginEmail" type="email" autocomplete="email" placeholder="seu@email.com"></div>
        <div class="field"><label>Senha</label><input class="input" id="loginPassword" type="password" autocomplete="current-password" placeholder="sua senha"></div>
      </div>
      <div class="actions"><button class="btn full" data-onboarding="login">Entrar</button></div>
      <div class="auth-links">
        <button type="button" data-onboarding="show-signup">Criar conta</button>
        <span>•</span>
        <button type="button" data-onboarding="show-local">Iniciar localmente</button>
      </div>
    </div>
  </section>`;
}
function renderSignupOnboarding(){
  return `<section class="welcome-hero"><div class="welcome-copy"><p class="eyebrow">Criar conta</p><h2>Monte seu perfil inicial</h2><p>Com esses dados, a IA gera um treino de adaptação. Você pode editar tudo depois.</p></div></section>
  <section class="auth-center"><div class="card auth-card wide">
    <div class="card-title"><div><h3>Dados da conta</h3><p>Perfil + login + primeiro treino com IA.</p></div><span class="badge green">IA inclusa</span></div>
    ${onboardingProfileFields('signup')}
    <div class="form-grid">
      <div class="field"><label>E-mail</label><input class="input" id="signupEmail" type="email" autocomplete="email" placeholder="seu@email.com"></div>
      <div class="field"><label>Senha</label><input class="input" id="signupPassword" type="password" autocomplete="new-password" placeholder="mínimo 6 caracteres"></div>
    </div>
    <p class="form-error hidden" id="signupError"></p>
    <div class="actions"><button class="btn full" data-onboarding="signup">Criar conta e gerar treino</button><button class="btn secondary full" data-onboarding="show-login">Voltar ao login</button></div>
  </div></section>`;
}
function renderLocalOnboarding(){
  return `<section class="welcome-hero"><div class="welcome-copy"><p class="eyebrow">Modo local</p><h2>Começar sem criar conta</h2><p>Os dados ficam neste aparelho. A IA funciona com sessão anônima enquanto estiver liberada.</p></div></section>
  <section class="auth-center"><div class="card auth-card wide">
    <div class="card-title"><div><h3>Perfil local</h3><p>Preencha para a IA gerar o treino de adaptação.</p></div><span class="badge yellow">Local</span></div>
    ${onboardingProfileFields('local')}
    <p class="form-error hidden" id="localError"></p>
    <div class="actions"><button class="btn full" data-onboarding="local">Iniciar localmente e gerar treino</button><button class="btn secondary full" data-onboarding="show-login">Voltar ao login</button></div>
    <p class="muted">Se limpar os dados do navegador, o histórico local pode ser perdido. Para recuperar em outro dispositivo, use uma conta.</p>
  </div></section>`;
}
function onboardingProfileFields(prefix){
  return `<div class="form-grid">
    <div class="field"><label>Nome</label><input class="input" id="${prefix}Name" placeholder="Seu nome"></div>
    <div class="field"><label>Idade</label><input class="input" id="${prefix}Age" type="number" min="12" max="99" placeholder="ex: 21"></div>
    <div class="field"><label>Altura</label><input class="input" id="${prefix}Height" inputmode="decimal" placeholder="ex: 1,88"></div>
    <div class="field"><label>Peso inicial</label><input class="input" id="${prefix}Weight" inputmode="decimal" placeholder="ex: 83,2"></div>
    <div class="field"><label>Objetivo</label><input class="input" id="${prefix}Goal" placeholder="ex: ganhar massa e secar"></div>
    <div class="field"><label>Foco principal</label><input class="input" id="${prefix}Focus" placeholder="ex: peito, braços, recomposição"></div>
    <div class="field"><label>Experiência</label><select class="select" id="${prefix}Experience"><option value="">Selecione</option><option>Iniciante</option><option>Intermediário</option><option>Avançado</option></select></div>
    <div class="field"><label>Dias por semana</label><select class="select" id="${prefix}Days"><option value="5">5 dias</option><option value="3">3 dias</option><option value="4">4 dias</option><option value="6">6 dias</option></select></div>
    <div class="field" style="grid-column:1/-1"><label>Observações</label><textarea id="${prefix}Notes" placeholder="Dor, limitação, tempo de treino, equipamento, preferências..."></textarea></div>
  </div>`;
}
function bindOnboarding(){
  document.querySelectorAll('[data-onboarding]').forEach(btn=>btn.onclick=()=>handleOnboarding(btn.dataset.onboarding));
}
function handleOnboarding(action){
  if(action==='show-signup'){ onboardingView='signup'; render(); return; }
  if(action==='show-local'){ onboardingView='local'; render(); return; }
  if(action==='show-login'){ onboardingView='login'; render(); return; }
  if(action==='login') return onboardingLogin();
  if(action==='signup') return onboardingSignup();
  if(action==='local') return onboardingLocal();
}


function readOnboardingProfile(prefix){
  return {
    name: byId(prefix+'Name')?.value?.trim() || '',
    age: byId(prefix+'Age')?.value?.trim() || '',
    height: byId(prefix+'Height')?.value?.trim() || '',
    weight: byId(prefix+'Weight')?.value?.trim() || '',
    goal: byId(prefix+'Goal')?.value?.trim() || '',
    focus: byId(prefix+'Focus')?.value?.trim() || '',
    experience: byId(prefix+'Experience')?.value?.trim() || '',
    daysPerWeek: byId(prefix+'Days')?.value?.trim() || '',
    notes: byId(prefix+'Notes')?.value?.trim() || ''
  };
}
function showFormError(id, message){
  const el=byId(id);
  if(!el){ toast(message); return; }
  el.textContent=message;
  el.classList.remove('hidden');
}
function validateProfileInfo(info){
  if(!info.name || info.name.length < 2) return 'Informe um nome com pelo menos 2 letras.';
  const age=Number(info.age);
  if(!Number.isFinite(age) || age < 12 || age > 99) return 'Informe uma idade válida.';
  const height=parseNumberValue(info.height);
  if(!height || height < 1 || height > 2.5) return 'Informe uma altura válida. Exemplo: 1,88.';
  const weight=parseNumberValue(info.weight);
  if(!weight || weight < 30 || weight > 300) return 'Informe um peso inicial válido.';
  if(!info.goal || info.goal.length < 3) return 'Informe seu objetivo.';
  if(!info.focus || info.focus.length < 2) return 'Informe seu foco principal.';
  if(!info.experience) return 'Informe sua experiência.';
  if(!info.daysPerWeek) return 'Informe quantos dias por semana pretende treinar.';
  return '';
}
function applyProfileInfo(info){
  const p=profile();
  p.name=info.name;
  p.age=info.age;
  p.height=info.height;
  p.weight=info.weight;
  p.goal=info.goal;
  p.focus=info.focus;
  p.experience=info.experience;
  p.daysPerWeek=info.daysPerWeek;
  p.notes=info.notes;
  ensureProfile(p);
  save();
}
async function onboardingLogin(){
  if(!supabaseClient) return toast('Supabase não carregou. Reabra o app.');
  if(isOffline()) return toast('Você está offline. Faça login quando estiver online.');
  const email=byId('loginEmail')?.value?.trim();
  const password=byId('loginPassword')?.value || '';
  if(!email || !password) return toast('Informe e-mail e senha.');
  const { data, error } = await supabaseClient.auth.signInWithPassword({email,password});
  if(error) return toast('Erro no login: '+error.message);
  cloudUser=data?.user || null;
  state.onboardingDone=true;
  state.entryMode='account';
  save();
  screen='home';
  toast('Login realizado.');
  render();
}
async function onboardingSignup(){
  if(!supabaseClient) return toast('Supabase não carregou. Reabra o app.');
  if(isOffline()) return toast('Você está offline. Crie a conta quando estiver online.');
  const info=readOnboardingProfile('signup');
  const msg=validateProfileInfo(info);
  if(msg) return showFormError('signupError', msg);
  const email=byId('signupEmail')?.value?.trim();
  const password=byId('signupPassword')?.value || '';
  if(!email || !email.includes('@')) return showFormError('signupError', 'Informe um e-mail válido.');
  if(!password || password.length < 6) return showFormError('signupError', 'A senha precisa ter pelo menos 6 caracteres.');
  applyProfileInfo(info);
  const { data, error } = await supabaseClient.auth.signUp({email,password, options:{data:{display_name:info.name}}});
  if(error) return showFormError('signupError', 'Erro ao criar conta: '+error.message);
  cloudUser=data?.user || null;
  state.onboardingDone=true;
  state.entryMode='account';
  save();
  if(cloudUser){ await upsertCloudProfile(info.name); await generateInitialPlanFromAI({silent:false}); }
  screen='home';
  toast(data?.session ? 'Conta criada e treino de adaptação preparado.' : 'Conta criada. Confirme seu e-mail para liberar IA e nuvem.');
  render();
}
async function onboardingLocal(){
  const info=readOnboardingProfile('local');
  const msg=validateProfileInfo(info);
  if(msg) return showFormError('localError', msg);
  applyProfileInfo(info);
  state.onboardingDone=true;
  state.entryMode='local';
  save();
  if(supabaseClient && !isOffline()){
    try{
      const { data, error } = await supabaseClient.auth.signInAnonymously({options:{data:{display_name:info.name, entry_mode:'local'}}});
      if(error) throw error;
      cloudUser=data?.user || null;
      await generateInitialPlanFromAI({silent:false});
      toast('Modo local ativado com IA e treino de adaptação.');
    }catch(e){
      toast('Modo local ativado. IA online precisa de login anônimo habilitado no Supabase.');
    }
  }else{
    toast('Modo local ativado. IA fica pausada enquanto estiver offline.');
  }
  screen='home';
  render();
}

function renderHome(){
  const p = profile(); const w=currentWorkout(p); const pct=Math.min(100, Math.round(p.progress/p.target*100));
  const cycles = Math.floor(p.progress/5);
  return `
    <section class="hero">
      <div class="hero-row">
        <div>
          <p class="eyebrow">Perfil ativo</p>
          <h2>${esc(p.name || 'Meu perfil')}</h2>
          <p>${esc(p.goal || 'Seu projeto de evolução em 100 treinos.')}</p>
          <div class="actions"><button class="btn" data-action="start-current">Iniciar ${w.id}</button><button class="btn secondary" data-screen-go="progress">Ver progresso</button></div>
        </div>
        <div class="progress-ring" style="--p:${pct}%"><div class="progress-ring-inner">${p.progress}/${p.target}<small>${pct}%</small></div></div>
      </div>
    </section>
    <section class="card plan-card">
      <div class="card-title"><div><h3>Plano atual</h3><p>${esc(p.planMeta?.title || 'Treino padrão')} • Ciclo ${p.planMeta?.cycle || Math.max(1, cycles+1)}</p></div><span class="badge ${p.planMeta?.source==='ai'?'green':'orange'}">${p.planMeta?.source==='ai'?'IA':'Padrão'}</span></div>
      <p class="muted">${esc(p.planMeta?.notes || 'Use os dados dos treinos para ajustar o próximo ciclo com IA.')}</p>
      <div class="actions"><button class="btn sm secondary" data-action="generate-initial-plan">Gerar/atualizar treino com IA</button><button class="btn sm ${p.progress>=5?'':'secondary'}" ${p.progress>=5?'':'disabled'} data-action="finish-cycle-ai">Finalizar ciclo e ajustar treino</button></div>
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
  <section class="card"><div class="card-title"><h3>Últimos treinos</h3></div>${p.history.slice(-8).reverse().map(h=>historyRowHTML(h)).join('') || '<div class="empty">Nenhum treino finalizado ainda.</div>'}</section>`;
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

function renderCoach(){
  const p=profile(); const insights=generateInsights(p); const aiOn=canUseOnlineAI(); const reports=p.history.filter(h=>h.aiReport || h.aiReportStatus || h.aiReportError).slice(-5).reverse();
  return `<section class="hero"><p class="eyebrow">Coach</p><h2>Análise inteligente</h2><p>${aiOn?'IA online pronta. Ao finalizar treino, o app pode gerar um relatório automático.':(isOffline()?'Você está offline. A análise local funciona, mas IA e nuvem ficam pausadas.':'Entre na conta ou use modo local para liberar a IA online.')}</p><div class="actions"><button class="btn secondary" data-screen-go="profile">Configurar IA</button></div></section>
  <section class="card"><div class="card-title"><h3>Status da IA</h3><span class="badge ${aiOn?'green':'yellow'}">${aiOn?'Online pronta':(isOffline()?'Offline':'Login necessário')}</span></div><p class="muted">Relatório automático ao finalizar treino: <strong>${p.ai?.autoWorkoutReport?'ativado':'desativado'}</strong></p></section>
  <section class="grid">${insights.map(i=>`<div class="alert ${i.type==='orange'?'orange':''}"><div>${i.icon}</div><div><strong>${esc(i.title)}</strong><p>${esc(i.text)}</p></div></div>`).join('')}</section>
  <section class="card"><div class="card-title"><h3>Últimos relatórios da IA</h3><p>Gerados ao finalizar treino</p></div>${reports.length?reports.map(h=>aiHistoryHTML(h)).join(''):'<div class="empty">Nenhum relatório de IA salvo ainda.</div>'}</section>`;
}
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

function aiHistoryHTML(h){
  const badge = h.aiReportStatus==='pending' ? '<span class="badge yellow">Gerando</span>' : h.aiReportError ? '<span class="badge red">Erro</span>' : '<span class="badge green">IA</span>';
  const body = h.aiReport ? `<div class="ai-report"><strong>${esc(h.aiReport.title||'Relatório da IA')}</strong><p>${esc(h.aiReport.summary||'')}</p>${h.aiReport.evolution?`<p><b>Evolução:</b> ${esc(h.aiReport.evolution)}</p>`:''}${h.aiReport.attention?`<p><b>Atenção:</b> ${esc(h.aiReport.attention)}</p>`:''}${h.aiReport.nextGoal?`<p><b>Próxima meta:</b> ${esc(h.aiReport.nextGoal)}</p>`:''}</div>` : h.aiReportError ? `<div class="ai-report error"><strong>Erro ao gerar IA</strong><p>${esc(h.aiReportError)}</p></div>` : '<div class="ai-report"><p>Relatório em processamento...</p></div>';
  return `<div class="history-row ai-row"><div><strong>${h.workoutId} — ${esc(h.workoutName)}</strong><span>${fmtDate(h.date)}</span>${body}</div>${badge}</div>`;
}
function historyRowHTML(h){
  const aiBadge = h.aiReport ? '<span class="badge green">IA</span>' : h.aiReportStatus==='pending' ? '<span class="badge yellow">IA...</span>' : h.aiReportError ? '<span class="badge red">IA erro</span>' : '';
  const report = h.aiReport ? `<div class="ai-report compact"><p>${esc(h.aiReport.summary||'Relatório salvo.')}</p>${h.aiReport.nextGoal?`<p><b>Meta:</b> ${esc(h.aiReport.nextGoal)}</p>`:''}</div>` : '';
  return `<div class="history-row"><div><strong>${h.workoutId} — ${esc(h.workoutName)}</strong><span>${fmtDate(h.date)} • ${h.doneCount} concluídos • ${h.skippedCount} pulados</span>${report}</div><div class="badge-stack"><span class="badge">${h.score}%</span>${aiBadge}</div></div>`;
}


function renderProfile(){ const p=profile(); const ai=p.ai||{}; return `<section class="card"><div class="card-title"><h3>Perfil</h3><p>Dados locais. Se entrar na conta, salva também na nuvem.</p></div><div class="form-grid">
  ${inputHTML('name','Nome',p.name)}${inputHTML('age','Idade',p.age,'number')}${inputHTML('height','Altura',p.height)}${inputHTML('weight','Peso inicial/atual',p.weight)}${inputHTML('goal','Objetivo',p.goal)}${inputHTML('focus','Foco',p.focus)}${inputHTML('experience','Experiência',p.experience)}${inputHTML('daysPerWeek','Dias por semana',p.daysPerWeek)}
  <div class="field" style="grid-column:1/-1"><label>Observações</label><textarea data-profile-field="notes">${esc(p.notes)}</textarea></div></div><div class="actions"><button class="btn" data-action="save-profile">Salvar perfil</button><button class="btn secondary" data-action="new-profile">Novo perfil</button><button class="btn secondary" data-action="backup">Exportar backup</button><button class="btn secondary" data-action="import-backup">Importar backup</button><input id="backupInput" type="file" accept="application/json" hidden></div></section>
  <section class="card"><div class="card-title"><div><h3>Conta e sincronização</h3><p>Sem login o app continua funcionando só neste aparelho. Com login, salva também no Supabase.</p></div>${cloudStatusHTML()}</div>${renderCloudAccount(p)}</section>
  <section class="card"><div class="card-title"><div><h3>IA online via Vercel</h3><p>Backend configurado no app. Para gerar relatório, o usuário precisa estar logado e online.</p></div><span class="badge green">Pronta</span></div><div class="form-grid">
    <label class="toggle-row" style="grid-column:1/-1"><input type="checkbox" data-ai-field="autoWorkoutReport" ${ai.autoWorkoutReport?'checked':''}> <span>Gerar relatório automaticamente ao finalizar treino</span></label>
  </div><div class="actions"><button class="btn" data-action="save-profile">Salvar configuração</button><button class="btn secondary" data-action="test-ai">Testar IA</button></div><p class="muted">Versão correta: não usa APP_TOKEN fixo no frontend. A Vercel valida o login Supabase antes de chamar a IA.</p></section>
  <section class="card"><div class="card-title"><h3>Perfis</h3><p>${state.profiles.length} perfil(is)</p></div><div class="profile-list">${state.profiles.map(x=>`<div class="profile-option"><div class="workout-left"><div class="avatar-dot">${esc((x.name||'?').charAt(0).toUpperCase())}</div><div><strong>${esc(x.name || 'Perfil')}</strong><div class="small">${x.progress}/${x.target} treinos</div></div></div><button class="btn sm ${x.id===state.activeProfileId?'green':'secondary'}" data-switch-profile="${x.id}">${x.id===state.activeProfileId?'Ativo':'Usar'}</button></div>`).join('')}</div></section>
  <section class="card"><div class="card-title"><h3>Zona perigosa</h3></div><button class="btn danger full" data-action="reset-profile">Resetar perfil ativo</button></section>`; }
function renderCloudAccount(p){
  const synced = p.history.filter(h=>h.cloudSynced).length;
  const pending = p.history.filter(h=>!h.cloudSynced).length;
  if(hasCloudAccount()){
    return `<div class="cloud-panel"><p><b>Conta:</b> ${esc(cloudUser.email||'usuário conectado')}</p><p class="muted">Histórico local: ${p.history.length} treino(s) • Na nuvem: ${synced} • Pendentes: ${pending}</p><div class="actions"><button class="btn" data-action="cloud-sync">Sincronizar histórico com a nuvem</button><button class="btn secondary" data-action="cloud-refresh">Atualizar status</button><button class="btn secondary" data-action="cloud-logout">Sair</button></div></div>`;
  }
  const upgradeForm = `<div class="form-grid"><div class="field" style="grid-column:1/-1"><label>Nome para criar conta</label><input class="input" id="cloudName" value="${esc(p.name||'')}"></div><div class="field"><label>E-mail</label><input class="input" id="cloudEmail" type="email" autocomplete="email" placeholder="seu@email.com"></div><div class="field"><label>Senha</label><input class="input" id="cloudPassword" type="password" autocomplete="current-password" placeholder="mínimo 6 caracteres"></div></div><div class="actions"><button class="btn" data-action="cloud-login">Entrar</button><button class="btn secondary" data-action="cloud-signup">Criar conta</button><button class="btn secondary" data-action="cloud-refresh">Atualizar status</button></div>`;
  if(isLocalMode()){
    return `<div class="cloud-panel"><p><b>Modo local ativo.</b></p><p class="muted">Seus treinos ficam neste aparelho. A IA online usa uma sessão anônima do Supabase quando houver internet. Para sincronizar na nuvem e recuperar em outro dispositivo, crie uma conta.</p><div class="actions"><button class="btn secondary" data-action="cloud-refresh">Atualizar IA/local</button></div></div><div class="divider"></div>${upgradeForm}`;
  }
  return `${upgradeForm}<p class="muted">Ao criar conta, talvez o Supabase peça confirmação por e-mail. O app sem login continua funcionando normalmente. Se estiver offline, o login e a nuvem ficam indisponíveis.</p>`;
}
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
  if(a==='test-ai') testAIConnection();
  if(a==='cloud-login') cloudLogin();
  if(a==='cloud-signup') cloudSignup();
  if(a==='cloud-logout') cloudLogout();
  if(a==='cloud-sync') syncLocalHistoryToCloud();
  if(a==='cloud-refresh') refreshLocalOrCloudStatus();
  if(a==='generate-initial-plan') generateInitialPlanFromAI({silent:false, force:true});
  if(a==='finish-cycle-ai') finishCycleAndGeneratePlan();
}


function saveProfileForm(){
  const p=profile();
  document.querySelectorAll('[data-profile-field]').forEach(f=>p[f.dataset.profileField]=f.value);
  document.querySelectorAll('[data-ai-field]').forEach(f=>{
    const k=f.dataset.aiField;
    if(k==='autoWorkoutReport') p.ai[k]=f.checked;
    else p.ai[k]=f.value.trim();
  });
  save(); toast('Perfil salvo.'); render();
}
function createProfileFlow(){ const name=prompt('Nome do novo perfil:'); if(!name) return; const p=newProfile(name); state.profiles.push(p); state.activeProfileId=p.id; save(); render(); toast('Perfil criado.'); }
function resetProfileFlow(){ const p=profile(); if(!confirm(`Resetar TODO o perfil ${p.name || 'Perfil'}? Isso apaga treinos, cargas, histórico, check-ins e bioimpedância.`)) return; const t=prompt('Digite RESETAR para confirmar:'); if(t!=='RESETAR') return toast('Reset cancelado.'); const fresh=newProfile(p.name); fresh.id=p.id; state.profiles[state.profiles.findIndex(x=>x.id===p.id)] = fresh; save(); render(); toast('Perfil resetado.'); }


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
function modalScrollTop(){ const m=document.querySelector('#modalLayer .modal'); return m ? m.scrollTop : 0; }
function restoreModalScroll(y){ requestAnimationFrame(()=>{ const m=document.querySelector('#modalLayer .modal'); if(m) m.scrollTop = y || 0; }); }
function refreshWorkoutKeepingScroll(){ const y=modalScrollTop(); openWorkout(activeModalWorkout); restoreModalScroll(y); }
function toggleDone(id){ const p=profile(); p.tempDone[id]=!p.tempDone[id]; if(p.tempDone[id]) p.tempStatus[id]='done'; else delete p.tempStatus[id]; save(); refreshWorkoutKeepingScroll(); }
function skipExercise(id){ const p=profile(); p.tempDone[id]=false; p.tempStatus[id]='skipped'; save(); refreshWorkoutKeepingScroll(); }
function closeModal(){ byId('modalLayer').classList.add('hidden'); byId('modalLayer').innerHTML=''; render(); }
function finalizeWorkout(id){ const p=profile(); if(p.queue[0]!==id) return toast(`Bloqueado. O próximo treino correto é ${p.queue[0]}.`); const w=workoutById(p,id); const doneCount=w.exercises.filter(e=>p.tempDone[e.id]).length; const skippedCount=w.exercises.filter(e=>p.tempStatus[e.id]==='skipped').length;
  if(!confirm(`Finalizar o treino ${id}?\n\nConcluídos: ${doneCount}\nPulados: ${skippedCount}`)) return;
  const weights={}, status={}, metaSnap={}; w.exercises.forEach(e=>{ if(p.weights[e.id]) weights[e.id]=p.weights[e.id]; if(p.tempStatus[e.id]) status[e.id]=p.tempStatus[e.id]; if(p.exerciseMeta[e.id]) metaSnap[e.id]={...p.exerciseMeta[e.id]}; });
  const score = Math.max(0, Math.round(((doneCount + skippedCount*.35) / w.exercises.length) * 100));
  const record = {id:'h_'+Date.now(), date:nowISO(), workoutId:id, workoutName:w.name, doneCount, skippedCount, score, weights, status, meta:metaSnap};
  if(aiConfigured(p) && p.ai.autoWorkoutReport && canUseOnlineAI()) record.aiReportStatus='pending';
  else if(p.ai.autoWorkoutReport && isOffline()) record.aiReportError='IA pausada: você estava offline.';
  else if(p.ai.autoWorkoutReport && !cloudUser) record.aiReportError='IA pausada: entre na conta para gerar relatório.';
  p.history.push(record);
  p.progress = Math.min(p.target, p.progress + 1); p.queue.push(p.queue.shift()); p.tempDone={}; p.tempStatus={};
  save(); closeModal(); toast(record.aiReportStatus==='pending' ? 'Treino finalizado. Gerando relatório com IA...' : (isOffline() ? 'Treino salvo offline neste aparelho.' : 'Treino finalizado com sucesso.'));
  if(record.aiReportStatus==='pending') generateWorkoutAIReport(p.id, record.id);
  else saveWorkoutToCloud(p, record, {silent:true});

}

function openProfileSwitcher(){ const layer=byId('modalLayer'); layer.innerHTML=`<div class="modal"><div class="modal-head"><div><p class="eyebrow">Perfil</p><h2>Quem está treinando?</h2></div><button class="close" data-close>×</button></div><div class="profile-list">${state.profiles.map(p=>`<div class="profile-option"><div class="workout-left"><div class="avatar-dot">${esc((p.name||'?').charAt(0).toUpperCase())}</div><div><strong>${esc(p.name || 'Perfil')}</strong><div class="small">${p.progress}/${p.target} treinos</div></div></div><button class="btn sm ${p.id===state.activeProfileId?'green':'secondary'}" data-modal-switch-profile="${p.id}">${p.id===state.activeProfileId?'Ativo':'Usar'}</button></div>`).join('')}</div><div class="actions"><button class="btn" data-modal-new-profile>Novo perfil</button></div></div>`; layer.classList.remove('hidden'); document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal); document.querySelectorAll('[data-modal-switch-profile]').forEach(b=>b.onclick=()=>{state.activeProfileId=b.dataset.modalSwitchProfile; save(); closeModal();}); document.querySelector('[data-modal-new-profile]').onclick=()=>{closeModal(); createProfileFlow();}; }

function openCheckinModal(){ const p=profile(), cycle=Math.floor(p.progress/5); const layer=byId('modalLayer'); layer.innerHTML=`<div class="modal"><div class="modal-head"><div><p class="eyebrow">Check-in</p><h2>Ciclo ${cycle}</h2><p class="muted">Tente usar sempre a mesma luz, pose e distância.</p></div><button class="close" data-close>×</button></div><div class="form-grid">${inputPlain('checkWeight','Peso do dia')} ${inputPlain('checkWaist','Cintura')}<div class="field" style="grid-column:1/-1"><label>Observação do ciclo</label><textarea id="checkNotes"></textarea></div></div><div class="photo-grid"><label class="photo-box"><span>Frente<br><small>toque para enviar</small></span><input type="file" accept="image/*" data-photo="front" hidden></label><label class="photo-box"><span>Lado<br><small>toque para enviar</small></span><input type="file" accept="image/*" data-photo="side" hidden></label><label class="photo-box"><span>Costas<br><small>toque para enviar</small></span><input type="file" accept="image/*" data-photo="back" hidden></label></div><div class="actions"><button class="btn" data-save-checkin>Salvar check-in</button><button class="btn secondary" data-close>Cancelar</button></div></div>`; layer.classList.remove('hidden'); const photos={}; document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal); document.querySelectorAll('[data-photo]').forEach(inp=>inp.onchange=async()=>{ const img=await compressImage(inp.files[0]); photos[inp.dataset.photo]=img; inp.parentElement.innerHTML=`<img src="${img}" alt="foto ${inp.dataset.photo}">`; }); document.querySelector('[data-save-checkin]').onclick=()=>{ p.checkins.push({id:'c_'+Date.now(), date:nowISO(), cycle, weight:byId('checkWeight').value, waist:byId('checkWaist').value, notes:byId('checkNotes').value, photos}); save(); closeModal(); toast('Check-in salvo.'); }; }
function inputPlain(id,label){ return `<div class="field"><label>${label}</label><input class="input" id="${id}"></div>`; }
function compressImage(file){ return new Promise((resolve,reject)=>{ if(!file) return resolve(''); const r=new FileReader(); r.onload=()=>{ const img=new Image(); img.onload=()=>{ const max=900, scale=Math.min(1,max/img.width); const c=document.createElement('canvas'); c.width=Math.round(img.width*scale); c.height=Math.round(img.height*scale); c.getContext('2d').drawImage(img,0,0,c.width,c.height); resolve(c.toDataURL('image/jpeg',.72)); }; img.onerror=reject; img.src=r.result; }; r.onerror=reject; r.readAsDataURL(file); }); }

function openBioModal(){ const p=profile(); const layer=byId('modalLayer'); layer.innerHTML=`<div class="modal"><div class="modal-head"><div><p class="eyebrow">Bioimpedância</p><h2>Inserir avaliação</h2><p class="muted">Você pode preencher manualmente ou tentar extrair texto de um PDF.</p></div><button class="close" data-close>×</button></div><div class="field"><label>PDF da bioimpedância opcional</label><input class="input" id="bioPdf" type="file" accept="application/pdf"></div><div class="actions"><button class="btn secondary" data-parse-pdf>Tentar ler PDF</button></div><div class="form-grid">${['date:Data','weight:Peso','height:Altura','imc:IMC','bodyFat:% gordura','fatMass:Massa gorda','leanMass:Massa magra','water:% água','visceral:Gordura visceral','metabolicAge:Idade metabólica','waist:Cintura','abdomen:Abdômen','hip:Quadril','arm:Braço','thigh:Coxa','calf:Panturrilha'].map(x=>{const [id,label]=x.split(':'); return `<div class="field"><label>${label}</label><input class="input" id="bio_${id}"></div>`}).join('')}<div class="field" style="grid-column:1/-1"><label>Observações</label><textarea id="bio_notes"></textarea></div></div><div class="actions"><button class="btn" data-save-bio>Salvar avaliação</button><button class="btn secondary" data-close>Cancelar</button></div></div>`; layer.classList.remove('hidden'); byId('bio_date').value = new Date().toISOString().slice(0,10); document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal); document.querySelector('[data-save-bio]').onclick=()=>{ const obj={id:'b_'+Date.now(), date:byId('bio_date').value?new Date(byId('bio_date').value).toISOString():nowISO()}; ['weight','height','imc','bodyFat','fatMass','leanMass','water','visceral','metabolicAge','waist','abdomen','hip','arm','thigh','calf'].forEach(k=>obj[k]=byId('bio_'+k)?.value || ''); obj.notes=byId('bio_notes')?.value || ''; p.bio.push(obj); save(); closeModal(); toast('Bioimpedância salva.');}; document.querySelector('[data-parse-pdf]').onclick=parseBioPdf; }
async function parseBioPdf(){ const file=byId('bioPdf').files[0]; if(!file) return toast('Selecione um PDF.'); if(!window.pdfjsLib) return toast('Leitor PDF indisponível. Preencha manualmente.'); try{ pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; const buf=await file.arrayBuffer(); const pdf=await pdfjsLib.getDocument({data:buf}).promise; let text=''; for(let i=1;i<=pdf.numPages;i++){ const page=await pdf.getPage(i); const content=await page.getTextContent(); text += ' ' + content.items.map(it=>it.str).join(' '); } fillBioFromText(text); toast('PDF lido. Confira os dados antes de salvar.'); }catch(e){ toast('Não consegui ler esse PDF. Preencha manualmente.'); } }
function fillBioFromText(t){ const get=(re)=>{const m=t.match(re); return m?m[1].replace(',', '.'):''}; const date=t.match(/Data[:\s]+(\d{2}\/\d{2}\/\d{4})/i); if(date){ const [d,m,y]=date[1].split('/'); byId('bio_date').value=`${y}-${m}-${d}`; } const map={ weight:/Peso\s+(\d+[,.]?\d*)\s*Kg/i, height:/Altura\s+(\d+[,.]?\d*)\s*m/i, imc:/IMC\s+(\d+[,.]?\d*)/i, fatMass:/Massa Gorda\s+(\d+[,.]?\d*)\s*Kg/i, bodyFat:/%\s*Massa Gorda\s+(\d+[,.]?\d*)%?/i, leanMass:/Massa Magra\s+(\d+[,.]?\d*)\s*Kg/i, water:/%\s*Água Corporal\s+(\d+[,.]?\d*)%?/i, visceral:/Gordura Visceral\s+(\d+[,.]?\d*)%?/i, metabolicAge:/Idade Metabólica\s+(\d+)/i, waist:/Cintura\s+(\d+[,.]?\d*)\s*cm/i, abdomen:/Abdômen\s+(\d+[,.]?\d*)\s*cm/i, hip:/Quadril\s+(\d+[,.]?\d*)\s*cm/i, calf:/Panturrilha direita\s+(\d+[,.]?\d*)\s*cm/i}; Object.entries(map).forEach(([k,re])=>{ const v=get(re); if(v && byId('bio_'+k)) byId('bio_'+k).value=v; }); }


function aiConfigured(p=profile()){
  return !!AI_BACKEND_URL;
}
function aiUrl(p=profile(), path=AI_ENDPOINT_PATH){
  const base=String(AI_BACKEND_URL||'').trim().replace(/\/+$/,'');
  if(!base) return '';
  if(base.endsWith(path)) return base;
  return base + path;
}
function buildWorkoutAIPayload(p, h){
  const w=workoutById(p,h.workoutId);
  const exerciseDetails=(w?.exercises||[]).map(e=>({
    id:e.id,
    name:e.name,
    type:e.type,
    target:e.target,
    status:h.status?.[e.id] || 'not_done',
    weight:h.weights?.[e.id] || '',
    meta:h.meta?.[e.id] || {}
  }));
  const previousSame=p.history.filter(x=>x.id!==h.id && x.workoutId===h.workoutId).slice(-3).map(x=>({date:x.date, score:x.score, weights:x.weights, status:x.status, meta:x.meta}));
  return {
    kind:'workout-report',
    profile:{name:p.name, age:p.age, height:p.height, weight:p.weight, goal:p.goal, focus:p.focus, notes:p.notes},
    workout:{id:h.workoutId, name:h.workoutName, date:h.date, score:h.score, doneCount:h.doneCount, skippedCount:h.skippedCount, exercises:exerciseDetails},
    previousSameWorkout:previousSame,
    latestBio:p.bio?.slice(-1)[0] || null,
    recentHistory:p.history.slice(-8).map(x=>({date:x.date, workoutId:x.workoutId, workoutName:x.workoutName, score:x.score, doneCount:x.doneCount, skippedCount:x.skippedCount}))
  };
}
async function generateWorkoutAIReport(profileId, historyId){
  const p=ensureProfile(state.profiles.find(x=>x.id===profileId));
  if(!p) return;
  const h=p.history.find(x=>x.id===historyId);
  if(!h) return;
  try{
    if(isOffline()) throw new Error('Você está offline.');
    const accessToken = await getCloudAccessToken();
    if(!accessToken) throw new Error('Entre na conta para usar a IA online.');
    const response=await fetch(aiUrl(p),{
      method:'POST',
      headers:{'Content-Type':'application/json', 'Authorization': `Bearer ${accessToken}`},
      body:JSON.stringify(buildWorkoutAIPayload(p,h))
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.error || `Erro HTTP ${response.status}`);
    h.aiReport=data.report || {title:'Relatório da IA', summary:data.text || 'Relatório gerado.'};
    h.aiReportStatus='done';
    h.aiReportError='';
    save(); await saveWorkoutToCloud(p, h, {silent:true}); render(); toast('Relatório da IA salvo.');
  }catch(err){
    h.aiReportStatus='error';
    h.aiReportError=err.message || 'Erro desconhecido';
    save(); await saveWorkoutToCloud(p, h, {silent:true}); render(); toast('Não consegui gerar o relatório da IA.');
  }
}


async function refreshLocalOrCloudStatus(){
  await refreshCloudUser(false);
  if(isLocalMode() && !cloudUser && supabaseClient && !isOffline()){
    try{
      const p=profile();
      const { data, error } = await supabaseClient.auth.signInAnonymously({options:{data:{display_name:p.name||'Usuário', entry_mode:'local'}}});
      if(error) throw error;
      cloudUser=data?.user || null;
    }catch(e){}
  }
  render();
  toast(cloudUser ? (isLocalMode()?'Modo local com IA pronto.':'Conta conectada.') : 'Sem sessão online ativa.');
}

async function cloudLogin(){
  if(!supabaseClient) return toast('Supabase não carregou. Reabra o app.');
  const email=byId('cloudEmail')?.value?.trim();
  const password=byId('cloudPassword')?.value || '';
  if(!email || !password) return toast('Informe e-mail e senha.');
  const { data, error } = await supabaseClient.auth.signInWithPassword({email,password});
  if(error) return toast('Erro no login: '+error.message);
  cloudUser=data?.user || null;
  state.onboardingDone=true; state.entryMode='account'; save();
  toast('Login realizado.'); render();
}
async function cloudSignup(){
  if(!supabaseClient) return toast('Supabase não carregou. Reabra o app.');
  const p=profile();
  const name=byId('cloudName')?.value?.trim() || p.name || 'Usuário';
  const email=byId('cloudEmail')?.value?.trim();
  const password=byId('cloudPassword')?.value || '';
  if(!email || !email.includes('@')) return toast('Informe um e-mail válido.');
  if(!password || password.length < 6) return toast('A senha precisa ter pelo menos 6 caracteres.');
  p.name=name; ensureProfile(p); save();
  const { data, error } = await supabaseClient.auth.signUp({email,password, options:{data:{display_name:name}}});
  if(error) return toast('Erro ao criar conta: '+error.message);
  cloudUser=data?.user || null;
  state.onboardingDone=true; state.entryMode='account'; save();
  if(cloudUser){ await upsertCloudProfile(name); toast('Conta criada e conectada.'); }
  else toast('Conta criada. Verifique seu e-mail para confirmar.');
  render();
}
async function cloudLogout(){
  if(!supabaseClient) return;
  await supabaseClient.auth.signOut();
  cloudUser=null;
  toast('Você saiu da conta.'); render();
}
async function upsertCloudProfile(name){
  const user=await getCurrentCloudUser();
  if(!user) return;
  const p=profile();
  await supabaseClient.from('profiles').upsert({id:user.id, name:name || p.name || 'Usuário', age:parseNumberValue(p.age), height:parseNumberValue(p.height), initial_weight:parseNumberValue(p.weight), goal:p.goal || null, focus:p.focus || null, notes:p.notes || null, experience:p.experience || null, days_per_week:parseNumberValue(p.daysPerWeek)});
}
function reportToText(report){
  if(!report) return '';
  if(typeof report==='string') return report;
  const parts=[];
  if(report.title) parts.push(report.title);
  if(report.summary) parts.push(report.summary);
  if(report.evolution) parts.push('Evolução: '+report.evolution);
  if(report.attention) parts.push('Atenção: '+report.attention);
  if(report.nextGoal) parts.push('Próxima meta: '+report.nextGoal);
  return parts.join('\n\n') || JSON.stringify(report);
}
function parseNumberValue(v){
  if(v===undefined || v===null || v==='') return null;
  const n=parseFloat(String(v).replace(',', '.').replace(/[^0-9.\-]/g,''));
  return Number.isFinite(n) ? n : null;
}
async function saveWorkoutToCloud(p, h, opts={}){
  if(!supabaseClient) return {ok:false, reason:'supabase_not_ready'};
  const user=await getCurrentCloudUser();
  if(!user) return {ok:false, reason:'not_logged_in'};
  if(isLocalMode() || isAnonymousCloudUser()) return {ok:false, reason:'local_mode'};
  try{
    await upsertCloudProfile(p.name);
    let cloudId=h.cloudWorkoutId || null;
    if(!cloudId){
      const { data: existing } = await supabaseClient.from('workout_logs').select('id').eq('user_id', user.id).eq('local_id', h.id).maybeSingle();
      cloudId = existing?.id || null;
    }
    if(!cloudId){
      const { data, error } = await supabaseClient.from('workout_logs').insert({
        user_id:user.id,
        workout_key:h.workoutId || '',
        workout_name:h.workoutName || '',
        cycle_number:Math.floor((p.progress||0)/5),
        finished_at:h.date || nowISO(),
        notes:h.notes || null,
        local_id:h.id || null
      }).select().single();
      if(error) throw error;
      cloudId=data.id;
      h.cloudWorkoutId=cloudId;
      const w=workoutById(p,h.workoutId);
      const rows=(w?.exercises||[]).map(e=>({
        workout_log_id:cloudId,
        user_id:user.id,
        exercise_name:e.name || '',
        exercise_type:e.type || null,
        weight:parseNumberValue(h.weights?.[e.id]),
        reps:parseNumberValue(h.meta?.[e.id]?.reps),
        sets:parseNumberValue(h.meta?.[e.id]?.sets),
        difficulty:h.meta?.[e.id]?.difficulty || null,
        pain:h.meta?.[e.id]?.pain || null,
        notes:h.meta?.[e.id]?.notes || null,
        skipped:h.status?.[e.id]==='skipped',
        completed:h.status?.[e.id]==='done'
      }));
      if(rows.length){
        const { error: exError } = await supabaseClient.from('exercise_logs').insert(rows);
        if(exError) console.warn('Erro ao salvar exercícios:', exError);
      }
    }
    h.cloudSynced=true;
    const reportText=reportToText(h.aiReport);
    if(reportText && !h.cloudReportSynced){
      const { error: repError } = await supabaseClient.from('ai_reports').insert({
        user_id:user.id,
        workout_log_id:cloudId,
        report_type:'workout',
        report_text:reportText,
        provider:'gemini',
        model:'gemini-3.5-flash-lite'
      });
      if(!repError) h.cloudReportSynced=true;
      else console.warn('Erro ao salvar relatório IA:', repError);
    }
    save();
    if(!opts.silent) toast('Treino salvo na nuvem.');
    return {ok:true, id:cloudId};
  }catch(e){
    console.error('Erro Supabase:', e);
    if(!opts.silent) toast('Erro ao salvar na nuvem: '+(e.message||'erro'));
    return {ok:false, error:e};
  }
}
async function syncLocalHistoryToCloud(){
  const p=profile();
  const user=await getCurrentCloudUser();
  if(!user || !hasCloudAccount()) return toast('Crie uma conta ou entre para sincronizar na nuvem.');
  let sent=0, skipped=0, failed=0;
  for(const h of p.history){
    if(h.cloudSynced && (!h.aiReport || h.cloudReportSynced)){ skipped++; continue; }
    const result=await saveWorkoutToCloud(p,h,{silent:true});
    if(result.ok) sent++; else failed++;
  }
  save(); render();
  toast(`Sincronização: ${sent} enviado(s), ${skipped} já estavam, ${failed} falha(s).`);
}
async function testAIConnection(){
  saveProfileForm();
  const p=profile();
  if(!aiConfigured(p)) return toast('Backend da IA não configurado.');
  if(isOffline()) return toast('Você está offline. IA indisponível agora.');
  const accessToken = await getCloudAccessToken();
  if(!accessToken) return toast('Entre na conta ou use modo local para testar a IA.');
  try{
    const response=await fetch(aiUrl(p),{
      method:'POST',
      headers:{'Content-Type':'application/json', 'Authorization': `Bearer ${accessToken}`},
      body:JSON.stringify({kind:'health-check', profile:{name:p.name, goal:p.goal}, workout:{id:'TESTE', name:'Teste'}, previousSameWorkout:[]})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.error || `Erro HTTP ${response.status}`);
    toast('IA respondeu com sucesso.');
  }catch(err){
    toast('Teste falhou: '+(err.message||'erro'));
  }
}


function buildPlanAIPayload(mode='initial', extra={}){
  const p=profile();
  return {
    kind:'workout-plan',
    mode,
    cycleChangeRequest: extra.cycleChangeRequest || '',
    profile:{name:p.name, age:p.age, height:p.height, weight:p.weight, goal:p.goal, focus:p.focus, experience:p.experience, daysPerWeek:p.daysPerWeek, notes:p.notes},
    currentPlan:{title:p.planMeta?.title, cycle:p.planMeta?.cycle, workouts:p.workouts},
    progress:{completedWorkouts:p.progress, target:p.target, cycle:Math.max(1, Math.floor((p.progress||0)/5)+1)},
    recentHistory:p.history.slice(-12).map(h=>({date:h.date, workoutId:h.workoutId, workoutName:h.workoutName, score:h.score, doneCount:h.doneCount, skippedCount:h.skippedCount, weights:h.weights, status:h.status, meta:h.meta, aiReport:h.aiReport}))
  };
}
function normalizeAIPlan(plan, mode='initial'){
  const list = Array.isArray(plan?.workouts) ? plan.workouts : [];
  const ids = ['A','B','C','D','E'];
  const workouts = ids.map((id, idx)=>{
    const source = list.find(w=>String(w.id||'').toUpperCase()===id) || list[idx] || null;
    const exs = Array.isArray(source?.exercises) ? source.exercises : [];
    return {
      id,
      name: String(source?.name || DEFAULT_WORKOUTS[idx]?.name || `Treino ${id}`),
      focus: String(source?.focus || source?.description || DEFAULT_WORKOUTS[idx]?.focus || ''),
      exercises: exs.slice(0,12).map((item, n)=>({
        id: `${id.toLowerCase()}_ai_${Date.now()}_${n}`,
        name: String(item?.name || item?.exercise || `Exercício ${n+1}`),
        type: String(item?.type || item?.equipment || 'personalizado'),
        target: String(item?.target || item?.setsReps || item?.reps || '3x10-12')
      })).filter(e=>e.name.trim())
    };
  });
  workouts.forEach((w, i)=>{ if(!w.exercises.length) w.exercises = structuredClone(DEFAULT_WORKOUTS[i].exercises); });
  return {
    title: String(plan?.title || (mode==='cycle' ? 'Ciclo ajustado pela IA' : 'Treino de adaptação com IA')),
    notes: String(plan?.notes || plan?.explanation || ''),
    workouts
  };
}
function applyAIPlan(plan, mode='initial'){
  const p=profile();
  const normalized=normalizeAIPlan(plan, mode);
  p.workouts=normalized.workouts;
  p.queue=normalized.workouts.map(w=>w.id);
  p.tempDone={};
  p.tempStatus={};
  p.planMeta={source:'ai', cycle: mode==='cycle' ? (p.planMeta?.cycle||1)+1 : (p.planMeta?.cycle||1), title:normalized.title, notes:normalized.notes, updatedAt:nowISO()};
  save();
}
async function callPlanAI(mode='initial', extra={}){
  if(isOffline()) throw new Error('Você está offline. A IA não consegue gerar treino agora.');
  const accessToken=await getCloudAccessToken();
  if(!accessToken) throw new Error('Entre na conta ou use modo local para gerar treino com IA.');
  const response=await fetch(aiUrl(profile(), AI_PLAN_ENDPOINT_PATH),{
    method:'POST',
    headers:{'Content-Type':'application/json', 'Authorization': `Bearer ${accessToken}`},
    body:JSON.stringify(buildPlanAIPayload(mode, extra))
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error || `Erro HTTP ${response.status}`);
  return data.plan || data;
}
async function generateInitialPlanFromAI(opts={}){
  const p=profile();
  if(!opts.force && p.planMeta?.source==='ai') return;
  try{
    if(!opts.silent) toast('Gerando treino de adaptação com IA...');
    const plan=await callPlanAI('initial');
    applyAIPlan(plan, 'initial');
    render();
    if(!opts.silent) toast('Treino de adaptação criado pela IA.');
  }catch(e){
    console.warn('Plano IA falhou:', e);
    if(!opts.silent) toast('Não consegui gerar o treino com IA. Mantive o treino padrão.');
  }
}
function askCycleChangeRequest(){
  return new Promise((resolve)=>{
    const layer=byId('modalLayer');
    layer.innerHTML=`<div class="modal"><div class="modal-head"><div><p class="eyebrow">Próximo ciclo</p><h2>O que você quer mudar?</h2><p class="muted">Escreva pedidos para a IA considerar no ajuste do próximo ciclo. É opcional.</p></div><button class="close" data-cycle-cancel>×</button></div>
      <div class="card subtle-card"><p class="small">Exemplos: quero focar mais em braço, achei perna muito pesado, quero treinos mais curtos, trocar exercício que dói o ombro, evitar agachamento livre.</p></div>
      <div class="field"><label>Pedido para o próximo ciclo</label><textarea id="cycleChangeRequest" placeholder="Ex: quero focar mais em peito e braço, reduzir exercícios que forçam o ombro e deixar o treino em até 60 minutos."></textarea></div>
      <div class="actions"><button class="btn" data-cycle-generate>Gerar próximo ciclo</button><button class="btn secondary" data-cycle-skip>Gerar sem pedir mudanças</button><button class="btn secondary" data-cycle-cancel>Cancelar</button></div>
    </div>`;
    layer.classList.remove('hidden');
    const finish=(value)=>{ layer.classList.add('hidden'); layer.innerHTML=''; resolve(value); };
    document.querySelectorAll('[data-cycle-cancel]').forEach(b=>b.onclick=()=>finish(null));
    document.querySelector('[data-cycle-skip]').onclick=()=>finish('');
    document.querySelector('[data-cycle-generate]').onclick=()=>finish((byId('cycleChangeRequest')?.value || '').trim());
  });
}
async function finishCycleAndGeneratePlan(){
  const p=profile();
  if(p.progress < 5) return toast('Complete pelo menos 1 ciclo antes de ajustar com IA.');
  const cycleChangeRequest = await askCycleChangeRequest();
  if(cycleChangeRequest === null) return;
  try{
    toast('Analisando ciclo e gerando próximo treino...');
    const plan=await callPlanAI('cycle', { cycleChangeRequest });
    applyAIPlan(plan, 'cycle');
    p.planMeta.lastCycleRequest = cycleChangeRequest || '';
    screen='workouts';
    save();
    render();
    toast('Novo ciclo gerado pela IA. Revise antes de treinar.');
  }catch(e){
    toast('Não consegui ajustar o ciclo: '+(e.message||'erro'));
  }
}

function exportBackup(){ state.lastBackupAt=nowISO(); save(); const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`treino100-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href); }
document.addEventListener('change', e=>{ if(e.target?.id==='backupInput'){ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ try{ const data=JSON.parse(r.result); if(!data.profiles) throw new Error(); if(confirm('Importar backup e substituir dados atuais?')){ state=data; save(); render(); toast('Backup importado.'); } }catch{ toast('Backup inválido.'); }}; r.readAsText(f); }});
function toast(msg){ const t=byId('toast'); t.textContent=msg; t.classList.remove('hidden'); clearTimeout(window.__toast); window.__toast=setTimeout(()=>t.classList.add('hidden'),2800); }

init();
