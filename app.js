const STORAGE_KEY = "meuTreino100DiasV1";

const defaultWorkouts = {
  A: {
    title: "Peito + Bíceps",
    exercises: [
      "Supino inclinado com halter",
      "Supino deitado/reto",
      "Peck fly",
      "Rosca direta com halter ou barra",
      "Rosca martelo",
      "Rosca Scott/máquina ou rosca no cabo",
      "Abdominal máquina",
      "Cardio"
    ]
  },
  B: {
    title: "Perna - Quadríceps",
    exercises: [
      "Agachamento hack",
      "Leg press 45°",
      "Cadeira extensora",
      "Cadeira flexora",
      "Cadeira abdutora",
      "Panturrilha sentado máquina"
    ]
  },
  C: {
    title: "Costas + Tríceps",
    exercises: [
      "Pulley frente pegada aberta",
      "Pulley frente pegada supinada ou neutra",
      "Remada baixa com triângulo",
      "Remada unilateral com halter ou máquina",
      "Peck fly inverso",
      "Tríceps barra no crossover",
      "Tríceps máquina ou tríceps corda/francês",
      "Prancha ventral 3x1min",
      "Cardio"
    ]
  },
  D: {
    title: "Ombro + Braços Extra",
    exercises: [
      "Desenvolvimento com halter ou máquina",
      "Elevação lateral com halter",
      "Elevação lateral na polia ou máquina",
      "Peck fly inverso ou face pull",
      "Rosca Scott/máquina ou rosca no cabo",
      "Tríceps corda ou francês na corda",
      "Abdominal infra"
    ]
  },
  E: {
    title: "Posterior + Perna",
    exercises: [
      "Stiff com halter ou barra",
      "Mesa flexora",
      "Flexora em pé unilateral articulada",
      "Leg press 45° unilateral ou bilateral",
      "Cadeira abdutora",
      "Panturrilha em pé ou sentado",
      "Abdominal máquina"
    ]
  }
};

let state = loadState();
let currentWorkoutKey = null;
let toastTimeout = null;

