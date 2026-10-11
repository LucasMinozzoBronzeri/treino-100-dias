Gym Bronze v5.5

Mudanças:
- Campo Sexo no cadastro, modo local e perfil.
- Prompt de treino refeito para gerar treinos menos genéricos.
- Títulos dos treinos no formato "A - Peito e Tríceps".
- Nova rota /api/diet-plan para orientação alimentar beta.
- Card "Orientação alimentar" na aba Análise.
- Limite diário de IA por usuário no backend usando Supabase.

Antes de subir:
1. Rode o SQL em SQL_V5_5_SUPABASE.sql no Supabase.
2. Suba o backend v5.5 na Vercel e faça Redeploy.
3. Suba o app v5.5 no GitHub Pages.

Variáveis opcionais na Vercel:
DAILY_AI_LIMIT=15
DAILY_WORKOUT_REPORT_LIMIT=15
DAILY_WORKOUT_PLAN_LIMIT=8
DAILY_DIET_PLAN_LIMIT=5

A orientação alimentar é educativa e não substitui nutricionista/médico.
