Treino 100 Dias Pro v5.2 — Supabase + IA com login

O que mudou nesta versão:
- Login/criação de conta via Supabase.
- Sem login: app continua funcionando e salva só no aparelho.
- Com login: salva também na nuvem/Supabase.
- A IA não usa APP_TOKEN fixo no frontend.
- Para gerar relatório com IA, o usuário precisa estar logado e online.
- O app mostra aviso de modo offline.

Como publicar:
1. Substitua os arquivos da raiz do repositório do app por estes arquivos.
2. Aguarde o GitHub Pages atualizar.
3. Abra com cache novo:
   https://lucasminozzobronzeri.github.io/treino-100-dias/?v=supabase-5-2

Backend necessário:
Suba também o backend v5.2 na Vercel.

Variáveis necessárias no backend Vercel:
- GEMINI_API_KEY
- GEMINI_MODEL=gemini-3.5-flash-lite
- SUPABASE_URL=https://ppmlzpyxqtsgyhsyiuuh.supabase.co
- SUPABASE_ANON_KEY=anon public key do Supabase
- ALLOWED_ORIGIN=https://lucasminozzobronzeri.github.io

Pode remover/ignorar:
- APP_TOKEN
- OPENAI_API_KEY
- OPENAI_MODEL

Teste recomendado:
1. Abrir sem login e finalizar treino: deve salvar local.
2. Criar conta/fazer login.
3. Testar IA no Perfil.
4. Finalizar treino logado: deve salvar local + nuvem + relatório IA.
5. Colocar o celular em modo avião: deve aparecer aviso offline e salvar só local.
