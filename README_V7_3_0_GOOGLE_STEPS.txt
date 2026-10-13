Gym Bronze v7.3.0 — hotfix Google em etapas

Base: v7.3 final + hotfix Perfil 4.

O que mudou:
- Fluxo de completar perfil após login Google agora também é dividido em etapas.
- Passo 1: informações pessoais e treino.
- Passo 2: rotina, horários e lembretes.
- Passo 3: aceite dos termos e geração do treino.
- Mantém rotina/reminders salvos no Supabase via colunas jsonb.
- Não precisa alterar backend/Vercel.

SQL necessário no Supabase, caso ainda não tenha rodado:
alter table public.profiles add column if not exists routine jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists reminders jsonb not null default '{}'::jsonb;
