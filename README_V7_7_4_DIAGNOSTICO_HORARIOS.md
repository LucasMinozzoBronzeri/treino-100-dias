# Gym Bronze 7.7.4 — recuperar horários do Supabase

A v7.7.3 salvava no Supabase mas podia conservar horário antigo no formulário. Esta versão torna a leitura da conta selecionada testável pelo botão **Recarregar horários da nuvem**.

- Verifica que a sessão Supabase corresponde ao perfil selecionado.
- Ao carregar, aplica `reminders.water.start`, `reminders.water.end`, intervalos e horários do perfil na interface sem reconstruir a página.
- Se a sessão não estiver disponível ou o banco rejeitar a leitura, mostra mensagem em vez de permanecer silencioso.
- Protege alterações em andamento e aguarda gravações pendentes antes de ler.
- O banco/backend e Web Push não foram alterados.

Teste: no Supabase confirme `profiles.reminders.water.end = 22:00`, abra Perfil > Rotina e lembretes e use **Recarregar horários da nuvem**. Se a mensagem mencionar sessão, reconecte o perfil correto. Não limpe dados do aplicativo. Faça backup antes de atualizar.
