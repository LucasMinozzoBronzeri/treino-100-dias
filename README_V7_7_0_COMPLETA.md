# Gym Bronze v7.7.0 COMPLETA — Web Push + treino e descanso

Esta é a versão consolidada, substitui os pacotes preliminares v7.7.0 de Web Push. Mantém a base funcional v7.6.4.

## Novidades finais
- Perfil > Rotina: selecione explicitamente os dias da semana em que deseja receber lembretes de treino. Dias desmarcados = descanso para notificações. A seleção NÃO reorganiza a fila de exercícios.
- Se o usuário não escolheu dias antes da atualização, aplica sugestão de segunda/quinta (2 treinos), segunda/quarta/sexta (3), segunda/terça/quinta/sexta (4), segunda a sexta (5) ou segunda a sábado (6). Confirme/edite no Perfil.
- O backend verifica `workout_logs.finished_at` no fuso do dispositivo, para a conta cadastrada, e não envia o lembrete quando já houver treino finalizado no dia. Consulta apenas ao chegar o horário agendado para treino.
- Modo com página aberta, sem inscrição Web Push: o lembrete local também respeita o descanso e a conclusão do dia.
- Água e alimentação continuam com seus horários, inclusive em dias de descanso.

## Implantação
Siga `README_V7_7_0_WEB_PUSH.md` e execute `SQL_V7_7_0_WEB_PUSH.sql` no Supabase. Esta atualização NÃO requer outro SQL, pois `workout_logs` e `profiles.reminders` já existiam.

1. Faça backup da aplicação/backend atuais, seus dados e do banco antes de implantar.
2. Implante backend e app dos ZIPs **COMPLETA** juntos.
3. Configure VAPID/CRON_SECRET/segredos conforme README de Web Push. O plano Vercel Hobby não suporta cron por minuto: use agendador externo confiável ou plano compatível.
4. No perfil autenticado, salve os dias de treino e ative notificações; autorize no dispositivo HTTPS/PWA.
5. Teste um dia de descanso e um dia de treino já concluído. Os registros de treino devem estar sincronizados no Supabase para que o servidor os reconheça.

## Observações técnicas
- Treino concluído enquanto offline fica apenas no aparelho até sincronizar; nesse intervalo o backend pode enviar um lembrete porque ainda não encontra o registro em `workout_logs`.
- O disparo considera o fuso horário salvo por dispositivo no momento da inscrição. Se mudar de fuso, reinscreva no Web Push.
- Treinos feitos fora dos dias selecionados continuam possíveis normalmente; dias servem unicamente ao lembrete.
- Não há notificação automática especial anunciando descanso: por padrão, o dia de descanso é silencioso para treino.
- Web Push não substitui notificações nativas do APK Capacitor.
- A conclusão do treino é determinada por pelo menos um registro em `workout_logs` no dia civil local, não pela conclusão de cada exercício.
- Não houve testes end-to-end no Supabase ou na Vercel reais: é necessário executar os testes pós-implantação.

## Ajuste final v7.7.0 — limite de dias de descanso
- A seleção de dias no Perfil → Rotina e lembretes respeita a frequência de 2 a 6 treinos semanais; restam exatamente 7 − frequência dias de descanso.
- Exemplo: 5 treinos por semana = 2 dias de descanso, no máximo; o usuário pode escolher quais são.
- Alterar a frequência sugere automaticamente uma nova distribuição, permitindo personalizar os dias.
- A lista é normalizada antes de salvar localmente/no Supabase e no backend antes do envio de Web Push, inclusive para perfis antigos.
- O cadastro inicial usa sugestões compatíveis; a seleção é editável no Perfil.

## Ajuste de cadastro — mesma versão 7.7.0
A seleção dos dias de treino e descanso aparece na etapa Rotina e lembretes do cadastro por e-mail e Google, e no perfil local. São selecionados exatamente os dias da frequência semanal; a configuração é incluída em reminders.workoutDays no perfil e segue a sincronização existente com o Supabase.
