Gym Bronze v5.7.5 — correção de perfil após verificação de e-mail

Correções:
- Guarda os dados completos preenchidos no cadastro enquanto o usuário espera verificar o e-mail.
- Depois que o e-mail é confirmado, aplica esses dados no perfil local e atualiza a tabela profiles no Supabase.
- Usa os user_metadata do Supabase como fallback caso o usuário confirme o e-mail em outro fluxo.
- Corrige profiles ficando com age/height/goal/focus/sex/notes nulos.

Como testar:
1. Suba o app no GitHub Pages.
2. Abra com ?v=5-7-5.
3. Crie uma conta nova, confirme o e-mail e faça login.
4. Confira public.profiles no Supabase.
