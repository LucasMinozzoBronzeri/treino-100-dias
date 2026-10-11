Gym Bronze v5.7.9

Correções:
- Rotina alimentar: ao gerar uma nova, o app apaga a rotina anterior do usuário em nutrition_plans e insere a mais recente.
- O app mostra erro real se nutrition_plans falhar.
- Botão “Salvar rotina na nuvem” continua disponível se a rotina não sincronizar.
- Ao clicar em “Gerar/Atualizar treino específico”, abre popup perguntando objetivo, foco e observações, preenchido com os dados atuais do perfil.
- O objetivo/foco atualizados entram no perfil e no prompt enviado à IA.

Importante:
- nutrition_plans só salva em conta real com e-mail confirmado.
- Modo local/anônimo não salva plano de nutri na nuvem.
- Rode SQL_V5_7_9_NUTRITION_POLICY.sql se a tabela não permitir delete/insert.
