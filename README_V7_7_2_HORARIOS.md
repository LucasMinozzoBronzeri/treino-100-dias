# Gym Bronze v7.7.2 — correção de exibição dos lembretes

Base: app v7.7.1 COMPLETA (mantém suporte mult contas, migração local e Web Push).

- Ao entrar na tela Perfil, busca os lembretes e rotina persistidos em `profiles` do Supabase, apenas se o usuário autenticado tiver o MESMO id do perfil selecionado.
- Atualiza o perfil local e a tela, preservando dados de outras contas.
- Não executa escrita na nuvem nesse processo; não altera o horário ou lógica do push.
- Atualiza o cache do Service Worker para receber o novo JavaScript após o deploy.

## Testes manuais recomendados
1. Faça backup no app antes de substituir a versão.
2. Conta A: defina Água início 00:10, salve e confirme no Supabase; saia da aba Perfil e volte: deve mostrar 00:10.
3. Feche/reabra a PWA; abra Perfil com rede ativa e aguarde a sincronização: deve mostrar 00:10.
4. Troque para conta B, com horário diferente; confirme que a configuração não mistura entre contas.
5. Teste modo offline (mostra último horário local) e retorno online.
6. Teste push e exclusão com contas descartáveis antes de publicar para todos.

Observação: se o perfil for aberto sem sessão cloud válida, a tela usará os dados locais e não tentará buscar dados de outra conta.
