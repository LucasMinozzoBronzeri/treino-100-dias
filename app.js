const STORAGE_KEY = 'gymBronze.v579';
const APP_VERSION = '7.6.4';
const AI_ENDPOINT_PATH = '/api/workout-report';
const AI_PLAN_ENDPOINT_PATH = '/api/workout-plan';
const AI_DIET_ENDPOINT_PATH = '/api/diet-plan';
const DELETE_ACCOUNT_ENDPOINT_PATH = '/api/delete-account';
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

const WORKOUT_LETTERS = ['A','B','C','D','E','F'];
function clampTrainingDays(value){
  const n = parseInt(value, 10);
  if(!Number.isFinite(n)) return 5;
  return Math.max(2, Math.min(6, n));
}
function normalizeExperienceLabel(value){
  const v = String(value || '').toLowerCase();
  if(v.includes('avanç') || v.includes('avanc')) return 'Avançado';
  if(v.includes('inter')) return 'Intermediário';
  return 'Iniciante';
}
function programWeeksForExperience(exp){
  const level = normalizeExperienceLabel(exp);
  if(level === 'Iniciante') return 4;
  if(level === 'Intermediário') return 20;
  return 30;
}
function targetWorkoutsForProfile(p){
  const days = clampTrainingDays(p?.daysPerWeek || 5);
  return days * programWeeksForExperience(p?.experience || 'Iniciante');
}
function programLabelForProfile(p){
  const weeks = programWeeksForExperience(p?.experience || 'Iniciante');
  const target = targetWorkoutsForProfile(p);
  return `${weeks} semanas • ${target} treinos`;
}
function applyProgramDuration(p){
  if(!p) return;
  p.target = targetWorkoutsForProfile(p);
  p.programWeeks = programWeeksForExperience(p.experience);
  p.programLabel = programLabelForProfile(p);
}
function targetForExperience(exp, kind='default'){
  const level = normalizeExperienceLabel(exp);
  if(kind === 'cardio') return level === 'Iniciante' ? '10-20 min leve' : level === 'Intermediário' ? '15-25 min moderado' : '20-30 min moderado';
  if(kind === 'core') return level === 'Iniciante' ? '2-3x10-15' : level === 'Intermediário' ? '3x12-20' : '3-4x12-20';
  if(level === 'Iniciante') return '2-3x10-12';
  if(level === 'Intermediário') return '3-4x8-12';
  return '4x6-12';
}
function makeWorkout(id, name, focus, items, exp){
  return { id, name, focus, exercises: items.map((item, idx)=>{
    const arr = Array.isArray(item) ? item : [item, 'máquina'];
    const [name, type='máquina', kind='default'] = arr;
    return { id: `${id.toLowerCase()}_tpl_${idx+1}`, name, type, target: targetForExperience(exp, kind) };
  })};
}
function templateForProfile(sourceProfile=null){
  const p = sourceProfile || profile();
  const days = clampTrainingDays(p?.daysPerWeek || 5);
  const exp = normalizeExperienceLabel(p?.experience || 'Iniciante');
  const beginner = exp === 'Iniciante';
  const cardio = ['Cardio leve/moderado','cardio','cardio'];
  const core = ['Abdominal máquina ou prancha','core','core'];
  const sexText = String(p?.sex || '').toLowerCase();
  const isWoman = sexText.includes('mulher') || sexText.includes('femin');
  let workouts = [];

  if(isWoman){
    if(days === 2){
      workouts = [
        makeWorkout('A','A - Full body com ênfase em glúteos','Corpo inteiro + glúteos', beginner ? [
          ['Leg press 45°','máquina'], ['Elevação pélvica','máquina/barra'], ['Puxada frontal','máquina'], ['Cadeira extensora','máquina'], ['Mesa flexora','máquina'], ['Cadeira abdutora','máquina'], core
        ] : [
          ['Agachamento hack ou livre','máquina/barra'], ['Elevação pélvica','máquina/barra'], ['Remada baixa','máquina'], ['Stiff com halteres','halter'], ['Cadeira extensora','máquina'], ['Cadeira abdutora','máquina'], core
        ], exp),
        makeWorkout('B','B - Superiores e posterior','Costas, braços e posterior', beginner ? [
          ['Mesa flexora','máquina'], ['Leg press pés altos','máquina'], ['Puxada frontal','máquina'], ['Supino máquina ou halter','máquina/halter'], ['Desenvolvimento máquina','máquina'], ['Tríceps corda','cabo'], cardio
        ] : [
          ['Stiff ou levantamento romeno','halter/barra'], ['Flexora sentada ou mesa flexora','máquina'], ['Puxada frente','máquina'], ['Remada unilateral','halter/máquina'], ['Desenvolvimento','halter/máquina'], ['Tríceps na polia','cabo'], cardio
        ], exp)
      ];
    } else if(days === 3){
      workouts = [
        makeWorkout('A','A - Glúteos e posteriores','Glúteos/posterior', beginner ? [
          ['Elevação pélvica','máquina/barra'], ['Mesa flexora','máquina'], ['Stiff com halteres','halter'], ['Cadeira abdutora','máquina'], ['Coice no cabo','cabo'], core
        ] : [
          ['Elevação pélvica','máquina/barra'], ['Stiff ou romeno','halter/barra'], ['Mesa flexora','máquina'], ['Afundo ou passada','halter'], ['Cadeira abdutora','máquina'], ['Coice no cabo','cabo'], core
        ], exp),
        makeWorkout('B','B - Costas, bíceps e ombros','Superiores', [['Puxada frontal','máquina'], ['Remada baixa','máquina'], ['Remada unilateral','halter/máquina'], ['Elevação lateral','halter/cabo'], ['Rosca direta','barra/cabo'], ['Rosca martelo','halter'], cardio], exp),
        makeWorkout('C','C - Quadríceps e glúteos','Quadríceps/glúteos', beginner ? [
          ['Agachamento hack','máquina'], ['Leg press 45°','máquina'], ['Cadeira extensora','máquina'], ['Cadeira abdutora','máquina'], ['Panturrilha sentado','máquina'], core
        ] : [
          ['Agachamento hack ou livre','máquina/barra'], ['Leg press 45°','máquina'], ['Cadeira extensora','máquina'], ['Afundo ou passada','halter'], ['Cadeira abdutora','máquina'], ['Panturrilha','máquina'], core
        ], exp)
      ];
    } else if(days === 4){
      workouts = [
        makeWorkout('A','A - Glúteos e posteriores','Glúteos/posterior', [['Elevação pélvica','máquina/barra'], ['Stiff com halteres','halter'], ['Mesa flexora','máquina'], ['Cadeira abdutora','máquina'], ['Coice no cabo','cabo'], core], exp),
        makeWorkout('B','B - Costas e bíceps','Superiores puxada', [['Puxada frontal','máquina'], ['Remada baixa','máquina'], ['Remada unilateral','halter/máquina'], ['Peck fly inverso','máquina'], ['Rosca direta','barra/cabo'], ['Rosca martelo','halter']], exp),
        makeWorkout('C','C - Quadríceps e glúteos','Quadríceps/glúteos', [['Agachamento hack','máquina'], ['Leg press 45°','máquina'], ['Cadeira extensora','máquina'], ['Afundo ou passada','halter'], ['Cadeira abdutora','máquina'], ['Panturrilha','máquina'], core], exp),
        makeWorkout('D','D - Peito, ombros e tríceps','Superiores empurrar', [['Supino com halteres ou máquina','halter/máquina'], ['Desenvolvimento de ombros','halter/máquina'], ['Elevação lateral','halter/cabo'], ['Peck fly','máquina'], ['Tríceps na polia','cabo'], ['Tríceps francês','halter/cabo'], cardio], exp)
      ];
    } else if(days === 5){
      workouts = [
        makeWorkout('A','A - Glúteos e posteriores','Glúteos/posterior', [['Elevação pélvica','máquina/barra'], ['Mesa flexora','máquina'], ['Stiff com halteres','halter'], ['Cadeira abdutora','máquina'], ['Coice no cabo','cabo'], core], exp),
        makeWorkout('B','B - Costas e bíceps','Costas/bíceps', [['Puxada frontal','máquina'], ['Remada baixa','máquina'], ['Remada unilateral','halter/máquina'], ['Rosca direta','barra/cabo'], ['Rosca martelo','halter'], ['Peck fly inverso','máquina']], exp),
        makeWorkout('C','C - Quadríceps e glúteos','Quadríceps/glúteos', [['Agachamento hack','máquina'], ['Leg press 45°','máquina'], ['Cadeira extensora','máquina'], ['Afundo ou passada','halter'], ['Cadeira abdutora','máquina'], ['Panturrilha','máquina'], core], exp),
        makeWorkout('D','D - Peito, ombros e tríceps','Peito/ombros/tríceps', [['Supino com halteres ou máquina','halter/máquina'], ['Desenvolvimento de ombros','halter/máquina'], ['Elevação lateral','halter/cabo'], ['Peck fly','máquina'], ['Tríceps na polia','cabo'], ['Tríceps francês','halter/cabo']], exp),
        makeWorkout('E','E - Glúteos e pernas','Glúteos/pernas completo', [['Elevação pélvica','máquina/barra'], ['Agachamento búlgaro','halter'], ['Stiff com halteres','halter'], ['Mesa flexora','máquina'], ['Cadeira abdutora','máquina'], ['Panturrilha','máquina'], cardio], exp)
      ];
    } else {
      workouts = [
        makeWorkout('A','A - Glúteos e posteriores','Glúteos/posterior', [['Elevação pélvica','máquina/barra'], ['Mesa flexora','máquina'], ['Stiff com halteres','halter'], ['Cadeira abdutora','máquina'], ['Coice no cabo','cabo'], core], exp),
        makeWorkout('B','B - Costas e bíceps','Costas/bíceps', [['Puxada frontal','máquina'], ['Remada baixa','máquina'], ['Remada unilateral','halter/máquina'], ['Peck fly inverso','máquina'], ['Rosca direta','barra/cabo'], ['Rosca martelo','halter']], exp),
        makeWorkout('C','C - Quadríceps e glúteos','Quadríceps/glúteos', [['Agachamento hack','máquina'], ['Leg press 45°','máquina'], ['Cadeira extensora','máquina'], ['Afundo ou passada','halter'], ['Cadeira abdutora','máquina'], core], exp),
        makeWorkout('D','D - Peito, ombros e tríceps','Peito/ombros/tríceps', [['Supino com halteres ou máquina','halter/máquina'], ['Desenvolvimento','halter/máquina'], ['Elevação lateral','halter/cabo'], ['Peck fly','máquina'], ['Tríceps polia','cabo'], ['Tríceps francês','halter/cabo']], exp),
        makeWorkout('E','E - Posteriores e glúteos','Posterior/glúteos', [['Stiff ou romeno','halter/barra'], ['Flexora sentada ou mesa','máquina'], ['Elevação pélvica unilateral ou máquina','máquina'], ['Cadeira abdutora','máquina'], ['Coice no cabo','cabo'], ['Panturrilha','máquina']], exp),
        makeWorkout('F','F - Pernas completo','Pernas geral', [['Leg press 45°','máquina'], ['Agachamento hack','máquina'], ['Cadeira extensora','máquina'], ['Mesa flexora','máquina'], ['Afundo caminhando','halter'], ['Panturrilha','máquina'], cardio], exp)
      ];
    }
  } else if(days === 2){
    workouts = [
      makeWorkout('A','A - Full body A','Corpo inteiro', beginner ? [
        ['Leg press 45°','máquina'], ['Supino máquina ou halter','máquina/halter'], ['Pulley frente','máquina'], ['Cadeira extensora','máquina'], ['Rosca direta no cabo','cabo'], ['Tríceps corda','cabo'], core
      ] : [
        ['Agachamento hack ou leg press','máquina'], ['Supino reto','halter/máquina'], ['Remada baixa','máquina'], ['Stiff com halter','halter'], ['Elevação lateral','halter'], ['Rosca direta','barra/cabo'], core
      ], exp),
      makeWorkout('B','B - Full body B','Corpo inteiro', beginner ? [
        ['Cadeira flexora','máquina'], ['Supino inclinado máquina ou halter','máquina/halter'], ['Remada baixa','máquina'], ['Cadeira abdutora','máquina'], ['Desenvolvimento máquina','máquina'], ['Panturrilha sentado','máquina'], cardio
      ] : [
        ['Stiff ou mesa flexora','halter/máquina'], ['Supino inclinado','halter/máquina'], ['Pulley pegada neutra','máquina'], ['Cadeira extensora','máquina'], ['Desenvolvimento','halter/máquina'], ['Tríceps no crossover','cabo'], cardio
      ], exp)
    ];
  } else if(days === 3){
    workouts = beginner ? [
      makeWorkout('A','A - Full body A','Base e técnica', [['Leg press 45°','máquina'], ['Supino máquina','máquina'], ['Pulley frente','máquina'], ['Cadeira extensora','máquina'], ['Rosca direta cabo','cabo'], core], exp),
      makeWorkout('B','B - Full body B','Posterior e costas', [['Mesa flexora','máquina'], ['Remada baixa','máquina'], ['Supino inclinado halter','halter'], ['Cadeira abdutora','máquina'], ['Tríceps corda','cabo'], cardio], exp),
      makeWorkout('C','C - Full body C','Reforço geral', [['Agachamento hack','máquina'], ['Pulley neutro','máquina'], ['Peck fly','máquina'], ['Panturrilha sentado','máquina'], ['Elevação lateral','halter'], core], exp)
    ] : [
      makeWorkout('A','A - Push','Peito, ombro e tríceps', [['Supino inclinado','halter/máquina'], ['Supino reto','halter/máquina'], ['Peck fly','máquina'], ['Desenvolvimento','halter/máquina'], ['Elevação lateral','halter'], ['Tríceps corda','cabo']], exp),
      makeWorkout('B','B - Pull','Costas e bíceps', [['Pulley frente','máquina'], ['Remada baixa','máquina'], ['Remada unilateral','halter/máquina'], ['Peck fly inverso','máquina'], ['Rosca direta','barra/cabo'], ['Rosca martelo','halter']], exp),
      makeWorkout('C','C - Legs','Pernas e core', [['Leg press 45°','máquina'], ['Agachamento hack','máquina'], ['Cadeira extensora','máquina'], ['Mesa flexora','máquina'], ['Panturrilha','máquina'], core, cardio], exp)
    ];
  } else if(days === 4){
    workouts = [
      makeWorkout('A','A - Upper A','Parte superior', [['Supino inclinado','halter/máquina'], ['Supino reto','halter/máquina'], ['Pulley frente','máquina'], ['Remada baixa','máquina'], ['Elevação lateral','halter'], ['Tríceps corda','cabo'], ['Rosca direta','barra/cabo']], exp),
      makeWorkout('B','B - Lower A','Quadríceps e panturrilha', [['Agachamento hack','máquina'], ['Leg press 45°','máquina'], ['Cadeira extensora','máquina'], ['Cadeira flexora','máquina'], ['Panturrilha sentado','máquina'], core], exp),
      makeWorkout('C','C - Upper B','Costas, ombro e braços', [['Pulley neutro/supinado','máquina'], ['Remada unilateral','halter/máquina'], ['Peck fly','máquina'], ['Peck fly inverso','máquina'], ['Desenvolvimento','halter/máquina'], ['Rosca martelo','halter'], ['Tríceps máquina/cabo','máquina/cabo']], exp),
      makeWorkout('D','D - Lower B','Posterior e glúteo', [['Stiff','halter/barra'], ['Mesa flexora','máquina'], ['Leg press unilateral ou bilateral','máquina'], ['Cadeira abdutora','máquina'], ['Panturrilha','máquina'], core, cardio], exp)
    ];
  } else if(days === 5){
    workouts = [
      makeWorkout('A','A - Peito e Bíceps','Parte superior', [['Supino inclinado com halter','halter'], ['Supino deitado/reto','halter/máquina'], ['Peck fly','máquina'], ['Rosca direta','barra/cabo'], ['Rosca martelo','halter'], ['Rosca Scott/máquina ou cabo','máquina/cabo'], core, cardio], exp),
      makeWorkout('B','B - Quadríceps','Perna', [['Agachamento hack','máquina'], ['Leg press 45°','máquina'], ['Cadeira extensora','máquina'], ['Cadeira flexora','máquina'], ['Cadeira abdutora','máquina'], ['Panturrilha sentado','máquina']], exp),
      makeWorkout('C','C - Costas e Tríceps','Parte superior', [['Pulley frente pegada aberta','máquina'], ['Pulley frente pegada supinada/neutra','máquina'], ['Remada baixa com triângulo','máquina'], ['Remada unilateral ou com apoio no peito','halter/máquina'], ['Peck fly inverso','máquina'], ['Tríceps barra no crossover','cabo'], ['Tríceps máquina/corda/francês','máquina/cabo'], core, cardio], exp),
      makeWorkout('D','D - Ombro e braços','Ombro e braços', [['Desenvolvimento com halter ou máquina','halter/máquina'], ['Elevação lateral com halter','halter'], ['Elevação lateral na polia ou máquina','máquina/cabo'], ['Face pull ou peck fly inverso','máquina/cabo'], ['Rosca extra Scott/cabo','máquina/cabo'], ['Tríceps extra corda/francês','máquina/cabo'], core], exp),
      makeWorkout('E','E - Posterior e pernas','Posterior', [['Stiff com halter ou barra','halter/barra'], ['Mesa flexora','máquina'], ['Flexora em pé unilateral','máquina'], ['Leg press unilateral ou bilateral','máquina'], ['Cadeira abdutora','máquina'], ['Panturrilha','máquina'], core], exp)
    ];
  } else {
    workouts = [
      makeWorkout('A','A - Push A','Peito, ombro e tríceps', [['Supino inclinado','halter/máquina'], ['Supino reto','halter/máquina'], ['Peck fly','máquina'], ['Desenvolvimento','halter/máquina'], ['Elevação lateral','halter'], ['Tríceps corda','cabo']], exp),
      makeWorkout('B','B - Pull A','Costas e bíceps', [['Pulley frente','máquina'], ['Remada baixa','máquina'], ['Remada unilateral','halter/máquina'], ['Peck fly inverso','máquina'], ['Rosca direta','barra/cabo'], ['Rosca martelo','halter']], exp),
      makeWorkout('C','C - Legs A','Quadríceps', [['Agachamento hack','máquina'], ['Leg press 45°','máquina'], ['Cadeira extensora','máquina'], ['Cadeira flexora','máquina'], ['Panturrilha sentado','máquina'], core], exp),
      makeWorkout('D','D - Push B','Peito/ombro/tríceps variação', [['Supino máquina ou halter','máquina/halter'], ['Crucifixo ou peck fly','máquina/halter'], ['Desenvolvimento máquina','máquina'], ['Elevação lateral polia/máquina','máquina/cabo'], ['Tríceps barra','cabo'], ['Tríceps francês/corda','cabo']], exp),
      makeWorkout('E','E - Pull B','Costas/bíceps variação', [['Pulley neutro/supinado','máquina'], ['Remada com apoio no peito','máquina'], ['Pulldown ou remada alta','máquina/cabo'], ['Face pull','cabo'], ['Rosca Scott','máquina/cabo'], ['Rosca alternada','halter']], exp),
      makeWorkout('F','F - Legs B','Posterior e glúteo', [['Stiff','halter/barra'], ['Mesa flexora','máquina'], ['Flexora em pé unilateral','máquina'], ['Leg press unilateral','máquina'], ['Cadeira abdutora','máquina'], ['Panturrilha','máquina'], cardio], exp)
    ];
  }

  const title = `${days} dias • ${exp}${isWoman ? ' • feminino' : ''}`;
  return { title, workouts };
}
function applyDefaultPlanForProfile(p, force=false){
  if(!p) return;
  if(!force && p.planMeta?.source === 'ai') return;
  if(!force && Array.isArray(p.history) && p.history.length) return;
  applyProgramDuration(p);
  const plan = templateForProfile(p);
  p.workouts = structuredClone(plan.workouts);
  p.queue = p.workouts.map(w=>w.id);
  p.tempDone = {};
  p.tempStatus = {};
  p.tempTimes = {};
  p.activeWorkoutSession = null;
  p.planMeta = {source:'default', cycle:p.planMeta?.cycle || 1, title:`Treino padrão • ${plan.title}`, notes:'Treino padrão aplicado como fallback. Você pode manter este treino ou pedir um treino específico com IA.', updatedAt:nowISO(), needsDefaultChoice:true};
}
function workoutsPerCycle(p=profile()){
  const count = Array.isArray(p?.workouts) && p.workouts.length ? p.workouts.length : clampTrainingDays(p?.daysPerWeek || 5);
  return Math.max(1, count);
}
function currentCycleNumber(p=profile()){
  return Math.floor((p.progress||0) / workoutsPerCycle(p));
}


let state = migrateState(load());
let screen = 'home';
let activeModalWorkout = null;
let onboardingView = 'login';
let googleStep = 1;

