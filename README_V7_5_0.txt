Gym Bronze v7.5.0 — Reps por série + metas sugeridas

O que entrou:
- Campo de reps feitas por série em exercícios de força.
- Remove a lógica de meta manual como foco principal.
- O app calcula uma meta sugerida após finalizar o treino.
- O relatório da IA pode devolver metas por exercício quando o backend v7.5 estiver publicado.
- A meta aparece discretamente dentro do exercício como “Meta sugerida”.
- Salva reps por série no histórico local e envia no payload da IA.
- Salva as metas no plano local e no snapshot do plano na nuvem.
- Sem SQL novo.

Backend:
- Para metas por IA por exercício, subir também o backend v7.5.0.
- Sem backend novo, o app ainda funciona com metas automáticas locais.
