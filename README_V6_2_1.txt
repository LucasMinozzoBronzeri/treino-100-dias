Gym Bronze v6.2.1

Novidades:
- Zona de segurança agora tem:
  - Sair e limpar este aparelho
  - Excluir conta
  - Resetar perfil ativo
- Para modo local:
  - aparece "Sair e apagar perfil local"
  - apaga o perfil local do aparelho sem precisar conta.
- "Sair" continua sendo apenas limpeza do aparelho/cache.
- "Excluir conta" chama o backend para apagar dados da nuvem e remover o usuário do Supabase Auth.

Importante para excluir conta:
- Suba também o backend v6.2.1.
- Na Vercel, adicione a variável:
  SUPABASE_SERVICE_ROLE_KEY
- Use a Service Role Key do Supabase. Não coloque essa chave no frontend.
- Sem essa variável, excluir conta retorna erro e não apaga o usuário Auth.

Banco:
- Nenhum SQL novo.
