Gym Bronze v5.8.5

Correção de abertura do PWA:
- Se a conta/perfil já estiver salvo no aparelho, o app não mostra mais a tela de login por alguns instantes ao abrir.
- O app entra direto usando os dados locais e deixa o Supabase restaurar a sessão em segundo plano.
- Se a sessão expirar ou a nuvem não conectar, o usuário continua vendo os dados locais e pode entrar novamente pelo Perfil.

Não precisa subir backend.
