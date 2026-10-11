Gym Bronze v6.4.0 — Horários do treino

Novidades:
- Ao marcar exercício como concluído, o app registra o horário.
- Ao pular exercício, o app registra o horário.
- Ao abrir o treino atual, o app inicia uma sessão com horário de início.
- Ao finalizar treino, salva:
  - startedAt
  - finishedAt
  - durationMinutes
  - horário de cada exercício concluído/pulado
- Histórico agora mostra horário de início/fim e duração.
- Payload da IA de treino e nutri recebe os horários para futuras sugestões alimentares por rotina real.

Banco:
- Nenhum SQL novo obrigatório.
- Horários vão no JSON/local e também no campo notes dos logs, quando sincronizar.
- Backend sem mudança obrigatória.
