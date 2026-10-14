# Gym Bronze v7.7.3 — correção da regressão de horários

- Leitura assíncrona não pode sobrescrever edições iniciadas depois da requisição.
- Leitura não pode sobrescrever alterações ainda pendentes de confirmação do Supabase.
- Atualização da interface altera apenas os campos, sem renderização completa que fecha a seção de lembretes.
- Botão Salvar informa separadamente o estado local e a confirmação do Supabase, incluindo erros.
- Mantidos backend v7.7.1, Web Push e mult contas.

**Teste antes de publicar amplamente:** exporte backup, configure Água fim para 22:00, salve, espere a confirmação de sincronização, veja em Supabase profiles.reminders.water.end, feche e reabra o PWA, entre no Perfil e confira 22:00. Teste com duas contas e sem rede.
