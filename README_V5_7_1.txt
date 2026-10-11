Gym Bronze v5.7.1 — correção IA em conta criada

Correção:
- Ao criar conta, o app agora só chama IA se existir sessão Supabase válida com access_token.
- Se o Supabase exigir confirmação de e-mail, o app avisa para confirmar e fazer login.
- Quando confirmação de e-mail estiver desativada, o app tenta login automático e libera treino/nutri normalmente.

Observação importante:
Se você quer que a IA funcione imediatamente após criar conta em testes/MVP, desative a confirmação de e-mail no Supabase Auth.
Se quiser confirmação por e-mail ativa, o usuário precisa confirmar o e-mail e depois entrar.
