Gym Bronze v7.3 final — Rotina, lembretes e cadastro em etapas

Antes de subir:
1. Rode SQL_V7_3_0_ROUTINE_REMINDERS.sql no Supabase SQL Editor.

Mudanças:
- Cadastro em 3 passos: perfil, rotina/lembretes e conta.
- Barra de progresso no cadastro.
- Rotina e lembretes salvos em public.profiles.routine e public.profiles.reminders.
- Rotina vai no payload da IA de nutrição/treino.
- Painel de Perfil continua permitindo editar rotina/lembretes depois.
- Exportar backup local continua baixando o state completo do usuário, incluindo rotina, lembretes, treinos, histórico, nutrição, XP, check-ins e fotos/metadados salvos localmente.
- Sem alteração no backend Vercel nesta versão.

Teste recomendado:
- Criar conta nova.
- Preencher passo 1, avançar, configurar rotina e notificações, avançar, criar login.
- Depois confirmar no Supabase profiles se routine/reminders foram preenchidos.
- Testar Exportar backup em Perfil > Conta/Segurança.
