Gym Bronze v6.0.1 — XP na nuvem

Antes de testar:
1. Abra o Supabase > SQL Editor.
2. Rode o arquivo SQL_V6_0_1_XP_EVENTS.sql.

Novidades:
- Cria tabela xp_events no Supabase.
- Salva cada ganho de XP na nuvem.
- Carrega XP ao entrar na conta.
- Sincroniza XP no botão de sincronizar.
- Evita duplicar XP usando unique(user_id, local_id).
- Modal de patentes ganhou botões "Salvar XP na nuvem" e "Atualizar XP da nuvem".

Backend:
- Não precisa subir backend.
