Treino 100 Dias Pro - v5 Supabase

Novidades:
- Conta e sincronização no Perfil
- Login/criar conta via Supabase email/senha
- App continua funcionando sem login, salvando localmente
- Com login, salva treino, exercícios e relatórios IA no Supabase
- Botão para sincronizar histórico local com a nuvem

Config Supabase usada no app:
SUPABASE_URL=https://ppmlzpyxqtsgyhsyiuuh.supabase.co
A chave usada é a anon public key. Não use service_role no frontend.

Depois de subir no GitHub Pages, abra com:
https://lucasminozzobronzeri.github.io/treino-100-dias/?v=supabase-1

Teste recomendado:
1. Exportar backup antes de atualizar.
2. Subir arquivos na raiz do repo.
3. Abrir com ?v=supabase-1.
4. Testar sem login.
5. Criar conta/login.
6. Finalizar um treino e conferir tabelas workout_logs, exercise_logs e ai_reports no Supabase.


Atualização v5.1:
- Backend da IA já vem configurado no código: https://treino-100-api.vercel.app
- APP_TOKEN já vem embutido para o usuário não precisar preencher.
- Novas instalações começam sem dados pessoais preenchidos.
- A área de IA no Perfil mostra apenas o toggle de relatório automático e botão de teste.

Atenção: como o APP_TOKEN está no frontend, ele não deve ser tratado como segredo em uma versão pública/monetizada. Para produto real, o ideal é autenticar usuário no backend e validar permissões pelo Supabase.
