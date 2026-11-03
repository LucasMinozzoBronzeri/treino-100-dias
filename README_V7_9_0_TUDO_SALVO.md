# Gym Bronze v7.9.0 — Tudo salvo na nuvem + dieta nova

## Antes de subir o app
1. No Supabase > SQL Editor, rode `SQL_V7_9_0_SNAPSHOT.sql` (está na pasta do backend). Cria a tabela `user_snapshots` com RLS.
2. Faça o redeploy do backend na Vercel.
3. Suba todos os arquivos do app e abra 2 vezes.

## O que mudou
- **Tudo salvo**: perfil, dieta, preferências alimentares, checklist de nutrição, check-ins, cargas, patente/XP, aulas, tema e plano ficam em um retrato na nuvem, enviado automaticamente alguns segundos depois de cada mudança. Em outro celular, ao entrar na conta, tudo volta.
- Perfil > Conta mostra "tudo salvo" e tem "Salvar agora" / "Buscar da nuvem".
- Se dois aparelhos mudarem ao mesmo tempo, os históricos são unidos (nada some).
- **Alimentação**: perguntas (restrições, tipo de dieta, refeições/dia, cozinha, orçamento, suplementos...) abrem ao gerar a dieta pela primeira vez e ficam em Perfil > Alimentação.
- **Dieta nova**: metas de kcal/macros calculadas pelo servidor (Mifflin-St Jeor), refeições com macros e trocas, respeitando restrições. Bloqueio para menores de 18, gestantes e histórico de transtorno alimentar.

## Limite conhecido
- Fotos dos check-ins (frente/lado/costas) ainda ficam só no aparelho (são grandes). Dá para mover para o Supabase Storage na próxima versão.
