Gym Bronze v7.1.0 — Login com Google + completar perfil

Novidades:
- Botão "Entrar com Google" na tela de login.
- Após login Google, se o perfil estiver incompleto, o app abre a tela "Complete seu perfil".
- Campos exigidos:
  - nome
  - idade
  - sexo
  - altura
  - peso inicial
  - objetivo
  - foco
  - experiência
  - dias por semana
  - observações
- Depois de completar:
  - salva perfil no Supabase
  - marca termos/política aceitos
  - gera treino inicial com IA
  - se a IA falhar, aplica treino padrão por fallback
- Usuários com perfil já completo entram direto.
- Sem SQL novo.

Configuração necessária no Supabase:
1. Authentication > Providers > Google: habilitar Google.
2. Configurar Client ID e Client Secret do Google Cloud.
3. Authentication > URL Configuration:
   - Site URL: URL do GitHub Pages do app.
   - Redirect URLs: URL do GitHub Pages do app.
4. Google Cloud OAuth:
   - adicionar redirect URL do Supabase indicada na tela do provider Google.