function defaultState(){
  return { activeProfileId: null, profiles: [], version: 5, onboardingDone: false, entryMode: null, pendingEmailVerification: null, pendingProfileCompletion: null };
}
function newProfile(name='Novo perfil'){
  const p = {
    id: 'p_' + Date.now() + '_' + Math.random().toString(16).slice(2), name, sex:'', age:'', height:'', weight:'', goal:'', focus:'', notes:'', experience:'Iniciante', daysPerWeek:'5', dietPlan:null,
    queue: [], progress: 0, target: 20, workouts: [], programWeeks:4, programLabel:'4 semanas • 20 treinos', planMeta:{source:'pending', cycle:1, title:'Aguardando treino inteligente', notes:'Preencha o perfil e gere um treino específico antes de começar.'},
    weights:{}, exerciseMeta:{}, exerciseGoals:{}, tempDone:{}, tempStatus:{}, history:[], lessons:[], lessonLogs:[], pendingAcademy:[], checkins:[], bio:[], ai:{autoWorkoutReport:true}, createdAt: nowISO()
  };
  applyProgramDuration(p);
  return p;
}
function load(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultState(); } catch { return defaultState(); } }
function hasMeaningfulProfileData(p){
  if(!p) return false;
  return !!(String(p.name||'').trim() || String(p.goal||'').trim() || (p.history&&p.history.length) || (p.progress&&p.progress>0) || (p.checkins&&p.checkins.length) || (p.bio&&p.bio.length));
}
function migrateState(s){
  if(!s || !Array.isArray(s.profiles)) s = defaultState();
  if(!s.profiles.length){
    s.activeProfileId = null;
    s.onboardingDone = false;
    s.entryMode = null;
  } else if(!s.activeProfileId || !s.profiles.some(p=>p.id===s.activeProfileId)){
    s.activeProfileId = s.profiles[0].id;
  }
  if(typeof s.onboardingDone !== 'boolean') s.onboardingDone = s.profiles.some(hasMeaningfulProfileData);
  if(!('entryMode' in s)) s.entryMode = s.onboardingDone ? 'local' : null;
  if(!('pendingEmailVerification' in s)) s.pendingEmailVerification = null;
  if(!('pendingProfileCompletion' in s)) s.pendingProfileCompletion = null;
  if(!s.version || s.version < 5) s.version = 5;
  return s;
}
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function hasActiveProfile(){ return !!(state.profiles && state.profiles.length && state.profiles.some(p=>p.id===state.activeProfileId)); }
function profile(){ const p = state.profiles.find(p=>p.id===state.activeProfileId) || state.profiles[0] || null; return ensureProfile(p); }
function ensureProfile(p){
  if(!p) return p;
  if(!p.ai) p.ai={autoWorkoutReport:true};
  if(!p.planMeta) p.planMeta={source:'pending', cycle:1, title:'Aguardando treino inteligente'};
  if(!('sex' in p)) p.sex='';
  if(!('dietPlan' in p)) p.dietPlan=null;
  if(!p.gamification) p.gamification={xp:0, xpEvents:[], lastLevelSeen:1};
  if(!Array.isArray(p.gamification.xpEvents)) p.gamification.xpEvents=[];
  if(!Number.isFinite(Number(p.gamification.xp))) p.gamification.xp=0;
  if(!p.gamification.lastLevelSeen) p.gamification.lastLevelSeen=levelFromXp(p.gamification.xp).level;
  if(!p.tempTimes) p.tempTimes={};
  if(!('activeWorkoutSession' in p)) p.activeWorkoutSession=null;
  if(p.planMeta?.source === 'default' && p.planMeta.needsDefaultChoice === undefined) p.planMeta.needsDefaultChoice = true;
  if(!('experience' in p)) p.experience='';
  if(!('daysPerWeek' in p)) p.daysPerWeek='';
  applyProgramDuration(p);
  p.ai.apiUrl = AI_BACKEND_URL;
  if(typeof p.ai.autoWorkoutReport !== 'boolean') p.ai.autoWorkoutReport = true;
  if(!Array.isArray(p.history)) p.history=[];
  if(!Array.isArray(p.dailyCheckins)) p.dailyCheckins=[];
  if(!p.routine) p.routine={};
  if(!Array.isArray(p.lessons)) p.lessons = Array.isArray(p.routine.lessons) ? p.routine.lessons : [];
  if(!Array.isArray(p.lessonLogs)) p.lessonLogs = Array.isArray(p.routine.lessonLogs) ? p.routine.lessonLogs : [];
  if(!p.routine.wakeTime) p.routine.wakeTime='09:00';
  if(!p.routine.lunchTime) p.routine.lunchTime='13:00';
  if(!p.routine.dinnerTime) p.routine.dinnerTime='20:00';
  if(!('workdayDescription' in p.routine)) p.routine.workdayDescription='';
  if(!p.reminders) p.reminders={};
  if(!p.reminders.types) p.reminders.types={workout:false, meals:false, water:false};
  if(!('enabled' in p.reminders)) p.reminders.enabled=!!(p.reminders.types.workout||p.reminders.types.meals||p.reminders.types.water);
  if(!p.reminders.times) p.reminders.times={};
  if(!p.reminders.times.workout) p.reminders.times.workout='12:00';
  if(!p.reminders.water) p.reminders.water={intervalHours:2,start:'09:00',end:'21:00'};
  p.routine.lessons = p.lessons;
  p.routine.lessonLogs = p.lessonLogs;
  if(!p.exerciseGoals) p.exerciseGoals={};
  if(!p.nutritionChecks) p.nutritionChecks={};
  if(!Array.isArray(p.quickCoachLogs)) p.quickCoachLogs=[];
  if(!('activeWorkoutAdjustment' in p)) p.activeWorkoutAdjustment=null;
  if(!('activeWorkoutVariant' in p)) p.activeWorkoutVariant=null;
  if(!Array.isArray(p.checkins)) p.checkins=[];
  if(!Array.isArray(p.bio)) p.bio=[];
  return p;
}
function nowISO(){ return new Date().toISOString(); }
function todayBR(d=new Date()){ return d.toLocaleDateString('pt-BR'); }
function fmtDate(iso){ return new Date(iso).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric'}); }
function fmtTime(iso){
  if(!iso) return '';
  const d=new Date(iso);
  if(Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
}
function fmtDateTime(iso){
  if(!iso) return '';
  return `${fmtDate(iso)} às ${fmtTime(iso)}`;
}
function byId(id){ return document.getElementById(id); }
function esc(s){ return String(s ?? '').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function cleanEmailInput(value){
  return String(value || '')
    .normalize('NFKC')
    .replace(/[​-‍﻿]/g, '')
    .trim()
    .toLowerCase();
}
function isValidEmailInput(email){
  const e=cleanEmailInput(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}
function formatHeightSmart(value){
  let raw=String(value || '').trim().replace(/\s+/g,'').replace('.', ',');
  if(!raw) return '';
  if(raw.includes(',')){
    const parts=raw.split(',');
    const left=(parts[0] || '').replace(/\D/g,'').slice(0,1);
    const right=(parts.slice(1).join('') || '').replace(/\D/g,'').slice(0,2);
    if(!left) return right ? `0,${right}` : '';
    return right ? `${left},${right}` : left;
  }
  const digits=raw.replace(/\D/g,'').slice(0,3);
  if(digits.length >= 3) return `${digits[0]},${digits.slice(1)}`;
  return digits;
}
function wireSmartHeightInputs(){
  document.querySelectorAll('input[id$="Height"]').forEach(inp=>{
    if(inp.dataset.smartHeightWired) return;
    inp.dataset.smartHeightWired='1';
    inp.autocomplete = inp.autocomplete || 'off';
    inp.oninput=()=>{
      const before=inp.value;
      const after=formatHeightSmart(before);
      if(after !== before) inp.value=after;
    };
    inp.onblur=()=>{ inp.value=formatHeightSmart(inp.value); };
  });
}


function normalizeTimeText(value, fallback='12:00'){
  const raw = String(value || '').trim();
  const fb = String(fallback || '12:00').trim();
  const match = raw.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if(!match) return fb;
  let h = Math.max(0, Math.min(23, Number(match[1])));
  let m = Math.max(0, Math.min(59, Number(match[2] ?? 0)));
  if(!Number.isFinite(h) || !Number.isFinite(m)) return fb;
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
}
function minutesToTime(total, fallback='12:00'){
  if(!Number.isFinite(Number(total))) return fallback;
  const mins = ((Math.round(Number(total)) % 1440) + 1440) % 1440;
  const h = Math.floor(mins/60);
  const m = mins%60;
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
}
function safeTimeMinutes(t, fallbackMinutes=null){
  const m = String(t || '').match(/^(\d{1,2}):(\d{2})/);
  if(!m) return fallbackMinutes;
  const h=Number(m[1]), min=Number(m[2]);
  if(!Number.isFinite(h) || !Number.isFinite(min) || h<0 || h>23 || min<0 || min>59) return fallbackMinutes;
  return h*60+min;
}
function suggestedWorkoutTimeFromRoutine(p=profile()){
  const r = p?.routine || {};
  const remWorkout = p?.reminders?.times?.workout;
  if(remWorkout) return normalizeTimeText(remWorkout, '12:00');
  const lunch = safeTimeMinutes(r.lunchTime, 13*60);
  const dinner = safeTimeMinutes(r.dinnerTime, 20*60);
  const wake = safeTimeMinutes(r.wakeTime, 9*60);
  const desc = String(r.workdayDescription || '').toLowerCase();
  if(desc.includes('manhã') || desc.includes('manha')) return minutesToTime(Math.max(wake+90, 7*60), '08:00');
  if(desc.includes('noite')) return minutesToTime(Math.max(dinner+90, 19*60), '19:00');
  if(desc.includes('almoço') || desc.includes('almoco') || desc.includes('meio dia') || desc.includes('meio-dia')) return minutesToTime(Math.max(wake+120, lunch-60), '12:00');
  if(lunch) return minutesToTime(Math.max(wake+120, lunch-60), '12:00');
  return '12:00';
}
function routineSummary(p=profile()){
  const r = p?.routine || {};
  const rem = p?.reminders || {};
  const parts = [];
  if(r.wakeTime) parts.push('acorda ' + normalizeTimeText(r.wakeTime,'09:00'));
  if(r.lunchTime) parts.push('almoça ' + normalizeTimeText(r.lunchTime,'13:00'));
  if(r.dinnerTime) parts.push('janta ' + normalizeTimeText(r.dinnerTime,'20:00'));
  const workout = rem?.times?.workout || suggestedWorkoutTimeFromRoutine(p);
  if(workout) parts.push('treino sugerido ' + normalizeTimeText(workout,'12:00'));
  const active=[];
  if(rem?.types?.workout) active.push('treino');
  if(rem?.types?.meals) active.push('refeições');
  if(rem?.types?.water) active.push('água');
  if(active.length) parts.push('lembretes: ' + active.join(', '));
  if(r.workdayDescription) parts.push('dia útil: ' + r.workdayDescription);
  return parts.join(' • ');
}

function remindersSummary(p=profile()){
  const rem = p?.reminders || {};
  const r = p?.routine || {};
  const types = rem.types || {};
  const water = rem.water || {};
  const times = rem.times || {};
  const parts = [];
  if(types.workout){
    parts.push('treino ' + normalizeTimeText(times.workout || suggestedWorkoutTimeFromRoutine(p), '12:00'));
  }
  if(types.meals){
    const mealParts = [];
    if(r.lunchTime) mealParts.push('almoço ' + normalizeTimeText(r.lunchTime, '13:00'));
    if(r.dinnerTime) mealParts.push('jantar ' + normalizeTimeText(r.dinnerTime, '20:00'));
    parts.push(mealParts.length ? mealParts.join(' / ') : 'refeições ativas');
  }
  if(types.water){
    const interval = Number(water.intervalHours || 2);
    const start = normalizeTimeText(water.start || r.wakeTime || '09:00', '09:00');
    const end = normalizeTimeText(water.end || '21:00', '21:00');
    parts.push(`água a cada ${interval}h (${start}-${end})`);
  }
  return parts.length ? parts.join(' • ') : 'sem lembretes ativos';
}


function workoutTimeRecommendation(p=profile()){
  ensureProfile(p);
  const r = p.routine || {};
  const desc = String(r.workdayDescription || '').toLowerCase();
  const wake = safeTimeMinutes(r.wakeTime, 9*60);
  const lunch = safeTimeMinutes(r.lunchTime, 13*60);
  const dinner = safeTimeMinutes(r.dinnerTime, 20*60);
  let time = safeTimeMinutes(p.reminders?.times?.workout, null);
  let reason = '';
  let label = 'horário definido';
  if(desc.includes('noite')){
    time = Math.min(21*60, Math.max(dinner + 75, 19*60));
    label = 'noite';
    reason = 'Seu dia útil indica noite. Evitei jogar o treino muito cedo e deixei depois do jantar/rotina principal.';
  }else if(desc.includes('manhã') || desc.includes('manha')){
    time = Math.max(wake + 60, 7*60);
    label = 'manhã';
    reason = 'Seu dia parece funcionar melhor cedo. Sugeri um horário após acordar, com margem para hidratar e comer algo leve.';
  }else if(desc.includes('almoço') || desc.includes('almoco') || desc.includes('meio dia') || desc.includes('meio-dia')){
    time = Math.max(wake + 90, lunch - 75);
    label = 'perto do almoço';
    reason = 'Seu dia combina com treino perto do almoço. Assim o almoço pode funcionar como pós-treino.';
  }else if(!time){
    time = Math.max(wake + 120, lunch - 75);
    label = 'sugestão automática';
    reason = 'Usei seu horário de acordar e almoço para encaixar um treino realista antes da primeira refeição grande.';
  }else{
    reason = 'Esse é o horário de treino salvo no seu perfil. Se sua rotina mudar, posso sugerir outro encaixe.';
  }
  const start = minutesToTime(time, '12:00');
  const end = minutesToTime(time + 75, '13:15');
  return {time:start, window:`${start}–${end}`, label, reason, wake:minutesToTime(wake,'09:00'), lunch:minutesToTime(lunch,'13:00'), dinner:minutesToTime(dinner,'20:00')};
}
function suggestedWorkoutTimeFromRoutineV74(p=profile()){
  return workoutTimeRecommendation(p).time;
}
function timeToMinutesForToday(t){
  const m=safeTimeMinutes(t, null);
  if(m===null || m===undefined) return null;
  return m;
}
function minutesUntilTodayTime(t){
  const mins=timeToMinutesForToday(t);
  if(mins===null) return null;
  const now=new Date();
  const current=now.getHours()*60+now.getMinutes();
  return mins-current;
}
function formatCommitmentTime(t){ return normalizeTimeText(t,'12:00'); }
function nextWaterTime(p=profile()){
  const rem=p.reminders||{}, water=rem.water||{}, r=p.routine||{};
  if(!rem.types?.water) return null;
  const start=safeTimeMinutes(water.start || r.wakeTime, safeTimeMinutes(r.wakeTime, 9*60));
  const end=safeTimeMinutes(water.end, 21*60);
  const interval=Math.max(1, Math.min(4, Number(water.intervalHours||2)))*60;
  const now=new Date();
  const cur=now.getHours()*60+now.getMinutes();
  if(cur > end) return null;
  let next=start;
  while(next < cur) next += interval;
  if(next > end) return null;
  return minutesToTime(next, '09:00');
}
function nextCommitment(p=profile()){
  ensureProfile(p);
  const list=[];
  const rem=p.reminders||{}, r=p.routine||{};
  const w=currentWorkout(p);
  if(rem.types?.workout && w){
    const t=normalizeTimeText(rem.times?.workout || suggestedWorkoutTimeFromRoutineV74(p), '12:00');
    const diff=minutesUntilTodayTime(t);
    if(diff!==null && diff>=-30) list.push({type:'Treino', time:t, title:`Treino ${w.id}`, detail:w.name, icon:'🏋️', diff});
  }
  if(rem.types?.meals){
    [['Almoço', r.lunchTime || '13:00', 'Seguir a rotina alimentar'], ['Jantar', r.dinnerTime || '20:00', 'Fechar o dia sem improvisar']].forEach(([type,t,detail])=>{
      const tt=normalizeTimeText(t, type==='Almoço'?'13:00':'20:00');
      const diff=minutesUntilTodayTime(tt);
      if(diff!==null && diff>=-30) list.push({type, time:tt, title:type, detail, icon:'🥗', diff});
    });
  }
  const meal=nextDietMeal(p);
  if(meal?.time){
    const tt=normalizeTimeText(meal.time, '13:00');
    const diff=minutesUntilTodayTime(tt);
    if(diff!==null && diff>=-30) list.push({type:'Refeição', time:tt, title:meal.title||'Refeição do plano', detail:meal.text||'Rotina alimentar', icon:'🥗', diff});
  }
  const water=nextWaterTime(p);
  if(water){
    const diff=minutesUntilTodayTime(water);
    if(diff!==null && diff>=-5) list.push({type:'Água', time:water, title:'Beber água', detail:`Janela ${normalizeTimeText(rem.water?.start || r.wakeTime || '09:00','09:00')}–${normalizeTimeText(rem.water?.end || '21:00','21:00')}`, icon:'💧', diff});
  }
  list.sort((a,b)=>a.diff-b.diff);
  return list[0] || null;
}
function nextCommitmentHTML(p=profile()){
  const next=nextCommitment(p);
  const rec=workoutTimeRecommendation(p);
  if(!next){
    return `<section class="card compact-card next-commitment-card"><div class="card-title"><div><h3>Próximo compromisso</h3><p>Sem lembretes ativos para hoje.</p></div><span class="badge yellow">Rotina</span></div><p class="muted">Sugestão de treino: ${esc(rec.window)}. Ajuste isso no Perfil se sua rotina mudar.</p><div class="actions"><button class="btn sm secondary" data-action="suggest-workout-time">Sugerir horário</button></div></section>`;
  }
  return `<section class="card compact-card next-commitment-card"><div class="card-title"><div><h3>Próximo compromisso</h3><p>${esc(next.icon)} ${esc(next.time)} — ${esc(next.title)}</p></div><span class="badge orange">${esc(next.type)}</span></div><p class="muted">${esc(next.detail || '')}</p><div class="actions"><button class="btn sm secondary" data-action="suggest-workout-time">Sugerir horário de treino</button></div></section>`;
}
function openWorkoutTimeSuggestionModal(){
  saveProfileForm(false);
  const p=profile();
  const rec=workoutTimeRecommendation(p);
  const layer=byId('modalLayer');
  layer.innerHTML=`<div class="modal"><div class="modal-head"><div><p class="eyebrow">Rotina inteligente</p><h2>Melhor horário de treino</h2><p class="muted">Usei acordar, almoço, jantar e o texto do seu dia útil para sugerir um encaixe realista.</p></div><button class="close" data-close>×</button></div>
    <section class="card compact-card"><div class="card-title"><div><h3>${esc(rec.window)}</h3><p>${esc(rec.label)}</p></div><span class="badge green">Sugerido</span></div><p>${esc(rec.reason)}</p><div class="grid three"><div class="stat"><strong>${esc(rec.wake)}</strong><span>acorda</span></div><div class="stat"><strong>${esc(rec.lunch)}</strong><span>almoço</span></div><div class="stat"><strong>${esc(rec.dinner)}</strong><span>jantar</span></div></div></section>
    ${p.routine?.workdayDescription?`<section class="card compact-card"><div class="card-title"><h3>Seu dia útil</h3></div><p class="muted">${esc(p.routine.workdayDescription)}</p></section>`:''}
    <div class="actions"><button class="btn" data-apply-suggested-workout-time="${esc(rec.time)}">Usar ${esc(rec.time)}</button><button class="btn secondary" data-close>Cancelar</button></div></div>`;
  layer.classList.remove('hidden');
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  document.querySelector('[data-apply-suggested-workout-time]').onclick=()=>{
    ensureProfile(p);
    p.reminders.times.workout=rec.time;
    p.reminders.types.workout=true;
    p.reminders.enabled=true;
    save();
    if(hasCloudAccount()) upsertCloudProfile(null).catch(()=>{});
    closeModal();
    toast('Horário de treino atualizado.');
  };
}

function workoutById(p,id){ return p.workouts.find(w=>w.id===id); }
function currentWorkout(p=profile()){ return workoutById(p, p.queue[0]); }
function allExercises(p=profile()){ return p.workouts.flatMap(w=>w.exercises.map(e=>({...e, workoutId:w.id, workoutName:w.name}))); }

function dateKey(d=new Date()){
  const x = d instanceof Date ? d : new Date(d);
  return x.toISOString().slice(0,10);
}
function startOfWeek(d=new Date()){
  const x=new Date(d);
  const day=(x.getDay()+6)%7; // segunda = 0
  x.setHours(0,0,0,0);
  x.setDate(x.getDate()-day);
  return x;
}
function workoutsThisWeek(p=profile()){
  const start=startOfWeek();
  return (p.history||[]).filter(h=>new Date(h.date||0) >= start).length;
}
function workoutDoneToday(p=profile()){
  const today=dateKey();
  return (p.history||[]).some(h=>dateKey(h.date||0)===today);
}
function latestWorkoutToday(p=profile()){
  const today=dateKey();
  return [...(p.history||[])].reverse().find(h=>dateKey(h.date||0)===today) || null;
}
function checkinDoneToday(p=profile()){
  const today=dateKey();
  return (p.checkins||[]).some(c=>dateKey(c.date||0)===today);
}
function dailyCheckinToday(p=profile()){
  const today=dateKey();
  return (p.dailyCheckins||[]).find(c=>c.dateKey===today || dateKey(c.date||0)===today) || null;
}
function readinessLabel(c){
  if(!c) return 'não feito';
  const score=Number(c.readinessScore||0);
  if(score>=80) return 'pronto para render';
  if(score>=60) return 'ok, treina controlado';
  if(score>=40) return 'dia moderado';
  return 'recuperação';
}
function calcReadinessScore(c){
  const energy=Number(c.energy||3);
  const sleep=Number(c.sleep||3);
  const motivation=Number(c.motivation||3);
  const pain=Number(c.pain||1);
  const stress=Number(c.stress||3);
  const hunger=Number(c.hunger||3);
  const positive=(energy+sleep+motivation)/15*70;
  const recovery=(6-pain)/5*15;
  const stressPart=(6-stress)/5*10;
  const hungerPart=(6-Math.abs(hunger-3))/5*5;
  return Math.max(0, Math.min(100, Math.round(positive+recovery+stressPart+hungerPart)));
}
function recentDailyCheckins(p=profile(), n=7){
  return [...(p.dailyCheckins||[])].slice(-n).reverse();
}
function dailyScoreDetails(p=profile()){
  const hasPlan=hasWorkoutPlan(p);
  const train=workoutDoneToday(p);
  const check=dailyCheckinToday(p);
  const photoCheck=checkinDoneToday(p);
  const nutri=nutritionStats(p);
  const weekDone=workoutsThisWeek(p);
  const weekTarget=clampTrainingDays(p.daysPerWeek);
  const weekPct=Math.min(100, Math.round((weekDone/Math.max(1,weekTarget))*100));
  const readiness=check ? Math.round((Number(check.readinessScore||0)/100)*10) : 0;
  const parts=[
    {key:'train', label:'Treino do dia', value:train?35:0, max:35, hint:train?'treino finalizado hoje':'finalize o treino do dia'},
    {key:'check', label:'Check-in diário', value:check?20:(photoCheck?10:0), max:20, hint:check?'sono/energia registrados':(photoCheck?'check-in físico feito':'faça o check-in rápido')},
    {key:'nutri', label:'Nutrição', value:nutri.total?Math.round(nutri.pct*0.25):0, max:25, hint:nutri.total?`${nutri.done}/${nutri.total} refeições marcadas`:'gere uma rotina alimentar'},
    {key:'readiness', label:'Estado do corpo', value:readiness, max:10, hint:check?readinessLabel(check):'sem check-in de prontidão'},
    {key:'week', label:'Meta semanal', value:Math.min(5, Math.round(weekPct*0.05)), max:5, hint:`${weekDone}/${weekTarget} treinos na semana`},
    {key:'plan', label:'Plano ativo', value:hasPlan?5:0, max:5, hint:hasPlan?'plano de treino ativo':'gere um plano de treino'}
  ];
  const score=Math.min(100, parts.reduce((a,x)=>a+x.value,0));
  const label=score>=85?'dia excelente':score>=70?'dia forte':score>=50?'dia ok':score>=30?'dia fraco':'comece pelo básico';
  const next=parts.find(x=>x.value<x.max);
  return {score, label, parts, next, train, check, nutri, weekDone, weekTarget, weekPct};
}

function activeDayInfo(p=profile()){
  const active = new Set();
  (p.history||[]).forEach(h=>{ if(h.date) active.add(dateKey(h.date)); });
  (p.dailyCheckins||[]).forEach(c=>{ if(c.dateKey) active.add(c.dateKey); else if(c.date) active.add(dateKey(c.date)); });
  (p.checkins||[]).forEach(c=>{ if(c.date) active.add(dateKey(c.date)); });
  (p.lessonLogs||[]).forEach(l=>{ if(l.dateKey) active.add(l.dateKey); else if(l.date) active.add(dateKey(l.date)); });
  Object.values(p.nutritionChecks||{}).forEach(n=>{
    const total=Object.keys(n.meals||{}).length;
    const done=Object.values(n.meals||{}).filter(Boolean).length;
    if(total && done) active.add(n.dateKey || dateKey(n.updatedAt||new Date()));
  });
  const today=dateKey();
  let cursor=new Date();
  let activeToday=active.has(today);
  if(!activeToday) cursor.setDate(cursor.getDate()-1);
  let count=0;
  for(let i=0;i<120;i++){
    const key=dateKey(cursor);
    if(!active.has(key)) break;
    count++;
    cursor.setDate(cursor.getDate()-1);
  }
  return {count, activeToday, active};
}
function dailyFocusMission(p=profile()){
  const hasPlan=hasWorkoutPlan(p);
  const w=hasPlan ? currentWorkout(p) : null;
  const done=workoutDoneToday(p);
  const daily=dailyCheckinToday(p);
  const nutri=nutritionStats(p);
  if(!hasPlan) return {icon:'🧭', title:'Montar plano', text:'Gere seu treino específico para começar direito.', action:'generate-initial-plan', cta:'Gerar treino'};
  if(!daily) return {icon:'⚡', title:'Check-in rápido', text:'Registre energia, sono e dor antes de treinar.', action:'daily-checkin', cta:'Fazer check-in'};
  if(!done) return {icon:'🏋️', title:`Treino ${w?.id || ''}`, text:`Concluir ${w?.name || 'o treino de hoje'}.`, action:'start-current', cta:'Iniciar treino'};
  if(nutri.total && nutri.pct<80) return {icon:'🥗', title:'Fechar nutrição', text:`Checklist em ${nutri.pct}%. Tenta bater 80% hoje.`, action:'nutrition-checklist', cta:'Abrir nutri'};
  return {icon:'✅', title:'Dia no controle', text:'O essencial está feito. Mantém o ritmo amanhã.', action:'open-score', cta:'Ver score'};
}
function missionStripHTML(p=profile()){
  const st=activeDayInfo(p);
  const m=dailyFocusMission(p);
  const streakText = st.count ? `${st.count} dia${st.count>1?'s':''} ativo${st.count>1?'s':''}${st.activeToday?'':' • falta hoje'}` : 'comece hoje';
  return `<div class="mission-strip"><div class="mission-main"><span>${esc(m.icon)}</span><div><strong>${esc(m.title)}</strong><small>${esc(m.text)}</small></div></div><div class="mission-side"><span class="streak-pill">🔥 ${esc(streakText)}</span><button class="btn sm secondary" data-action="${esc(m.action)}">${esc(m.cta)}</button></div></div>`;
}

function dailyScore(p=profile()){
  return dailyScoreDetails(p).score;
}
function scoreBreakdownHTML(p=profile()){
  const d=dailyScoreDetails(p);
  return `<div class="score-breakdown">${d.parts.map(part=>{
    const pct=Math.round((part.value/part.max)*100);
    return `<div class="score-part"><div><strong>${esc(part.label)}</strong><span>${esc(part.hint)}</span></div><div class="score-part-right"><b>${part.value}/${part.max}</b><div class="mini-bar"><i style="width:${pct}%"></i></div></div></div>`;
  }).join('')}</div>`;
}
function openScoreModal(){
  const p=profile();
  const d=dailyScoreDetails(p);
  const layer=byId('modalLayer');
  layer.innerHTML=`<div class="modal"><div class="modal-head"><div><p class="eyebrow">Score do dia</p><h2>${d.score}/100 — ${esc(d.label)}</h2><p class="muted">${d.next?`Próximo melhor passo: ${esc(d.next.hint)}.`:'Tudo completo por hoje.'}</p></div><button class="close" data-close>×</button></div>
    <div class="daily-score-preview"><div class="progress-ring small-ring" style="--p:${d.score}%"><div class="progress-ring-inner">${d.score}<small>score</small></div></div><p>O score combina treino, check-in, nutri, prontidão e meta semanal.</p></div>
    ${scoreBreakdownHTML(p)}
    <div class="actions"><button class="btn" data-close>Fechar</button><button class="btn secondary" data-action="daily-checkin">Check-in rápido</button><button class="btn secondary" data-action="nutrition-checklist">Checklist nutri</button></div>
  </div>`;
  layer.classList.remove('hidden');
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{ const a=b.dataset.action; closeModal(); handleAction(a); });
}

const WORKOUT_VARIANTS = {
  full:{icon:'🏋️', title:'Completo', tag:'Treino completo', desc:'Treino original, sem cortes.'},
  fast:{icon:'⚡', title:'Rápido', tag:'Versão rápida', desc:'Só os exercícios mais importantes do dia.'},
  crowded:{icon:'🏟️', title:'Academia cheia', tag:'Sem depender de máquina', desc:'Prioriza alternativas mais flexíveis.'},
  home:{icon:'🏠', title:'Sem máquina', tag:'Peso livre / simples', desc:'Foco em exercícios adaptáveis.'},
  light:{icon:'🧘', title:'Leve / recuperação', tag:'Recuperação ativa', desc:'Menos volume e mais controle.'}
};
function workoutVariantInfo(mode){
  return WORKOUT_VARIANTS[mode] || WORKOUT_VARIANTS.full;
}
function currentVariant(p=profile()){
  const v=p.activeWorkoutVariant;
  if(!v || v.mode==='full') return null;
  if(v.dateKey!==dateKey()) return null;
  const w=currentWorkout(p);
  if(w && v.workoutId && v.workoutId!==w.id) return null;
  return v;
}
function exerciseIsMachine(e){
  const s=String((e?.type||'')+' '+(e?.name||'')).toLowerCase();
  return /máquina|maquina|hack|leg press|extensora|flexora|pulley|peck|crossover|cadeira|mesa/.test(s);
}
function exerciseMuscleHint(e){
  const s=String(e?.name||'').toLowerCase();
  if(/supino|peito|peck/.test(s)) return 'peito';
  if(/pulley|remada|costas/.test(s)) return 'costas';
  if(/tríceps|triceps/.test(s)) return 'tríceps';
  if(/rosca|bíceps|biceps/.test(s)) return 'bíceps';
  if(/ombro|elevação|elevacao|desenvolvimento/.test(s)) return 'ombro';
  if(/leg|hack|agach|extensora|quadr/.test(s)) return 'quadríceps';
  if(/stiff|flexora|posterior/.test(s)) return 'posterior';
  if(/panturrilha/.test(s)) return 'panturrilha';
  if(/abd|prancha|core/.test(s)) return 'core';
  if(/cardio|bike|esteira/.test(s)) return 'cardio';
  return 'geral';
}
function variantExerciseName(e, mode){
  const base=String(e?.name||'Exercício');
  if(mode==='crowded' && exerciseIsMachine(e)){
    const muscle=exerciseMuscleHint(e);
    const map={
      peito:'Variação com halter ou flexão para peito',
      costas:'Remada com halter/cabo livre',
      tríceps:'Tríceps com halter ou banco',
      bíceps:'Rosca com halter',
      ombro:'Elevação/desenvolvimento com halter',
      quadríceps:'Agachamento goblet ou passada',
      posterior:'Stiff com halter',
      panturrilha:'Panturrilha em pé',
      core:'Prancha ou abdominal livre'
    };
    return map[muscle] || `Alternativa livre para ${base}`;
  }
  if(mode==='home' && exerciseIsMachine(e)){
    const muscle=exerciseMuscleHint(e);
    const map={
      peito:'Flexão ou supino com halter',
      costas:'Remada unilateral com halter/mochila',
      tríceps:'Tríceps banco ou francês com halter',
      bíceps:'Rosca com halter/mochila',
      ombro:'Desenvolvimento/elevação com halter',
      quadríceps:'Agachamento livre ou avanço',
      posterior:'Stiff unilateral ou ponte',
      panturrilha:'Panturrilha em pé',
      core:'Prancha/abdominal'
    };
    return map[muscle] || `Versão sem máquina de ${base}`;
  }
  return base;
}
function workoutExercisesForToday(w, p=profile()){
  const v=currentVariant(p);
  if(!w) return [];
  if(!v) return applyTemporarySubstitutions(w.exercises || [], p);
  const original=w.exercises||[];
  let selected=original;
  if(v.mode==='fast') selected=original.filter(e=>exerciseKind(e)!=='cardio').slice(0,4);
  else if(v.mode==='light') selected=original.filter(e=>exerciseKind(e)!=='cardio').slice(0, Math.min(5, original.length));
  else if(v.mode==='crowded') selected=original.slice(0, Math.min(6, original.length));
  else if(v.mode==='home') selected=original.filter(e=>exerciseKind(e)!=='cardio').slice(0, Math.min(5, original.length));
  return applyTemporarySubstitutions(selected.map(e=>{
    const clone={...e};
    clone.originalName=e.name;
    clone.variantMode=v.mode;
    clone.name=variantExerciseName(e, v.mode);
    if(v.mode==='fast') clone.target=e.target?.includes('x')?'3x8-12':(e.target||'3 séries');
    if(v.mode==='light') clone.target='2-3 séries leves';
    if(v.mode==='home') clone.target='3 séries controladas';
    return clone;
  }), p);
}
function variantRules(mode){
  if(mode==='fast') return ['Aqueça rápido, mas não pule completamente.', 'Faça só a lista reduzida e encerre sem culpa.', 'Descanso de 60–90s.'];
  if(mode==='crowded') return ['Mantenha o grupo muscular, mesmo trocando aparelho.', 'Não espere máquina por muito tempo.', 'Registre observações se trocar algo.'];
  if(mode==='home') return ['Use halter, peso corporal ou mochila se precisar.', 'Controle amplitude e execução.', 'Não tente imitar carga de máquina.'];
  if(mode==='light') return ['Reduza carga e foque técnica.', 'Evite falha muscular.', 'Use como recuperação ativa.'];
  return ['Treino original completo.'];
}
function openTodayWorkoutCenter(){
  const p=profile();
  const w=currentWorkout(p);
  const adj=currentAdjustment(p);
  const variant=currentVariant(p);
  const readiness=dailyCheckinToday(p);
  const readinessText=readiness ? `${readinessLabel(readiness)} • ${readiness.readinessScore}%` : 'sem check-in hoje';
  const layer=byId('modalLayer');
  layer.innerHTML=`<div class="modal quick-modal today-workout-center"><div class="modal-head"><div><p class="eyebrow">Treino de hoje</p><h2>${w?esc(w.id+' — '+w.name):'Nenhum treino ativo'}</h2><p class="muted">Escolha como você vai treinar hoje. Ajustes e versões são temporários e não alteram seu treino fixo.</p></div><button class="close" data-close>×</button></div>
    ${w?`<section class="today-center-status">
      <div class="status-chip"><strong>Prontidão</strong><span>${esc(readinessText)}</span></div>
      <div class="status-chip"><strong>Versão</strong><span>${variant?esc(variant.title||variant.tag):'Completo'}</span></div>
      <div class="status-chip"><strong>Ajuste</strong><span>${adj?esc(adj.title||adj.tag):'Nenhum'}</span></div>
    </section>`:'<div class="empty">Gere um treino primeiro para usar a central do treino de hoje.</div>'}
    <section class="today-center-block">
      <div class="card-title"><div><h3>Começar</h3><p>Entre direto no treino ou edite o treino fixo.</p></div></div>
      <div class="actions"><button class="btn" data-center-action="start" ${w?'':'disabled'}>Iniciar treino de hoje</button><button class="btn secondary" data-center-action="edit" ${w?'':'disabled'}>Editar treino fixo</button></div>
    </section>
    <section class="today-center-block">
      <div class="card-title"><div><h3>Escolher versão de hoje</h3><p>Versões mudam a lista de exercícios só para hoje.</p></div></div>
      <div class="quick-grid coach-grid">${Object.entries(WORKOUT_VARIANTS).map(([key,item])=>`<button class="quick-item ${variant?.mode===key || (!variant&&key==='full')?'active':''}" data-center-variant="${key}" ${w?'':'disabled'}><b>${item.icon}</b><span><strong>${item.title}</strong><small>${item.desc}</small></span></button>`).join('')}</div>
    </section>
    <section class="today-center-block">
      <div class="card-title"><div><h3>Ajustar situação de hoje</h3><p>Ajustes orientam estratégia, prioridade e cuidado.</p></div></div>
      <div class="quick-grid coach-grid">${Object.entries(QUICK_COACH_MODES).map(([key,item])=>`<button class="quick-item ${adj?.mode===key?'active':''}" data-center-coach="${key}" ${w?'':'disabled'}><b>${item.icon}</b><span><strong>${item.title}</strong><small>${item.desc}</small></span></button>`).join('')}</div>
    </section>
    <p class="muted">Na próxima vez que esse treino aparecer, ele volta ao formato normal, a menos que você escolha uma nova versão naquele dia.</p>
  </div>`;
  layer.classList.remove('hidden');
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  document.querySelectorAll('[data-center-action]').forEach(b=>b.onclick=()=>{
    const action=b.dataset.centerAction;
    if(action==='start'){ closeModal(); openWorkout(w.id); }
    if(action==='edit'){ closeModal(); openEditWorkout(w.id); }
  });
  document.querySelectorAll('[data-center-variant]').forEach(b=>b.onclick=()=>applyWorkoutVariantFromCenter(b.dataset.centerVariant));
  document.querySelectorAll('[data-center-coach]').forEach(b=>b.onclick=()=>applyQuickCoachFromCenter(b.dataset.centerCoach));
}
function applyWorkoutVariantFromCenter(mode){
  const p=profile();
  const w=currentWorkout(p);
  if(!w) return toast('Gere um treino primeiro.');
  if(mode==='full') p.activeWorkoutVariant=null;
  else p.activeWorkoutVariant={id:'wv_'+Date.now(), date:nowISO(), dateKey:dateKey(), workoutId:w.id, mode, title:workoutVariantInfo(mode).title, tag:workoutVariantInfo(mode).tag};
  save();
  openTodayWorkoutCenter();
  toast(mode==='full'?'Treino completo selecionado para hoje.':'Versão de hoje aplicada.');
}
function applyQuickCoachFromCenter(mode){
  const p=profile();
  const w=currentWorkout(p);
  if(!w) return toast('Gere um treino primeiro.');
  const plan=quickCoachPlan(mode,p);
  const adj={id:'qa_'+Date.now(), date:nowISO(), dateKey:dateKey(), workoutId:w.id, mode, title:plan.info.title, tag:plan.info.tag, focusExerciseIds:plan.focus.map(e=>e.id), notes:plan.instructions};
  p.activeWorkoutAdjustment=adj;
  p.quickCoachLogs.push(adj);
  save();
  openTodayWorkoutCenter();
  toast('Ajuste de hoje aplicado.');
}
function openWorkoutVariantModal(mode=null){
  const p=profile();
  const w=currentWorkout(p);
  const layer=byId('modalLayer');
  if(!mode){
    layer.innerHTML=`<div class="modal quick-modal"><div class="modal-head"><div><p class="eyebrow">Versões do treino</p><h2>Escolha como treinar hoje</h2><p class="muted">A versão vale só para hoje e não altera seu treino fixo.</p></div><button class="close" data-close>×</button></div>
      ${w?`<div class="alert"><div>🏋️</div><div><strong>${esc(w.id)} — ${esc(w.name)}</strong><p>${w.exercises.length} exercícios no treino original</p></div></div>`:'<div class="empty">Nenhum treino ativo ainda.</div>'}
      <div class="quick-grid coach-grid">${Object.entries(WORKOUT_VARIANTS).map(([key,item])=>`<button class="quick-item" data-variant-mode="${key}"><b>${item.icon}</b><span><strong>${item.title}</strong><small>${item.desc}</small></span></button>`).join('')}</div>
    </div>`;
  }else{
    const info=workoutVariantInfo(mode);
    const preview=w ? workoutExercisesForToday(w, {...p, activeWorkoutVariant:{mode, dateKey:dateKey(), workoutId:w.id}}) : [];
    layer.innerHTML=`<div class="modal quick-modal"><div class="modal-head"><div><p class="eyebrow">Versão do treino</p><h2>${info.icon} ${esc(info.title)}</h2><p class="muted">${esc(info.desc)} Vale só para o treino de hoje.</p></div><button class="close" data-close>×</button></div>
      <div class="variant-preview">${preview.map((e,i)=>`<div class="history-row"><div><strong>${i+1}. ${esc(e.name)}</strong><span>${e.originalName&&e.originalName!==e.name?'original: '+esc(e.originalName)+' • ':''}meta ${esc(e.target||'')}</span></div><span class="badge orange">${esc(exerciseKind(e))}</span></div>`).join('') || '<div class="empty">Nenhum exercício para preview.</div>'}</div>
      <div class="quick-rules"><h3>Regras</h3>${variantRules(mode).map(x=>`<p>• ${esc(x)}</p>`).join('')}</div>
      <div class="actions"><button class="btn" data-apply-variant="${mode}" ${w?'':'disabled'}>Usar essa versão hoje</button><button class="btn secondary" data-variant-back>Voltar</button><button class="btn secondary" data-close>Fechar</button></div>
    </div>`;
  }
  layer.classList.remove('hidden');
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  document.querySelectorAll('[data-variant-mode]').forEach(b=>b.onclick=()=>openWorkoutVariantModal(b.dataset.variantMode));
  const back=document.querySelector('[data-variant-back]'); if(back) back.onclick=()=>openWorkoutVariantModal();
  document.querySelectorAll('[data-apply-variant]').forEach(b=>b.onclick=()=>applyWorkoutVariant(b.dataset.applyVariant));
}
function applyWorkoutVariant(mode){
  const p=profile();
  const w=currentWorkout(p);
  if(!w) return toast('Gere um treino primeiro.');
  if(mode==='full') p.activeWorkoutVariant=null;
  else p.activeWorkoutVariant={id:'wv_'+Date.now(), date:nowISO(), dateKey:dateKey(), workoutId:w.id, mode, title:workoutVariantInfo(mode).title, tag:workoutVariantInfo(mode).tag};
  save();
  toast(mode==='full'?'Treino completo restaurado.':'Versão aplicada só para hoje.');
  openWorkout(w.id);
}
const QUICK_COACH_MODES = {
  short:{icon:'⏱️', title:'Estou sem tempo', tag:'Treino rápido', desc:'Prioriza o essencial e corta acessórios.'},
  tired:{icon:'😮‍💨', title:'Estou muito cansado', tag:'Dia controlado', desc:'Reduz intensidade e foca execução.'},
  pain:{icon:'⚠️', title:'Estou com dor/desconforto', tag:'Proteção', desc:'Evita forçar região dolorida.'},
  crowded:{icon:'🏟️', title:'Academia cheia', tag:'Plano alternativo', desc:'Sugere trocas para halter, cabo ou peso livre.'},
  swap:{icon:'🔁', title:'Quero trocar exercício', tag:'Substituição', desc:'Ajuda a trocar um exercício sem bagunçar o treino.'}
};
function quickCoachModeInfo(mode){
  return QUICK_COACH_MODES[mode] || QUICK_COACH_MODES.short;
}
function currentAdjustment(p=profile()){
  const adj=p.activeWorkoutAdjustment;
  if(!adj) return null;
  if(adj.dateKey!==dateKey()) return null;
  const w=currentWorkout(p);
  if(w && adj.workoutId && adj.workoutId!==w.id) return null;
  return adj;
}
function quickCoachPlan(mode, p=profile()){
  const w=currentWorkout(p);
  const info=quickCoachModeInfo(mode);
  const exercises=w?.exercises || [];
  const strength=exercises.filter(e=>exerciseKind(e)==='strength');
  const nonCardio=exercises.filter(e=>exerciseKind(e)!=='cardio');
  const cardio=exercises.filter(e=>exerciseKind(e)==='cardio');
  let focus=[], instructions=[], caution='';
  if(mode==='short'){
    focus=nonCardio.slice(0,4);
    instructions=['Faça aquecimento curto de 5 minutos.','Priorize os exercícios principais.','Use descanso de 60–90s.','Se sobrar tempo, finalize com cardio leve curto.'];
    caution='Não tente compensar com carga exagerada.';
  }else if(mode==='tired'){
    focus=nonCardio.slice(0, Math.min(5, nonCardio.length));
    instructions=['Reduza 10–20% da carga normal.','Deixe 2–3 repetições na reserva.','Evite falha muscular hoje.','Se o corpo piorar, encerre mais cedo.'];
    caution='Dia cansado ainda conta: objetivo é manter consistência.';
  }else if(mode==='pain'){
    focus=nonCardio.slice(0, Math.min(4, nonCardio.length));
    instructions=['Não force exercício que cause dor aguda.','Troque amplitude/carga ou pule o exercício problemático.','Prefira execução controlada e aquecimento maior.','Dor forte, tontura ou formigamento: encerre e procure orientação.'];
    caution='Dor não é “frescura”; é dado para ajustar o treino.';
  }else if(mode==='crowded'){
    focus=nonCardio.slice(0, Math.min(5, nonCardio.length));
    instructions=['Se máquina estiver ocupada, use variação similar.','Priorize padrões: empurrar, puxar, agachar, dobradiça, core.','Mantenha o mesmo grupo muscular, mesmo que troque o aparelho.','Evite esperar muito tempo parado.'];
    caution='Trocar equipamento é melhor do que perder o treino.';
  }else{
    focus=nonCardio.slice(0, Math.min(5, nonCardio.length));
    instructions=['Escolha exercício que treine o mesmo músculo.','Mantenha séries/reps parecidas.','Registre a troca na observação.','Se a troca virar fixa, edite o treino depois.'];
    caution='Troca boa mantém o objetivo do exercício original.';
  }
  if(!focus.length) focus=exercises.slice(0,4);
  return {mode, info, workout:w, focus, cardio, instructions, caution};
}
function quickCoachPlanHTML(mode, p=profile()){
  const plan=quickCoachPlan(mode,p);
  if(!plan.workout) return '<div class="empty">Gere um treino primeiro para usar o ajuste rápido.</div>';
  return `<div class="quick-coach-plan">
    <div class="alert orange"><div>${plan.info.icon}</div><div><strong>${esc(plan.info.tag)}</strong><p>${esc(plan.info.desc)}</p></div></div>
    <div class="quick-priority"><h3>Prioridade de hoje</h3>${plan.focus.map((e,i)=>`<div class="history-row"><div><strong>${i+1}. ${esc(e.name)}</strong><span>${esc(exerciseKind(e))} • meta ${esc(e.target||'')}</span></div><span class="badge orange">${i<3?'essencial':'se der'}</span></div>`).join('')}</div>
    <div class="quick-rules"><h3>Regras do ajuste</h3>${plan.instructions.map(x=>`<p>• ${esc(x)}</p>`).join('')}<p><b>Atenção:</b> ${esc(plan.caution)}</p></div>
  </div>`;
}
function openQuickCoachModal(mode=null){
  const p=profile();
  const w=currentWorkout(p);
  const layer=byId('modalLayer');
  if(!mode){
    layer.innerHTML=`<div class="modal quick-modal"><div class="modal-head"><div><p class="eyebrow">Coach rápido</p><h2>Ajustar treino de hoje</h2><p class="muted">Escolha a situação. O app adapta a estratégia sem destruir seu plano original.</p></div><button class="close" data-close>×</button></div>
      ${w?`<div class="alert"><div>🏋️</div><div><strong>Treino atual: ${esc(w.id)} — ${esc(w.name)}</strong><p>${w.exercises.length} exercícios • ${esc(w.focus||'')}</p></div></div>`:'<div class="empty">Nenhum treino ativo ainda.</div>'}
      <div class="quick-grid coach-grid">${Object.entries(QUICK_COACH_MODES).map(([key,item])=>`<button class="quick-item" data-quick-coach-mode="${key}"><b>${item.icon}</b><span><strong>${item.title}</strong><small>${item.desc}</small></span></button>`).join('')}</div>
    </div>`;
  }else{
    const plan=quickCoachPlan(mode,p);
    layer.innerHTML=`<div class="modal quick-modal"><div class="modal-head"><div><p class="eyebrow">Coach rápido</p><h2>${plan.info.icon} ${esc(plan.info.title)}</h2><p class="muted">Ajuste para hoje. Você pode aplicar como nota e abrir o treino.</p></div><button class="close" data-close>×</button></div>
      ${quickCoachPlanHTML(mode,p)}
      <div class="actions"><button class="btn" data-apply-quick-coach="${mode}" ${plan.workout?'':'disabled'}>Aplicar e abrir treino</button><button class="btn secondary" data-quick-coach-back>Voltar</button><button class="btn secondary" data-close>Fechar</button></div>
    </div>`;
  }
  layer.classList.remove('hidden');
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  document.querySelectorAll('[data-quick-coach-mode]').forEach(b=>b.onclick=()=>openQuickCoachModal(b.dataset.quickCoachMode));
  const back=document.querySelector('[data-quick-coach-back]'); if(back) back.onclick=()=>openQuickCoachModal();
  document.querySelectorAll('[data-apply-quick-coach]').forEach(b=>b.onclick=()=>applyQuickCoach(b.dataset.applyQuickCoach));
}
function applyQuickCoach(mode){
  const p=profile();
  const w=currentWorkout(p);
  if(!w) return toast('Gere um treino primeiro.');
  const plan=quickCoachPlan(mode,p);
  const adj={id:'qa_'+Date.now(), date:nowISO(), dateKey:dateKey(), workoutId:w.id, mode, title:plan.info.title, tag:plan.info.tag, focusExerciseIds:plan.focus.map(e=>e.id), notes:plan.instructions};
  p.activeWorkoutAdjustment=adj;
  p.quickCoachLogs.push(adj);
  save();
  toast('Ajuste rápido aplicado ao treino de hoje.');
  openWorkout(w.id);
}
function dietMeals(diet){
  if(!diet) return [];
  const candidates = [
    diet.mealSchedule,
    diet.routine,
    diet.meals,
    diet.refeicoes,
    diet.plan?.mealSchedule,
    diet.plan?.routine,
    diet.plan?.meals,
    diet.plan?.refeicoes,
    diet.data?.mealSchedule,
    diet.data?.routine,
    diet.data?.meals,
    diet.data?.refeicoes
  ];
  const raw = candidates.find(Array.isArray) || (Array.isArray(diet) ? diet : []);
  return raw.map((m,i)=>{
    if(typeof m === 'string') return {time:'', title:`Refeição ${i+1}`, text:m};
    const foods = Array.isArray(m.foods) ? m.foods.join(' • ') : Array.isArray(m.alimentos) ? m.alimentos.join(' • ') : (m.foods || m.alimentos || m.description || m.descricao || m.text || '');
    return {
      time:m.timeWindow || m.time || m.horario || m.hour || '',
      title:m.meal || m.title || m.name || m.refeicao || m.mealName || `Refeição ${i+1}`,
      text:foods,
      portions:m.portions || m.porcoes || '',
      notes:m.notes || m.observacoes || ''
    };
  });
}
function nutritionDayKey(d=new Date()){ return dateKey(d); }
function mealKey(m,i){
  return 'm_'+i+'_'+String(m.time||'').replace(/\W+/g,'').slice(0,8)+'_'+String(m.title||'ref').toLowerCase().replace(/\W+/g,'').slice(0,16);
}
function nutritionStateForDay(p=profile(), key=nutritionDayKey()){
  if(!p.exerciseGoals) p.exerciseGoals={};
  if(!p.nutritionChecks) p.nutritionChecks={};
  if(!p.nutritionChecks[key]) p.nutritionChecks[key]={dateKey:key, updatedAt:null, meals:{}};
  return p.nutritionChecks[key];
}
function nutritionStats(p=profile(), key=nutritionDayKey()){
  const meals=dietMeals(p.dietPlan);
  const day=nutritionStateForDay(p,key);
  const total=meals.length;
  const done=meals.filter((m,i)=>day.meals?.[mealKey(m,i)]?.done).length;
  const pct=total ? Math.round(done/total*100) : 0;
  return {meals, day, total, done, pct};
}
function recentNutritionStats(p=profile(), n=7){
  const entries=Object.values(p.nutritionChecks||{}).sort((a,b)=>String(b.dateKey).localeCompare(String(a.dateKey))).slice(0,n);
  return entries.map(day=>{
    const meals=dietMeals(p.dietPlan);
    const total=meals.length || Object.keys(day.meals||{}).length;
    const done=Object.values(day.meals||{}).filter(x=>x.done).length;
    return {dateKey:day.dateKey, total, done, pct:total?Math.round(done/total*100):0};
  });
}
function toggleNutritionMeal(i){
  const p=profile();
  const stats=nutritionStats(p);
  const meal=stats.meals[i];
  if(!meal) return;
  const key=mealKey(meal,i);
  const prev=stats.day.meals[key] || {};
  stats.day.meals[key]={done:!prev.done, checkedAt:nowISO(), title:meal.title, time:meal.time};
  stats.day.updatedAt=nowISO();
  save();
  render();
}
function resetNutritionToday(){
  const p=profile();
  const key=nutritionDayKey();
  if(!p.nutritionChecks?.[key]) return toast('Nada para limpar hoje.');
  if(!confirm('Limpar checklist de nutrição de hoje?')) return;
  delete p.nutritionChecks[key];
  save();
  render();
  toast('Checklist de hoje limpo.');
}
function renderNutritionChecklistHTML(p=profile()){
  const stats=nutritionStats(p);
  if(!p.dietPlan) return '<div class="empty">Gere uma rotina alimentar para liberar o checklist diário.</div>';
  if(!stats.total) return '<div class="empty">Rotina salva, mas sem refeições estruturadas para checklist.</div>';
  return `<div class="nutrition-check-head"><div><strong>${stats.done}/${stats.total} refeições feitas</strong><span>${stats.pct}% de aderência hoje</span></div><div class="mini-bar"><i style="width:${stats.pct}%"></i></div></div>
    <div class="nutrition-checklist">${stats.meals.map((m,i)=>{
      const k=mealKey(m,i);
      const item=stats.day.meals?.[k] || {};
      return `<button class="nutrition-meal ${item.done?'done':''}" type="button" data-meal-check="${i}">
        <span class="meal-check">${item.done?'✓':'○'}</span>
        <span><strong>${esc(m.title||'Refeição')}</strong><small>${esc((m.time?m.time+' • ':'')+(m.text||m.portions||''))}</small>${item.checkedAt?`<em>Marcado às ${fmtTime(item.checkedAt)}</em>`:''}</span>
      </button>`;
    }).join('')}</div>`;
}

function nextDietMeal(p=profile()){
  const meals=dietMeals(p.dietPlan);
  if(!meals.length) return null;
  const now=new Date();
  const minutes=now.getHours()*60+now.getMinutes();
  const parsed=meals.map((m,i)=>{
    const mt=String(m.time||'').match(/(\d{1,2})[:h](\d{2})?/i);
    if(!mt) return {...m, order:i, mins:null};
    return {...m, order:i, mins:(Number(mt[1])||0)*60+(Number(mt[2])||0)};
  });
  return parsed.find(m=>m.mins!==null && m.mins>=minutes) || parsed[0];
}
function todayMissionHTML(p=profile()){
  const hasPlan=hasWorkoutPlan(p);
  const w=hasPlan ? currentWorkout(p) : null;
  const done=workoutDoneToday(p);
  const todayRecord=latestWorkoutToday(p);
  const weekDone=workoutsThisWeek(p);
  const weekTarget=clampTrainingDays(p.daysPerWeek);
  const weekPct=Math.min(100,Math.round((weekDone/Math.max(1,weekTarget))*100));
  const scoreDetails=dailyScoreDetails(p);
  const score=scoreDetails.score;
  const meal=nextDietMeal(p);
  const nutri=nutritionStats(p);
  const daily=dailyCheckinToday(p);
  const levelInfo=levelFromXp(ensureGamification(p).xp);
  const missionTitle=done ? 'Missão do dia cumprida' : hasPlan ? 'Missão de hoje' : 'Monte sua missão';
  const missionText=done
    ? `Treino ${todayRecord?.workoutId || ''} finalizado hoje às ${fmtTime(todayRecord?.finishedAt || todayRecord?.date)}. Mantém o ritmo, Warrior.`
    : hasPlan ? `Próximo treino: ${w.id} — ${w.name}.`
    : 'Gere um treino específico para começar sua jornada.';
  return `<section class="today-hero">
    <div class="today-main">
      <p class="eyebrow">Hoje</p>
      <h2>${esc(missionTitle)}</h2>
      <p>${esc(missionText)}</p>
      <div class="today-actions">${done?'<button class="btn secondary" data-screen-go="progress">Ver progresso</button>':hasPlan?`<button class="btn" data-action="start-current">Iniciar ${w.id}</button>`:`<button class="btn" data-action="generate-initial-plan">Gerar treino</button>`}<button class="btn secondary" data-action="today-workout-center">Ajuste treino hoje</button><button class="btn secondary" data-action="daily-checkin">${daily?'Editar check-in':'Check-in rápido'}</button><button class="btn secondary" data-action="open-levels">Nv. ${levelInfo.roman}</button></div>
      ${missionStripHTML(p)}
    </div>
    <div class="today-score" data-action="open-score">
      <div class="progress-ring small-ring" style="--p:${score}%"><div class="progress-ring-inner">${score}<small>score</small></div></div>
      <span>${esc(scoreDetails.label)} • ${esc(levelInfo.rank.name)}</span>
    </div>
  </section>
  <section class="today-grid">
    <div class="today-card ${done?'done':''}">
      <div><strong>${done?'Treino feito':'Treino'}</strong><span>${hasPlan?esc(done ? `${todayRecord?.workoutName||'Finalizado'} • ${fmtTime(todayRecord?.finishedAt||todayRecord?.date)}` : `${w.id} — ${w.name}`):'Sem plano ativo'}</span></div>
      <b>${done?'✓':'🏋️'}</b>
    </div>
    <div class="today-card">
      <div><strong>Semana</strong><span>${weekDone}/${weekTarget} treinos</span></div>
      <b>${weekPct}%</b>
    </div>
    <div class="today-card ${daily?'done':''}" data-action="daily-checkin">
      <div><strong>Check-in diário</strong><span>${daily ? readinessLabel(daily)+' • '+daily.readinessScore+'%' : 'sono, energia e dor'}</span></div>
      <b>${daily?'✓':'⚡'}</b>
    </div>
    <div class="today-card ${nutri.total&&nutri.done===nutri.total?'done':''}" data-action="nutrition-checklist">
      <div><strong>Nutri</strong><span>${nutri.total ? `${nutri.done}/${nutri.total} refeições • ${nutri.pct}%` : (meal ? esc((meal.time?meal.time+' • ':'')+meal.title) : (p.dietPlan ? 'rotina salva' : 'sem rotina ainda'))}</span></div>
      <b>${p.dietPlan?'🥗':'+'}</b>
    </div>
  </section>
  <section class="card score-summary-card">
    <div class="card-title"><div><h3>Score inteligente</h3><p>${scoreDetails.next ? 'Próximo passo: '+esc(scoreDetails.next.hint) : 'Tudo completo por hoje.'}</p></div><button class="btn sm secondary" data-action="open-score">Ver detalhes</button></div>
    ${scoreBreakdownHTML(p)}
  </section>`;
}
const RANKS = [
  {from:1,to:2,name:'Frango Recém-Matriculado',icon:'🐣',desc:'Começou agora, mas já saiu da promessa.'},
  {from:3,to:5,name:'Frango Esforçado',icon:'🐥',desc:'Ainda é começo, mas já tem constância.'},
  {from:6,to:9,name:'Frango Premium',icon:'🥚',desc:'Você já não é só promessa.'},
  {from:10,to:14,name:'Projeto Shape',icon:'⚒️',desc:'Agora começou a ficar sério.'},
  {from:15,to:20,name:'Shape em Construção',icon:'🏗️',desc:'O físico está tomando forma.'},
  {from:21,to:27,name:'Aluno Aplicado',icon:'📋',desc:'Treina, registra e evolui com método.'},
  {from:28,to:35,name:'Rato de Academia',icon:'🐀',desc:'A academia já virou parte da rotina.'},
  {from:36,to:44,name:'Marombeiro Iniciante',icon:'💪',desc:'Já não parece perdido nos aparelhos.'},
  {from:45,to:54,name:'Maromba em Ascensão',icon:'🔥',desc:'A consistência começou a aparecer no shape.'},
  {from:55,to:64,name:'Físico Respeitável',icon:'🛡️',desc:'Já dá para perceber que você treina de verdade.'},
  {from:65,to:74,name:'Maromba de Respeito',icon:'🏛️',desc:'Força, rotina e disciplina no mesmo pacote.'},
  {from:75,to:84,name:'Monstro Controlado',icon:'🦍',desc:'Forte, mas ainda com cabeça no lugar.'},
  {from:85,to:94,name:'Lenda da Academia',icon:'⚔️',desc:'A galera já repara quando você chega.'},
  {from:95,to:99,name:'Final Boss do Shape',icon:'👑',desc:'Falta pouco para virar mito do Gym Bronze.'},
  {from:100,to:100,name:'Mr. Gym Bronze',icon:'🏆',desc:'O topo da jornada. Respeita o Warrior.'}
];
function roman(n){
  n=Math.max(1,Math.min(100,Number(n)||1));
  const map=[['C',100],['XC',90],['L',50],['XL',40],['X',10],['IX',9],['V',5],['IV',4],['I',1]];
  let out='';
  for(const [r,v] of map){ while(n>=v){ out+=r; n-=v; } }
  return out;
}
function xpForLevel(level){
  level=Math.max(1,Math.min(100,Number(level)||1));
  if(level<=1) return 0;
  return Math.round(35 * Math.pow(level-1, 1.65));
}
function levelFromXp(xp){
  xp=Math.max(0,Number(xp)||0);
  let level=1;
  for(let l=1;l<=100;l++){ if(xp>=xpForLevel(l)) level=l; else break; }
  const current=xpForLevel(level);
  const next=level>=100 ? current : xpForLevel(level+1);
  const inLevel=Math.max(0,xp-current);
  const needed=Math.max(1,next-current);
  const pct=level>=100 ? 100 : Math.min(100, Math.round((inLevel/needed)*100));
  return {level, roman:roman(level), xp, current, next, inLevel, needed, pct, toNext:Math.max(0,next-xp), rank:rankForLevel(level)};
}
function rankForLevel(level){
  return RANKS.find(r=>level>=r.from && level<=r.to) || RANKS[0];
}
function xpBaseForExperience(exp){
  const e=normalizeExperienceLabel(exp||'');
  if(e==='Avançado') return 90;
  if(e==='Intermediário') return 70;
  return 50;
}
function exerciseIsCardio(e){
  const s=String((e?.type||'')+' '+(e?.name||'')).toLowerCase();
  return /cardio|bike|esteira|corrida|caminhada|el[ií]ptico|escada|aer[oó]b/.test(s);
}
function ensureGamification(p=profile()){
  ensureProfile(p);
  return p.gamification;
}
function awardWorkoutXP(p,w,record){
  const g=ensureGamification(p);
  if(g.xpEvents.some(ev=>ev.id===record.id)) return null;
  const before=levelFromXp(g.xp);
  const breakdown=[];
  const base=xpBaseForExperience(p.experience);
  breakdown.push({label:'Treino concluído',xp:base});
  if(record.skippedCount===0) breakdown.push({label:'Sem pular exercício',xp:15});
  const cardioDone=(w?.exercises||[]).some(e=>exerciseIsCardio(e) && p.tempDone[e.id]);
  if(cardioDone) breakdown.push({label:'Cardio feito',xp:10});
  const total=breakdown.reduce((sum,item)=>sum+item.xp,0);
  g.xp += total;
  const after=levelFromXp(g.xp);
  const event={id:record.id, type:'workout', date:record.date, workoutId:record.workoutId, workoutName:record.workoutName, xp:total, breakdown, levelBefore:before.level, levelAfter:after.level, rankBefore:before.rank.name, rankAfter:after.rank.name, rankChanged:before.rank.name!==after.rank.name};
  g.xpEvents.push(event);
  if(g.xpEvents.length>300) g.xpEvents=g.xpEvents.slice(-300);
  g.lastLevelSeen=after.level;
  record.xpAwarded=total;
  record.xpBreakdown=breakdown;
  record.levelBefore=before.level;
  record.levelAfter=after.level;
  return {total, breakdown, before, after};
}
function localXpEventFromRecord(record){
  if(!record || !record.xpAwarded) return null;
  return {
    id: record.id,
    type: 'workout',
    date: record.date || nowISO(),
    workoutId: record.workoutId || '',
    workoutName: record.workoutName || '',
    xp: Number(record.xpAwarded || 0),
    breakdown: record.xpBreakdown || [],
    levelBefore: record.levelBefore || null,
    levelAfter: record.levelAfter || null,
    cloudSynced: !!record.xpCloudSynced,
    cloudId: record.xpCloudId || null
  };
}
async function saveXpEventToCloud(event, workoutLogId=null, opts={}){
  if(!event || !event.xp) return {ok:false, reason:'empty_event'};
  if(!supabaseClient || !hasCloudAccount()) return {ok:false, reason:'no_account'};
  const user=await getCurrentCloudUser();
  if(!user || isAnonymousCloudUser()) return {ok:false, reason:'no_account'};
  try{
    const payload={
      user_id:user.id,
      local_id:event.id,
      event_type:event.type || 'workout',
      xp:Number(event.xp || 0),
      description:event.workoutName ? `Treino ${event.workoutName}` : 'Ganho de XP',
      breakdown:event.breakdown || [],
      workout_log_id:workoutLogId || null,
      workout_local_id:event.workoutId || null,
      workout_name:event.workoutName || null,
      level_before:event.levelBefore || null,
      level_after:event.levelAfter || null,
      created_at:event.date || nowISO()
    };
    const { data, error } = await supabaseClient.from('xp_events')
      .upsert(payload, {onConflict:'user_id,local_id'})
      .select('id')
      .single();
    if(error) throw error;
    event.cloudSynced=true;
    event.cloudId=data?.id || event.cloudId || null;
    return {ok:true, id:event.cloudId};
  }catch(e){
    console.warn('Erro ao salvar XP na nuvem:', e);
    if(!opts.silent) toast('XP salvo localmente. Falha ao sincronizar com a nuvem.');
    return {ok:false, error:e};
  }
}
async function syncXpEventForRecord(p, record, workoutLogId=null){
  if(!record?.xpAwarded) return {ok:false, reason:'no_xp'};
  const g=ensureGamification(p);
  let event=g.xpEvents.find(ev=>ev.id===record.id) || localXpEventFromRecord(record);
  if(!event) return {ok:false, reason:'no_event'};
  const result=await saveXpEventToCloud(event, workoutLogId, {silent:true});
  if(result.ok){
    record.xpCloudSynced=true;
    record.xpCloudId=result.id;
    event.cloudSynced=true;
    event.cloudId=result.id;
  }
  return result;
}
async function syncXpEventsToCloud(opts={}){
  const p=profile();
  if(!hasCloudAccount()) return {ok:false, reason:'no_account'};
  const g=ensureGamification(p);
  let sent=0, skipped=0, failed=0;
  for(const ev of g.xpEvents){
    if(ev.cloudSynced){ skipped++; continue; }
    const h=(p.history||[]).find(x=>x.id===ev.id);
    const result=await saveXpEventToCloud(ev, h?.cloudWorkoutId || null, {silent:true});
    if(result.ok){
      sent++;
      if(h){ h.xpCloudSynced=true; h.xpCloudId=result.id; }
    } else failed++;
  }
  save();
  if(!opts.silent) toast(`XP na nuvem: ${sent} enviado(s), ${skipped} já estavam, ${failed} falha(s).`);
  return {ok: failed===0, sent, skipped, failed};
}
async function loadXpFromCloud(opts={}){
  if(!supabaseClient || !hasCloudAccount()) return {ok:false, reason:'no_account'};
  const user=await getCurrentCloudUser();
  if(!user || isAnonymousCloudUser()) return {ok:false, reason:'no_account'};
  try{
    const { data, error } = await supabaseClient.from('xp_events')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', {ascending:true});
    if(error) throw error;
    const p=profile();
    const g=ensureGamification(p);
    const byId=new Map((g.xpEvents||[]).map(ev=>[ev.id, ev]));
    (data||[]).forEach(row=>{
      const id=row.local_id || row.id;
      const event={
        id,
        type:row.event_type || 'workout',
        date:row.created_at,
        workoutId:row.workout_local_id || '',
        workoutName:row.workout_name || '',
        xp:Number(row.xp || 0),
        breakdown:Array.isArray(row.breakdown) ? row.breakdown : [],
        levelBefore:row.level_before || null,
        levelAfter:row.level_after || null,
        cloudSynced:true,
        cloudId:row.id
      };
      byId.set(id, {...(byId.get(id)||{}), ...event});
      const h=(p.history||[]).find(x=>x.id===id);
      if(h){
        h.xpCloudSynced=true;
        h.xpCloudId=row.id;
      }
    });
    g.xpEvents=Array.from(byId.values()).sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));
    g.xp=g.xpEvents.reduce((sum,ev)=>sum+Number(ev.xp||0),0);
    const levelInfo=levelFromXp(g.xp);
    g.lastLevelSeen=levelInfo.level;
    save();
    return {ok:true, loaded:(data||[]).length, xp:g.xp};
  }catch(e){
    console.warn('Erro ao carregar XP da nuvem:', e);
    if(!opts.silent) toast('Não consegui carregar XP da nuvem agora.');
    return {ok:false, error:e};
  }
}

function levelHeaderHTML(p=profile()){
  const info=levelFromXp(ensureGamification(p).xp);
  return `<div class="level-card-mini"><div class="level-card-row"><div class="level-badge">${esc(info.rank.icon)}</div><div><strong>${esc(info.rank.name)}</strong><span>Nv. ${info.roman} • faltam ${info.toNext} XP</span></div></div><div class="xp-bar"><i style="width:${info.pct}%"></i></div></div>`;
}
function updateLevelHeader(){
  const btn=byId('openLevelModal');
  if(!btn) return;
  if(shouldShowOnboarding()){
    btn.classList.add('hidden');
    return;
  }
  const info=levelFromXp(ensureGamification(profile()).xp);
  btn.classList.remove('hidden');
  const icon=btn.querySelector('.level-icon');
  const name=byId('activeRankName');
  const lvl=byId('activeLevelText');
  if(icon) icon.textContent=info.rank.icon;
  if(name) name.textContent=info.rank.name;
  if(lvl) lvl.textContent=`Nv. ${info.roman}`;
}
function openLevelModal(){
  const p=profile();
  const info=levelFromXp(ensureGamification(p).xp);
  const nextRank=RANKS.find(r=>r.from>info.level);
  const recent=[...(p.gamification?.xpEvents||[])].slice(-8).reverse();
  const trail=RANKS.map(r=>{
    const unlocked=info.level>=r.from;
    const current=info.level>=r.from && info.level<=r.to;
    const range=r.from===r.to ? roman(r.from) : `${roman(r.from)}–${roman(r.to)}`;
    return `<div class="rank-row ${current?'current':''} ${unlocked?'unlocked':'locked'}">
      <div class="rank-icon">${esc(r.icon)}</div>
      <div><strong>${range} • ${esc(r.name)}</strong><span>${esc(r.desc)}</span></div>
      <span class="badge ${current?'orange':unlocked?'green':''}">${current?'Atual':unlocked?'Liberado':'Bloqueado'}</span>
    </div>`;
  }).join('');
  const layer=byId('modalLayer');
  layer.innerHTML=`<div class="modal level-modal"><div class="modal-head"><div><p class="eyebrow">Trilha Gym Bronze</p><h2>${esc(info.rank.name)}</h2><p class="muted">Nível ${info.roman} (${info.level}) • ${info.xp} XP acumulados</p></div><button class="close" data-close>×</button></div>
    <section class="level-hero-card">
      <div class="level-big-icon">${esc(info.rank.icon)}</div>
      <div class="level-hero-copy"><h3>Nv. ${info.roman} — ${esc(info.rank.name)}</h3><p>${esc(info.rank.desc)}</p><div class="xp-bar big"><i style="width:${info.pct}%"></i></div><small>${info.level>=100?'Você chegou ao topo.':'Faltam '+info.toNext+' XP para o nível '+roman(info.level+1)+' ('+(info.level+1)+').'}</small></div>
    </section>
    ${nextRank?`<section class="card compact-card"><div class="card-title"><h3>Próxima patente</h3><p>${roman(nextRank.from)} • ${esc(nextRank.name)} — desbloqueia no nível ${nextRank.from}</p></div></section>`:''}
    <section class="card compact-card"><div class="card-title"><h3>Como ganhar XP</h3><p>Treinos mais avançados valem mais. Bônus vêm de consistência.</p></div>
      <div class="xp-rules"><span>Iniciante +50</span><span>Intermediário +70</span><span>Avançado +90</span><span>Sem pular +15</span><span>Cardio +10</span></div>
      ${hasCloudAccount()?'<div class="actions" style="margin-top:12px"><button class="btn sm secondary" data-action="sync-xp-cloud">Salvar XP na nuvem</button><button class="btn sm secondary" data-action="load-xp-cloud">Atualizar XP da nuvem</button></div>':'<p class="muted">Entre em uma conta confirmada para sincronizar XP na nuvem.</p>'}
    </section>
    <section class="card compact-card"><div class="card-title"><h3>Últimos ganhos</h3></div>${recent.length?recent.map(ev=>`<div class="history-row"><div><strong>+${ev.xp} XP</strong><span>${esc(ev.workoutName||'Treino')} • ${fmtDate(ev.date)}</span></div><span class="badge">Nv. ${roman(ev.levelAfter||info.level)}</span></div>`).join(''):'<div class="empty">Finalize um treino para começar a ganhar XP.</div>'}</section>
    <section class="card compact-card"><div class="card-title"><h3>Patentes</h3><p>De frango recém-matriculado a Mr. Gym Bronze.</p></div><div class="rank-list">${trail}</div></section>
  </div>`;
  layer.classList.remove('hidden');
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
}
function levelUpToast(xpInfo){
  if(!xpInfo) return 'Treino finalizado com sucesso.';
  if(xpInfo.after.level > xpInfo.before.level){
    return `+${xpInfo.total} XP. Subiu para Nv. ${xpInfo.after.roman} — ${xpInfo.after.rank.name}!`;
  }
  return `+${xpInfo.total} XP. Faltam ${xpInfo.after.toNext} XP para Nv. ${roman(xpInfo.after.level+1)}.`;
}
function rankChangedByXp(xpInfo){
  return !!(xpInfo && xpInfo.before?.rank?.name && xpInfo.after?.rank?.name && xpInfo.before.rank.name !== xpInfo.after.rank.name);
}
function openRankUpModal(xpInfo){
  if(!rankChangedByXp(xpInfo)) return false;
  const before=xpInfo.before;
  const after=xpInfo.after;
  const layer=byId('modalLayer');
  layer.innerHTML=`<div class="modal rank-up-modal">
    <div class="rank-confetti" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <div class="rank-up-hero">
      <p class="eyebrow">Nova patente desbloqueada</p>
      <div class="rank-up-icon">${esc(after.rank.icon)}</div>
      <h2>${esc(after.rank.name)}</h2>
      <p>${esc(after.rank.desc)}</p>
    </div>
    <div class="rank-up-change">
      <span>${esc(before.rank.icon)} ${esc(before.rank.name)}</span>
      <b>→</b>
      <span>${esc(after.rank.icon)} ${esc(after.rank.name)}</span>
    </div>
    <div class="rank-up-stats">
      <div><strong>+${xpInfo.total}</strong><span>XP no treino</span></div>
      <div><strong>Nv. ${esc(after.roman)}</strong><span>${after.level}</span></div>
      <div><strong>${after.toNext}</strong><span>XP p/ próximo nível</span></div>
    </div>
    <div class="actions center-actions"><button class="btn" data-rank-open-levels>Ver trilha</button><button class="btn secondary" data-close>Fechar</button></div>
  </div>`;
  layer.classList.remove('hidden');
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  const openBtn=document.querySelector('[data-rank-open-levels]');
  if(openBtn) openBtn.onclick=()=>openLevelModal();
  return true;
}
function maybeShowRankUpModal(xpInfo){
  if(!rankChangedByXp(xpInfo)) return;
  setTimeout(()=>openRankUpModal(xpInfo), 450);
}


function normalizeSupabaseUrl(url){
  return String(url||'').replace(/\/rest\/v1\/?$/,'').replace(/\/+$/,'');
}
function setupSupabase(){
  try{
    if(window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY){
      supabaseClient = window.supabase.createClient(normalizeSupabaseUrl(SUPABASE_URL), SUPABASE_ANON_KEY);
      cloudReady = true;
      refreshCloudUser(false);
      supabaseClient.auth.onAuthStateChange(async (_event, session)=>{
        cloudUser = session?.user || null;
        if(cloudUser && !isAnonymousCloudUser()){
          const wasPending = !!state.pendingEmailVerification || !state.onboardingDone || state.entryMode !== 'account';
          const ok = await completeVerifiedAccountSession();
          if(ok && wasPending){
            screen = 'home';
            toast('E-mail confirmado. Sua conta está ativa.');
          }
        }
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
function hasCloudAccount(){ const p=profile(); return !!(cloudUser && !isAnonymousCloudUser() && state.entryMode === 'account' && (!p.cloudUserId || p.cloudUserId === cloudUser.id)); }
function cloudStatusHTML(){
  if(!cloudReady) return '<span class="badge red">indisponível</span>';
  if(hasCloudAccount()) return '<span class="badge green">conectado</span>';
  if(isLocalMode()) return '<span class="badge yellow">modo local</span>';
  return '<span class="badge yellow">desconectado</span>';
}
function isOffline(){ return !navigator.onLine; }
function canUseOnlineAI(){ return !!(AI_BACKEND_URL && !isOffline() && cloudUser); }
function shouldShowOnboarding(){
  if(!state.profiles || !state.profiles.length || !state.activeProfileId) return true;
  if(state.pendingEmailVerification && !cloudUser) return true;
  if(state.pendingProfileCompletion) return true;

  // Se o usuário já passou pelo onboarding e tem dados salvos neste aparelho,
  // não mostra a tela de login enquanto o Supabase ainda está restaurando a sessão.
  // Isso evita o "flash" de login toda vez que o PWA abre.
  if(state.onboardingDone && state.entryMode === 'account') return false;

  // Modo local continua funcionando sem conta.
  if(state.entryMode === 'local' && state.onboardingDone) return false;

  return !state.onboardingDone && !cloudUser;
}
function appFooterHTML(){
  const year=new Date().getFullYear();
  return `<footer class="app-footer"><span>© ${year} Gym Bronze. Todos os direitos reservados.</span><strong>v${APP_VERSION}</strong></footer>`;
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
async function ensureAccountSession(email='', password=''){
  if(!supabaseClient) return { ok:false, reason:'Supabase indisponível.' };
  const { data: current } = await supabaseClient.auth.getSession();
  if(current?.session?.access_token){
    cloudUser = current.session.user || cloudUser;
    return { ok:true, session: current.session };
  }
  if(email && password){
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if(!error && data?.session?.access_token){
      cloudUser = data.user || null;
      return { ok:true, session: data.session };
    }
    return { ok:false, reason: error?.message || 'Confirme seu e-mail antes de usar IA e nuvem.' };
  }
  return { ok:false, reason:'Sessão online não encontrada.' };
}
function init(){
  setupSupabase();
  setTimeout(async()=>{ 
    try{
      await refreshCloudUser(false);
      if(cloudUser && !isAnonymousCloudUser()) await completeVerifiedAccountSession();
      render();
    }catch(e){}
  }, 350);
  window.addEventListener('online', () => { toast('Você voltou para o modo online.'); render(); });
  window.addEventListener('offline', () => { toast('Modo offline: treino salvo só neste aparelho.'); render(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>setScreen(btn.dataset.screen)));
  const quickBtn=byId('openQuickMenu'); if(quickBtn) quickBtn.addEventListener('click', openQuickMenuModal);
  byId('openProfileSwitcher').addEventListener('click', openProfileSwitcher);
  byId('openLevelModal')?.addEventListener('click', openLevelModal);
  render();
}
function setScreen(s, opts={}){
  screen=s;
  render();
  if(opts.scrollTo){
    requestAnimationFrame(()=>scrollToSection(opts.scrollTo));
  }
}
function scrollToSection(id){
  const el=document.getElementById(id);
  if(!el) return;
  el.scrollIntoView({behavior:'smooth', block:'start'});
  el.classList.add('section-highlight');
  setTimeout(()=>el.classList.remove('section-highlight'),1400);
}
function goNutritionChecklist(){
  setScreen('coach', {scrollTo:'nutritionChecklistCard'});
}
function titleFor(s){ return {home:'Hoje',workouts:'Treinos',lessons:'Aulas',checkin:'Check-in',coach:'Nutri',progress:'Progresso',profile:'Perfil'}[s] || 'Hoje'; }
function render(){
  const p = profile();
  if(shouldShowOnboarding()){
    document.body.classList.add('onboarding-active');
    byId('screenTitle').textContent = 'Bem-vindo';
    byId('activeProfileName').textContent = 'Começar';
    byId('profileInitial').textContent = '+';
    updateLevelHeader();
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    byId('content').innerHTML = onlineNoticeHTML() + renderOnboarding() + appFooterHTML();
    bindOnboarding();
    wireSmartHeightInputs();
    return;
  }
  document.body.classList.remove('onboarding-active');
  byId('screenTitle').textContent = titleFor(screen);
  byId('activeProfileName').textContent = p.name || (isLocalMode() ? 'Modo local' : 'Perfil');
  byId('profileInitial').textContent = (p.name||'?').trim().charAt(0).toUpperCase();
  updateLevelHeader();
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.screen===screen));
  const map = {home:renderHome, workouts:renderWorkouts, lessons:renderLessons, checkin:renderCheckin, coach:renderCoach, progress:renderProgress, profile:renderProfile};
  try{
    const view = map[screen] || renderHome;
    byId('content').innerHTML = onlineNoticeHTML() + view() + appFooterHTML();
  }catch(err){
    console.error('Erro ao renderizar tela', screen, err);
    byId('content').innerHTML = onlineNoticeHTML() + `<section class="card"><div class="card-title"><div><h3>Não consegui abrir esta tela</h3><p>Erro temporário ao carregar ${esc(titleFor(screen))}. Tente atualizar o app.</p></div><span class="badge red">erro</span></div><p class="muted">${esc(err && err.message ? err.message : 'erro desconhecido')}</p><div class="actions"><button class="btn" data-screen-go="home">Voltar ao início</button></div></section>` + appFooterHTML();
  }
  wireSmartHeightInputs();
  bindScreen();
}

function renderOnboarding(){
  if(state.pendingProfileCompletion) return renderGoogleCompleteOnboarding();
  if(state.pendingEmailVerification && !cloudUser && onboardingView !== 'login' && onboardingView !== 'local') return renderVerifyEmailOnboarding();
  if(onboardingView === 'signup') return renderSignupOnboarding();
  if(onboardingView === 'local') return renderLocalOnboarding();
  return `<section class="welcome-hero login-hero">
    <div class="welcome-copy">
      <p class="eyebrow">Gym Bronze</p>
      <h2>Forje seu físico. Registre sua evolução.</h2>
      <p>Entre para sincronizar na nuvem, receber apoio de IA e evoluir treino após treino.</p>
      <div class="mini-status"><span>${cloudStatusHTML()}</span><span>${isOffline()?'offline':'online'}</span></div>
    </div>
  </section>
  <section class="auth-center">
    <div class="card auth-card">
      <div class="card-title"><div><h3>Entrar</h3><p>Acesse sua conta para continuar.</p></div></div>
      <div class="form-grid single">
        <div class="field"><label>E-mail</label><input class="input" id="loginEmail" type="text" inputmode="email" autocomplete="email" placeholder="seu@email.com"></div>
        <div class="field"><label>Senha</label><input class="input" id="loginPassword" type="password" autocomplete="current-password" placeholder="sua senha"></div>
      </div>
      <div class="actions"><button class="btn full" data-onboarding="login">Entrar</button><button class="btn google full" data-onboarding="google-login" type="button"><span>G</span> Entrar com Google</button></div>
      <div class="auth-separator"><span>ou</span></div>
      <div class="auth-links">
        <button type="button" data-onboarding="show-signup">Criar conta</button>
        <span>•</span>
        <button type="button" data-onboarding="show-local">Iniciar localmente</button>
      </div>
    </div>
  </section>`;
}
function renderGoogleCompleteOnboarding(){
  const p=profile() || {};
  return `<section class="welcome-hero"><div class="welcome-copy"><p class="eyebrow">Login Google</p><h2>Complete seu perfil</h2><p>Você já entrou com Google. Agora vamos fechar seu perfil em etapas para não ficar poluído.</p></div></section>
  <section class="auth-center"><div class="card auth-card wide signup-wizard-card">
    <div class="card-title"><div><h3>Completar conta Google</h3><p>Perfil + rotina + termos. Sem e-mail e senha, porque o Google já cuidou disso.</p></div><span class="badge green">Google conectado</span></div>
    <div class="signup-progress" aria-label="Progresso do perfil Google">
      <div class="signup-progress-track"><span id="googleProgressFill"></span></div>
      <div class="signup-step-dots">
        <span class="signup-step-dot" data-google-step-dot="1">Perfil</span>
        <span class="signup-step-dot" data-google-step-dot="2">Rotina</span>
        <span class="signup-step-dot" data-google-step-dot="3">Finalizar</span>
      </div>
    </div>
    <div class="signup-step-panel" data-google-step="1">
      <div class="section-head compact"><div><h3>1. Informações pessoais</h3><p>Esses dados personalizam treino, score e IA.</p></div></div>
      ${onboardingPersonalFields('google')}
      <p class="form-error hidden" id="googleStep1Error"></p>
      <div class="actions"><button class="btn full" data-onboarding="google-next" type="button">Próximo</button><button class="btn secondary full" data-onboarding="google-logout" type="button">Sair desta conta Google</button></div>
    </div>
    <div class="signup-step-panel" data-google-step="2">
      <div class="section-head compact"><div><h3>2. Rotina e lembretes</h3><p>Opcional, mas ajuda a IA a organizar dieta, hidratação e horário de treino.</p></div><span class="badge orange">Opcional</span></div>
      ${onboardingRoutineFields('google')}
      <p class="form-error hidden" id="googleStep2Error"></p>
      <div class="actions"><button class="btn full" data-onboarding="google-next" type="button">Próximo</button><button class="btn secondary full" data-onboarding="google-back" type="button">Voltar</button></div>
    </div>
    <div class="signup-step-panel" data-google-step="3">
      <div class="section-head compact"><div><h3>3. Finalizar perfil</h3><p>Confirme os termos para salvar seu perfil e gerar o primeiro treino específico.</p></div></div>
      <div class="notice-box"><b>Conta Google conectada</b><span>${esc(state.pendingProfileCompletion?.email || p.accountEmail || '')}</span></div>
      <label class="legal-check"><input type="checkbox" id="googleAcceptTerms"> <span>Li e aceito os Termos, a Política de Privacidade e entendo que o Gym Bronze não substitui profissionais de saúde, nutrição ou educação física.</span></label>
      <p class="form-error hidden" id="googleError"></p>
      <div class="actions"><button class="btn full" data-onboarding="google-complete" type="button">Salvar perfil e gerar treino</button><button class="btn secondary full" data-onboarding="google-back" type="button">Voltar</button></div>
    </div>
  </div></section>`;
}
function renderVerifyEmailOnboarding(){
  const email = state.pendingEmailVerification?.email || '';
  return `<section class="welcome-hero"><div class="welcome-copy"><p class="eyebrow">Confirme seu e-mail</p><h2>Falta só ativar sua conta</h2><p>Enviamos um link de confirmação para <b>${esc(email)}</b>. Depois de confirmar, volte aqui e faça login para liberar IA, nutri e sincronização.</p></div></section>
  <section class="auth-center"><div class="card auth-card wide verify-card">
    <div class="card-title"><div><h3>Verificação necessária</h3><p>Conta real precisa de e-mail confirmado. O modo local continua disponível sem verificação.</p></div><span class="badge yellow">Pendente</span></div>
    <div class="notice-box"><b>Confira sua caixa de entrada</b><span>Abra o e-mail da Supabase/Auth e clique em “Confirm email address”. Verifique também spam/lixo eletrônico.</span></div>
    <p class="form-error hidden" id="verifyError"></p>
    <div class="actions">
      <button class="btn full" data-onboarding="verify-login">Já confirmei, entrar agora</button>
      <button class="btn secondary full" data-onboarding="verify-resend">Reenviar e-mail</button>
      <button class="btn secondary full" data-onboarding="verify-local">Usar modo local por enquanto</button>
    </div>
    <p class="muted">A IA e a nuvem ficam bloqueadas na conta até o e-mail ser confirmado. Isso evita contas inválidas e erros de sessão.</p>
  </div></section>`;
}

function renderSignupOnboarding(){
  return `<section class="welcome-hero"><div class="welcome-copy"><p class="eyebrow">Criar conta</p><h2>Monte seu perfil inicial</h2><p>Cadastro em 3 passos para não ficar pesado: perfil, rotina/lembretes e acesso.</p></div></section>
  <section class="auth-center"><div class="card auth-card wide signup-wizard-card">
    <div class="card-title"><div><h3>Criar conta</h3><p>Perfil + rotina + login. A barra mostra seu avanço.</p></div><span class="badge green">IA inclusa</span></div>
    <div class="signup-progress" aria-label="Progresso do cadastro">
      <div class="signup-progress-track"><span id="signupProgressFill"></span></div>
      <div class="signup-step-dots">
        <span class="signup-step-dot" data-step-dot="1">Perfil</span>
        <span class="signup-step-dot" data-step-dot="2">Rotina</span>
        <span class="signup-step-dot" data-step-dot="3">Conta</span>
      </div>
    </div>
    <div class="signup-step-panel" data-signup-step="1">
      <div class="section-head compact"><div><h3>1. Informações pessoais</h3><p>Base para a IA montar treino, metas e recomendações.</p></div></div>
      ${onboardingPersonalFields('signup')}
      <p class="form-error hidden" id="signupStep1Error"></p>
      <div class="actions"><button class="btn full" data-onboarding="signup-next" type="button">Próximo</button><button class="btn secondary full" data-onboarding="show-login" type="button">Voltar ao login</button></div>
    </div>
    <div class="signup-step-panel" data-signup-step="2">
      <div class="section-head compact"><div><h3>2. Rotina e lembretes</h3><p>Opcional, mas ajuda muito a organizar nutrição, treino e água.</p></div><span class="badge orange">Opcional</span></div>
      ${onboardingRoutineFields('signup')}
      <p class="form-error hidden" id="signupStep2Error"></p>
      <div class="actions"><button class="btn full" data-onboarding="signup-next" type="button">Próximo</button><button class="btn secondary full" data-onboarding="signup-back" type="button">Voltar</button></div>
    </div>
    <div class="signup-step-panel" data-signup-step="3">
      <div class="section-head compact"><div><h3>3. Acesso da conta</h3><p>Agora só falta e-mail, senha e aceite dos termos.</p></div></div>
      <div class="form-grid">
        <div class="field"><label>E-mail</label><input class="input" id="signupEmail" type="text" inputmode="email" autocomplete="email" placeholder="seu@email.com"></div>
        <div class="field"><label>Senha</label><input class="input" id="signupPassword" type="password" autocomplete="new-password" placeholder="Maiúscula, número e especial"></div>
        <div class="field"><label>Confirmar senha</label><input class="input" id="signupPassword2" type="password" autocomplete="new-password" placeholder="repita a senha"></div>
        <label class="legal-check" style="grid-column:1/-1"><input type="checkbox" id="signupAcceptTerms"> <span>Li e aceito os Termos, a Política de Privacidade e entendo que o Gym Bronze não substitui profissionais de saúde, nutrição ou educação física.</span></label>
      </div>
      <p class="form-error hidden" id="signupError"></p>
      <div class="actions"><button class="btn full" data-onboarding="signup">Criar conta</button><button class="btn secondary full" data-onboarding="signup-back" type="button">Voltar</button></div>
    </div>
  </div></section>`;
}
function renderLocalOnboarding(){
  return `<section class="welcome-hero"><div class="welcome-copy"><p class="eyebrow">Modo local</p><h2>Começar sem criar conta</h2><p>Use sem conta. Seus dados ficam no aparelho e a IA funciona enquanto o modo local estiver disponível.</p></div></section>
  <section class="auth-center"><div class="card auth-card wide">
    <div class="card-title"><div><h3>Perfil local</h3><p>Preencha para a IA gerar o treino de adaptação.</p></div><span class="badge yellow">Local</span></div>
    ${onboardingProfileFields('local')}
    <label class="legal-check"><input type="checkbox" id="localAcceptTerms"> <span>Li e aceito os Termos, a Política de Privacidade e entendo que a IA é apenas apoio educativo.</span></label>
    <p class="form-error hidden" id="localError"></p>
    <div class="actions"><button class="btn full" data-onboarding="local">Iniciar localmente e gerar treino</button><button class="btn secondary full" data-onboarding="show-login">Voltar ao login</button></div>
    <p class="muted">Se limpar os dados do navegador, o histórico local pode ser perdido. Para recuperar em outro dispositivo, use uma conta.</p>
  </div></section>`;
}
function onboardingPersonalFields(prefix){
  return `<div class="form-grid">
    <div class="field"><label>Nome</label><input class="input" id="${prefix}Name" placeholder="Seu nome"></div>
    <div class="field"><label>Idade</label><input class="input" id="${prefix}Age" type="number" min="12" max="99" placeholder="ex: 21"></div>
    <div class="field"><label>Sexo</label><select class="select" id="${prefix}Sex"><option value="">Selecione</option><option value="Homem">Homem</option><option value="Mulher">Mulher</option><option value="Outro/Prefiro não informar">Outro/Prefiro não informar</option></select></div>
    <div class="field"><label>Altura</label><input class="input" id="${prefix}Height" inputmode="decimal" placeholder="ex: 1,88"></div>
    <div class="field"><label>Peso inicial</label><input class="input" id="${prefix}Weight" inputmode="decimal" placeholder="ex: 83,2"></div>
    <div class="field"><label>Objetivo</label><input class="input" id="${prefix}Goal" placeholder="ex: ganhar massa e secar"></div>
    <div class="field"><label>Foco principal</label><input class="input" id="${prefix}Focus" placeholder="ex: peito, braços, recomposição"></div>
    <div class="field"><label>Nível</label><select class="select" id="${prefix}Experience"><option value="">Selecione</option><option>Iniciante</option><option>Intermediário</option><option>Avançado</option></select></div>
    <div class="field"><label>Dias por semana</label><select class="select" id="${prefix}Days"><option value="2">2 dias</option><option value="3">3 dias</option><option value="4">4 dias</option><option value="5" selected>5 dias</option><option value="6">6 dias</option></select></div>
    <div class="field" style="grid-column:1/-1"><label>Observações importantes</label><textarea id="${prefix}Notes" placeholder="Dor, limitação, tempo disponível, exercícios que gosta/não gosta, restrições alimentares..."></textarea></div>
  </div>`;
}
function onboardingRoutineFields(prefix){
  return `<div class="onboarding-routine">
    <div class="form-grid">
      <div class="field"><label>Que horas você acorda?</label><input class="input" id="${prefix}WakeTime" type="time" value="09:00"></div>
      <div class="field"><label>Almoço médio</label><input class="input" id="${prefix}LunchTime" type="time" value="13:00"></div>
      <div class="field"><label>Jantar médio</label><input class="input" id="${prefix}DinnerTime" type="time" value="20:00"></div>
      <div class="field"><label>Horário de treino, se souber</label><input class="input" id="${prefix}WorkoutTime" type="time" value="12:00"></div>
      <div class="field" style="grid-column:1/-1"><label>Quer contar como funciona seu dia útil?</label><textarea id="${prefix}WorkdayDescription" placeholder="ex: acordo tarde, trabalho no computador, treino perto do almoço, chego cansado à noite..."></textarea></div>
    </div>
    <div class="reminder-checks">
      <label class="legal-check"><input type="checkbox" id="${prefix}RemWorkout"> <span>Receber lembrete de treino</span></label>
      <label class="legal-check"><input type="checkbox" id="${prefix}RemMeals"> <span>Receber lembretes de refeição</span></label>
      <label class="legal-check"><input type="checkbox" id="${prefix}RemWater"> <span>Receber lembrete de beber água</span></label>
    </div>
    <p class="muted">As preferências ficam salvas no Supabase. A permissão da notificação precisa ser liberada no aparelho/navegador.</p>
  </div>`;
}
function onboardingProfileFields(prefix){
  return `<div class="form-grid">
    <div class="field"><label>Nome</label><input class="input" id="${prefix}Name" placeholder="Seu nome"></div>
    <div class="field"><label>Idade</label><input class="input" id="${prefix}Age" type="number" min="12" max="99" placeholder="ex: 21"></div>
    <div class="field"><label>Sexo</label><select class="select" id="${prefix}Sex"><option value="">Selecione</option><option value="Homem">Homem</option><option value="Mulher">Mulher</option><option value="Outro/Prefiro não informar">Outro/Prefiro não informar</option></select></div>
    <div class="field"><label>Altura</label><input class="input" id="${prefix}Height" inputmode="decimal" placeholder="ex: 1,88"></div>
    <div class="field"><label>Peso inicial</label><input class="input" id="${prefix}Weight" inputmode="decimal" placeholder="ex: 83,2"></div>
    <div class="field"><label>Objetivo</label><input class="input" id="${prefix}Goal" placeholder="ex: ganhar massa e secar"></div>
    <div class="field"><label>Foco principal</label><input class="input" id="${prefix}Focus" placeholder="ex: peito, braços, recomposição"></div>
    <div class="field"><label>Nível</label><select class="select" id="${prefix}Experience"><option value="">Selecione</option><option>Iniciante</option><option>Intermediário</option><option>Avançado</option></select></div>
    <div class="field"><label>Dias por semana</label><select class="select" id="${prefix}Days"><option value="2">2 dias</option><option value="3">3 dias</option><option value="4">4 dias</option><option value="5" selected>5 dias</option><option value="6">6 dias</option></select></div>
    <div class="onboarding-routine" style="grid-column:1/-1">
      <div class="card-title"><div><h3>Rotina e lembretes</h3><p>Ajuda a IA a montar nutrição melhor e prepara notificações discretas.</p></div><span class="badge orange">Opcional</span></div>
      <div class="form-grid">
        <div class="field"><label>Que horas você acorda?</label><input class="input" id="${prefix}WakeTime" type="time" value="09:00"></div>
        <div class="field"><label>Almoço médio</label><input class="input" id="${prefix}LunchTime" type="time" value="13:00"></div>
        <div class="field"><label>Jantar médio</label><input class="input" id="${prefix}DinnerTime" type="time" value="20:00"></div>
        <div class="field"><label>Horário de treino, se souber</label><input class="input" id="${prefix}WorkoutTime" type="time" value="12:00"></div>
        <div class="field" style="grid-column:1/-1"><label>Quer contar como funciona seu dia útil?</label><textarea id="${prefix}WorkdayDescription" placeholder="ex: acordo tarde, treino no almoço, trabalho à tarde, chego cansado à noite..."></textarea></div>
      </div>
      <div class="reminder-checks">
        <label class="legal-check"><input type="checkbox" id="${prefix}RemWorkout"> <span>Receber lembrete de treino</span></label>
        <label class="legal-check"><input type="checkbox" id="${prefix}RemMeals"> <span>Receber lembretes de refeição</span></label>
        <label class="legal-check"><input type="checkbox" id="${prefix}RemWater"> <span>Receber lembrete de beber água</span></label>
      </div>
      <p class="muted">As notificações dependem da permissão do navegador e funcionam melhor com o app instalado.</p>
    </div>
    <div class="field" style="grid-column:1/-1"><label>Observações importantes</label><textarea id="${prefix}Notes" placeholder="Dor, limitação, tempo disponível, exercícios que gosta/não gosta, restrições alimentares..."></textarea></div>
  </div>`;
}
function bindOnboarding(){
  document.querySelectorAll('[data-onboarding]').forEach(btn=>btn.onclick=()=>handleOnboarding(btn.dataset.onboarding));
  if(onboardingView==='signup') setSignupStep(signupStep);
  if(state.pendingProfileCompletion) setGoogleStep(googleStep);
  if(state.pendingProfileCompletion){
    const p=profile() || {};
    const map={Name:p.name||state.pendingProfileCompletion.name||'', Age:p.age||'', Sex:p.sex||'', Height:p.height||'', Weight:p.weight||'', Goal:p.goal||'', Focus:p.focus||'', Experience:p.experience||'Iniciante', Days:p.daysPerWeek||'5', WakeTime:p.routine?.wakeTime||'09:00', LunchTime:p.routine?.lunchTime||'13:00', DinnerTime:p.routine?.dinnerTime||'20:00', WorkoutTime:p.reminders?.times?.workout||'12:00', WorkdayDescription:p.routine?.workdayDescription||'', Notes:p.notes||''};
    Object.entries(map).forEach(([k,v])=>{ const el=byId('google'+k); if(el && !el.value) el.value=v; });
  }
}
function handleOnboarding(action){
  if(action==='show-signup'){ onboardingView='signup'; signupStep=1; render(); return; }
  if(action==='show-local'){ onboardingView='local'; render(); return; }
  if(action==='show-login'){ onboardingView='login'; render(); return; }
  if(action==='login') return onboardingLogin();
  if(action==='google-login') return onboardingGoogleLogin();
  if(action==='google-complete') return onboardingGoogleComplete();
  if(action==='google-logout') return googleCompletionLogout();
  if(action==='google-next') return googleWizardNext();
  if(action==='google-back') return googleWizardBack();
  if(action==='signup-next') return signupWizardNext();
  if(action==='signup-back') return signupWizardBack();
  if(action==='signup') return onboardingSignup();
  if(action==='local') return onboardingLocal();
  if(action==='verify-login') return verifyEmailLoginNow();
  if(action==='verify-resend') return resendVerificationEmail();
  if(action==='verify-local') return useLocalWhileEmailPending();
}


function setGoogleStep(step){
  googleStep=Math.max(1, Math.min(3, Number(step)||1));
  document.querySelectorAll('[data-google-step]').forEach(panel=>{
    panel.classList.toggle('active', Number(panel.dataset.googleStep)===googleStep);
  });
  document.querySelectorAll('[data-google-step-dot]').forEach(dot=>{
    const n=Number(dot.dataset.googleStepDot||0);
    dot.classList.toggle('active', n===googleStep);
    dot.classList.toggle('done', n<googleStep);
  });
  const fill=byId('googleProgressFill');
  if(fill) fill.style.width = `${Math.round((googleStep/3)*100)}%`;
}
function googleWizardNext(){
  if(googleStep===1){
    const msg=validateProfileInfo(readOnboardingProfile('google'));
    if(msg) return showFormError('googleStep1Error', msg);
  }
  setGoogleStep(googleStep+1);
  window.scrollTo({top:0, behavior:'smooth'});
}
function googleWizardBack(){
  setGoogleStep(googleStep-1);
  window.scrollTo({top:0, behavior:'smooth'});
}

function setSignupStep(step){
  signupStep=Math.max(1, Math.min(3, Number(step)||1));
  document.querySelectorAll('.signup-step-panel').forEach(panel=>{
    panel.classList.toggle('active', Number(panel.dataset.signupStep)===signupStep);
  });
  document.querySelectorAll('.signup-step-dot').forEach(dot=>{
    const n=Number(dot.dataset.stepDot||0);
    dot.classList.toggle('active', n===signupStep);
    dot.classList.toggle('done', n<signupStep);
  });
  const fill=byId('signupProgressFill');
  if(fill) fill.style.width = `${Math.round((signupStep/3)*100)}%`;
}
function signupWizardNext(){
  if(signupStep===1){
    const msg=validateProfileInfo(readOnboardingProfile('signup'));
    if(msg) return showFormError('signupStep1Error', msg);
  }
  setSignupStep(signupStep+1);
  window.scrollTo({top:0, behavior:'smooth'});
}
function signupWizardBack(){
  setSignupStep(signupStep-1);
  window.scrollTo({top:0, behavior:'smooth'});
}
function readOnboardingProfile(prefix){
  return {
    name: byId(prefix+'Name')?.value?.trim() || '',
    age: byId(prefix+'Age')?.value?.trim() || '',
    sex: byId(prefix+'Sex')?.value?.trim() || '',
    height: formatHeightSmart(byId(prefix+'Height')?.value) || '',
    weight: byId(prefix+'Weight')?.value?.trim() || '',
    goal: byId(prefix+'Goal')?.value?.trim() || '',
    focus: byId(prefix+'Focus')?.value?.trim() || '',
    experience: byId(prefix+'Experience')?.value?.trim() || '',
    daysPerWeek: byId(prefix+'Days')?.value?.trim() || '',
    routine:{
      wakeTime: normalizeTimeText(byId(prefix+'WakeTime')?.value, '09:00'),
      lunchTime: normalizeTimeText(byId(prefix+'LunchTime')?.value, '13:00'),
      dinnerTime: normalizeTimeText(byId(prefix+'DinnerTime')?.value, '20:00'),
      workdayDescription: byId(prefix+'WorkdayDescription')?.value?.trim() || ''
    },
    reminders:{
      enabled: !!(byId(prefix+'RemWorkout')?.checked || byId(prefix+'RemMeals')?.checked || byId(prefix+'RemWater')?.checked),
      types:{workout:!!byId(prefix+'RemWorkout')?.checked, meals:!!byId(prefix+'RemMeals')?.checked, water:!!byId(prefix+'RemWater')?.checked},
      times:{workout: normalizeTimeText(byId(prefix+'WorkoutTime')?.value, '12:00')},
      water:{intervalHours:2, start:normalizeTimeText(byId(prefix+'WakeTime')?.value, '09:00'), end:'21:00'}
    },
    notes: byId(prefix+'Notes')?.value?.trim() || ''
  };
}

async function maybeAskNotificationPermissionForProfile(p=profile()){
  ensureProfile(p);
  if(!p.reminders?.enabled) return;
  const ok=await requestReminderPermission();
  p.reminders.permission=ok?'granted':(notificationAvailable()?Notification.permission:'unsupported');
  save();
  if(ok) toast('Lembretes ativados neste aparelho.');
  else toast('Lembretes salvos. Ative a permissão do navegador quando quiser receber notificações.');
}

function notificationAvailable(){
  return typeof window !== 'undefined' && 'Notification' in window;
}
async function requestReminderPermission(){
  try{
    if(!notificationAvailable()) return false;
    if(Notification.permission === 'granted') return true;
    if(Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }catch(e){
    return false;
  }
}
function showReminderNotification(title, body){
  try{
    if(!notificationAvailable() || Notification.permission !== 'granted') return false;
    const options = {
      body: body || '',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: 'gym-bronze-reminder',
      renotify: false
    };
    if(navigator.serviceWorker && navigator.serviceWorker.ready){
      navigator.serviceWorker.ready.then(reg=>{
        if(reg && reg.showNotification) reg.showNotification(title, options);
        else new Notification(title, options);
      }).catch(()=>new Notification(title, options));
    }else{
      new Notification(title, options);
    }
    return true;
  }catch(e){
    return false;
  }
}

function showFormError(id, message){
  const el=byId(id);
  if(!el){ toast(message); return; }
  el.textContent=message;
  el.classList.remove('hidden');
}

function friendlyAuthError(error){
  const msg = String(error?.message || error || '').toLowerCase();
  if(msg.includes('invalid login credentials') || msg.includes('invalid credentials')){
    return 'Conta não encontrada ou senha incorreta. Verifique os dados, crie uma conta ou use o modo local.';
  }
  if(msg.includes('email not confirmed') || msg.includes('not confirmed')){
    return 'Confirme seu e-mail antes de entrar. Abra o link enviado para sua caixa de entrada.';
  }
  if(msg.includes('rate limit')){
    return 'Muitas tentativas agora. Aguarde alguns minutos e tente novamente.';
  }
  return error?.message || 'Não foi possível entrar agora.';
}
function normalizeProfileInfoFromUser(user){
  const meta = user?.user_metadata || {};
  return {
    name: meta.display_name || meta.name || user?.email?.split('@')[0] || '',
    age: meta.age || '',
    sex: meta.sex || '',
    height: meta.height || '',
    weight: meta.weight || meta.initial_weight || '',
    goal: meta.goal || '',
    focus: meta.focus || '',
    experience: meta.experience || 'Iniciante',
    daysPerWeek: String(meta.daysPerWeek || meta.days_per_week || 5),
    routine: meta.routine || {wakeTime:meta.wake_time||'09:00', lunchTime:meta.lunch_time||'13:00', dinnerTime:meta.dinner_time||'20:00', workdayDescription:meta.workday_description||''},
    reminders: meta.reminders || null,
    notes: meta.notes || ''
  };
}
function profileInfoLooksComplete(info){
  if(!info) return false;
  return !validateProfileInfo({
    name:info.name || '',
    age:info.age || '',
    sex:info.sex || '',
    height:info.height || '',
    weight:info.weight || '',
    goal:info.goal || '',
    focus:info.focus || '',
    experience:info.experience || 'Iniciante',
    daysPerWeek:info.daysPerWeek || '5',
    notes:info.notes || ''
  });
}
function currentProfileLooksComplete(p=profile()){
  if(!p) return false;
  return profileInfoLooksComplete({
    name:p.name, age:p.age, sex:p.sex, height:p.height, weight:p.weight,
    goal:p.goal, focus:p.focus, experience:p.experience, daysPerWeek:p.daysPerWeek, notes:p.notes
  });
}
async function onboardingGoogleLogin(){
  if(!supabaseClient) return toast('Supabase não carregou. Reabra o app.');
  if(isOffline()) return toast('Você está offline. Entre com Google quando estiver online.');
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider:'google',
    options:{ redirectTo, queryParams:{ prompt:'select_account' } }
  });
  if(error) return toast('Erro ao abrir Google: '+friendlyAuthError(error));
}
async function onboardingGoogleComplete(){
  if(!cloudUser || isAnonymousCloudUser()){
    await refreshCloudUser(false);
    if(!cloudUser || isAnonymousCloudUser()) return showFormError('googleError','Sessão Google não encontrada. Entre com Google novamente.');
  }
  const info=readOnboardingProfile('google');
  const msg=validateProfileInfo(info);
  if(msg) return showFormError('googleError', msg);
  if(!byId('googleAcceptTerms')?.checked) return showFormError('googleError', 'Aceite os Termos e a Política de Privacidade para continuar.');
  const p=prepareAccountProfile(cloudUser, info);
  applyProfileInfo(info, p);
  p.cloudUserId=cloudUser.id;
  p.accountEmail=cloudUser.email || p.accountEmail || '';
  markLegalAcceptance(p);
  await maybeAskNotificationPermissionForProfile(p);
  state.pendingProfileCompletion=null;
  googleStep=1;
  state.pendingEmailVerification=null;
  state.onboardingDone=true;
  state.entryMode='account';
  screen='home';
  save();
  try{ await upsertCloudProfile(info.name, info); }catch(e){ console.warn('profile upsert failed', e); }
  await generateInitialPlanFromAI({silent:false, force:true, fallbackDefault:true});
  toast(profile().planMeta?.source==='ai' ? 'Perfil Google completo. Treino específico criado.' : 'Perfil Google completo. Apliquei treino padrão por fallback.');
  render();
}
async function googleCompletionLogout(){
  if(supabaseClient) await supabaseClient.auth.signOut().catch(()=>{});
  cloudUser=null;
  state.pendingProfileCompletion=null;
  googleStep=1;
  state.onboardingDone=false;
  state.entryMode=null;
  onboardingView='login';
  save();
  render();
  toast('Conta Google desconectada.');
}
function setPendingEmailVerification(email, profileInfo=null, legalInfo=null){
  const current = state.pendingEmailVerification || {};
  state.pendingEmailVerification = {
    email: email || current.email || '',
    createdAt: current.createdAt || nowISO(),
    profileInfo: profileInfo || current.profileInfo || null,
    acceptedTermsAt: legalInfo?.acceptedTermsAt || current.acceptedTermsAt || null,
    acceptedPrivacyAt: legalInfo?.acceptedPrivacyAt || current.acceptedPrivacyAt || null
  };
  state.onboardingDone = false;
  state.entryMode = null;
  onboardingView = 'verify';
  save();
}
async function fetchCloudProfileInfo(user){
  if(!supabaseClient || !user?.id) return null;
  try{
    const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if(error || !data) return null;
    return {
      name:data.name || user.email?.split('@')[0] || '',
      age:data.age || '',
      sex:data.sex || '',
      height:data.height || '',
      weight:data.initial_weight || '',
      goal:data.goal || '',
      focus:data.focus || '',
      experience:data.experience || 'Iniciante',
      daysPerWeek:String(data.days_per_week || 5),
      notes:data.notes || '',
      routine:data.routine || {wakeTime:data.wake_time||'09:00', lunchTime:data.lunch_time||'13:00', dinnerTime:data.dinner_time||'20:00', workdayDescription:data.workday_description||''},
      reminders:data.reminders || null
    };
  }catch(e){ return null; }
}
function findLocalProfileForCloudUser(user){
  if(!user) return null;
  return state.profiles.find(p=>p.cloudUserId===user.id || (p.accountEmail && user.email && String(p.accountEmail).toLowerCase()===String(user.email).toLowerCase())) || null;
}
function prepareAccountProfile(user, info={}){
  let p=findLocalProfileForCloudUser(user);
  if(!p){
    p=newProfile(info?.name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Novo usuário');
    p.cloudUserId=user.id;
    p.accountEmail=user.email || '';
    state.profiles.push(p);
  }
  state.activeProfileId=p.id;
  p.cloudUserId=user.id;
  p.accountEmail=user.email || p.accountEmail || '';
  // Só aplica os dados cadastrais neste perfil da conta, nunca no perfil ativo antigo.
  if(info && info.name) applyProfileInfo(info, p);
  ensureProfile(p);
  return p;
}
async function completeVerifiedAccountSession(){
  const user = await getCurrentCloudUser();
  if(!user || isAnonymousCloudUser()) return false;
  const confirmed = !!(user.email_confirmed_at || user.confirmed_at);
  if(!confirmed){
    setPendingEmailVerification(user.email || state.pendingEmailVerification?.email || '');
    return false;
  }

  const pending = state.pendingEmailVerification || {};
  const cloudInfo = await fetchCloudProfileInfo(user);
  const signupInfo = pending.profileInfo || cloudInfo || normalizeProfileInfoFromUser(user);
  const accountProfile = prepareAccountProfile(user, signupInfo);

  if(!profileInfoLooksComplete(signupInfo) && !currentProfileLooksComplete(accountProfile)){
    state.pendingProfileCompletion={
      provider:'google',
      userId:user.id,
      email:user.email || '',
      name:signupInfo?.name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || ''
    };
    state.pendingEmailVerification=null;
    state.onboardingDone=false;
    state.entryMode='account';
    onboardingView='google-complete';
    googleStep=1;
    save();
    return false;
  }

  if(pending.acceptedTermsAt) accountProfile.acceptedTermsAt = pending.acceptedTermsAt;
  if(pending.acceptedPrivacyAt) accountProfile.acceptedPrivacyAt = pending.acceptedPrivacyAt;
  markLegalAcceptance(accountProfile);

  state.pendingEmailVerification = null;
  state.pendingProfileCompletion = null;
  state.onboardingDone = true;
  state.entryMode = 'account';
  save();

  try{ await upsertCloudProfile(accountProfile.name || user.user_metadata?.display_name || 'Usuário', signupInfo); }catch(e){ console.warn('profile upsert failed', e); }
  try{ await loadLatestPlanFromCloud(); }catch(e){ console.warn('plan load failed', e); }
  try{ await loadLatestDietPlanFromCloud(); }catch(e){ console.warn('diet load failed', e); }
  try{ await loadLessonsFromCloud({silent:true}); }catch(e){ console.warn('lessons load failed', e); }
  try{ await syncXpEventsToCloud({silent:true}); await loadXpFromCloud({silent:true}); }catch(e){ console.warn('xp sync/load failed', e); }
  save();
  return true;
}
function validateProfileInfo(info){
  if(!info.name || info.name.length < 2) return 'Informe um nome com pelo menos 2 letras.';
  const age=Number(info.age);
  if(!Number.isFinite(age) || age < 12 || age > 99) return 'Informe uma idade válida.';
  if(!info.sex) return 'Informe o sexo para personalizar melhor o treino.';
  const height=parseNumberValue(info.height);
  if(!height || height < 1 || height > 2.5) return 'Informe uma altura válida. Exemplo: 1,88.';
  const weight=parseNumberValue(info.weight);
  if(!weight || weight < 30 || weight > 300) return 'Informe um peso inicial válido.';
  if(!info.goal || info.goal.length < 3) return 'Informe seu objetivo.';
  if(!info.focus || info.focus.length < 2) return 'Informe seu foco principal.';
  if(!info.experience) return 'Informe sua experiência.';
  if(!info.daysPerWeek || clampTrainingDays(info.daysPerWeek) != Number(info.daysPerWeek)) return 'Escolha entre 2 e 6 dias por semana.';
  return '';
}

function validateStrongPassword(password){
  if(!password || password.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if(!/[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(password)) return 'A senha precisa ter ao menos uma letra maiúscula.';
  if(!/[0-9]/.test(password)) return 'A senha precisa ter ao menos um número.';
  if(!/[^A-Za-z0-9À-ÿ]/.test(password)) return 'A senha precisa ter ao menos um caractere especial.';
  return '';
}
function markLegalAcceptance(targetProfile=null){
  const p=targetProfile || profile();
  const now=nowISO();
  p.acceptedTermsAt = p.acceptedTermsAt || now;
  p.acceptedPrivacyAt = p.acceptedPrivacyAt || now;
  return p;
}
function applyProfileInfo(info, targetProfile=null){
  const p=targetProfile || profile();
  p.name=info.name;
  p.age=info.age;
  p.sex=info.sex;
  p.height=info.height;
  p.weight=info.weight;
  p.goal=info.goal;
  p.focus=info.focus;
  p.experience=normalizeExperienceLabel(info.experience);
  p.daysPerWeek=String(clampTrainingDays(info.daysPerWeek));
  p.notes=info.notes;
  if(info.routine){
    p.routine={
      ...(p.routine||{}),
      wakeTime:normalizeTimeText(info.routine.wakeTime,'09:00'),
      lunchTime:normalizeTimeText(info.routine.lunchTime,'13:00'),
      dinnerTime:normalizeTimeText(info.routine.dinnerTime,'20:00'),
      workdayDescription:info.routine.workdayDescription||'',
      lessons:Array.isArray(info.routine.lessons)?info.routine.lessons:(p.routine?.lessons||[]),
      lessonLogs:Array.isArray(info.routine.lessonLogs)?info.routine.lessonLogs:(p.routine?.lessonLogs||[])
    };
    if(Array.isArray(p.routine.lessons)) p.lessons=p.routine.lessons;
    if(Array.isArray(p.routine.lessonLogs)) p.lessonLogs=p.routine.lessonLogs;
  }
  if(info.reminders){
    p.reminders={...(p.reminders||{}), ...info.reminders, types:{...(p.reminders?.types||{}), ...(info.reminders.types||{})}, times:{...(p.reminders?.times||{}), ...(info.reminders.times||{})}, water:{...(p.reminders?.water||{}), ...(info.reminders.water||{})}};
    p.reminders.enabled=!!(p.reminders.types?.workout||p.reminders.types?.meals||p.reminders.types?.water);
  }else if(p.routine && !p.reminders?.times?.workout){
    p.reminders={...(p.reminders||{}), times:{...(p.reminders?.times||{}), workout:suggestedWorkoutTimeFromRoutine(p)}};
  }
  applyProgramDuration(p);
  ensureProfile(p);
  if(!Array.isArray(p.workouts) || !p.workouts.length){
    p.queue=[];
    p.planMeta={source:'pending', cycle:p.planMeta?.cycle || 1, title:'Aguardando treino inteligente', notes:'O app vai tentar gerar um treino específico com IA. Se falhar, você pode usar o treino padrão.'};
  }
  save();
  return p;
}
function createFreshLocalProfile(info){
  const p = newProfile(info?.name || 'Perfil local');
  state.profiles.push(p);
  state.activeProfileId = p.id;
  applyProfileInfo(info, p);
  return p;
}
async function verifyEmailLoginNow(){
  const email = state.pendingEmailVerification?.email || '';
  onboardingView = 'login';
  render();
  setTimeout(()=>{
    const input = byId('loginEmail');
    if(input && email) input.value = email;
    const pass = byId('loginPassword');
    if(pass) pass.focus();
  }, 50);
}
async function resendVerificationEmail(){
  if(!supabaseClient) return showFormError('verifyError', 'Supabase não carregou. Reabra o app.');
  if(isOffline()) return showFormError('verifyError', 'Você está offline. Tente reenviar quando estiver online.');
  const email = state.pendingEmailVerification?.email || '';
  if(!email) return showFormError('verifyError', 'E-mail não encontrado. Crie a conta novamente.');
  const { error } = await supabaseClient.auth.resend({ type:'signup', email });
  if(error) return showFormError('verifyError', 'Erro ao reenviar: '+error.message);
  toast('E-mail reenviado. Confira sua caixa de entrada.');
}
async function useLocalWhileEmailPending(){
  state.pendingEmailVerification = null;
  onboardingView = 'local';
  state.entryMode = null;
  state.onboardingDone = false;
  save();
  render();
}

async function onboardingLogin(){
  if(!supabaseClient) return toast('Supabase não carregou. Reabra o app.');
  if(isOffline()) return toast('Você está offline. Faça login quando estiver online.');
  const email=cleanEmailInput(byId('loginEmail')?.value);
  const password=byId('loginPassword')?.value || '';
  if(!isValidEmailInput(email) || !password) return toast('Informe um e-mail válido e a senha.');
  const { data, error } = await supabaseClient.auth.signInWithPassword({email,password});
  if(error){
    const msg = friendlyAuthError(error);
    state.pendingEmailVerification = msg.toLowerCase().includes('confirme') ? {email, createdAt:nowISO()} : state.pendingEmailVerification;
    save();
    toast(msg);
    if(msg.toLowerCase().includes('confirme')){ onboardingView='verify'; render(); }
    return;
  }
  cloudUser=data?.user || null;
  if(!cloudUser) return toast('Não foi possível abrir sua sessão.');
  const confirmed = !!(cloudUser.email_confirmed_at || cloudUser.confirmed_at);
  if(!confirmed){
    await supabaseClient.auth.signOut().catch(()=>{});
    cloudUser=null;
    setPendingEmailVerification(email);
    toast('Confirme seu e-mail para ativar a conta.');
    render();
    return;
  }
  await completeVerifiedAccountSession();
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
  const email=cleanEmailInput(byId('signupEmail')?.value);
  const password=byId('signupPassword')?.value || '';
  const password2=byId('signupPassword2')?.value || '';
  if(!isValidEmailInput(email)) return showFormError('signupError', 'Informe um e-mail válido. Exemplo: nome@gmail.com');
  const passMsg=validateStrongPassword(password);
  if(passMsg) return showFormError('signupError', passMsg);
  if(password !== password2) return showFormError('signupError', 'As senhas não conferem.');
  if(!byId('signupAcceptTerms')?.checked) return showFormError('signupError', 'Aceite os Termos e a Política de Privacidade para continuar.');

  applyProfileInfo(info);
  markLegalAcceptance();
  await maybeAskNotificationPermissionForProfile(profile());
  const legalInfo = {
    acceptedTermsAt: profile().acceptedTermsAt || nowISO(),
    acceptedPrivacyAt: profile().acceptedPrivacyAt || nowISO()
  };
  save();

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options:{
      data:{
        display_name:info.name,
        name:info.name,
        sex:info.sex,
        age:info.age,
        height:info.height,
        weight:info.weight,
        initial_weight:info.weight,
        goal:info.goal,
        focus:info.focus,
        experience:info.experience,
        daysPerWeek:info.daysPerWeek,
        days_per_week:info.daysPerWeek,
        notes:info.notes || '',
        routine:info.routine || null,
        reminders:info.reminders || null,
        wake_time:info.routine?.wakeTime || '',
        lunch_time:info.routine?.lunchTime || '',
        dinner_time:info.routine?.dinnerTime || '',
        workday_description:info.routine?.workdayDescription || '',
        accepted_terms_at:legalInfo.acceptedTermsAt,
        accepted_privacy_at:legalInfo.acceptedPrivacyAt
      },
      emailRedirectTo: window.location.origin + window.location.pathname
    }
  });
  if(error) return showFormError('signupError', 'Erro ao criar conta: '+friendlyAuthError(error));

  const user = data?.user || null;
  const confirmed = !!(user?.email_confirmed_at || user?.confirmed_at);
  if(data?.session?.access_token && confirmed){
    cloudUser = data.session.user || user || null;
    await completeVerifiedAccountSession();
    await generateInitialPlanFromAI({silent:false, fallbackDefault:true});
    screen='home';
    toast('Conta criada e conectada. Treino específico preparado ou fallback aplicado.');
  } else {
    // Conta foi criada no Supabase, mas só será ativada no app após confirmação.
    await supabaseClient.auth.signOut().catch(()=>{});
    cloudUser = null;
    setPendingEmailVerification(email, info, legalInfo);
    toast('Enviamos um link. Confirme seu e-mail para ativar sua conta.');
  }
  render();
}

async function onboardingLocal(){
  const info=readOnboardingProfile('local');
  const msg=validateProfileInfo(info);
  if(msg) return showFormError('localError', msg);
  if(!byId('localAcceptTerms')?.checked) return showFormError('localError', 'Aceite os Termos e a Política de Privacidade para continuar.');

  // Modo local deve sempre começar como um perfil novo, sem reaproveitar
  // nome, histórico, fila ou sessão anônima anterior.
  createFreshLocalProfile(info);
  markLegalAcceptance();
  await maybeAskNotificationPermissionForProfile(profile());
  state.onboardingDone=true;
  state.entryMode='local';
  save();

  if(supabaseClient && !isOffline()){
    try{
      // Garante uma sessão anônima nova para este perfil local.
      // Sem isso, o Supabase pode reaproveitar o anônimo anterior.
      await supabaseClient.auth.signOut().catch(()=>{});
      cloudUser=null;
      const { data, error } = await supabaseClient.auth.signInAnonymously({options:{data:{display_name:info.name, entry_mode:'local', local_profile_id: state.activeProfileId}}});
      if(error) throw error;
      cloudUser=data?.user || null;
      await generateInitialPlanFromAI({silent:false, fallbackDefault:true});
      toast(profile().planMeta?.source==='ai' ? 'Novo perfil local criado com treino específico.' : 'Novo perfil local criado com treino padrão por fallback.');
    }catch(e){
      applyDefaultPlanForProfile(profile(), true);
      toast('Novo perfil local criado. Não consegui usar a IA, então apliquei treino padrão.');
    }
  }else{
    applyDefaultPlanForProfile(profile(), true);
    toast('Novo perfil local criado offline. Apliquei treino padrão por enquanto.');
  }
  screen='home';
  render();
}

function hasWorkoutPlan(p){ return Array.isArray(p?.workouts) && p.workouts.length && Array.isArray(p?.queue) && p.queue.length; }

function dayIndexBR(d=new Date()){
  return d.getDay();
}
function lessonDayLabel(day){
  return ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][Number(day)||0] || 'Seg';
}
function lessonTypeOptions(){
  return ['Yoga','Pilates','Spinning','Power Local','GAP','Funcional','Alongamento','Dança','Luta','Outra'];
}
function lessonIcon(type=''){
  const s=String(type).toLowerCase();
  if(s.includes('yoga')) return '🧘';
  if(s.includes('pilates')) return '🤸';
  if(s.includes('spinning')) return '🚴';
  if(s.includes('gap')) return '🍑';
  if(s.includes('power')) return '💪';
  if(s.includes('luta')) return '🥊';
  if(s.includes('dança') || s.includes('danca')) return '💃';
  if(s.includes('along')) return '🧘';
  return '⚡';
}
function lessonsToday(p=profile()){
  ensureProfile(p);
  const d=dayIndexBR();
  return (p.lessons||[]).filter(a=>Number(a.day)===d).sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')));
}
function lessonDoneToday(p=profile(), lessonId=''){
  const key=dateKey();
  return (p.lessonLogs||[]).some(l=>l.lessonId===lessonId && l.dateKey===key);
}
function lessonTodayHTML(p=profile()){
  const list=lessonsToday(p);
  if(!list.length) return '';
  return `<section class="card compact-card lessons-today-card"><div class="card-title"><div><h3>Aulas de hoje</h3><p>Atividades guiadas também contam para sua rotina.</p></div><span class="badge orange">Aulas</span></div>
    <div class="lesson-list mini">${list.map(a=>`<div class="lesson-row"><div><strong>${lessonIcon(a.type)} ${esc(a.type||a.name||'Aula')}</strong><span>${esc(a.time||'--:--')} • ${esc(a.duration||'')} min • ${esc(a.intensity||'Média')}</span></div><button class="btn sm ${lessonDoneToday(p,a.id)?'green':'secondary'}" data-complete-lesson="${esc(a.id)}">${lessonDoneToday(p,a.id)?'Feita':'Concluir'}</button></div>`).join('')}</div>
  </section>`;
}
function renderLessons(){
  const p=profile(); ensureProfile(p);
  const today=lessonsToday(p);
  const logs=[...(p.lessonLogs||[])].slice(-8).reverse();
  const byDay=[1,2,3,4,5,6,0].map(d=>({day:d, items:(p.lessons||[]).filter(a=>Number(a.day)===d).sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')))}));
  return `<section class="card"><div class="card-title"><div><h3>Aulas</h3><p>Yoga, Pilates, Spinning, Power Local, GAP e outras atividades sem complicar.</p></div><button class="btn sm" data-action="add-lesson">Adicionar aula</button></div>
    ${today.length?`<div class="lesson-list">${today.map(a=>lessonRowHTML(p,a,true)).join('')}</div>`:`<div class="empty"><strong>Nenhuma aula para hoje.</strong><br>Adicione sua grade semanal para aparecer aqui e na tela Hoje.</div>`}
  </section>
  <section class="card"><div class="card-title"><div><h3>Grade semanal</h3><p>Organize aulas fixas da academia ou estúdio.</p></div><span class="badge yellow">Sem séries</span></div>
    <div class="weekly-lessons">${byDay.map(g=>`<div class="lesson-day"><h4>${lessonDayLabel(g.day)}</h4>${g.items.length?g.items.map(a=>lessonRowHTML(p,a,false)).join(''):'<p class="muted">Sem aula</p>'}</div>`).join('')}</div>
  </section>
  <section class="card"><div class="card-title"><div><h3>Histórico de aulas</h3><p>Últimas aulas concluídas.</p></div><span class="badge green">Atividade</span></div>
    ${logs.length?`<div class="history-list">${logs.map(l=>`<div class="history-row"><div><b>${lessonIcon(l.type)} ${esc(l.type||l.name||'Aula')}</b><span>${fmtDate(l.date)} às ${fmtTime(l.date)} • ${esc(l.duration||'')} min • ${esc(l.intensity||'Média')}</span></div><strong>${esc(l.effort||'Feita')}</strong></div>`).join('')}</div>`:'<div class="empty">Nenhuma aula concluída ainda.</div>'}
  </section>`;
}
function lessonRowHTML(p,a,isToday=false){
  const done=isToday && lessonDoneToday(p,a.id);
  return `<div class="lesson-row"><div><strong>${lessonIcon(a.type)} ${esc(a.type||a.name||'Aula')}</strong><span>${lessonDayLabel(a.day)} • ${esc(a.time||'--:--')} • ${esc(a.duration||'')} min • ${esc(a.intensity||'Média')}${a.notes?' • '+esc(a.notes):''}</span></div><div class="actions inline-actions">${isToday?`<button class="btn sm ${done?'green':'secondary'}" data-complete-lesson="${esc(a.id)}">${done?'Concluída':'Concluir'}</button>`:''}<button class="btn sm secondary" data-edit-lesson="${esc(a.id)}">Editar</button><button class="btn sm danger" data-delete-lesson="${esc(a.id)}">Excluir</button></div></div>`;
}
function openLessonModal(id=''){
  const p=profile(); ensureProfile(p);
  const editing=(p.lessons||[]).find(a=>a.id===id) || null;
  const layer=byId('modalLayer');
  layer.innerHTML=`<div class="modal"><div class="modal-head"><div><p class="eyebrow">Aulas</p><h2>${editing?'Editar aula':'Adicionar aula'}</h2><p class="muted">Use para Yoga, Pilates, Spinning, GAP, Power Local e outras aulas.</p></div><button class="close" data-close>×</button></div>
    <div class="form-grid">
      <div class="field"><label>Tipo</label><select class="select" id="lessonType">${lessonTypeOptions().map(x=>`<option ${editing?.type===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label>Nome opcional</label><input class="input" id="lessonName" value="${esc(editing?.name||'')}" placeholder="ex: Pilates solo"></div>
      <div class="field"><label>Dia</label><select class="select" id="lessonDay">${[1,2,3,4,5,6,0].map(d=>`<option value="${d}" ${Number(editing?.day??dayIndexBR())===d?'selected':''}>${lessonDayLabel(d)}</option>`).join('')}</select></div>
      <div class="field"><label>Horário</label><input class="input" id="lessonTime" type="time" value="${esc(editing?.time||'19:00')}"></div>
      <div class="field"><label>Duração</label><input class="input" id="lessonDuration" type="number" value="${esc(editing?.duration||'50')}" placeholder="min"></div>
      <div class="field"><label>Intensidade</label><select class="select" id="lessonIntensity">${['Leve','Média','Forte'].map(x=>`<option ${editing?.intensity===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="field" style="grid-column:1/-1"><label>Observação</label><input class="input" id="lessonNotes" value="${esc(editing?.notes||'')}" placeholder="ex: estúdio, professor, foco..."></div>
    </div>
    <div class="actions"><button class="btn" data-save-lesson="${esc(id)}">Salvar aula</button><button class="btn secondary" data-close>Cancelar</button></div></div>`;
  layer.classList.remove('hidden');
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  document.querySelector('[data-save-lesson]').onclick=()=>saveLesson(id);
}
function saveLesson(id=''){
  const p=profile(); ensureProfile(p);
  const obj={
    id:id || 'lesson_'+Date.now(),
    type:byId('lessonType').value,
    name:byId('lessonName').value.trim(),
    day:Number(byId('lessonDay').value),
    time:normalizeTimeText(byId('lessonTime').value,'19:00'),
    duration:String(byId('lessonDuration').value||'50'),
    intensity:byId('lessonIntensity').value,
    notes:byId('lessonNotes').value.trim(),
    updatedAt:nowISO()
  };
  const i=p.lessons.findIndex(a=>a.id===obj.id);
  if(i>=0) p.lessons[i]=obj; else p.lessons.push(obj);
  p.routine.lessons=p.lessons; p.routine.lessonLogs=p.lessonLogs;
  save(); if(hasCloudAccount()){ upsertCloudProfile(null).catch(()=>{}); syncLessonScheduleToCloud(obj).then(()=>save()).catch(()=>{}); }
  closeModal(); toast('Aula salva.'); setScreen('lessons');
}
function completeLesson(id){
  const p=profile(); ensureProfile(p);
  const a=(p.lessons||[]).find(x=>x.id===id);
  if(!a) return toast('Aula não encontrada.');
  if(lessonDoneToday(p,id)) return toast('Essa aula já foi concluída hoje.');
  const effort=prompt('Como foi a aula? (Leve, Média, Pesada)', a.intensity||'Média') || a.intensity || 'Média';
  const log={id:'lessonlog_'+Date.now(), lessonId:id, cloudScheduleId:a.cloudScheduleId||null, date:nowISO(), dateKey:dateKey(), type:a.type, name:a.name, duration:a.duration, intensity:a.intensity, effort, notes:a.notes||''};
  p.lessonLogs.push(log);
  p.routine.lessons=p.lessons; p.routine.lessonLogs=p.lessonLogs;
  save(); if(hasCloudAccount()){ upsertCloudProfile(null).catch(()=>{}); syncLessonLogToCloud(log).then(()=>save()).catch(()=>{}); }
  toast('Aula concluída.'); render();
}
function deleteLesson(id){
  const p=profile(); ensureProfile(p);
  const a=(p.lessons||[]).find(x=>x.id===id);
  if(!a) return;
  if(!confirm(`Excluir a aula ${a.type || a.name || ''}?`)) return;
  p.lessons=p.lessons.filter(x=>x.id!==id);
  p.routine.lessons=p.lessons;
  save(); if(hasCloudAccount()){ upsertCloudProfile(null).catch(()=>{}); deleteLessonScheduleFromCloud(id).catch(()=>{}); }
  toast('Aula excluída.'); render();
}


function lessonScheduleToCloudRow(userId, a){
  return {
    user_id:userId,
    local_id:a.id || ('lesson_'+Date.now()),
    class_type:String(a.type || 'Outra'),
    class_name:a.name || null,
    weekday:Number(a.day ?? dayIndexBR()),
    class_time:a.time || null,
    duration_minutes:parseNumberValue(a.duration),
    intensity:a.intensity || null,
    notes:a.notes || null,
    active:true,
    updated_at:nowISO()
  };
}
function lessonLogToCloudRow(userId, l){
  return {
    user_id:userId,
    local_id:l.id || ('lessonlog_'+Date.now()),
    schedule_local_id:l.lessonId || null,
    schedule_id:l.cloudScheduleId || null,
    class_type:String(l.type || 'Outra'),
    class_name:l.name || null,
    performed_at:l.date || nowISO(),
    duration_minutes:parseNumberValue(l.duration),
    intensity:l.intensity || null,
    effort:l.effort || null,
    notes:l.notes || null
  };
}
async function syncLessonScheduleToCloud(a){
  if(!supabaseClient || !hasCloudAccount()) return {ok:false, reason:'no_account'};
  const user=await getCurrentCloudUser();
  if(!user || isAnonymousCloudUser()) return {ok:false, reason:'no_account'};
  try{
    const row=lessonScheduleToCloudRow(user.id, a);
    const { data, error } = await supabaseClient
      .from('class_schedules')
      .upsert(row, { onConflict:'user_id,local_id' })
      .select('id')
      .single();
    if(error) throw error;
    a.cloudScheduleId=data?.id || a.cloudScheduleId || null;
    a.cloudSynced=true;
    a.cloudSyncedAt=nowISO();
    return {ok:true, id:a.cloudScheduleId};
  }catch(e){
    console.warn('Erro ao sincronizar aula:', e);
    return {ok:false, error:e};
  }
}
async function syncLessonLogToCloud(l){
  if(!supabaseClient || !hasCloudAccount()) return {ok:false, reason:'no_account'};
  const user=await getCurrentCloudUser();
  if(!user || isAnonymousCloudUser()) return {ok:false, reason:'no_account'};
  try{
    const p=profile();
    const schedule=(p.lessons||[]).find(a=>a.id===l.lessonId);
    if(schedule?.cloudScheduleId) l.cloudScheduleId=schedule.cloudScheduleId;
    const row=lessonLogToCloudRow(user.id, l);
    const { data, error } = await supabaseClient
      .from('class_logs')
      .upsert(row, { onConflict:'user_id,local_id' })
      .select('id')
      .single();
    if(error) throw error;
    l.cloudClassLogId=data?.id || l.cloudClassLogId || null;
    l.cloudSynced=true;
    l.cloudSyncedAt=nowISO();
    return {ok:true, id:l.cloudClassLogId};
  }catch(e){
    console.warn('Erro ao sincronizar histórico de aula:', e);
    return {ok:false, error:e};
  }
}
async function deleteLessonScheduleFromCloud(localId){
  if(!supabaseClient || !hasCloudAccount() || !localId) return {ok:false, reason:'no_account'};
  const user=await getCurrentCloudUser();
  if(!user || isAnonymousCloudUser()) return {ok:false, reason:'no_account'};
  try{
    const { error } = await supabaseClient
      .from('class_schedules')
      .update({active:false, updated_at:nowISO()})
      .eq('user_id', user.id)
      .eq('local_id', localId);
    if(error) throw error;
    return {ok:true};
  }catch(e){
    console.warn('Erro ao excluir aula da nuvem:', e);
    return {ok:false, error:e};
  }
}
async function syncLessonsToCloud(opts={}){
  if(!supabaseClient || !hasCloudAccount()) return {ok:false, reason:'no_account'};
  const user=await getCurrentCloudUser();
  if(!user || isAnonymousCloudUser()) return {ok:false, reason:'no_account'};
  const p=profile(); ensureProfile(p);
  let schedules=0, logs=0, failed=0;
  for(const a of (p.lessons||[])){
    const r=await syncLessonScheduleToCloud(a);
    if(r.ok) schedules++; else failed++;
  }
  for(const l of (p.lessonLogs||[])){
    const r=await syncLessonLogToCloud(l);
    if(r.ok) logs++; else failed++;
  }
  p.routine.lessons=p.lessons;
  p.routine.lessonLogs=p.lessonLogs;
  save();
  if(!opts.silent) toast(`Aulas sincronizadas: ${schedules} grade, ${logs} histórico.`);
  return {ok:failed===0, schedules, logs, failed};
}
async function loadLessonsFromCloud(opts={}){
  if(!supabaseClient || !hasCloudAccount()) return {ok:false, reason:'no_account'};
  const user=await getCurrentCloudUser();
  if(!user || isAnonymousCloudUser()) return {ok:false, reason:'no_account'};
  const p=profile(); ensureProfile(p);
  try{
    const { data:schedules, error:sErr } = await supabaseClient
      .from('class_schedules')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('weekday', {ascending:true})
      .order('class_time', {ascending:true});
    if(sErr) throw sErr;
    const { data:logs, error:lErr } = await supabaseClient
      .from('class_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('performed_at', {ascending:false})
      .limit(250);
    if(lErr) throw lErr;

    const cloudLessons=(schedules||[]).map(r=>({
      id:r.local_id || r.id,
      cloudScheduleId:r.id,
      type:r.class_type || 'Outra',
      name:r.class_name || '',
      day:Number(r.weekday ?? 1),
      time:r.class_time || '',
      duration:r.duration_minutes ? String(r.duration_minutes) : '',
      intensity:r.intensity || 'Média',
      notes:r.notes || '',
      updatedAt:r.updated_at || r.created_at || nowISO(),
      cloudSynced:true,
      cloudSyncedAt:r.updated_at || r.created_at || nowISO()
    }));
    const scheduleIdByCloud=new Map(cloudLessons.map(a=>[a.cloudScheduleId, a.id]));
    const cloudLogs=(logs||[]).map(r=>({
      id:r.local_id || r.id,
      cloudClassLogId:r.id,
      lessonId:r.schedule_local_id || scheduleIdByCloud.get(r.schedule_id) || r.schedule_id || '',
      cloudScheduleId:r.schedule_id || null,
      date:r.performed_at || r.created_at || nowISO(),
      dateKey:dateKey(r.performed_at || r.created_at || nowISO()),
      type:r.class_type || 'Outra',
      name:r.class_name || '',
      duration:r.duration_minutes ? String(r.duration_minutes) : '',
      intensity:r.intensity || 'Média',
      effort:r.effort || 'Feita',
      notes:r.notes || '',
      cloudSynced:true,
      cloudSyncedAt:r.created_at || nowISO()
    })).reverse();

    const lessonMap=new Map();
    cloudLessons.forEach(a=>lessonMap.set(a.id, a));
    (p.lessons||[]).forEach(a=>{ if(!lessonMap.has(a.id)) lessonMap.set(a.id, a); });
    const logMap=new Map();
    cloudLogs.forEach(l=>logMap.set(l.id, l));
    (p.lessonLogs||[]).forEach(l=>{ if(!logMap.has(l.id)) logMap.set(l.id, l); });
    p.lessons=[...lessonMap.values()].sort((a,b)=>Number(a.day)-Number(b.day) || String(a.time||'').localeCompare(String(b.time||'')));
    p.lessonLogs=[...logMap.values()].sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));
    p.routine.lessons=p.lessons;
    p.routine.lessonLogs=p.lessonLogs;
    save();
    await syncLessonsToCloud({silent:true}).catch(()=>{});
    if(!opts.silent) toast('Aulas carregadas da nuvem.');
    return {ok:true, loaded:true, schedules:p.lessons.length, logs:p.lessonLogs.length};
  }catch(e){
    console.warn('Erro ao carregar aulas da nuvem:', e);
    return {ok:false, error:e};
  }
}

function renderPlanActions(p){
  const source = p.planMeta?.source || 'pending';
  const needsChoice = source === 'default' && p.planMeta?.needsDefaultChoice;
  if(source === 'pending' || !hasWorkoutPlan(p)){
    return `<div class="actions"><button class="btn sm" data-action="generate-initial-plan">Gerar treino específico</button><button class="btn sm secondary" data-action="use-default-plan">Usar treino padrão</button></div>`;
  }
  if(needsChoice){
    return `<div class="actions"><button class="btn sm" data-action="generate-initial-plan">Atualizar treino para específico</button><button class="btn sm secondary" data-action="accept-default-plan">Ficar com treino default</button></div>`;
  }
  return `<div class="actions"><button class="btn sm secondary" data-action="generate-initial-plan">Criar treino inteligente</button><button class="btn sm ${p.progress>=workoutsPerCycle(p)?'':'secondary'}" ${p.progress>=workoutsPerCycle(p)?'':'disabled'} data-action="finish-cycle-ai">Revisar próximo ciclo</button></div>`;
}
function renderHome(){
  const p = profile();
  const hasPlan = hasWorkoutPlan(p);
  const w = hasPlan ? currentWorkout(p) : null;
  const cycles = currentCycleNumber(p);
  const planSource = p.planMeta?.source || 'pending';
  const planBadge = planSource==='ai' ? 'IA' : planSource==='default' ? 'Padrão' : 'Pendente';
  const planBadgeClass = planSource==='ai' ? 'green' : planSource==='default' ? 'orange' : 'yellow';
  return `
    ${todayMissionHTML(p)}
    ${levelHeaderHTML(p)}
    ${nextCommitmentHTML(p)}
    ${lessonTodayHTML(p)}
    <section class="card plan-card compact-plan">
      <div class="card-title"><div><h3>Plano atual</h3><p>${esc(p.planMeta?.title || 'Aguardando treino inteligente')} • ${esc(p.programLabel || programLabelForProfile(p))} • Ciclo ${p.planMeta?.cycle || Math.max(1, cycles+1)}</p></div><span class="badge ${planBadgeClass}">${planBadge}</span></div>
      <p class="muted">${esc(p.planMeta?.notes || (hasPlan ? 'Use os dados dos treinos para ajustar o próximo ciclo.' : 'Nenhum treino foi carregado ainda. Gere um treino específico com IA ou use o treino padrão.'))}</p>
      ${renderPlanActions(p)}
    </section>
    ${hasPlan ? `<section class="card">
      <div class="card-title"><h3>Próximo treino</h3><span class="badge orange">${w.id}</span></div>
      <div class="workout-card current" data-open-workout="${w.id}">
        <div class="workout-left"><div class="letter">${w.id}</div><div class="workout-name"><strong>${esc(w.name)}</strong><span>${w.exercises.length} exercícios • ${esc(w.focus)}</span></div></div>
        <span>›</span>
      </div>
    </section>` : `<section class="card"><div class="empty"><strong>Nenhum treino ativo ainda.</strong><br>O Gym Bronze vai tentar criar um treino específico com IA. Se der erro, você ainda pode usar o treino padrão para começar.</div></section>`}
    <section class="grid three">
      <div class="stat"><strong>${cycles}</strong><span>ciclos completos</span></div>
      <div class="stat"><strong>${p.history.length}</strong><span>treinos no histórico</span></div>
      <div class="stat"><strong>${p.checkins.length}</strong><span>check-ins salvos</span></div>
    </section>
    ${hasPlan ? `<section class="card">
      <div class="card-title"><h3>Fila atual</h3><p>Somente o primeiro treino da fila pode ser concluído</p></div>
      <div class="grid">${p.queue.map((id,i)=>workoutQueueCard(p,id,i===0)).join('')}</div>
    </section>` : ''}
    ${p.history.length ? `<section class="card"><div class="card-title"><h3>Último treino</h3></div>${historyRowHTML(p.history[p.history.length-1])}</section>` : ''}
  `;
}
function pendingHTML(p){ return ''; }
function workoutQueueCard(p,id,current=false){ const w=workoutById(p,id); if(!w) return ''; return `<div class="workout-card ${current?'current':''}" data-open-workout="${id}"><div class="workout-left"><div class="letter">${id}</div><div class="workout-name"><strong>${esc(w.name)}</strong><span>${current?'Liberado para concluir':'Modo consulta'} • ${w.exercises.length} exercícios</span></div></div><span class="badge ${current?'orange':''}">${current?'Atual':'Bloqueado'}</span></div>`; }
function renderWorkouts(){ const p=profile(); if(!hasWorkoutPlan(p)) return `<section class="card"><div class="card-title"><div><h3>Nenhum treino ativo</h3><p>Gere um treino específico ou use o treino padrão para começar.</p></div></div><div class="actions"><button class="btn" data-action="generate-initial-plan">Gerar treino específico</button><button class="btn secondary" data-action="use-default-plan">Usar treino padrão</button></div></section>`; return `<section class="card"><div class="card-title"><div><h3>Treinos</h3><p>Você pode abrir todos, mas só conclui o treino da ordem.</p></div><div class="actions inline-actions"><button class="btn sm" data-action="today-workout-center">Treino de hoje</button><button class="btn sm secondary" data-action="edit-current-workout">Editar fixo</button></div></div><div class="grid">${p.queue.map((id,i)=>workoutQueueCard(p,id,i===0)).join('')}</div></section><section class="card pro-tip"><div><span class="badge orange">PRO</span><h3>Editor liberado</h3><p>Agora você pode editar exercícios, ordem, nome, tipo e meta de reps direto no app.</p></div></section>`; }

function renderProgress(){
  const p=profile(); const gains = exerciseGains(p); const cycles=currentCycleNumber(p); const levelInfo=levelFromXp(ensureGamification(p).xp);
  return `<section class="hero"><div class="hero-row"><div><p class="eyebrow">Evolução</p><h2>${p.progress}/${p.target} treinos</h2><p>${cycles} ciclos completos. Acompanhe cargas, consistência e estagnações.</p></div><div class="progress-ring" style="--p:${Math.round(p.progress/p.target*100)}%"><div class="progress-ring-inner">${p.progress}<small>treinos</small></div></div></div></section>
  <section class="card level-progress-card"><div class="card-title"><div><h3>${esc(levelInfo.rank.name)}</h3><p>Nível ${levelInfo.roman} (${levelInfo.level}) • ${levelInfo.xp} XP totais</p></div><button class="btn sm secondary" data-action="open-levels">Ver patentes</button></div><div class="xp-bar big"><i style="width:${levelInfo.pct}%"></i></div><p class="muted">${levelInfo.level>=100?'Você chegou ao topo do Gym Bronze.':'Faltam '+levelInfo.toNext+' XP para o nível '+roman(levelInfo.level+1)+'.'}</p></section>
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
  const todayDaily=dailyCheckinToday(p);
  return `<section class="card"><div class="card-title"><div><h3>Check-in diário</h3><p>Sono, energia, dor, fome e estresse. Ajuda a IA a ajustar treino e nutri.</p></div><span class="badge ${todayDaily?'green':'yellow'}">${todayDaily?'Hoje feito':'Pendente'}</span></div>
    <div class="actions"><button class="btn" data-action="daily-checkin">${todayDaily?'Editar check-in de hoje':'Fazer check-in rápido'}</button></div>
    ${recentDailyCheckins(p,7).length?`<div class="daily-list">${recentDailyCheckins(p,7).map(c=>`<div class="history-row"><div><strong>${fmtDate(c.date)} — ${readinessLabel(c)}</strong><span>Score ${c.readinessScore}% • Sono ${c.sleep}/5 • Energia ${c.energy}/5 • Dor ${c.pain}/5 • Estresse ${c.stress}/5</span>${c.notes?`<p class="muted">${esc(c.notes)}</p>`:''}</div><span class="badge orange">${fmtTime(c.date)}</span></div>`).join('')}</div>`:'<div class="empty">Nenhum check-in diário ainda.</div>'}
  </section>
  <section class="card"><div class="card-title"><h3>Check-in físico</h3><p>Fotos e dados corporais por ciclo.</p></div>
    <div class="actions"><button class="btn" data-action="new-checkin">Novo check-in</button><button class="btn secondary" data-action="new-bio">Inserir bioimpedância</button></div>
  </section>
  <section class="card"><div class="card-title"><h3>Fotos por ciclo</h3></div>${p.checkins.length?`<div class="grid">${p.checkins.slice().reverse().map(c=>`<div class="stat"><strong>Ciclo ${c.cycle}</strong><span>${fmtDate(c.date)} • ${c.weight?c.weight+' kg':''}</span><div class="timeline">${['front','side','back'].map(k=>c.photos?.[k]?`<img class="mini-photo" src="${c.photos[k]}" alt="${k}">`:'' ).join('')}</div></div>`).join('')}</div>`:'<div class="empty">Nenhum check-in salvo ainda.</div>'}</section>
  <section class="card"><div class="card-title"><h3>Bioimpedância / medidas</h3></div>${p.bio.length?p.bio.slice().reverse().map(b=>`<div class="history-row"><div><strong>${fmtDate(b.date)} — ${b.weight||'--'} kg</strong><span>Gordura: ${b.bodyFat||'--'}% • Massa magra: ${b.leanMass||'--'} kg • Cintura: ${b.waist||'--'} cm</span></div><span class="badge orange">Bio</span></div>`).join(''):'<div class="empty">Nenhuma avaliação inserida.</div>'}</section>`;
}

function renderDietPlanHTML(diet){
  if(!diet) return '<div class="empty">Nenhuma rotina alimentar gerada ainda.</div>';
  const schedule = dietMeals(diet);
  const scheduleHTML = schedule.length ? `<div class="meal-timeline">${schedule.map(m=>`<div class="meal-item"><div class="meal-time">${esc(m.time || '')}</div><div><strong>${esc(m.title || 'Refeição')}</strong><p>${esc(m.text || '')}</p>${m.portions?`<span>${esc(m.portions)}</span>`:''}${m.notes?`<em>${esc(m.notes)}</em>`:''}</div></div>`).join('')}</div>` : '';
  return `<div class="ai-report diet-report"><strong>${esc(diet.title||'Rotina alimentar')}</strong><p>${esc(diet.summary||'')}</p>${diet.guidelines?`<p><b>Diretrizes:</b> ${esc(Array.isArray(diet.guidelines)?diet.guidelines.join(' • '):diet.guidelines)}</p>`:''}${scheduleHTML || '<p class="muted">Rotina alimentar salva, mas sem horários estruturados detectados.</p>'}${diet.shoppingList?`<p><b>Base de compras:</b> ${esc(Array.isArray(diet.shoppingList)?diet.shoppingList.join(' • '):diet.shoppingList)}</p>`:''}${diet.attention?`<p><b>Atenção:</b> ${esc(diet.attention)}</p>`:''}</div>`;
}
function renderCoach(){
  const p=profile(); const insights=generateInsights(p); const aiOn=canUseOnlineAI(); const reports=p.history.filter(h=>h.aiReport || h.aiReportStatus || h.aiReportError).slice(-5).reverse();
  const diet = p.dietPlan;
  return `<section class="hero"><p class="eyebrow">Nutri & Análise</p><h2>Rotina, evolução e ajustes</h2><p>${aiOn?'IA online pronta para revisar treino, ciclo e alimentação.':(isOffline()?'Você está offline. A análise local funciona, mas IA e nuvem ficam pausadas.':'Entre na conta ou use modo local para liberar os recursos inteligentes.')}</p><div class="actions"><button class="btn secondary" data-screen-go="profile">Configurar conta</button></div></section>
  <section class="card"><div class="card-title"><h3>Status dos recursos inteligentes</h3><span class="badge ${aiOn?'green':'yellow'}">${aiOn?'Online':(isOffline()?'Offline':'Login necessário')}</span></div><p class="muted">Relatório automático ao finalizar treino: <strong>${p.ai?.autoWorkoutReport?'ativado':'desativado'}</strong></p><p class="muted">Limite diário controlado no backend por usuário para evitar abuso.</p></section>
  <section class="card"><div class="card-title"><div><h3>Rotina alimentar</h3><p>Plano educativo baseado no seu perfil, objetivo e treino. Não substitui nutricionista.</p></div><span class="badge orange">Beta</span></div>
    ${renderDietPlanHTML(diet)}
    ${diet ? `<p class="muted">Status na nuvem: <strong>${diet.cloudSynced?'salva':'não salva'}</strong>${!hasCloudAccount()?' • crie uma conta para sincronizar':''}</p>` : ''}
    <div class="actions"><button class="btn" data-action="generate-diet-plan">Gerar rotina alimentar</button>${hasCloudAccount() ? '<button class="btn secondary" data-action="load-diet-cloud">Atualizar nutri da nuvem</button>' : ''}${diet && hasCloudAccount() && !diet.cloudSynced ? '<button class="btn secondary" data-action="save-diet-cloud">Salvar rotina na nuvem</button>' : ''}</div>
  </section>
  <section class="card" id="nutritionChecklistCard"><div class="card-title"><div><h3>Checklist de nutrição</h3><p>Marque as refeições feitas hoje. Isso entra no score do dia.</p></div><span class="badge green">${nutritionStats(p).pct}% hoje</span></div>
    ${renderNutritionChecklistHTML(p)}
    <div class="actions"><button class="btn secondary" data-action="reset-nutrition-today">Limpar hoje</button>${hasCloudAccount()?'<button class="btn secondary" data-action="save-diet-cloud">Salvar nutri na nuvem</button>':''}</div>
  </section>
  <section class="grid">${insights.map(i=>`<div class="alert ${i.type==='orange'?'orange':''}"><div>${i.icon}</div><div><strong>${esc(i.title)}</strong><p>${esc(i.text)}</p></div></div>`).join('')}</section>
  <section class="card"><div class="card-title"><h3>Últimos relatórios</h3><p>Gerados ao finalizar treino</p></div>${reports.length?reports.map(h=>aiHistoryHTML(h)).join(''):'<div class="empty">Nenhum relatório salvo ainda.</div>'}</section>`;
}
function generateInsights(p){
  const out=[]; const cycles=currentCycleNumber(p); const st=stagnated(p);
  out.push({icon:'🔥',title:`${p.progress}/${p.target} treinos concluídos`,text:`Você completou ${cycles} ciclos. Próxima meta: ${Math.min(p.target, (cycles+1)*workoutsPerCycle(p))} treinos.`,type:'orange'});
  if(st.length) out.push({icon:'⚠️',title:'Possível estagnação de carga',text:`Há ${st.length} exercício(s) com mesma carga nos últimos registros. Se a execução estiver boa, planeje subir pouco ou melhorar reps.`,type:'orange'});
  const skipped = p.history.slice(-5).reduce((a,h)=>a+(h.skippedCount||0),0); if(skipped) out.push({icon:'🟡',title:'Exercícios pulados recentemente',text:`Nos últimos 5 treinos, você pulou ${skipped} exercício(s). Veja se isso está atrapalhando ombro/costas.`,type:'orange'});
  const lateralSkipped = p.history.slice(-12).some(h=>h.status?.d3==='skipped' || h.status?.d3===undefined && h.workoutId==='D'); if(lateralSkipped) out.push({icon:'💪',title:'Prioridade para ombro lateral',text:'Não deixe a elevação lateral na polia/máquina virar opcional. Ela é uma das chaves para ombro mais largo.',type:'orange'});
  if(p.bio.length>=2){ const a=p.bio[p.bio.length-2], b=p.bio[p.bio.length-1]; out.push({icon:'📊',title:'Bioimpedância comparada',text:compareBio(a,b),type:'orange'}); }
  if(!p.checkins.length) out.push({icon:'📸',title:'Comece os check-ins visuais',text:'Ao fechar cada ciclo, tire fotos de frente, lado e costas nas mesmas condições para comparar evolução.'});
  return out;
}
function compareBio(a,b){ const parts=[]; [['weight','Peso','kg'],['bodyFat','Gordura','%'],['leanMass','Massa magra','kg'],['waist','Cintura','cm']].forEach(([k,n,u])=>{const x=parseFloat(a[k]), y=parseFloat(b[k]); if(!isNaN(x)&&!isNaN(y)){ const d=+(y-x).toFixed(1); parts.push(`${n}: ${d>0?'+':''}${d}${u}`); }}); return parts.length?parts.join(' • '):'Duas avaliações salvas; preencha mais campos para comparação melhor.'; }

function aiErrorActionsHTML(h){
  if(!h?.aiReportError) return '';
  return `<div class="actions" style="margin-top:8px"><button class="btn sm secondary" data-retry-ai-report="${esc(h.id)}">Tentar IA novamente</button></div>`;
}
function aiHistoryHTML(h){
  const badge = h.aiReportStatus==='pending' ? '<span class="badge yellow">Gerando</span>' : h.aiReportError ? '<span class="badge red">Erro</span>' : '<span class="badge green">IA</span>';
  const body = h.aiReport ? `<div class="ai-report"><strong>${esc(h.aiReport.title||'Relatório da IA')}</strong><p>${esc(h.aiReport.summary||'')}</p>${h.aiReport.evolution?`<p><b>Evolução:</b> ${esc(h.aiReport.evolution)}</p>`:''}${h.aiReport.attention?`<p><b>Atenção:</b> ${esc(h.aiReport.attention)}</p>`:''}${h.aiReport.nextGoal?`<p><b>Próxima meta:</b> ${esc(h.aiReport.nextGoal)}</p>`:''}</div>` : h.aiReportError ? `<div class="ai-report error"><strong>Erro ao gerar IA</strong><p>${esc(h.aiReportError)}</p>${aiErrorActionsHTML(h)}</div>` : '<div class="ai-report"><p>Relatório em processamento...</p></div>';
  return `<div class="history-row ai-row"><div><strong>${h.workoutId} — ${esc(h.workoutName)}</strong><span>${fmtDate(h.date)}</span>${body}</div>${badge}</div>`;
}
function historyRowHTML(h){
  const aiBadge = h.aiReport ? '<span class="badge green">IA</span>' : h.aiReportStatus==='pending' ? '<span class="badge yellow">IA...</span>' : h.aiReportError ? '<span class="badge red">IA erro</span>' : '';
  const report = h.aiReport ? `<div class="ai-report compact"><p>${esc(h.aiReport.summary||'Relatório salvo.')}</p>${h.aiReport.nextGoal?`<p><b>Meta:</b> ${esc(h.aiReport.nextGoal)}</p>`:''}</div>` : h.aiReportError ? `<div class="ai-report error compact"><p><b>Erro IA:</b> ${esc(h.aiReportError)}</p>${aiErrorActionsHTML(h)}</div>` : '';
  const timeInfo = h.startedAt ? `${fmtDate(h.date)} • ${fmtTime(h.startedAt)}–${fmtTime(h.finishedAt||h.date)}${h.durationMinutes!==undefined ? ' • '+h.durationMinutes+' min' : ''}` : `${fmtDate(h.date)} • ${fmtTime(h.date)}`;
  return `<div class="history-row"><div><strong>${h.workoutId} — ${esc(h.workoutName)}</strong><span>${timeInfo} • ${h.doneCount} concluídos • ${h.skippedCount} pulados</span>${report}</div><div class="badge-stack"><span class="badge">${h.score}%</span>${aiBadge}</div></div>`;
}



function remindersPanelHTML(p){
  ensureProfile(p);
  const routine=p.routine||{};
  const reminders=p.reminders||{};
  const types=reminders.types||{};
  const times=reminders.times||{};
  const water=reminders.water||{};
  const permission = notificationAvailable() ? (Notification.permission || 'default') : 'unsupported';
  const permissionLabel = permission==='granted' ? 'permitidas' : permission==='denied' ? 'bloqueadas' : permission==='unsupported' ? 'não suportadas' : 'não ativadas';
  return `<div class="routine-panel">
    <div class="form-grid">
      <div class="field"><label>Que horas você acorda?</label><input class="input" type="time" data-profile-field="routine.wakeTime" value="${esc(routine.wakeTime||'09:00')}"></div>
      <div class="field"><label>Almoço médio</label><input class="input" type="time" data-profile-field="routine.lunchTime" value="${esc(routine.lunchTime||'13:00')}"></div>
      <div class="field"><label>Jantar médio</label><input class="input" type="time" data-profile-field="routine.dinnerTime" value="${esc(routine.dinnerTime||'20:00')}"></div>
      <div class="field"><label>Horário de treino</label><input class="input" type="time" data-profile-field="reminders.times.workout" value="${esc(times.workout||suggestedWorkoutTimeFromRoutine(p)||'12:00')}"></div>
      <div class="field"><label>Água: início</label><input class="input" type="time" data-profile-field="reminders.water.start" value="${esc(water.start||routine.wakeTime||'09:00')}"></div>
      <div class="field"><label>Água: fim</label><input class="input" type="time" data-profile-field="reminders.water.end" value="${esc(water.end||'21:00')}"></div>
      <div class="field"><label>Água: intervalo</label><select class="select" data-profile-field="reminders.water.intervalHours">
        ${[1,2,3,4].map(n=>`<option value="${n}" ${Number(water.intervalHours||2)===n?'selected':''}>a cada ${n}h</option>`).join('')}
      </select></div>
      <div class="stat"><strong>${esc(workoutTimeRecommendation(p).window)}</strong><span>sugestão de treino</span></div>
      <div class="field" style="grid-column:1/-1"><label>Quer contar como funciona seu dia útil?</label><textarea data-profile-field="routine.workdayDescription" placeholder="ex: acordo tarde, trabalho no computador, treino perto do almoço...">${esc(routine.workdayDescription||'')}</textarea></div>
    </div>
    <div class="reminder-checks">
      <label class="legal-check"><input type="checkbox" data-reminder-type="workout" ${types.workout?'checked':''}> <span>Lembrete de treino</span></label>
      <label class="legal-check"><input type="checkbox" data-reminder-type="meals" ${types.meals?'checked':''}> <span>Lembretes de refeição</span></label>
      <label class="legal-check"><input type="checkbox" data-reminder-type="water" ${types.water?'checked':''}> <span>Lembrete de beber água</span></label>
    </div>
    <p class="muted">Resumo: ${esc(remindersSummary(p))} • Permissão neste aparelho: ${esc(permissionLabel)}.</p><div class="actions"><button class="btn sm secondary" data-action="suggest-workout-time">Sugerir melhor horário de treino</button></div>
  </div>`;
}

function renderProfile(){
  const p=profile();
  const ai=p.ai||{};
  const levelInfo=levelFromXp(ensureGamification(p).xp);
  const accountLabel = p.accountEmail || cloudUser?.email || 'Conta local';
  return `<section class="card profile-level-card">
    <div class="card-title">
      <div><p class="eyebrow">Warrior</p><h3>${esc(p.name || 'Meu perfil')}</h3><p>${esc(accountLabel)}</p><p>${esc(levelInfo.rank.name)} • Nv. ${levelInfo.roman} (${levelInfo.level})</p></div>
      <div class="level-badge big">${esc(levelInfo.rank.icon)}</div>
    </div>
    <div class="xp-bar big"><i style="width:${levelInfo.pct}%"></i></div>
    <p class="muted">${levelInfo.level>=100?'Mr. Gym Bronze desbloqueado.':'Faltam '+levelInfo.toNext+' XP para o próximo nível.'} ${hasCloudAccount()?'XP sincronizável na nuvem.':'XP salvo neste aparelho.'}</p>
    <div class="actions"><button class="btn sm secondary" data-action="open-levels">Ver patentes</button><button class="btn sm secondary" data-action="account-switch">Alternar conta</button>${hasCloudAccount()?'<button class="btn sm secondary" data-action="sync-xp-cloud">Salvar XP na nuvem</button>':''}</div>
  </section>

  <details class="profile-section" open>
    <summary><span>Dados pessoais</span><small>nome, idade e corpo</small></summary>
    <section class="card"><div class="form-grid">
      ${inputHTML('name','Nome',p.name)}
      ${inputHTML('age','Idade',p.age,'number')}
      ${selectHTML('sex','Sexo',p.sex,['Homem','Mulher','Outro/Prefiro não informar'])}
      ${inputHTML('height','Altura',p.height)}
      ${inputHTML('weight','Peso inicial/atual',p.weight)}
    </div><div class="actions"><button class="btn" data-action="save-profile">Salvar perfil</button></div></section>
  </details>

  <details class="profile-section">
    <summary><span>Objetivo e treino</span><small>foco, nível e dias</small></summary>
    <section class="card"><div class="form-grid">
      ${inputHTML('goal','Objetivo',p.goal)}
      ${inputHTML('focus','Foco',p.focus)}
      ${selectHTML('experience','Nível',p.experience,['Iniciante','Intermediário','Avançado'])}
      ${selectHTML('daysPerWeek','Dias por semana',p.daysPerWeek,['2','3','4','5','6'], v=>v+' dias')}
      <div class="stat"><strong>${esc(p.programLabel || programLabelForProfile(p))}</strong><span>meta do programa</span></div>
      <div class="field" style="grid-column:1/-1"><label>Observações</label><textarea data-profile-field="notes">${esc(p.notes)}</textarea></div>
    </div><div class="actions"><button class="btn" data-action="save-profile">Salvar treino/perfil</button></div></section>
  </details>

  <details class="profile-section">
    <summary><span>Rotina e lembretes</span><small>treino, refeição e água</small></summary>
    <section class="card"><div class="card-title"><div><h3>Lembretes inteligentes</h3><p>Use seus horários para organizar nutrição e lembretes. Funciona melhor com o app instalado.</p></div><span class="badge orange">v7.3</span></div>
      ${remindersPanelHTML(p)}
      <div class="actions"><button class="btn" data-action="save-profile">Salvar rotina</button><button class="btn secondary" data-action="request-notifications">Ativar notificações</button><button class="btn secondary" data-action="test-notification">Testar notificação</button></div>
      <p class="muted">No PWA, lembretes locais dependem do navegador. Push real com servidor pode entrar em uma versão futura.</p>
    </section>
  </details>

  <details class="profile-section">
    <summary><span>Conta e sincronização</span><small>nuvem, backup e troca</small></summary>
    <section class="card"><div class="card-title"><div><h3>Conta</h3><p>Sincronize histórico, treino, nutri e XP na nuvem.</p></div>${cloudStatusHTML()}</div>${renderCloudAccount(p)}<div class="divider"></div><div class="actions"><button class="btn secondary" data-action="account-switch">Alternar conta</button><button class="btn secondary" data-action="new-profile">Adicionar novo perfil</button><button class="btn secondary" data-action="backup">Exportar backup</button><button class="btn secondary" data-action="import-backup">Importar backup</button><input id="backupInput" type="file" accept="application/json" hidden></div></section>
  </details>

  <details class="profile-section">
    <summary><span>IA e relatórios</span><small>automação e análise</small></summary>
    <section class="card"><div class="card-title"><div><h3>IA online via Vercel</h3><p>Relatórios automáticos e geração inteligente.</p></div><span class="badge green">Pronta</span></div><div class="form-grid">
      <label class="toggle-row" style="grid-column:1/-1"><input type="checkbox" data-ai-field="autoWorkoutReport" ${ai.autoWorkoutReport?'checked':''}> <span>Gerar relatório automaticamente ao finalizar treino</span></label>
    </div><div class="actions"><button class="btn" data-action="save-profile">Salvar configuração</button><button class="btn secondary" data-action="test-ai">Testar IA</button></div><p class="muted">A Vercel valida o login Supabase antes de chamar a IA.</p></section>
  </details>

  <details class="profile-section">
    <summary><span>Termos e avisos</span><small>beta público</small></summary>
    <section class="card legal-card"><div class="card-title"><div><h3>Termos e avisos</h3><p>Transparência para uso público.</p></div><span class="badge yellow">Beta</span></div><div class="legal-text"><p>O Gym Bronze é uma ferramenta de organização, treino e análise. Ele não substitui personal trainer, nutricionista, médico ou fisioterapeuta.</p><p>As sugestões de treino e alimentação são educativas. Interrompa o exercício em caso de dor forte, tontura, falta de ar incomum ou desconforto relevante.</p><p>Dados como idade, peso, altura, objetivo, observações, treinos e relatórios podem ser enviados para serviços externos de IA quando você usa recursos inteligentes.</p></div></section>
  </details>

  <section class="card danger-zone"><div class="card-title"><div><h3>Zona de segurança</h3><p>Ações de saída, limpeza e exclusão ficam aqui.</p></div></div><div class="actions">${hasCloudAccount()?'<button class="btn secondary danger-soft" data-action="cloud-logout">Sair e limpar este aparelho</button><button class="btn danger" data-action="delete-account">Excluir conta</button>': isLocalMode()?'<button class="btn secondary danger-soft" data-action="local-logout">Sair e apagar perfil local</button>':''}<button class="btn danger" data-action="reset-profile">Resetar perfil ativo</button></div><p class="muted">Sair limpa apenas este aparelho. Excluir conta tenta apagar também os dados da nuvem.</p></section>`;
}

function renderCloudAccount(p){
  const synced = p.history.filter(h=>h.cloudSynced).length;
  const pending = p.history.filter(h=>!h.cloudSynced).length;
  if(hasCloudAccount()){
    return `<div class="cloud-panel"><p><b>Conta conectada:</b> ${esc(cloudUser.email||'usuário conectado')}</p><p class="muted">Histórico local: ${p.history.length} treino(s) • Na nuvem: ${synced} • Pendentes: ${pending}</p><div class="actions"><button class="btn" data-action="cloud-sync">Sincronizar tudo com a nuvem</button><button class="btn secondary" data-action="cloud-refresh">Atualizar status</button></div></div>`;
  }
  const upgradeForm = `<div class="form-grid"><div class="field" style="grid-column:1/-1"><label>Nome para criar conta</label><input class="input" id="cloudName" value="${esc(p?.name||'')}"></div><div class="field"><label>E-mail</label><input class="input" id="cloudEmail" type="text" inputmode="email" autocomplete="email" placeholder="seu@email.com"></div><div class="field"><label>Senha</label><input class="input" id="cloudPassword" type="password" autocomplete="current-password" placeholder="Maiúscula, número e especial"></div><div class="field"><label>Confirmar senha</label><input class="input" id="cloudPassword2" type="password" autocomplete="new-password" placeholder="repita a senha"></div><label class="legal-check" style="grid-column:1/-1"><input type="checkbox" id="cloudAcceptTerms"> <span>Li e aceito os Termos e a Política de Privacidade.</span></label></div><div class="actions"><button class="btn" data-action="cloud-login">Entrar</button><button class="btn secondary" data-action="cloud-signup">Criar conta</button><button class="btn secondary" data-action="cloud-refresh">Atualizar status</button></div>`;
  if(isLocalMode()){
    return `<div class="cloud-panel"><p><b>Modo local ativo.</b></p><p class="muted">Seus treinos ficam neste aparelho. Para salvar na nuvem, crie uma conta e confirme o e-mail antes de limpar o app.</p><div class="actions"><button class="btn secondary" data-action="cloud-refresh">Atualizar IA/local</button></div></div><div class="alert orange"><div>⚠️</div><div><strong>Antes de limpar</strong><p>Crie uma conta primeiro para sincronizar seus dados. A limpeza local fica na Zona de segurança, no final desta tela.</p></div></div><div class="divider"></div>${upgradeForm}`;
  }
  return `${upgradeForm}<p class="muted">Ao criar conta, talvez o Supabase peça confirmação por e-mail. O app sem login continua funcionando normalmente.</p>`;
}
function inputHTML(id,label,val,type='text'){ return `<div class="field"><label>${label}</label><input class="input" type="${type}" data-profile-field="${id}" value="${esc(val)}"></div>`; }
function selectHTML(id,label,val,options,labelFn=(v)=>v){ return `<div class="field"><label>${label}</label><select class="select" data-profile-field="${id}">${options.map(o=>`<option value="${esc(o)}" ${String(val||'')===String(o)?'selected':''}>${esc(labelFn(o))}</option>`).join('')}</select></div>`; }

function bindScreen(){
  document.querySelectorAll('[data-screen-go]').forEach(el=>el.onclick=()=>setScreen(el.dataset.screenGo));
  document.querySelectorAll('[data-open-workout]').forEach(el=>el.onclick=()=>openWorkout(el.dataset.openWorkout));
  document.querySelectorAll('[data-action]').forEach(el=>el.onclick=()=>handleAction(el.dataset.action));
  document.querySelectorAll('[data-meal-check]').forEach(el=>el.onclick=()=>toggleNutritionMeal(Number(el.dataset.mealCheck)));
  document.querySelectorAll('[data-switch-profile]').forEach(el=>el.onclick=()=>{state.activeProfileId=el.dataset.switchProfile; save(); render();});
  document.querySelectorAll('[data-complete-lesson]').forEach(el=>el.onclick=()=>completeLesson(el.dataset.completeLesson));
  document.querySelectorAll('[data-edit-lesson]').forEach(el=>el.onclick=()=>openLessonModal(el.dataset.editLesson));
  document.querySelectorAll('[data-delete-lesson]').forEach(el=>el.onclick=()=>deleteLesson(el.dataset.deleteLesson));
  document.querySelectorAll('[data-retry-ai-report]').forEach(el=>el.onclick=()=>retryWorkoutAIReport(el.dataset.retryAiReport));
}
function handleAction(a){
  if(a==='start-current'){ const w=currentWorkout(); if(!w) return toast('Gere um treino primeiro.'); openWorkout(w.id); }
  if(a==='new-profile') createProfileFlow();
  if(a==='save-profile') saveProfileForm();
  if(a==='backup') exportBackup();
  if(a==='import-backup') byId('backupInput').click();
  if(a==='reset-profile') resetProfileFlow();
  if(a==='new-checkin') openCheckinModal();
  if(a==='daily-checkin') openDailyCheckinModal();
  if(a==='new-bio') openBioModal();
  if(a==='edit-current-workout'){ const w=currentWorkout(); if(!w) return toast('Gere um treino primeiro.'); openEditWorkout(w.id); }
  if(a==='test-ai') testAIConnection();
  if(a==='request-notifications') requestNotificationsFlow();
  if(a==='test-notification') testReminderNotification();
  if(a==='suggest-workout-time') openWorkoutTimeSuggestionModal();
  if(a==='cloud-login') cloudLogin();
  if(a==='cloud-signup') cloudSignup();
  if(a==='cloud-logout') cloudLogout();
  if(a==='local-logout') localLogoutWarning();
  if(a==='delete-account') deleteAccountFlow();
  if(a==='save-diet-cloud') saveDietPlanToCloud(profile().dietPlan, {silent:false}).then(()=>render());
  if(a==='load-diet-cloud') loadLatestDietPlanFromCloud().then(r=>{ render(); toast(r?.loaded?'Rotina alimentar carregada da nuvem.':'Nenhuma rotina nova encontrada na nuvem.'); });
  if(a==='cloud-sync') syncLocalHistoryToCloud();
  if(a==='cloud-refresh') refreshLocalOrCloudStatus();
  if(a==='generate-initial-plan') generateSpecificPlanFlow();
  if(a==='use-default-plan') { applyDefaultPlanForProfile(profile(), true); save(); saveCurrentPlanToCloud('default_plan_selected').catch(()=>{}); render(); toast('Treino padrão aplicado.'); }
  if(a==='accept-default-plan') { const p=profile(); if(p.planMeta) p.planMeta.needsDefaultChoice=false; save(); saveCurrentPlanToCloud('default_plan_accepted').catch(()=>{}); render(); toast('Treino padrão mantido.'); }
  if(a==='finish-cycle-ai') finishCycleAndGeneratePlan();
  if(a==='generate-diet-plan') generateDietPlan();
  if(a==='nutrition-checklist') goNutritionChecklist();
  if(a==='reset-nutrition-today') resetNutritionToday();
  if(a==='open-quick-menu') openQuickMenuModal();
  if(a==='open-score') openScoreModal();
  if(a==='today-workout-center') openTodayWorkoutCenter();
  if(a==='quick-coach') openQuickCoachModal();
  if(a==='workout-variants') openWorkoutVariantModal();
  if(a==='open-levels') openLevelModal();
  if(a==='account-switch') openProfileSwitcher();
  if(a==='add-lesson') openLessonModal();
  if(a==='sync-xp-cloud') syncXpEventsToCloud({silent:false}).then(()=>render());
  if(a==='load-xp-cloud') loadXpFromCloud({silent:false}).then(r=>{ render(); toast(r?.ok?'XP carregado da nuvem.':'Não consegui carregar XP da nuvem.'); });
}



function setProfileFieldValue(p,path,value){
  ensureProfile(p);
  const parts=String(path||'').split('.').filter(Boolean);
  if(parts.length===1){ p[parts[0]]=value; return; }
  let obj=p;
  for(let i=0;i<parts.length-1;i++){
    if(!obj[parts[i]] || typeof obj[parts[i]]!=='object') obj[parts[i]]={};
    obj=obj[parts[i]];
  }
  obj[parts[parts.length-1]]=value;
}
async function requestNotificationsFlow(){
  const p=profile();
  saveProfileForm(false);
  const ok=await requestReminderPermission();
  ensureProfile(p);
  p.reminders.permission=ok?'granted':(notificationAvailable()?Notification.permission:'unsupported');
  if(ok && !p.reminders.enabled){
    p.reminders.types.workout=true;
    p.reminders.types.water=true;
    p.reminders.enabled=true;
  }
  save(); render();
  toast(ok?'Notificações ativadas neste aparelho.':'O navegador não liberou notificações agora.');
}
function testReminderNotification(){
  saveProfileForm(false);
  const p=profile();
  const sent=showReminderNotification('Gym Bronze', `Teste de lembrete ativo • ${remindersSummary(p)}`);
  if(!sent) requestReminderPermission().then(ok=>{
    if(ok) showReminderNotification('Gym Bronze', `Teste de lembrete ativo • ${remindersSummary(p)}`);
    toast(ok?'Notificação de teste enviada.':'Permissão de notificação não liberada.');
  });
  else toast('Notificação de teste enviada.');
}

function saveProfileForm(doRender=true){
  const p=profile();
  const beforeDays = String(p.daysPerWeek||'');
  const beforeExp = String(p.experience||'');
  document.querySelectorAll('[data-profile-field]').forEach(f=>setProfileFieldValue(p, f.dataset.profileField, f.dataset.profileField==='height' ? formatHeightSmart(f.value) : f.value));
  document.querySelectorAll('[data-reminder-type]').forEach(f=>{
    ensureProfile(p);
    p.reminders.types[f.dataset.reminderType]=f.checked;
  });
  ensureProfile(p);
  p.reminders.enabled=!!(p.reminders.types?.workout||p.reminders.types?.meals||p.reminders.types?.water);
  p.routine.wakeTime=normalizeTimeText(p.routine.wakeTime,'09:00');
  p.routine.lunchTime=normalizeTimeText(p.routine.lunchTime,'13:00');
  p.routine.dinnerTime=normalizeTimeText(p.routine.dinnerTime,'20:00');
  p.reminders.times.workout=normalizeTimeText(p.reminders.times.workout, suggestedWorkoutTimeFromRoutine(p));
  p.reminders.water.start=normalizeTimeText(p.reminders.water.start,p.routine.wakeTime||'09:00');
  p.reminders.water.end=normalizeTimeText(p.reminders.water.end,'21:00');
  p.reminders.water.intervalHours=Math.max(1, Math.min(4, Number(p.reminders.water.intervalHours||2)));
  p.experience = normalizeExperienceLabel(p.experience);
  p.daysPerWeek = String(clampTrainingDays(p.daysPerWeek));
  if(p.planMeta?.source === 'default' && !(p.history&&p.history.length) && (beforeDays !== p.daysPerWeek || beforeExp !== p.experience)){
    applyDefaultPlanForProfile(p, true);
  }
  document.querySelectorAll('[data-ai-field]').forEach(f=>{
    const k=f.dataset.aiField;
    if(k==='autoWorkoutReport') p.ai[k]=f.checked;
    else p.ai[k]=f.value.trim();
  });
  save();
  if(hasCloudAccount()) upsertCloudProfile(null).catch(()=>{});
  if(doRender){ toast('Perfil salvo.'); render(); }
}
async function createProfileFlow(){
  if(supabaseClient){
    try{ await supabaseClient.auth.signOut(); }catch(e){}
  }
  cloudUser=null;
  state.activeProfileId=null;
  state.onboardingDone=false;
  state.entryMode=null;
  state.pendingEmailVerification=null;
  onboardingView='login';
  screen='home';
  save();
  render();
  toast('Entre ou crie uma conta para adicionar um novo perfil.');
}
function resetProfileFlow(){ const p=profile(); if(!confirm(`Resetar TODO o perfil ${p.name || 'Perfil'}? Isso apaga treinos, cargas, histórico, check-ins e bioimpedância.`)) return; const t=prompt('Digite RESETAR para confirmar:'); if(t!=='RESETAR') return toast('Reset cancelado.'); const fresh=newProfile(p.name); fresh.id=p.id; state.profiles[state.profiles.findIndex(x=>x.id===p.id)] = fresh; save(); render(); toast('Perfil resetado.'); }



function normalizedExerciseName(name=''){
  return String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}
function latestExerciseLoad(p=profile(), e={}){
  const wantedId=e.id;
  const wantedName=normalizedExerciseName(e.originalName || e.name);
  const list=[...(p.history||[])].reverse();
  for(const h of list){
    const weights=h.weights||{};
    const meta=h.meta||{};
    if(weights[wantedId]) return {weight:weights[wantedId], reps:formatRepsPerSet(meta[wantedId]||{}), date:h.date, workoutName:h.workoutName};
    const candidates=Object.keys(weights);
    for(const id of candidates){
      const maybeName=normalizedExerciseName(meta[id]?.exerciseName || id);
      if(maybeName && maybeName===wantedName) return {weight:weights[id], reps:formatRepsPerSet(meta[id]||{}), date:h.date, workoutName:h.workoutName};
    }
  }
  return null;
}

function exerciseGoalKey(e={}){
  return String(e.id || normalizedExerciseName(e.originalName || e.name || ''));
}
function exerciseGoalNameKey(e={}){
  return 'name:' + normalizedExerciseName(e.originalName || e.name || '');
}
function currentExerciseGoal(p=profile(), e={}){
  const goals=p?.exerciseGoals || {};
  return goals[exerciseGoalKey(e)] || goals[exerciseGoalNameKey(e)] || null;
}
function parseTargetSetsReps(target=''){
  const raw=String(target||'').toLowerCase();
  let m=raw.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if(m) return {sets:Number(m[1])||4, reps:Number(m[2])||12};
  m=raw.match(/(\d+)\s*s[ée]ries?.*?(\d+)\s*rep/i);
  if(m) return {sets:Number(m[1])||4, reps:Number(m[2])||12};
  m=raw.match(/(\d+)\s*rep/i);
  if(m) return {sets:4, reps:Number(m[1])||12};
  return {sets:4, reps:12};
}
function repsArrayFromMeta(e={}, meta={}){
  const cfg=parseTargetSetsReps(e.target || meta.target || '4x12');
  const fromArray=Array.isArray(meta.repsPerSet) ? meta.repsPerSet : null;
  if(fromArray && fromArray.length) return fromArray.slice(0,8).map(v=>String(v??'')).filter(v=>v!=='' || fromArray.length<=cfg.sets);
  const str=String(meta.reps || meta.repsDone || '').trim();
  if(str){
    const nums=str.split(/[\/|,;\s]+/).map(x=>parseInt(x,10)).filter(n=>Number.isFinite(n));
    if(nums.length) return nums.slice(0,8).map(String);
  }
  return Array.from({length:Math.max(1, Math.min(6,cfg.sets))}, ()=>String(cfg.reps));
}
function repsInputsHTML(e={}, meta={}){
  const reps=repsArrayFromMeta(e, meta);
  return `<div class="field full-field reps-field"><label>Reps feitas por série</label><div class="reps-grid" data-reps-wrap="${esc(e.id)}">${reps.map((r,i)=>`<input class="input rep-input" inputmode="numeric" pattern="[0-9]*" data-rep-ex="${esc(e.id)}" data-rep-idx="${i}" value="${esc(r)}" aria-label="Série ${i+1}">`).join('')}</div><small>Ex.: 12 / 12 / 10 / 8. Isso ajuda o Gym Bronze a sugerir a próxima meta.</small></div>`;
}
function normalizeRepsInputsForExercise(id){
  const p=profile();
  if(!p.exerciseMeta[id]) p.exerciseMeta[id]={};
  const reps=[...document.querySelectorAll(`[data-rep-ex="${CSS.escape(id)}"]`)].sort((a,b)=>Number(a.dataset.repIdx)-Number(b.dataset.repIdx)).map(inp=>parseInt(inp.value,10)).filter(n=>Number.isFinite(n) && n>=0 && n<=200);
  p.exerciseMeta[id].repsPerSet=reps;
  p.exerciseMeta[id].reps=reps.join('/');
  p.exerciseMeta[id].sets=reps.length ? reps.length : '';
  p.exerciseMeta[id].repsDoneAvg=reps.length ? Math.round(reps.reduce((a,b)=>a+b,0)/reps.length) : '';
}
function formatRepsPerSet(meta={}){
  const reps=Array.isArray(meta.repsPerSet) ? meta.repsPerSet : String(meta.reps||'').split(/[\/|,;\s]+/).map(x=>parseInt(x,10)).filter(Number.isFinite);
  return reps.length ? reps.join('/') : '';
}
function numberFromWeightText(v){
  const n=parseFloat(String(v||'').replace(',', '.').replace(/[^0-9.\-]/g,''));
  return Number.isFinite(n) ? n : null;
}
function weightUnitText(v){
  const s=String(v||'');
  const m=s.match(/[a-zA-ZÀ-ÿ%]+/g);
  return m ? m.join('') : 'kg';
}
function exerciseProgressionType(e={}){
  const s=normalizedExerciseName((e?.type||'')+' '+(e?.name||'')+' '+(e?.originalName||''));
  if(/halter|dumbbell/.test(s)) return 'dumbbell';
  if(/maquina|machine|cabo|crossover|pulley|peck|fly|leg press|leg|hack|extensora|flexora|abdutora|adutora|panturrilha sentado|smith/.test(s)) return 'machine';
  if(/barra|barbell|supino reto|agachamento livre|levantamento terra|stiff/.test(s)) return 'barbell';
  return 'default';
}
function nextAvailableWeightNumber(n, type='default'){
  if(!Number.isFinite(n)) return null;
  if(type==='dumbbell'){
    if(n < 10) return Math.ceil(n + 0.0001); // halteres leves: sobe de 1 em 1 até 10 kg
    let next=Math.ceil((n + 0.0001)/2)*2; // depois, padrão comum de 2 em 2 kg
    if(next<=n) next+=2;
    return next;
  }
  if(type==='machine'){
    if(n < 20){
      const next=Math.ceil((n + 0.0001)/4)*4; // placas leves: 4 em 4 até 20 kg
      return Math.min(20, next<=n ? next+4 : next);
    }
    let next=Math.ceil((n + 0.0001)/5)*5; // depois, 5 em 5 kg
    if(next<=n) next+=5;
    return next;
  }
  if(type==='barbell'){
    const step=n<60 ? 2.5 : 5;
    let next=Math.ceil((n + 0.0001)/step)*step;
    if(next<=n) next+=step;
    return next;
  }
  const step=n<20 ? 1 : n<60 ? 2 : 5;
  let next=Math.ceil((n + 0.0001)/step)*step;
  if(next<=n) next+=step;
  return next;
}
function bumpWeightText(weight, pct=0.05, e={}){
  const n=numberFromWeightText(weight);
  if(n===null) return '';
  const unit=weightUnitText(weight);
  const type=exerciseProgressionType(e);
  const byType=nextAvailableWeightNumber(n, type);
  const stepTarget=n*(1+pct);
  const candidate=byType===null ? null : Math.max(byType, nextAvailableWeightNumber(stepTarget, type) || byType);
  if(candidate===null) return '';
  const rounded=Number.isInteger(candidate) ? String(candidate) : String(candidate).replace('.', ',');
  return `${rounded} ${unit}`;
}
function goalForExerciseFromRecord(e={}, record={}){
  const meta=record.meta?.[e.id] || {};
  const weight=record.weights?.[e.id] || '';
  const reps=Array.isArray(meta.repsPerSet) ? meta.repsPerSet.map(Number).filter(Number.isFinite) : [];
  const cfg=parseTargetSetsReps(e.target||'4x12');
  const totalTarget=cfg.sets*cfg.reps;
  const totalDone=reps.reduce((a,b)=>a+b,0);
  const completedRatio=totalTarget ? totalDone/totalTarget : 0;
  const minRep=reps.length ? Math.min(...reps) : 0;
  const diff=String(meta.difficulty||'').toLowerCase();
  const pain=String(meta.pain||'').toLowerCase();
  const hasPain=/m[eé]dia|forte/.test(pain);
  const veryHard=/muito/.test(diff);
  const easy=/f[aá]cil/.test(diff);
  let suggestion='Manter a carga e repetir a meta planejada.';
  let reason='Ainda falta histórico suficiente para uma sugestão mais precisa.';
  let suggestedWeight=weight;
  let repsTarget=e.target || `${cfg.sets}x${cfg.reps}`;
  if(record.status?.[e.id]==='skipped'){
    suggestion='Retomar este exercício com calma no próximo treino.';
    reason='Ele foi pulado neste treino.';
  }else if(hasPain){
    suggestion=`Manter ${weight || 'a carga atual'} ou reduzir levemente e priorizar execução.`;
    reason='Você marcou dor/desconforto relevante.';
  }else if(veryHard || completedRatio < .75){
    suggestion=`Manter ${weight || 'a carga atual'} até fechar melhor as reps.`;
    reason=reps.length ? `Você fez ${reps.join('/')} em uma meta ${cfg.sets}x${cfg.reps}.` : 'O treino foi marcado como muito pesado.';
  }else if(completedRatio >= 1 && minRep >= cfg.reps && (easy || !/pesada/.test(diff))){
    const next=bumpWeightText(weight, 0.05, e);
    suggestedWeight=next || weight;
    suggestion=next ? `Tentar ${next} ou a próxima carga disponível, mantendo pelo menos ${cfg.sets}x${Math.max(8, cfg.reps-2)}.` : `Tentar subir para a próxima carga disponível mantendo ${cfg.sets}x${Math.max(8, cfg.reps-2)}.`;
    reason=reps.length ? `Você fechou ${reps.join('/')} sem sinal forte de dor.` : 'Você concluiu a meta planejada.';
  }else if(completedRatio >= .9){
    suggestion=`Manter ${weight || 'a carga atual'} e buscar fechar ${cfg.sets}x${cfg.reps}.`;
    reason=reps.length ? `Você chegou perto da meta: ${reps.join('/')}.` : 'Você ficou perto da meta.';
  }else{
    suggestion=`Manter ${weight || 'a carga atual'} e tentar melhorar o total de reps.`;
    reason=reps.length ? `Resultado registrado: ${reps.join('/')} para meta ${cfg.sets}x${cfg.reps}.` : 'Faltam reps registradas por série.';
  }
  return {exerciseId:e.id, exerciseName:e.name, workoutId:record.workoutId, createdAt:nowISO(), source:'auto', lastWeight:weight, repsPerSet:reps, target:e.target||'', suggestedWeight, repsTarget, suggestion, reason, validFor:'next_workout'};
}
function saveExerciseGoal(p,e,goal){
  if(!p.exerciseGoals) p.exerciseGoals={};
  p.exerciseGoals[exerciseGoalKey(e)] = goal;
  p.exerciseGoals[exerciseGoalNameKey(e)] = goal;
}
function updateExerciseGoalsFromWorkout(p,w,record,dayExercises=[]){
  (dayExercises||[]).forEach(e=>{
    const kind=exerciseKind(e);
    if(kind==='mobility') return;
    const goal=goalForExerciseFromRecord(e,record);
    saveExerciseGoal(p,e,goal);
  });
}
function applyAiExerciseGoalsFromReport(p,h,w){
  const items=h?.aiReport?.exerciseGoals;
  if(!Array.isArray(items) || !items.length) return false;
  const exercises=(w?.exercises || []).concat(workoutExercisesForToday(w,p)||[]);
  items.forEach(item=>{
    const target=exercises.find(e=>e.id===item.exerciseId) || exercises.find(e=>normalizedExerciseName(e.name)===normalizedExerciseName(item.exerciseName));
    if(!target) return;
    const local=currentExerciseGoal(p,target) || {};
    saveExerciseGoal(p,target,{...local, ...item, exerciseId:target.id, exerciseName:target.name, source:'ia', createdAt:nowISO(), validFor:'next_workout'});
  });
  return true;
}

function substituteOptionsForExercise(e={}){
  const s=normalizedExerciseName((e.originalName||e.name||'')+' '+(e.type||''));
  const opt=(arr)=>arr.map((name,i)=>({id:'sub_'+i+'_'+Date.now(), name, target:e.target||'3-4 séries', type:e.type||'alternativa'}));
  if(/supino|peito|peck|crucifixo|crossover/.test(s)) return opt(['Supino com halteres','Flexão de braço','Crucifixo com halteres','Crossover em outra polia']);
  if(/pulley|remada|costas/.test(s)) return opt(['Remada unilateral com halter','Remada baixa com outra pegada','Pulldown com braço reto','Remada curvada leve']);
  if(/triceps|tríceps/.test(s)) return opt(['Tríceps corda','Tríceps francês com halter','Tríceps banco','Tríceps unilateral na polia']);
  if(/rosca|biceps|bíceps/.test(s)) return opt(['Rosca alternada com halteres','Rosca martelo','Rosca direta com barra W','Rosca no cabo com outra pegada']);
  if(/ombro|elevacao|elevação|desenvolvimento/.test(s)) return opt(['Desenvolvimento com halteres','Elevação lateral com halteres','Elevação lateral na polia oposta','Face pull']);
  if(/leg|hack|agach|extensora|quadriceps|quadríceps/.test(s)) return opt(['Agachamento goblet','Passada andando','Afundo búlgaro','Leg press unilateral se livre']);
  if(/stiff|flexora|posterior|mesa/.test(s)) return opt(['Stiff com halteres','Levantamento terra romeno leve','Flexora unilateral se livre','Ponte de glúteo']);
  if(/panturrilha/.test(s)) return opt(['Panturrilha em pé','Panturrilha no leg press','Panturrilha unilateral','Panturrilha sentado se livre']);
  if(/abd|prancha|core/.test(s)) return opt(['Prancha','Abdominal máquina livre alternativo','Elevação de pernas','Crunch no solo']);
  return opt(['Variação livre equivalente','Exercício com halteres','Exercício no cabo livre','Pular e compensar no próximo treino']);
}
function tempSubstitutionFor(p,e){
  const sub=p.tempSubstitutions?.[e.id];
  if(!sub || sub.dateKey!==dateKey()) return null;
  return sub;
}
function applySubstitutionToExercise(p,e){
  const sub=tempSubstitutionFor(p,e);
  if(!sub) return e;
  return {...e, originalName:e.originalName || e.name, name:sub.name, target:sub.target || e.target, type:sub.type || e.type, temporarySubstitution:true, substituteReason:sub.reason || 'Máquina ocupada'};
}
function applyTemporarySubstitutions(list,p=profile()){
  return (list||[]).map(e=>applySubstitutionToExercise(p,e));
}
function openSubstitutionModal(exId){
  const p=profile();
  const w=currentWorkout(p);
  if(!w) return toast('Nenhum treino ativo.');
  const current=workoutExercisesForToday(w,p).find(e=>e.id===exId) || (w.exercises||[]).find(e=>e.id===exId);
  if(!current) return toast('Exercício não encontrado.');
  const original=(w.exercises||[]).find(e=>e.id===exId) || current;
  const options=substituteOptionsForExercise(original);
  const layer=byId('modalLayer');
  layer.innerHTML=`<div class="modal quick-modal"><div class="modal-head"><div><p class="eyebrow">Academia cheia</p><h2>Trocar só hoje</h2><p class="muted">Substitui ${esc(original.name)} sem alterar seu treino fixo.</p></div><button class="close" data-close>×</button></div>
    <section class="card compact-card"><div class="card-title"><div><h3>Alternativas rápidas</h3><p>Escolha a mais viável agora. A troca entra no histórico do treino.</p></div><span class="badge orange">Temporário</span></div>
    <div class="sub-list">${options.map((o,i)=>`<button class="sub-option" data-apply-sub="${i}"><strong>${esc(o.name)}</strong><span>${esc(o.target)}</span></button>`).join('')}</div></section>
    <div class="field"><label>Ou escreva outra opção</label><input class="input" id="customSubName" placeholder="ex: supino inclinado smith"></div>
    <div class="actions"><button class="btn" data-apply-custom-sub>Usar opção escrita</button><button class="btn secondary" data-remove-sub="${esc(exId)}">Voltar ao original</button><button class="btn secondary" data-close>Cancelar</button></div></div>`;
  layer.classList.remove('hidden');
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>openWorkout(w.id));
  document.querySelectorAll('[data-apply-sub]').forEach(b=>b.onclick=()=>{
    const chosen=options[Number(b.dataset.applySub)];
    if(!p.tempSubstitutions) p.tempSubstitutions={};
    p.tempSubstitutions[exId]={...chosen, originalName:original.name, dateKey:dateKey(), reason:'Máquina ocupada', createdAt:nowISO()};
    save(); openWorkout(w.id); toast('Substituição aplicada só para hoje.');
  });
  const custom=byId('customSubName');
  document.querySelector('[data-apply-custom-sub]').onclick=()=>{
    const name=(custom?.value||'').trim();
    if(!name) return toast('Digite o nome da alternativa.');
    if(!p.tempSubstitutions) p.tempSubstitutions={};
    p.tempSubstitutions[exId]={id:'custom_'+Date.now(), name, target:original.target||'3-4 séries', type:original.type||'alternativa', originalName:original.name, dateKey:dateKey(), reason:'Máquina ocupada', createdAt:nowISO()};
    save(); openWorkout(w.id); toast('Substituição aplicada só para hoje.');
  };
  const rem=document.querySelector('[data-remove-sub]');
  if(rem) rem.onclick=()=>{ if(p.tempSubstitutions) delete p.tempSubstitutions[exId]; save(); openWorkout(w.id); toast('Exercício original restaurado.'); };
}

function exerciseKind(e){
  if(exerciseIsCardio(e)) return 'cardio';
  const s=String((e?.type||'')+' '+(e?.name||'')).toLowerCase();
  if(/prancha|abdominal|core/.test(s)) return 'core';
  if(/along|mobilidade|aquecimento/.test(s)) return 'mobility';
  return 'strength';
}
function exerciseHTML(p,w,e,isCurrent){
  const done=!!p.tempDone[e.id];
  const status=p.tempStatus[e.id];
  const m=p.exerciseMeta[e.id] || {};
  const t=p.tempTimes?.[e.id] || {};
  const statusTime = t.completedAt ? `Concluído às ${fmtTime(t.completedAt)}` : t.skippedAt ? `Pulado às ${fmtTime(t.skippedAt)}` : '';
  const adj=currentAdjustment(p);
  const isQuickPriority=!!(adj?.focusExerciseIds||[]).includes(e.id);
  const weight=p.weights[e.id] || '';
  const lastLoad=latestExerciseLoad(p,e);
  const sub=tempSubstitutionFor(p,e);
  const locked=!isCurrent;
  const kind=exerciseKind(e);
  const commonTail = `
      <div class="field"><label>Dificuldade</label><select class="select" data-meta="difficulty" data-ex-id="${e.id}">
        ${['','Fácil','Boa','Pesada','Muito pesada'].map(x=>`<option ${m.difficulty===x?'selected':''}>${x}</option>`).join('')}
      </select></div>
      <div class="field"><label>Dor/desconforto</label><select class="select" data-meta="pain" data-ex-id="${e.id}">
        ${['','Não','Leve','Média','Forte'].map(x=>`<option ${m.pain===x?'selected':''}>${x}</option>`).join('')}
      </select></div>
      <div class="field full-field"><label>Observação</label><input class="input" data-meta="note" data-ex-id="${e.id}" value="${esc(m.note||'')}" placeholder="ex: cansei muito, dor no pé, ajustar ritmo..."></div>`;
  const goal=currentExerciseGoal(p,e);
  const strengthFields = `
      <div class="field"><label>Carga usada</label><input class="input" data-weight="${e.id}" value="${esc(weight)}" placeholder="ex: 40 kg"></div>
      ${repsInputsHTML(e,m)}
      ${commonTail}`;
  const cardioFields = `
      <div class="field full-field"><label>Tipo de cardio</label><div class="segmented compact-segmented">
        ${['Bike','Esteira','Escada','Elíptico','Corrida'].map(x=>`<button type="button" class="seg-btn ${(m.cardioType||'Bike')===x?'active':''}" data-cardio-type="${esc(x)}" data-ex-id="${e.id}">${x}</button>`).join('')}
      </div></div>
      <div class="field"><label>Tempo feito</label><input class="input" data-meta="cardioTime" data-ex-id="${e.id}" value="${esc(m.cardioTime||'')}" placeholder="ex: 20 min"></div>
      <div class="field"><label>Intensidade</label><select class="select" data-meta="cardioIntensity" data-ex-id="${e.id}">
        ${['','Leve','Moderado','Forte'].map(x=>`<option ${m.cardioIntensity===x?'selected':''}>${x}</option>`).join('')}
      </select></div>
      <div class="field full-field"><label>Observação opcional</label><input class="input" data-meta="cardioNote" data-ex-id="${e.id}" value="${esc(m.cardioNote||m.note||'')}" placeholder="ex: bike moderada, esteira inclinada, escada puxada..."></div>`;
  const coreFields = `
      <div class="field"><label>Tempo/reps feitos</label><input class="input" data-meta="coreDone" data-ex-id="${e.id}" value="${esc(m.coreDone||'')}" placeholder="ex: 3x30s ou 3x15"></div>
      <div class="field"><label>Próxima meta</label><input class="input" data-meta="coreTarget" data-ex-id="${e.id}" value="${esc(m.coreTarget||e.target||'')}" placeholder="ex: 3x40s"></div>
      ${commonTail}`;
  const mobilityFields = `
      <div class="field"><label>Tempo feito</label><input class="input" data-meta="mobilityTime" data-ex-id="${e.id}" value="${esc(m.mobilityTime||'')}" placeholder="ex: 8 min"></div>
      <div class="field"><label>Região</label><input class="input" data-meta="mobilityArea" data-ex-id="${e.id}" value="${esc(m.mobilityArea||'')}" placeholder="ex: ombro, quadril..."></div>
      ${commonTail}`;
  const fields = kind==='cardio' ? cardioFields : kind==='core' ? coreFields : kind==='mobility' ? mobilityFields : strengthFields;
  const kindLabel = kind==='cardio' ? 'cardio' : kind==='core' ? 'core' : kind==='mobility' ? 'mobilidade' : (e.type||'força');
  return `<div class="exercise ${done?'done':''} ${status==='skipped'?'skipped':''} ${isQuickPriority?'quick-priority-ex':''}" data-exercise-card="${e.id}">
    <div class="exercise-top">
      <div><h4>${esc(e.name)}</h4><div class="small">${esc(kindLabel)} • meta ${esc(e.target||'4x12')}${statusTime ? ' • '+esc(statusTime) : ''}</div>${lastLoad?`<div class="last-load">Última carga: <b>${esc(lastLoad.weight)}</b> • ${lastLoad.reps?`reps ${esc(lastLoad.reps)} • `:''}${esc(fmtDate(lastLoad.date))}</div>`:''}${goal?`<div class="suggested-goal">🎯 Meta sugerida: <b>${esc(goal.suggestion||'')}</b>${goal.source==='ia'?' <span>IA</span>':''}</div>`:''}${e.temporarySubstitution?`<div class="last-load orange">Hoje no lugar de: <b>${esc(e.originalName||'exercício original')}</b></div>`:''}</div>
      <span class="badge ${done?'green':status==='skipped'?'yellow':isQuickPriority?'orange':''}">${done?'Concluído':status==='skipped'?'Pulado':isQuickPriority?'Prioridade':isCurrent?'Pendente':'Consulta'}</span>
    </div>
    <div class="exercise-controls ${kind==='cardio'?'cardio-controls':''}">
      ${fields}
    </div>
    <div class="actions">
      <button class="btn sm green" ${locked?'disabled':''} data-toggle-ex="${e.id}">${done?'Desmarcar':'Concluir'}</button>
      <button class="btn sm secondary" ${locked?'disabled':''} data-skip-ex="${e.id}">Pular</button>
      <button class="btn sm secondary" ${locked?'disabled':''} data-sub-ex="${e.id}">${sub?'Trocar novamente':'Máquina ocupada'}</button>
    </div>
  </div>`;
}

function openWorkout(id){
  activeModalWorkout=id;
  const p=profile(); const w=workoutById(p,id); const isCurrent=p.queue[0]===id; const layer=byId('modalLayer');
  if(isCurrent && (!p.activeWorkoutSession || p.activeWorkoutSession.id!==id)){
    p.activeWorkoutSession={id, startAt:nowISO()};
    if(!p.tempTimes) p.tempTimes={};
    save();
  }
  const adj=currentAdjustment(p);
  const variant=currentVariant(p);
  const dayExercises=workoutExercisesForToday(w,p);
  layer.innerHTML = `<div class="modal"><div class="modal-head"><div><p class="eyebrow">${isCurrent?'Treino liberado':'Modo consulta'}</p><h2>${w.id} — ${esc(w.name)}</h2><p class="muted">${isCurrent?'Você pode concluir exercícios e finalizar.':'Você pode consultar cargas, mas não concluir fora da ordem.'}</p></div><button class="close" data-close>×</button></div>
  <div class="actions modal-actions-top"><button class="btn sm" data-open-today-center>Ajuste treino hoje</button><button class="btn sm secondary" data-edit-workout="${w.id}">Editar treino</button><button class="btn sm secondary" data-close>Fechar</button></div>
  ${variant?`<section class="card quick-active-card"><div class="card-title"><div><h3>${esc(variant.tag || 'Versão ativa')}</h3><p>${esc(variant.title || '')} • vale só hoje</p></div><span class="badge orange">Temporário</span></div><p class="muted">O treino original permanece salvo. Na próxima vez, ele volta normal.</p></section>`:''}
  ${adj?`<section class="card quick-active-card"><div class="card-title"><div><h3>${esc(adj.tag || 'Ajuste ativo')}</h3><p>${esc(adj.title || '')} • aplicado às ${fmtTime(adj.date)}</p></div><span class="badge orange">Hoje</span></div><p class="muted">${esc((adj.notes||[]).slice(0,2).join(' '))}</p></section>`:''}
  ${dayExercises.map(e=>exerciseHTML(p,w,e,isCurrent)).join('')}
  <div class="divider"></div><div class="actions"><button class="btn green" ${isCurrent?'':'disabled'} data-finalize-workout="${w.id}">Finalizar treino</button><button class="btn secondary" data-close>Fechar</button></div></div>`;
  layer.classList.remove('hidden');
  wireWorkoutModal();
}
function wireWorkoutModal(){
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  document.querySelectorAll('[data-weight]').forEach(inp=>inp.oninput=()=>{ const p=profile(); p.weights[inp.dataset.weight]=inp.value; save(); });
  document.querySelectorAll('[data-rep-ex]').forEach(inp=>{
    inp.onfocus=()=>setTimeout(()=>{ try{ inp.select(); }catch(e){} },0);
    inp.onmouseup=(ev)=>{ ev.preventDefault(); };
    inp.oninput=()=>{ normalizeRepsInputsForExercise(inp.dataset.repEx); save(); };
  });
  document.querySelectorAll('[data-meta]').forEach(inp=>inp.oninput=inp.onchange=()=>{ const p=profile(); const id=inp.dataset.exId; if(!p.exerciseMeta[id]) p.exerciseMeta[id]={}; p.exerciseMeta[id][inp.dataset.meta]=inp.value; save(); });
  document.querySelectorAll('[data-cardio-type]').forEach(btn=>btn.onclick=()=>{ const p=profile(); const id=btn.dataset.exId; if(!p.exerciseMeta[id]) p.exerciseMeta[id]={}; p.exerciseMeta[id].cardioType=btn.dataset.cardioType; save(); refreshWorkoutKeepingScroll(); });
  document.querySelectorAll('[data-toggle-ex]').forEach(b=>b.onclick=()=>toggleDone(b.dataset.toggleEx));
  document.querySelectorAll('[data-skip-ex]').forEach(b=>b.onclick=()=>skipExercise(b.dataset.skipEx));
  document.querySelectorAll('[data-sub-ex]').forEach(b=>b.onclick=()=>openSubstitutionModal(b.dataset.subEx));
  document.querySelectorAll('[data-finalize-workout]').forEach(b=>b.onclick=()=>finalizeWorkout(b.dataset.finalizeWorkout));
  document.querySelectorAll('[data-edit-workout]').forEach(b=>b.onclick=()=>openEditWorkout(b.dataset.editWorkout));
  document.querySelectorAll('[data-open-quick-coach]').forEach(b=>b.onclick=()=>openQuickCoachModal());
  document.querySelectorAll('[data-open-variant]').forEach(b=>b.onclick=()=>openWorkoutVariantModal());
  document.querySelectorAll('[data-open-today-center]').forEach(b=>b.onclick=()=>openTodayWorkoutCenter());
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
function toggleDone(id){
  const p=profile();
  if(!p.tempTimes) p.tempTimes={};
  p.tempDone[id]=!p.tempDone[id];
  if(p.tempDone[id]){
    p.tempStatus[id]='done';
    p.tempTimes[id]={...(p.tempTimes[id]||{}), status:'done', completedAt:nowISO()};
  }else{
    delete p.tempStatus[id];
    delete p.tempTimes[id];
  }
  save();
  refreshWorkoutKeepingScroll();
}
function skipExercise(id){
  const p=profile();
  if(!p.tempTimes) p.tempTimes={};
  p.tempDone[id]=false;
  p.tempStatus[id]='skipped';
  p.tempTimes[id]={...(p.tempTimes[id]||{}), status:'skipped', skippedAt:nowISO()};
  save();
  refreshWorkoutKeepingScroll();
}
function closeModal(){ byId('modalLayer').classList.add('hidden'); byId('modalLayer').innerHTML=''; render(); }
function finalizeWorkout(id){ const p=profile(); if(p.queue[0]!==id) return toast(`Bloqueado. O próximo treino correto é ${p.queue[0]}.`); const w=workoutById(p,id); const dayExercises=workoutExercisesForToday(w,p); const variant=currentVariant(p); const doneCount=dayExercises.filter(e=>p.tempDone[e.id]).length; const skippedCount=dayExercises.filter(e=>p.tempStatus[e.id]==='skipped').length;
  if(!confirm(`Finalizar o treino ${id}?\n\nConcluídos: ${doneCount}\nPulados: ${skippedCount}`)) return;
  const weights={}, status={}, metaSnap={}, substitutions=[];
  dayExercises.forEach(e=>{
    if(p.weights[e.id]) weights[e.id]=p.weights[e.id];
    if(p.tempStatus[e.id]) status[e.id]=p.tempStatus[e.id];
    const metaObj={...(p.exerciseMeta[e.id]||{}), ...(p.tempTimes?.[e.id]||{})};
    if(Array.isArray(metaObj.repsPerSet)){ metaObj.reps = metaObj.repsPerSet.join('/'); metaObj.sets = metaObj.repsPerSet.length; metaObj.repsDoneAvg = metaObj.repsPerSet.length ? Math.round(metaObj.repsPerSet.reduce((a,b)=>Number(a)+Number(b),0)/metaObj.repsPerSet.length) : ''; }
    metaObj.exerciseName=e.name;
    if(e.temporarySubstitution){ metaObj.originalExerciseName=e.originalName||''; metaObj.substituteReason=e.substituteReason||'Máquina ocupada'; substitutions.push({exerciseId:e.id, originalName:e.originalName||'', substituteName:e.name, reason:e.substituteReason||'Máquina ocupada', createdAt:nowISO()}); }
    if(Object.keys(metaObj).length) metaSnap[e.id]=metaObj;
  });
  const startedAt = p.activeWorkoutSession?.id===id ? p.activeWorkoutSession.startAt : nowISO();
  const finishedAt = nowISO();
  const durationMinutes = Math.max(0, Math.round((new Date(finishedAt)-new Date(startedAt))/60000));
  const score = Math.max(0, Math.round(((doneCount + skippedCount*.35) / Math.max(1, dayExercises.length)) * 100));
  const record = {id:'h_'+Date.now(), date:finishedAt, startedAt, finishedAt, durationMinutes, workoutId:id, workoutName:w.name, workoutVariant:variant, workoutAdjustment:currentAdjustment(p), substitutions, doneCount, skippedCount, score, weights, status, meta:metaSnap};
  updateExerciseGoalsFromWorkout(p,w,record,dayExercises);
  const xpInfo = awardWorkoutXP(p,w,record);
  if(aiConfigured(p) && p.ai.autoWorkoutReport && canUseOnlineAI()) record.aiReportStatus='pending';
  else if(p.ai.autoWorkoutReport && isOffline()) record.aiReportError='IA pausada: você estava offline.';
  else if(p.ai.autoWorkoutReport && !cloudUser) record.aiReportError='IA pausada: entre na conta para gerar relatório.';
  p.history.push(record);
  p.progress = Math.min(p.target, p.progress + 1); p.queue.push(p.queue.shift()); p.tempDone={}; p.tempStatus={}; p.tempTimes={}; p.activeWorkoutSession=null; p.activeWorkoutVariant=null; p.activeWorkoutAdjustment=null; p.tempSubstitutions={};
  save(); closeModal(); toast(record.aiReportStatus==='pending' ? levelUpToast(xpInfo)+' Gerando relatório com IA...' : (isOffline() ? levelUpToast(xpInfo)+' Salvo offline neste aparelho.' : levelUpToast(xpInfo)));
  maybeShowRankUpModal(xpInfo);
  saveCurrentPlanToCloud('queue_after_workout').catch(()=>{});
  if(record.aiReportStatus==='pending') generateWorkoutAIReport(p.id, record.id);
  else saveWorkoutToCloud(p, record, {silent:true});

}

function openQuickMenuModal(){
  const p=profile();
  const layer=byId('modalLayer');
  const items=[
    ['home','🏠','Início','Missão do dia'],
    ['workouts','🏋️','Treinos','Plano e execução'],
    ['lessons','🧘','Aulas','Yoga, Pilates e coletivas'],
    ['checkin','⚡','Check-in','Diário e físico'],
    ['coach','🥗','Nutri','Rotina e checklist'],
    ['progress','📈','Progresso','Cargas e histórico'],
    ['profile','👤','Perfil','Conta e segurança']
  ];
  layer.innerHTML=`<div class="modal quick-modal"><div class="modal-head"><div><p class="eyebrow">Menu rápido</p><h2>Gym Bronze</h2><p class="muted">Atalhos para as áreas principais e ações rápidas.</p></div><button class="close" data-close>×</button></div>
    <div class="quick-grid">${items.map(([screenKey,icon,title,desc])=>`<button class="quick-item" data-quick-screen="${screenKey}"><b>${icon}</b><span><strong>${title}</strong><small>${desc}</small></span></button>`).join('')}</div>
    <div class="divider"></div>
    <div class="actions"><button class="btn" data-quick-action="open-score">Score do dia</button><button class="btn secondary" data-quick-action="today-workout-center">Treino de hoje</button><button class="btn secondary" data-quick-action="daily-checkin">Check-in rápido</button><button class="btn secondary" data-quick-action="account-switch">Alternar conta</button>${p.dietPlan?'<button class="btn secondary" data-quick-action="nutrition-checklist">Checklist nutri</button>':'<button class="btn secondary" data-quick-action="generate-diet-plan">Gerar nutri</button>'}</div>
    <p class="muted">v${APP_VERSION}</p>
  </div>`;
  layer.classList.remove('hidden');
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  document.querySelectorAll('[data-quick-screen]').forEach(b=>b.onclick=()=>{ const s=b.dataset.quickScreen; closeModal(); setScreen(s); });
  document.querySelectorAll('[data-quick-action]').forEach(b=>b.onclick=()=>{ const a=b.dataset.quickAction; closeModal(); handleAction(a); });
}
function openProfileSwitcher(){
  const layer=byId('modalLayer');
  const list=(state.profiles||[]).map(p=>`<div class="profile-option"><div class="workout-left"><div class="avatar-dot">${esc((p.name||'?').charAt(0).toUpperCase())}</div><div><strong>${esc(p.name || 'Perfil')}</strong><div class="small">${p.accountEmail?esc(p.accountEmail)+' • ':''}${levelFromXp(ensureGamification(p).xp).rank.name} • Nv. ${levelFromXp(ensureGamification(p).xp).roman}</div></div></div><button class="btn sm ${p.id===state.activeProfileId?'green':'secondary'}" data-modal-switch-profile="${p.id}">${p.id===state.activeProfileId?'Ativo':'Usar'}</button></div>`).join('');
  layer.innerHTML=`<div class="modal"><div class="modal-head"><div><p class="eyebrow">Alternar conta</p><h2>Escolha o usuário</h2><p class="muted">Cada conta tem treino, nutri, XP e progresso separados neste aparelho.</p></div><button class="close" data-close>×</button></div><div class="profile-list">${list || '<div class="empty">Nenhum perfil ativo neste aparelho.</div>'}</div><div class="actions"><button class="btn" data-modal-open-profile>Abrir Perfil</button><button class="btn secondary" data-modal-new-profile>Adicionar novo perfil</button></div></div>`;
  layer.classList.remove('hidden');
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  document.querySelectorAll('[data-modal-switch-profile]').forEach(b=>b.onclick=async()=>{
    state.activeProfileId=b.dataset.modalSwitchProfile;
    state.onboardingDone=true;
    screen='home';
    save();
    closeModal();
    render();
    toast('Conta alternada.');
  });
  const openProfileBtn=document.querySelector('[data-modal-open-profile]'); if(openProfileBtn) openProfileBtn.onclick=()=>{closeModal(); setScreen('profile');};
  document.querySelector('[data-modal-new-profile]').onclick=()=>{closeModal(); createProfileFlow();};
}

function rangeField(id,label,value=3,help=''){
  return `<div class="field range-field"><label>${label}</label><input type="range" min="1" max="5" step="1" id="${id}" value="${esc(value||3)}"><small>${help}</small></div>`;
}
function openDailyCheckinModal(){
  const p=profile();
  const existing=dailyCheckinToday(p) || {};
  const layer=byId('modalLayer');
  layer.innerHTML=`<div class="modal daily-modal"><div class="modal-head"><div><p class="eyebrow">Check-in diário</p><h2>Como você está hoje?</h2><p class="muted">Leva menos de 1 minuto. Isso ajuda o Gym Bronze a entender quando pesar ou aliviar.</p></div><button class="close" data-close>×</button></div>
    <div class="daily-score-preview"><div class="progress-ring small-ring" style="--p:${existing.readinessScore||0}%"><div class="progress-ring-inner">${existing.readinessScore||'--'}<small>pronto</small></div></div><p>${existing.readinessScore?'Score atual: '+readinessLabel(existing):'Preencha para calcular seu estado de hoje.'}</p></div>
    <div class="form-grid">
      ${rangeField('dailySleep','Sono',existing.sleep||3,'1 ruim • 5 ótimo')}
      ${rangeField('dailyEnergy','Energia',existing.energy||3,'1 sem energia • 5 voando')}
      ${rangeField('dailyPain','Dor/desconforto',existing.pain||1,'1 sem dor • 5 dor forte')}
      ${rangeField('dailyHunger','Fome/apetite',existing.hunger||3,'1 sem fome • 5 muita fome')}
      ${rangeField('dailyStress','Estresse',existing.stress||3,'1 tranquilo • 5 estressado')}
      ${rangeField('dailyMotivation','Motivação',existing.motivation||3,'1 baixa • 5 alta')}
      <div class="field" style="grid-column:1/-1"><label>Observação</label><textarea id="dailyNotes" placeholder="ex: dormi mal, ombro incomodando, treino às 12h...">${esc(existing.notes||'')}</textarea></div>
    </div>
    <div class="actions"><button class="btn" data-save-daily-checkin>Salvar check-in</button><button class="btn secondary" data-close>Cancelar</button></div>
  </div>`;
  layer.classList.remove('hidden');
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  document.querySelector('[data-save-daily-checkin]').onclick=()=>{
    const record={
      id: existing.id || 'dc_'+Date.now(),
      date: nowISO(),
      dateKey: dateKey(),
      sleep: Number(byId('dailySleep').value),
      energy: Number(byId('dailyEnergy').value),
      pain: Number(byId('dailyPain').value),
      hunger: Number(byId('dailyHunger').value),
      stress: Number(byId('dailyStress').value),
      motivation: Number(byId('dailyMotivation').value),
      notes: byId('dailyNotes').value.trim()
    };
    record.readinessScore=calcReadinessScore(record);
    const idx=(p.dailyCheckins||[]).findIndex(c=>c.dateKey===record.dateKey);
    if(idx>=0) p.dailyCheckins[idx]=record;
    else p.dailyCheckins.push(record);
    save();
    closeModal();
    toast('Check-in diário salvo.');
  };
}
function openCheckinModal(){ const p=profile(), cycle=currentCycleNumber(p); const layer=byId('modalLayer'); layer.innerHTML=`<div class="modal"><div class="modal-head"><div><p class="eyebrow">Check-in</p><h2>Ciclo ${cycle}</h2><p class="muted">Tente usar sempre a mesma luz, pose e distância.</p></div><button class="close" data-close>×</button></div><div class="form-grid">${inputPlain('checkWeight','Peso do dia')} ${inputPlain('checkWaist','Cintura')}<div class="field" style="grid-column:1/-1"><label>Observação do ciclo</label><textarea id="checkNotes"></textarea></div></div><div class="photo-grid"><label class="photo-box"><span>Frente<br><small>toque para enviar</small></span><input type="file" accept="image/*" data-photo="front" hidden></label><label class="photo-box"><span>Lado<br><small>toque para enviar</small></span><input type="file" accept="image/*" data-photo="side" hidden></label><label class="photo-box"><span>Costas<br><small>toque para enviar</small></span><input type="file" accept="image/*" data-photo="back" hidden></label></div><div class="actions"><button class="btn" data-save-checkin>Salvar check-in</button><button class="btn secondary" data-close>Cancelar</button></div></div>`; layer.classList.remove('hidden'); const photos={}; document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal); document.querySelectorAll('[data-photo]').forEach(inp=>inp.onchange=async()=>{ const img=await compressImage(inp.files[0]); photos[inp.dataset.photo]=img; inp.parentElement.innerHTML=`<img src="${img}" alt="foto ${inp.dataset.photo}">`; }); document.querySelector('[data-save-checkin]').onclick=()=>{ p.checkins.push({id:'c_'+Date.now(), date:nowISO(), cycle, weight:byId('checkWeight').value, waist:byId('checkWaist').value, notes:byId('checkNotes').value, photos}); save(); closeModal(); toast('Check-in salvo.'); }; }
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
    completedAt:h.meta?.[e.id]?.completedAt || null,
    skippedAt:h.meta?.[e.id]?.skippedAt || null,
    repsPerSet:h.meta?.[e.id]?.repsPerSet || [],
    suggestedGoal:currentExerciseGoal(p,e),
    meta:h.meta?.[e.id] || {}
  }));
  const previousSame=p.history.filter(x=>x.id!==h.id && x.workoutId===h.workoutId).slice(-3).map(x=>({date:x.date, score:x.score, weights:x.weights, status:x.status, meta:x.meta}));
  return {
    kind:'workout-report',
    profile:{name:p.name, age:p.age, height:p.height, weight:p.weight, goal:p.goal, focus:p.focus, notes:p.notes},
    workout:{id:h.workoutId, name:h.workoutName, date:h.date, score:h.score, doneCount:h.doneCount, skippedCount:h.skippedCount, exercises:exerciseDetails},
    previousSameWorkout:previousSame,
    latestBio:p.bio?.slice(-1)[0] || null,
    todayReadiness:dailyCheckinToday(p),
    activeWorkoutAdjustment:h.workoutAdjustment || currentAdjustment(p),
    workoutVariant:h.workoutVariant || null,
    recentDailyCheckins:recentDailyCheckins(p,7),
    exerciseGoals:p.exerciseGoals || {},
    recentHistory:p.history.slice(-8).map(x=>({date:x.date, workoutId:x.workoutId, workoutName:x.workoutName, score:x.score, doneCount:x.doneCount, skippedCount:x.skippedCount}))
  };
}
async function retryWorkoutAIReport(historyId){
  const p=profile();
  const h=p.history.find(x=>x.id===historyId);
  if(!h) return toast('Treino não encontrado.');
  if(!canUseOnlineAI()) return toast(isOffline()?'Você está offline.':'Entre na conta para usar IA.');
  h.aiReportStatus='pending';
  h.aiReportError='';
  save(); render();
  toast('Tentando gerar relatório novamente...');
  generateWorkoutAIReport(p.id, h.id);
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
    applyAiExerciseGoalsFromReport(p,h,workoutById(p,h.workoutId));
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
  if(hasCloudAccount()){
    await loadLatestPlanFromCloud().catch(()=>{});
    await loadLatestDietPlanFromCloud().catch(()=>{});
    await syncXpEventsToCloud({silent:true}).catch(()=>{});
    await loadXpFromCloud({silent:true}).catch(()=>{});
  }
  render();
  toast(cloudUser ? (isLocalMode()?'Modo local com IA pronto.':'Conta conectada.') : (state.entryMode==='account'?'Dados locais carregados. Entre novamente se a nuvem não conectar.':'Sem sessão online ativa.'));
}

async function cloudLogin(){
  if(!supabaseClient) return toast('Supabase não carregou. Reabra o app.');
  const email=cleanEmailInput(byId('cloudEmail')?.value);
  const password=byId('cloudPassword')?.value || '';
  if(!isValidEmailInput(email) || !password) return toast('Informe um e-mail válido e a senha.');
  const { data, error } = await supabaseClient.auth.signInWithPassword({email,password});
  if(error) return toast(friendlyAuthError(error));
  cloudUser=data?.user || null;
  const confirmed = !!(cloudUser?.email_confirmed_at || cloudUser?.confirmed_at);
  if(!confirmed){
    await supabaseClient.auth.signOut().catch(()=>{});
    cloudUser=null;
    setPendingEmailVerification(email);
    toast('Confirme seu e-mail antes de entrar.');
    render();
    return;
  }
  await completeVerifiedAccountSession();
  await upsertCloudProfile(profile().name || 'Usuário').catch(()=>{});
  toast('Login realizado.'); render();
}
async function cloudSignup(){
  if(!supabaseClient) return toast('Supabase não carregou. Reabra o app.');
  const p=profile();
  const name=byId('cloudName')?.value?.trim() || p.name || 'Usuário';
  const email=cleanEmailInput(byId('cloudEmail')?.value);
  const password=byId('cloudPassword')?.value || '';
  const password2=byId('cloudPassword2')?.value || '';
  if(!isValidEmailInput(email)) return toast('Informe um e-mail válido. Exemplo: nome@gmail.com');
  const passMsg=validateStrongPassword(password);
  if(passMsg) return toast(passMsg);
  if(password !== password2) return toast('As senhas não conferem.');
  if(!byId('cloudAcceptTerms')?.checked) return toast('Aceite os Termos e a Política de Privacidade.');
  p.name=name; ensureProfile(p); markLegalAcceptance(p); save();
  const { data, error } = await supabaseClient.auth.signUp({email,password, options:{data:{display_name:name}, emailRedirectTo: window.location.origin + window.location.pathname}});
  if(error) return toast('Erro ao criar conta: '+friendlyAuthError(error));

  const user = data?.user || null;
  const confirmed = !!(user?.email_confirmed_at || user?.confirmed_at);
  if(data?.session?.access_token && confirmed){
    cloudUser = data.session.user || user || null;
    await completeVerifiedAccountSession();
    await upsertCloudProfile(name);
    await saveCurrentPlanToCloud('account_created_existing_plan').catch(()=>{});
    toast('Conta criada e conectada.');
  } else {
    await supabaseClient.auth.signOut().catch(()=>{});
    cloudUser = null;
    setPendingEmailVerification(email);
    toast('Conta criada. Confirme seu e-mail para liberar IA e nuvem.');
  }
  render();
}
async function clearAppRuntimeCache(){
  try{
    if('caches' in window){
      const names = await caches.keys();
      await Promise.all(names.map(name => caches.delete(name)));
    }
  }catch(e){ console.warn('Não consegui limpar caches:', e); }
  try{
    if('serviceWorker' in navigator){
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(reg => reg.unregister()));
    }
  }catch(e){ console.warn('Não consegui remover service workers:', e); }
}
async function syncCurrentDataBeforeLogout(){
  const p=profile();
  const result={profile:false, workouts:false, plan:false, diet:false, lessons:false};
  if(!hasCloudAccount()) return result;
  try{ await upsertCloudProfile(null); result.profile=true; }catch(e){ console.warn('Falha ao sincronizar perfil antes do logout:', e); }
  try{ await syncLocalHistoryToCloud({silent:true}); result.workouts=true; }catch(e){ console.warn('Falha ao sincronizar histórico antes do logout:', e); }
  try{ await saveCurrentPlanToCloud('logout_sync'); result.plan=true; }catch(e){ console.warn('Falha ao sincronizar plano antes do logout:', e); }
  try{ await saveDietPlanToCloud(p.dietPlan, {silent:true}); result.diet=true; }catch(e){ console.warn('Falha ao sincronizar nutri antes do logout:', e); }
  try{ await syncLessonsToCloud({silent:true}); result.lessons=true; }catch(e){ console.warn('Falha ao sincronizar aulas antes do logout:', e); }
  return result;
}
async function hardResetLocalAppState(){
  try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
  try{ sessionStorage.clear(); }catch(e){}
  state = defaultState();
  screen = 'home';
  onboardingView = 'login';
  cloudUser = null;
}
async function deleteActiveLocalProfile(){
  const p=profile();
  if(!p) return;
  const label=p.name || 'perfil local';
  if(!confirm(`Sair e apagar o perfil local "${label}" deste aparelho?\n\nIsso apaga treinos, nutri, XP, check-ins e dados locais desse perfil. Como ele não está na nuvem, não terá como recuperar.`)) return;
  const t=prompt('Digite APAGAR para confirmar:');
  if(t !== 'APAGAR') return toast('Exclusão cancelada.');
  const idx=state.profiles.findIndex(x=>x.id===p.id);
  if(idx>=0) state.profiles.splice(idx,1);
  state.activeProfileId=state.profiles[0]?.id || null;
  if(!state.activeProfileId){
    state.onboardingDone=false;
    state.entryMode=null;
    onboardingView='login';
    screen='home';
    try{ if(supabaseClient) await supabaseClient.auth.signOut(); }catch(e){}
    cloudUser=null;
  }
  save();
  render();
  toast('Perfil local apagado deste aparelho.');
}
async function deleteAccountFlow(){
  if(isLocalMode() || !hasCloudAccount()) return deleteActiveLocalProfile();
  const p=profile();
  const email=cloudUser?.email || p.accountEmail || '';
  const ok=confirm(`Excluir permanentemente esta conta?\n\nConta: ${email}\n\nIsso tenta apagar seus dados da nuvem e remover o login desta conta. Esta ação não é o mesmo que sair do aparelho e não deve ser usada só para limpar cache.`);
  if(!ok) return;
  const t=prompt('Digite EXCLUIR CONTA para confirmar:');
  if(t !== 'EXCLUIR CONTA') return toast('Exclusão cancelada.');
  const accessToken=await getCloudAccessToken();
  if(!accessToken) return toast('Sessão expirada. Entre novamente para excluir a conta.');
  try{
    const base=String(AI_BACKEND_URL||'').trim().replace(/\/+$/,'');
    const response=await fetch(base + DELETE_ACCOUNT_ENDPOINT_PATH, {
      method:'POST',
      headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${accessToken}`},
      body:JSON.stringify({confirm:'EXCLUIR CONTA'})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.error || `Erro HTTP ${response.status}`);
    const deletedUserId=cloudUser?.id;
    try{ await supabaseClient.auth.signOut(); }catch(e){}
    state.profiles=(state.profiles||[]).filter(x=>x.cloudUserId !== deletedUserId && x.accountEmail !== email);
    state.activeProfileId=state.profiles[0]?.id || null;
    if(!state.activeProfileId){
      state.onboardingDone=false;
      state.entryMode=null;
      onboardingView='login';
      screen='home';
    }
    cloudUser=null;
    save();
    await clearAppRuntimeCache();
    render();
    toast('Conta excluída e dados locais limpos.');
  }catch(e){
    toast('Não consegui excluir a conta: '+(e.message||'erro'));
  }
}
async function localLogoutWarning(){
  return deleteActiveLocalProfile();
}
async function cloudLogout(){
  if(!supabaseClient) return;
  const ok = confirm('Sair da conta neste aparelho e limpar o cache local?\n\nIsso NÃO exclui sua conta na nuvem. O Gym Bronze vai tentar sincronizar seus dados antes de sair e depois este aparelho volta para a tela inicial.');
  if(!ok) return;
  toast('Sincronizando dados antes de sair...');
  await syncCurrentDataBeforeLogout();
  try{ await supabaseClient.auth.signOut(); }catch(e){ console.warn('Falha ao sair do Supabase:', e); }
  await clearAppRuntimeCache();
  await hardResetLocalAppState();
  save();
  toast('Você saiu. Cache local limpo.');
  render();
}
async function upsertCloudProfile(name=null, sourceInfo=null){
  const user=await getCurrentCloudUser();
  if(!user || isAnonymousCloudUser()) return;
  const p=profile();
  if(!p || (p.cloudUserId && p.cloudUserId !== user.id)) return;
  const info = sourceInfo || {};

  let existing=null;
  try{
    const { data } = await supabaseClient.from('profiles').select('*').eq('id', user.id).maybeSingle();
    existing=data || null;
  }catch(e){}

  const textOrExisting=(candidate, existingValue, fallback=null)=>{
    const v=String(candidate ?? '').trim();
    return v ? v : (existingValue ?? fallback);
  };
  const numOrExisting=(candidate, existingValue, fallback=null)=>{
    const n=parseNumberValue(candidate);
    return Number.isFinite(n) && n !== null ? n : (existingValue ?? fallback);
  };

  const row = {
    id:user.id,
    name:textOrExisting(name || p.name || info.name || user.user_metadata?.display_name, existing?.name, user.email?.split('@')[0] || 'Usuário'),
    sex:textOrExisting(p.sex || info.sex || user.user_metadata?.sex, existing?.sex, null),
    age:numOrExisting(p.age || info.age || user.user_metadata?.age, existing?.age, null),
    height:numOrExisting(p.height || info.height || user.user_metadata?.height, existing?.height, null),
    initial_weight:numOrExisting(p.weight || info.weight || user.user_metadata?.weight || user.user_metadata?.initial_weight, existing?.initial_weight, null),
    goal:textOrExisting(p.goal || info.goal || user.user_metadata?.goal, existing?.goal, null),
    focus:textOrExisting(p.focus || info.focus || user.user_metadata?.focus, existing?.focus, null),
    notes:textOrExisting(p.notes || info.notes || user.user_metadata?.notes, existing?.notes, null),
    experience:textOrExisting(p.experience || info.experience || user.user_metadata?.experience, existing?.experience, 'Iniciante'),
    days_per_week:numOrExisting(p.daysPerWeek || info.daysPerWeek || user.user_metadata?.daysPerWeek || user.user_metadata?.days_per_week, existing?.days_per_week, 5),
    accepted_terms_at:p.acceptedTermsAt || existing?.accepted_terms_at || user.user_metadata?.accepted_terms_at || nowISO(),
    accepted_privacy_at:p.acceptedPrivacyAt || existing?.accepted_privacy_at || user.user_metadata?.accepted_privacy_at || nowISO(),
    routine:{...(p.routine || info.routine || existing?.routine || {}), lessons:p.lessons||[], lessonLogs:p.lessonLogs||[]},
    reminders:p.reminders || info.reminders || existing?.reminders || {}
  };
  const { error } = await supabaseClient.from('profiles').upsert(row, { onConflict:'id' });
  if(error) throw error;
}

function serializeCurrentPlan(p=profile()){
  return {
    version:'gym-bronze-plan-v1',
    planMeta:p.planMeta || {},
    workouts:p.workouts || [],
    queue:p.queue || [],
    exerciseGoals:p.exerciseGoals || {},
    target:p.target,
    programWeeks:p.programWeeks,
    programLabel:p.programLabel,
    profileSnapshot:{
      name:p.name, sex:p.sex, age:p.age, height:p.height, weight:p.weight,
      goal:p.goal, focus:p.focus, experience:p.experience, daysPerWeek:p.daysPerWeek, notes:p.notes,
      routine:p.routine || {}, reminders:p.reminders || {}, exerciseGoals:p.exerciseGoals || {}
    }
  };
}
async function saveCurrentPlanToCloud(reason='plan_update'){
  if(!supabaseClient || !hasCloudAccount()) return {ok:false, reason:'no_account'};
  const user=await getCurrentCloudUser();
  if(!user || isAnonymousCloudUser()) return {ok:false, reason:'no_account'};
  const p=profile();
  if(!Array.isArray(p.workouts) || !p.workouts.length) return {ok:false, reason:'empty_plan'};
  try{
    const payload = serializeCurrentPlan(p);
    const { error } = await supabaseClient.from('workout_plans').insert({
      user_id:user.id,
      title:p.planMeta?.title || 'Plano Gym Bronze',
      source:p.planMeta?.source || 'unknown',
      cycle_number:p.planMeta?.cycle || 1,
      reason,
      plan_json:payload
    });
    if(error) throw error;
    p.cloudPlanSyncedAt=nowISO();
    save();
    return {ok:true};
  }catch(e){
    console.warn('Erro ao salvar plano na nuvem:', e);
    return {ok:false, error:e};
  }
}
async function loadLatestPlanFromCloud(){
  if(!supabaseClient || !hasCloudAccount()) return {ok:false, reason:'no_account'};
  const user=await getCurrentCloudUser();
  if(!user || isAnonymousCloudUser()) return {ok:false, reason:'no_account'};
  try{
    const { data, error } = await supabaseClient.from('workout_plans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', {ascending:false})
      .limit(1)
      .maybeSingle();
    if(error) throw error;
    if(!data?.plan_json) return {ok:false, reason:'no_plan'};
    const saved=data.plan_json;
    const p=profile();
    const hasLocalProgress = (p.history && p.history.length) || p.progress > 0;
    if(!hasLocalProgress && Array.isArray(saved.workouts) && saved.workouts.length){
      p.workouts=saved.workouts;
      p.queue=Array.isArray(saved.queue) && saved.queue.length ? saved.queue : saved.workouts.map(w=>w.id);
      p.planMeta=saved.planMeta || {source:data.source || 'cloud', cycle:data.cycle_number || 1, title:data.title || 'Plano salvo'};
      p.target=saved.target || p.target;
      p.programWeeks=saved.programWeeks || p.programWeeks;
      p.programLabel=saved.programLabel || p.programLabel;
      p.exerciseGoals=saved.exerciseGoals || saved.profileSnapshot?.exerciseGoals || p.exerciseGoals || {};
      save();
      return {ok:true, loaded:true};
    }
    return {ok:true, loaded:false};
  }catch(e){
    console.warn('Erro ao carregar plano da nuvem:', e);
    return {ok:false, error:e};
  }
}
async function loadLatestDietPlanFromCloud(){
  if(!supabaseClient || !hasCloudAccount()) return {ok:false, reason:'no_account'};
  const user=await getCurrentCloudUser();
  if(!user || isAnonymousCloudUser()) return {ok:false, reason:'no_account'};
  try{
    const { data, error } = await supabaseClient.from('nutrition_plans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', {ascending:false})
      .limit(1)
      .maybeSingle();
    if(error) throw error;
    if(!data?.plan_json) return {ok:false, reason:'no_diet_plan'};
    const p=profile();
    // Só carrega do BD se não houver uma rotina local mais recente não sincronizada.
    const localTime = p.dietPlan?.generatedAt || p.dietPlan?.cloudSyncedAt || '';
    const cloudTime = data.created_at || '';
    const hasUnsyncedLocal = p.dietPlan && !p.dietPlan.cloudSynced && localTime && cloudTime && new Date(localTime) > new Date(cloudTime);
    if(!hasUnsyncedLocal){
      p.dietPlan = {
        ...data.plan_json,
        cloudSynced:true,
        cloudNutritionPlanId:data.id,
        cloudSyncedAt:data.created_at,
        generatedAt:data.plan_json?.generatedAt || data.created_at
      };
      save();
      return {ok:true, loaded:true};
    }
    return {ok:true, loaded:false, reason:'local_newer'};
  }catch(e){
    console.warn('Erro ao carregar nutri da nuvem:', e);
    return {ok:false, error:e};
  }
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
        cycle_number:currentCycleNumber(p),
        finished_at:h.date || nowISO(),
        notes:h.notes || (h.startedAt ? `Início ${fmtTime(h.startedAt)} • Fim ${fmtTime(h.finishedAt||h.date)} • Duração ${h.durationMinutes||0} min` : null),
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
        reps:parseNumberValue(h.meta?.[e.id]?.repsDoneAvg || h.meta?.[e.id]?.reps),
        sets:parseNumberValue(h.meta?.[e.id]?.sets),
        difficulty:h.meta?.[e.id]?.difficulty || null,
        pain:h.meta?.[e.id]?.pain || null,
        notes:[h.meta?.[e.id]?.note, h.meta?.[e.id]?.reps ? `Reps ${h.meta[e.id].reps}` : '', h.meta?.[e.id]?.completedAt ? `Concluído às ${fmtTime(h.meta[e.id].completedAt)}` : '', h.meta?.[e.id]?.skippedAt ? `Pulado às ${fmtTime(h.meta[e.id].skippedAt)}` : '', h.meta?.[e.id]?.cardioTime ? `Cardio ${h.meta[e.id].cardioTime}` : '', h.meta?.[e.id]?.coreDone ? `Core ${h.meta[e.id].coreDone}` : ''].filter(Boolean).join(' • ') || null,
        skipped:h.status?.[e.id]==='skipped',
        completed:h.status?.[e.id]==='done'
      }));
      if(rows.length){
        const { error: exError } = await supabaseClient.from('exercise_logs').insert(rows);
        if(exError) console.warn('Erro ao salvar exercícios:', exError);
      }
    }
    h.cloudSynced=true;
    await syncXpEventForRecord(p, h, cloudId).catch(e=>console.warn('Erro ao sincronizar XP do treino:', e));
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
async function syncLocalHistoryToCloud(opts={}){
  const p=profile();
  const user=await getCurrentCloudUser();
  if(!user || !hasCloudAccount()){
    if(!opts.silent) toast('Crie uma conta ou entre para sincronizar na nuvem.');
    return {ok:false, sent:0, skipped:0, failed:0};
  }
  let sent=0, skipped=0, failed=0;
  for(const h of p.history){
    if(h.cloudSynced && (!h.aiReport || h.cloudReportSynced)){ skipped++; continue; }
    const result=await saveWorkoutToCloud(p,h,{silent:true});
    if(result.ok) sent++; else failed++;
  }
  await saveCurrentPlanToCloud('manual_sync').catch(()=>{});
  await saveDietPlanToCloud(p.dietPlan, {silent:true}).catch(()=>{});
  await syncXpEventsToCloud({silent:true}).catch(()=>{});
  await syncLessonsToCloud({silent:true}).catch(()=>{});
  save(); render();
  if(!opts.silent) toast(`Sincronização: ${sent} enviado(s), ${skipped} já estavam, ${failed} falha(s).`);
  return {ok: failed===0, sent, skipped, failed};
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
    profile:{name:p.name, sex:p.sex, age:p.age, height:p.height, weight:p.weight, goal:p.goal, focus:p.focus, experience:normalizeExperienceLabel(p.experience), daysPerWeek:String(clampTrainingDays(p.daysPerWeek)), notes:p.notes},
    routine:{...(p.routine||{}), summary:routineSummary(p), suggestedWorkoutTime:suggestedWorkoutTimeFromRoutineV74(p), workoutRecommendation:workoutTimeRecommendation(p)},
    reminders:p.reminders || {},
    planRules:{daysPerWeek:clampTrainingDays(p.daysPerWeek), level:normalizeExperienceLabel(p.experience), programWeeks:programWeeksForExperience(p.experience), targetWorkouts:targetWorkoutsForProfile(p), programLabel:programLabelForProfile(p), allowedWorkoutIds:WORKOUT_LETTERS.slice(0, clampTrainingDays(p.daysPerWeek))},
    currentPlan:{title:p.planMeta?.title, cycle:p.planMeta?.cycle, source:p.planMeta?.source, workouts:p.planMeta?.source==='ai'?p.workouts:[]},
    progress:{completedWorkouts:p.progress, target:p.target, cycle:Math.max(1, currentCycleNumber(p)+1)},
    recentHistory:p.history.slice(-12).map(h=>({date:h.date, workoutId:h.workoutId, workoutName:h.workoutName, score:h.score, doneCount:h.doneCount, skippedCount:h.skippedCount, weights:h.weights, status:h.status, meta:h.meta, substitutions:h.substitutions||[], aiReport:h.aiReport}))
  };
}
function normalizeAIPlan(plan, mode='initial'){
  if(!Array.isArray(plan?.workouts) || !plan.workouts.length) throw new Error('A IA não retornou uma lista de treinos válida.');
  const list = plan.workouts;
  const ids = WORKOUT_LETTERS.slice(0, clampTrainingDays(profile().daysPerWeek));
  const workouts = ids.map((id, idx)=>{
    const source = list.find(w=>String(w.id||'').toUpperCase()===id) || list[idx] || null;
    const exs = Array.isArray(source?.exercises) ? source.exercises : [];
    return {
      id,
      name: String(source?.name || templateForProfile(profile()).workouts[idx]?.name || `Treino ${id}`),
      focus: String(source?.focus || source?.description || templateForProfile(profile()).workouts[idx]?.focus || ''),
      exercises: exs.slice(0,12).map((item, n)=>({
        id: `${id.toLowerCase()}_ai_${Date.now()}_${n}`,
        name: String(item?.name || item?.exercise || `Exercício ${n+1}`),
        type: String(item?.type || item?.equipment || 'personalizado'),
        target: String(item?.target || item?.setsReps || item?.reps || '3x10-12')
      })).filter(e=>e.name.trim())
    };
  });
  workouts.forEach((w, i)=>{ if(!w.exercises.length) w.exercises = structuredClone(templateForProfile(profile()).workouts[i]?.exercises || []); });
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
  applyProgramDuration(p);
  p.planMeta={source:'ai', cycle: mode==='cycle' ? (p.planMeta?.cycle||1)+1 : (p.planMeta?.cycle||1), title:normalized.title, notes:normalized.notes, updatedAt:nowISO(), programLabel:programLabelForProfile(p)};
  save();
  saveCurrentPlanToCloud(mode==='cycle' ? 'cycle_ai_plan' : 'initial_ai_plan').catch(()=>{});
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
async function askInitialPlanFocus(){
  return new Promise((resolve)=>{
    const p=profile();
    const layer=byId('modalLayer');
    layer.innerHTML=`<div class="modal"><div class="modal-head"><div><p class="eyebrow">Treino específico</p><h2>Qual é seu foco agora?</h2><p class="muted">Confirme ou ajuste objetivo e foco antes da IA gerar o treino. Isso ajuda a reduzir treinos genéricos.</p></div><button class="close" data-plan-cancel>×</button></div>
      <div class="field"><label>Objetivo principal</label><input class="input" id="planGoalInput" value="${esc(p.goal || '')}" placeholder="Ex: ganhar massa e secar, emagrecer, força, hipertrofia"></div>
      <div class="field"><label>Foco do treino</label><input class="input" id="planFocusInput" value="${esc(p.focus || '')}" placeholder="Ex: glúteos e pernas, membros superiores, braços, costas, condicionamento"></div>
      <div class="field"><label>Observações para a IA</label><textarea id="planNotesInput" placeholder="Ex: tenho dor no ombro, treino até 60 min, evitar agachamento livre">${esc(p.notes || '')}</textarea></div>
      <div class="actions"><button class="btn" data-plan-generate>Gerar treino específico</button><button class="btn secondary" data-plan-cancel>Cancelar</button></div>
    </div>`;
    layer.classList.remove('hidden');
    const finish=(value)=>{ layer.classList.add('hidden'); layer.innerHTML=''; resolve(value); };
    document.querySelectorAll('[data-plan-cancel]').forEach(b=>b.onclick=()=>finish(null));
    document.querySelector('[data-plan-generate]').onclick=()=>{
      finish({
        goal:(byId('planGoalInput')?.value || '').trim(),
        focus:(byId('planFocusInput')?.value || '').trim(),
        notes:(byId('planNotesInput')?.value || '').trim()
      });
    };
  });
}
async function generateSpecificPlanFlow(){
  const info = await askInitialPlanFocus();
  if(info === null) return;
  const p=profile();
  p.goal = info.goal || p.goal;
  p.focus = info.focus || p.focus;
  p.notes = info.notes || p.notes;
  save();
  if(hasCloudAccount()) upsertCloudProfile(null).catch(()=>{});
  await generateInitialPlanFromAI({silent:false, force:true, fallbackDefault:true});
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
    if(opts.fallbackDefault !== false){
      applyDefaultPlanForProfile(p, true);
      render();
      if(!opts.silent) toast('Não consegui gerar o treino com IA. Apliquei o treino padrão por enquanto.');
    } else if(!opts.silent) {
      toast('Não consegui gerar o treino com IA.');
    }
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

function dietPlanTitle(diet){
  return String(diet?.title || diet?.name || 'Rotina alimentar Gym Bronze');
}
function dietPlanSummary(diet){
  return String(diet?.summary || diet?.overview || diet?.notes || diet?.explanation || 'Rotina alimentar educativa gerada pelo Gym Bronze.');
}
async function saveDietPlanToCloud(diet, opts={}){
  if(!diet) return {ok:false, reason:'no_diet'};
  if(!supabaseClient) return {ok:false, reason:'supabase_not_ready'};
  if(!hasCloudAccount()){
    if(!opts.silent){
      if(isLocalMode()) toast('Rotina alimentar gerada. Crie uma conta para salvar na nuvem.');
      else toast('Entre em uma conta confirmada para salvar a rotina na nuvem.');
    }
    return {ok:false, reason:'no_cloud_account'};
  }
  const user=await getCurrentCloudUser();
  if(!user || isAnonymousCloudUser()) return {ok:false, reason:'no_account'};
  try{
    await upsertCloudProfile(null);
    const payload = {...diet, savedFromApp:true, savedAt:nowISO()};
    const row = {
      user_id:user.id,
      title:dietPlanTitle(diet),
      summary:dietPlanSummary(diet),
      plan_json:payload,
      provider:'gemini',
      model:'gemini-3.5-flash-lite'
    };

    // Mantém apenas a rotina alimentar mais recente do usuário.
    // Isso evita várias linhas antigas e garante que um novo plano atualize o BD.
    const { error: delError } = await supabaseClient
      .from('nutrition_plans')
      .delete()
      .eq('user_id', user.id);
    if(delError) throw delError;

    const { data, error } = await supabaseClient
      .from('nutrition_plans')
      .insert(row)
      .select('id')
      .single();
    if(error) throw error;

    diet.cloudSynced = true;
    diet.cloudNutritionPlanId = data?.id || null;
    diet.cloudSyncedAt = nowISO();
    save();
    if(!opts.silent) toast('Rotina alimentar salva na nuvem.');
    return {ok:true, id:data?.id || null};
  }catch(e){
    console.warn('Erro ao salvar rotina alimentar na nuvem:', e);
    if(!opts.silent){
      const msg = e?.message || e?.details || 'erro desconhecido';
      toast('Não consegui salvar nutri na nuvem: '+msg);
    }
    return {ok:false, error:e};
  }
}

function buildDietAIPayload(){
  const p=profile();
  return {
    kind:'diet-plan',
    profile:{name:p.name, sex:p.sex, age:p.age, height:p.height, weight:p.weight, goal:p.goal, focus:p.focus, experience:normalizeExperienceLabel(p.experience), daysPerWeek:String(clampTrainingDays(p.daysPerWeek)), notes:p.notes},
    routine:{...(p.routine||{}), summary:routineSummary(p), suggestedWorkoutTime:suggestedWorkoutTimeFromRoutineV74(p), workoutRecommendation:workoutTimeRecommendation(p)},
    reminders:p.reminders || {},
    dietInstructions:{priority:'Respeitar a rotina real do usuário antes de sugerir horários.', rules:['Não sugerir café da manhã antes do horário de acordar.', 'Distribuir refeições em torno de almoço e jantar informados.', 'Se houver horário de treino, colocar pré-treino antes e pós-treino/refeição principal depois.', 'Se a descrição do dia útil indicar restrição de horário, adaptar a rotina a ela.']},
    currentPlan:{title:p.planMeta?.title, source:p.planMeta?.source, workouts:p.workouts},
    progress:{completedWorkouts:p.progress, target:p.target, cycle:Math.max(1, currentCycleNumber(p)+1)},
    todayReadiness:dailyCheckinToday(p),
    recentDailyCheckins:recentDailyCheckins(p,7),
    nutritionToday:nutritionStats(p),
    recentNutrition:recentNutritionStats(p,7),
    recentHistory:p.history.slice(-10).map(h=>({date:h.date, startedAt:h.startedAt, finishedAt:h.finishedAt || h.date, durationMinutes:h.durationMinutes, workoutName:h.workoutName, doneCount:h.doneCount, skippedCount:h.skippedCount, score:h.score, weights:h.weights, meta:h.meta, substitutions:h.substitutions||[]}))
  };
}
async function callDietAI(){
  if(isOffline()) throw new Error('Você está offline. A IA não consegue gerar orientação alimentar agora.');
  const accessToken=await getCloudAccessToken();
  if(!accessToken) throw new Error('Entre na conta ou use modo local para usar a IA.');
  const response=await fetch(aiUrl(profile(), AI_DIET_ENDPOINT_PATH),{
    method:'POST',
    headers:{'Content-Type':'application/json', 'Authorization': `Bearer ${accessToken}`},
    body:JSON.stringify(buildDietAIPayload())
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error || `Erro HTTP ${response.status}`);
  return data.diet || data.plan || data;
}
async function generateDietPlan(){
  try{
    toast('Gerando rotina alimentar...');
    const diet=await callDietAI();
    profile().dietPlan = {...diet, generatedAt:nowISO(), cloudSynced:false};
    save();
    const cloudResult = await saveDietPlanToCloud(profile().dietPlan, {silent:true});
    render();
    if(profile().dietPlan.cloudSynced) toast('Rotina alimentar gerada e salva na nuvem.');
    else if(isLocalMode()) toast('Rotina alimentar gerada. Crie uma conta para salvar na nuvem.');
    else if(hasCloudAccount()){
      const msg = cloudResult?.error?.message || cloudResult?.reason || '';
      toast('Rotina gerada, mas não salvou na nuvem.'+(msg ? ' '+msg : ''));
    }
    else toast('Rotina alimentar gerada.');
  }catch(e){
    toast('Não consegui gerar rotina alimentar: '+(e.message||'erro'));
  }
}

async function finishCycleAndGeneratePlan(){
  const p=profile();
  if(p.progress < workoutsPerCycle(p)) return toast(`Complete pelo menos 1 ciclo (${workoutsPerCycle(p)} treinos) antes de ajustar com IA.`);
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

function exportBackup(){ state.lastBackupAt=nowISO(); save(); const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`gym-bronze-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href); }
document.addEventListener('change', e=>{ if(e.target?.id==='backupInput'){ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ try{ const data=JSON.parse(r.result); if(!data.profiles) throw new Error(); if(confirm('Importar backup e substituir dados atuais?')){ state=data; save(); render(); toast('Backup importado.'); } }catch{ toast('Backup inválido.'); }}; r.readAsText(f); }});
function toast(msg){ const t=byId('toast'); t.textContent=msg; t.classList.remove('hidden'); clearTimeout(window.__toast); window.__toast=setTimeout(()=>t.classList.add('hidden'),2800); }


let __reminderTimer=null;
let __lastReminderKeys={};
function timeToMinutes(t){ const m=String(t||'').match(/^(\d{1,2}):(\d{2})/); return m?Number(m[1])*60+Number(m[2]):null; }
function maybeTriggerLocalReminders(){
  const p=profile();
  if(!p?.reminders?.enabled || !notificationAvailable() || Notification.permission!=='granted') return;
  const now=new Date();
  const mins=now.getHours()*60+now.getMinutes();
  const day=dateKey(now);
  const emit=(key,title,body)=>{
    const id=day+'-'+key;
    if(__lastReminderKeys[key]===id) return;
    __lastReminderKeys[key]=id;
    showReminderNotification(title, body);
  };
  const rem=p.reminders;
  if(rem.types?.workout && mins===timeToMinutes(rem.times?.workout||'12:00') && !workoutDoneToday(p)){
    const w=currentWorkout(p);
    emit('workout','Hora do treino 💪', w?`Hoje é ${w.id} — ${w.name}. Bora manter a sequência?`:'Bora treinar hoje?');
  }
  if(rem.types?.meals){
    const r=p.routine||{};
    [['lunch','Almoço 🥗',r.lunchTime],['dinner','Jantar 🥗',r.dinnerTime]].forEach(([key,title,time])=>{
      if(mins===timeToMinutes(time)) emit(key,title,'Hora da refeição. Marca no checklist depois.');
    });
  }
  if(rem.types?.water){
    const water=rem.water||{};
    const start=timeToMinutes(water.start||p.routine?.wakeTime||'09:00');
    const end=timeToMinutes(water.end||'21:00');
    const interval=Math.max(1, Number(water.intervalHours||2))*60;
    if(start!==null && end!==null && mins>=start && mins<=end && (mins-start)%interval===0){
      emit('water-'+mins,'Água agora 💧','Bebe água e mantém o corpo funcionando bem.');
    }
  }
}
function startReminderLoop(){
  if(__reminderTimer) clearInterval(__reminderTimer);
  maybeTriggerLocalReminders();
  __reminderTimer=setInterval(maybeTriggerLocalReminders, 60*1000);
}

init();
startReminderLoop();
