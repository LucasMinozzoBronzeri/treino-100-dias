Gym Bronze v6.1.0

Correções e melhorias:
1. Separação correta de contas/perfis no mesmo aparelho.
   - Ao confirmar um e-mail de outra conta no celular, o app cria/usa um perfil separado.
   - Não mistura treino, plano, nutri e XP da conta anterior.
   - Cada perfil local guarda o cloudUserId da conta Supabase.

2. Campos por tipo de exercício.
   - Musculação mantém carga atual / próxima meta.
   - Cardio agora tem tempo feito, meta de tempo, intensidade, cansaço e distância opcional.
   - Core/abdômen tem tempo/reps feitos e próxima meta.
   - Mobilidade tem tempo e região trabalhada.

3. Mantém tudo da v6.0.1:
   - XP, patentes, nível romano e XP na nuvem.

Banco:
- Se você já rodou o SQL_V6_0_1_XP_EVENTS.sql, não precisa rodar SQL novo nesta versão.
- Backend não precisa subir.