const els = {
  progressText: document.getElementById("progressText"),
  nextWorkoutTitle: document.getElementById("nextWorkoutTitle"),
  startNextBtn: document.getElementById("startNextBtn"),
  workoutQueue: document.getElementById("workoutQueue"),
  historyList: document.getElementById("historyList"),
  pendingBox: document.getElementById("pendingBox"),
  pendingMessage: document.getElementById("pendingMessage"),
  confirmAcademyBtn: document.getElementById("confirmAcademyBtn"),
  resetBtn: document.getElementById("resetBtn"),
  undoBtn: document.getElementById("undoBtn"),
  exportBackupBtn: document.getElementById("exportBackupBtn"),
  importBackupBtn: document.getElementById("importBackupBtn"),
  backupFileInput: document.getElementById("backupFileInput"),
  workoutModal: document.getElementById("workoutModal"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  closeModalArea: document.getElementById("closeModalArea"),
  modalTitle: document.getElementById("modalTitle"),
  exerciseList: document.getElementById("exerciseList"),
  finishWorkoutBtn: document.getElementById("finishWorkoutBtn"),
  confirmModal: document.getElementById("confirmModal"),
  confirmText: document.getElementById("confirmText"),
  cancelFinishBtn: document.getElementById("cancelFinishBtn"),
  confirmFinishBtn: document.getElementById("confirmFinishBtn"),
  toast: document.getElementById("toast")
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        workouts: parsed.workouts || defaultWorkouts,
        queue: parsed.queue || ["A", "B", "C", "D", "E"],
        progress: parsed.progress || 0,
        checked: parsed.checked || {},
        pendingAcademy: parsed.pendingAcademy || [],
        history: parsed.history || [],
        weights: parsed.weights || {}
      };
    } catch (error) {
      console.error("Erro ao carregar estado:", error);
    }
  }

  return {
    workouts: defaultWorkouts,
    queue: ["A", "B", "C", "D", "E"],
    progress: 0,
    checked: {},
    pendingAcademy: [],
    history: [],
    weights: {}
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function render() {
  const nextKey = state.queue[0];
  const next = state.workouts[nextKey];

  els.progressText.textContent = `${state.progress}/100`;
  els.nextWorkoutTitle.textContent = `${nextKey} - ${next.title}`;

  renderQueue();
  renderPending();
  renderHistory();
  saveState();
}

function renderQueue() {
  els.workoutQueue.innerHTML = "";

  state.queue.forEach((key, index) => {
    const workout = state.workouts[key];
    const isNext = index === 0;
    const button = document.createElement("button");
    button.className = `workout-button ${isNext ? "next" : "locked"}`;
    button.innerHTML = `
      <span class="workout-letter">${key}</span>
      <strong>${workout.title}</strong>
      <small>${isNext ? "Próximo da fila" : "Consulta liberada"}</small>
    `;
    button.addEventListener("click", () => openWorkout(key));
    els.workoutQueue.appendChild(button);
  });
}

function renderPending() {
  const pending = state.pendingAcademy.filter(item => !item.academyDone);

  if (pending.length === 0) {
    els.pendingBox.classList.add("hidden");
    return;
  }

  const last = pending[pending.length - 1];
  els.pendingBox.classList.remove("hidden");
  els.pendingMessage.textContent = `Você concluiu o Treino ${last.key} - ${last.title} em ${last.date}. FINALIZE O TREINO NO APP DA ACADEMIA.`;
}

function renderHistory() {
  els.historyList.innerHTML = "";

  if (state.history.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "Nenhum treino finalizado ainda.";
    els.historyList.appendChild(empty);
    return;
  }

  [...state.history].slice(-6).reverse().forEach(item => {
    const div = document.createElement("div");
    const status = item.academyDone ? "🟢 Baixado no app da academia" : "🔴 Falta baixar no app da academia";
    div.className = "history-item";
    div.innerHTML = `
      <strong>${item.date} - Treino ${item.key}</strong>
      <small>${item.title}</small>
      <small>${status}</small>
    `;
    els.historyList.appendChild(div);
  });
}

function isWorkoutUnlocked(key) {
  return key === state.queue[0];
}

function openWorkout(key) {
  currentWorkoutKey = key;
  const workout = state.workouts[key];
  const unlocked = isWorkoutUnlocked(key);

  if (!state.checked[key]) {
    state.checked[key] = [];
  }

  els.modalTitle.textContent = `Treino ${key} - ${workout.title}`;
  els.finishWorkoutBtn.disabled = !unlocked;
  els.finishWorkoutBtn.textContent = unlocked ? "Finalizar treino" : "Finalização bloqueada";
  els.finishWorkoutBtn.classList.toggle("disabled", !unlocked);

  renderExercises(key);
  els.workoutModal.classList.remove("hidden");
  els.workoutModal.setAttribute("aria-hidden", "false");
}

function renderExercises(key) {
  const workout = state.workouts[key];
  const checked = state.checked[key] || [];
  const unlocked = isWorkoutUnlocked(key);

  els.exerciseList.innerHTML = "";

  if (!unlocked) {
    const notice = document.createElement("div");
    notice.className = "lock-notice";
    notice.innerHTML = `
      <strong>Modo consulta</strong>
      <span>Este não é o próximo treino da fila. Você pode ver os exercícios e cargas, mas não pode concluir exercícios nem finalizar este treino.</span>
    `;
    els.exerciseList.appendChild(notice);
  }

  workout.exercises.forEach((exercise, index) => {
    const isDone = checked.includes(index);
    const weightKey = getWeightKey(key, index);
    const savedWeight = state.weights[weightKey] || "";
    const row = document.createElement("div");
    row.className = `exercise-item ${isDone ? "done" : ""}`;
    row.innerHTML = `
      <div class="exercise-info">
        <div class="exercise-name">
          ${exercise}
          <span>${isDone ? "Concluído" : "Pendente"}</span>
        </div>
        <label class="weight-field">
          <span>Carga</span>
          <input type="text" inputmode="decimal" placeholder="ex: 12 kg" value="${escapeHtml(savedWeight)}" aria-label="Carga de ${exercise}">
        </label>
      </div>
      <button class="done-button" ${unlocked ? "" : "disabled"}>${unlocked ? (isDone ? "Feito" : "Concluir") : "Bloqueado"}</button>
    `;

    const input = row.querySelector("input");
    input.addEventListener("input", event => saveExerciseWeight(key, index, event.target.value));
    input.addEventListener("click", event => event.stopPropagation());

    row.querySelector("button").addEventListener("click", () => toggleExercise(key, index));
    els.exerciseList.appendChild(row);
  });
}

function getWeightKey(key, index) {
  return `${key}-${index}`;
}

function saveExerciseWeight(key, index, value) {
  const weightKey = getWeightKey(key, index);
  state.weights[weightKey] = value.trim();
  saveState();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toggleExercise(key, index) {
  if (!isWorkoutUnlocked(key)) {
    showToast(`Treino ${key} bloqueado. Só é possível concluir o próximo treino da fila: ${state.queue[0]}.`);
    return;
  }

  if (!state.checked[key]) state.checked[key] = [];

  const current = state.checked[key];
  if (current.includes(index)) {
    state.checked[key] = current.filter(item => item !== index);
  } else {
    state.checked[key] = [...current, index];
  }

  renderExercises(key);
  saveState();
}

function closeWorkoutModal() {
  els.workoutModal.classList.add("hidden");
  els.workoutModal.setAttribute("aria-hidden", "true");
}

function openConfirmModal() {
  if (!currentWorkoutKey) return;

  if (!isWorkoutUnlocked(currentWorkoutKey)) {
    showToast(`Finalização bloqueada. O próximo treino da fila é o Treino ${state.queue[0]}.`);
    return;
  }

  const workout = state.workouts[currentWorkoutKey];
  const total = workout.exercises.length;
  const done = (state.checked[currentWorkoutKey] || []).length;

  els.confirmText.textContent = `Você marcou ${done}/${total} exercícios. Deseja finalizar o Treino ${currentWorkoutKey} mesmo assim?`;
  els.confirmModal.classList.remove("hidden");
  els.confirmModal.setAttribute("aria-hidden", "false");
}

function closeConfirmModal() {
  els.confirmModal.classList.add("hidden");
  els.confirmModal.setAttribute("aria-hidden", "true");
}

function finishWorkout() {
  if (!currentWorkoutKey) return;

  if (!isWorkoutUnlocked(currentWorkoutKey)) {
    closeConfirmModal();
    showToast(`Finalização bloqueada. O próximo treino da fila é o Treino ${state.queue[0]}.`);
    return;
  }

  const key = currentWorkoutKey;
  const workout = state.workouts[key];
  const today = formatDate();

  const record = {
    id: `${Date.now()}-${key}`,
    key,
    title: workout.title,
    date: today,
    academyDone: false
  };

  state.progress = Math.min(state.progress + 1, 100);
  state.queue = state.queue.filter(item => item !== key);
  state.queue.push(key);
  state.checked[key] = [];
  state.pendingAcademy.push(record);
  state.history.push(record);

  closeConfirmModal();
  closeWorkoutModal();
  render();
  showToast("ATENÇÃO: FINALIZE O TREINO NO APP DA ACADEMIA");
}

function markLatestAcademyDone() {
  const pending = state.pendingAcademy.filter(item => !item.academyDone);
  if (pending.length === 0) return;

  const target = pending[pending.length - 1];
  state.pendingAcademy = state.pendingAcademy.map(item =>
    item.id === target.id ? { ...item, academyDone: true } : item
  );
  state.history = state.history.map(item =>
    item.id === target.id ? { ...item, academyDone: true } : item
  );

  render();
  showToast("Baixa confirmada no app da academia.");
}

function undoLastWorkout() {
  const last = state.history[state.history.length - 1];
  if (!last) {
    showToast("Não há treino para desfazer.");
    return;
  }

  state.history.pop();
  state.pendingAcademy = state.pendingAcademy.filter(item => item.id !== last.id);
  state.progress = Math.max(state.progress - 1, 0);

  state.queue = state.queue.filter(item => item !== last.key);
  state.queue.unshift(last.key);

  render();
  showToast(`Último treino desfeito: ${last.key}.`);
}

function resetApp() {
  const firstConfirm = window.confirm(
    "ATENÇÃO: você está prestes a resetar tudo.\n\n" +
    "Isso vai apagar progresso, histórico, pendências, exercícios concluídos e cargas salvas.\n\n" +
    "Deseja continuar?"
  );
  if (!firstConfirm) return;

  const typed = window.prompt(
    "Para confirmar o reset, digite exatamente: RESETAR"
  );

  if (typed !== "RESETAR") {
    showToast("Reset cancelado.");
    return;
  }

  const finalConfirm = window.confirm(
    "Última confirmação: resetar tudo agora?"
  );
  if (!finalConfirm) {
    showToast("Reset cancelado.");
    return;
  }

  state = {
    workouts: defaultWorkouts,
    queue: ["A", "B", "C", "D", "E"],
    progress: 0,
    checked: {},
    pendingAcademy: [],
    history: [],
    weights: {}
  };

  render();
  showToast("App resetado.");
}


function normalizeState(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  return {
    workouts: source.workouts || defaultWorkouts,
    queue: Array.isArray(source.queue) && source.queue.length ? source.queue : ["A", "B", "C", "D", "E"],
    progress: Number.isFinite(Number(source.progress)) ? Math.max(0, Math.min(Number(source.progress), 100)) : 0,
    checked: source.checked && typeof source.checked === "object" ? source.checked : {},
    pendingAcademy: Array.isArray(source.pendingAcademy) ? source.pendingAcademy : [],
    history: Array.isArray(source.history) ? source.history : [],
    weights: source.weights && typeof source.weights === "object" ? source.weights : {}
  };
}

function exportBackup() {
  const payload = {
    app: "Meu Treino 100 Dias",
    version: 2,
    exportedAt: new Date().toISOString(),
    storageKey: STORAGE_KEY,
    state
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const today = new Date().toISOString().slice(0, 10);
  const link = document.createElement("a");
  link.href = url;
  link.download = `backup-meu-treino-${today}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showToast("Backup exportado.");
}

function requestImportBackup() {
  els.backupFileInput.value = "";
  els.backupFileInput.click();
}

function importBackupFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result || "{}"));
      const importedState = data.state || data;

      if (!importedState || !Array.isArray(importedState.queue)) {
        showToast("Arquivo de backup inválido.");
        return;
      }

      const confirmed = window.confirm(
        "Importar este backup vai substituir os dados atuais deste aparelho.\n\n" +
        "Isso inclui progresso, cargas, histórico e pendências. Deseja continuar?"
      );
      if (!confirmed) return;

      state = normalizeState(importedState);
      saveState();
      render();
      showToast("Backup importado com sucesso.");
    } catch (error) {
      console.error("Erro ao importar backup:", error);
      showToast("Não consegui importar este arquivo.");
    }
  };
  reader.readAsText(file);
}

function showToast(message) {
  clearTimeout(toastTimeout);
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");

  toastTimeout = setTimeout(() => {
    els.toast.classList.add("hidden");
  }, 3800);
}

els.startNextBtn.addEventListener("click", () => openWorkout(state.queue[0]));
els.closeModalBtn.addEventListener("click", closeWorkoutModal);
els.closeModalArea.addEventListener("click", closeWorkoutModal);
els.finishWorkoutBtn.addEventListener("click", openConfirmModal);
els.cancelFinishBtn.addEventListener("click", closeConfirmModal);
els.confirmFinishBtn.addEventListener("click", finishWorkout);
els.confirmAcademyBtn.addEventListener("click", markLatestAcademyDone);
els.undoBtn.addEventListener("click", undoLastWorkout);
els.resetBtn.addEventListener("click", resetApp);
els.exportBackupBtn.addEventListener("click", exportBackup);
els.importBackupBtn.addEventListener("click", requestImportBackup);
els.backupFileInput.addEventListener("change", importBackupFile);

render();
