Gym Bronze v7.1.1 — Popup de nova patente + persistência da fila

Mudanças:
- Adicionado popup animado quando o usuário muda de PATENTE/RANK, não apenas de nível.
- O popup só aparece se a patente mudar, por exemplo de Frango Recém-Matriculado para Frango Esforçado.
- Eventos de XP agora guardam rankBefore, rankAfter e rankChanged.
- Ao finalizar treino, a fila local continua avançando normalmente: A -> B -> C...
- Ao finalizar treino em conta real, o app também tenta salvar silenciosamente o estado atualizado da fila/plano na nuvem com reason queue_after_workout.
- Sem SQL novo.
