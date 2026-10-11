Gym Bronze v5.7.4 — Auth corrigido + planos na nuvem

Correções principais:
- Conta real só libera IA/nuvem depois do e-mail confirmado.
- Tela de verificação fica aguardando confirmação de e-mail.
- Login mostra mensagem melhor quando conta não existe, senha está errada ou e-mail não foi confirmado.
- Quando o usuário confirma pelo link do e-mail e volta ao app, a sessão é detectada e a conta passa para logada.
- Perfil é salvo em `profiles` após confirmação/login.
- Plano/treino gerado pela IA agora pode ser salvo em `workout_plans`.
- Ao fazer login, o app tenta carregar o último plano salvo na nuvem se o perfil local ainda não tem progresso.

Antes de subir:
1. Rode `SQL_V5_7_4_SUPABASE.txt` no Supabase SQL Editor.
2. Suba o app no GitHub Pages.
3. Suba o backend se quiser manter os ZIPs na mesma versão.
4. Abra com `?v=5-7-4`.
