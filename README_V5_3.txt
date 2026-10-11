Gym Bronze v5.3 — Onboarding + Modo Local + IA

O que mudou:
- Tela inicial antes do app principal.
- Opções: Entrar, Criar conta ou Entrar localmente.
- Cadastro já pede: nome, idade, altura, peso inicial e objetivo.
- Mini validação dos campos de cadastro.
- Modo local continua salvando no aparelho.
- Modo local pode usar IA via sessão anônima do Supabase, sem APP_TOKEN no frontend.
- Conta normal salva local + Supabase + IA.
- Aviso offline mantido.

IMPORTANTE NO SUPABASE

1) Habilite login anônimo:
Supabase > Authentication > Providers > Anonymous Sign-ins > Enable

Isso permite que o usuário use o modo local com uma sessão autenticada anônima. O histórico continua local, mas a IA consegue validar uma sessão Supabase sem expor APP_TOKEN.

2) Rode este SQL para completar os dados do perfil:

alter table public.profiles
  add column if not exists age numeric,
  add column if not exists height numeric,
  add column if not exists initial_weight numeric,
  add column if not exists goal text,
  add column if not exists focus text;

3) Backend:
Pode manter o backend v5.2 Supabase Auth. Ele já valida Authorization: Bearer <token Supabase>.

4) Deploy:
Substitua os arquivos do app no GitHub Pages e abra com:
https://lucasminozzobronzeri.github.io/treino-100-dias/?v=5-3

Teste recomendado:
- abrir em aba anônima ou limpar dados do site;
- criar conta com campos completos;
- testar modo local;
- finalizar treino em modo local;
- finalizar treino logado;
- testar offline.
