# Gym Bronze v7.7.6 — correção de navegação e persistência de lembretes

Base: v7.7.5 (frontend). Backend inalterado.

- Entrar na tela de Perfil deixa de disparar uma consulta automática ao Supabase, evitando sobrescrever horários em memória após navegar entre abas.
- O botão manual **Recarregar horários da nuvem** continua disponível.
- Após o salvamento, a resposta confirmada pelo Supabase é consolidada no perfil local correto, desde que não haja edição mais nova.
- Revisão de edição invalida leituras assíncronas anteriores.
- Cache do Service Worker e identificador de versão atualizados.

## Testes de aceitação
1. Exportar backup local antes de publicar.
2. Configurar Água — Fim como 22:00 e salvar; aguardar confirmação de sincronização.
3. Navegar para Home e retornar ao Perfil: 22:00 deve continuar exibido.
4. Confirmar `reminders.water.end` no Supabase.
5. Fechar e reabrir o PWA; confirmar 22:00 no app e no banco.
6. Testar outra conta e modo offline sem limpar dados locais.

Validação realizada: sintaxe do JavaScript e integridade do ZIP. Não houve teste integrado em celular/Supabase real.
