Treino 100 Dias Pro v5.4

Novidades:
- Tela inicial simplificada com um bloco de login.
- Links para Criar conta e Iniciar localmente.
- Cadastro com nome, idade, altura, peso inicial, objetivo, foco, experiência, dias por semana e observações.
- IA gera treino de adaptação no cadastro ou no modo local.
- Botão para gerar/atualizar treino com IA.
- Botão para finalizar ciclo e pedir novo ciclo ajustado com base no histórico.
- Continua sem APP_TOKEN fixo no frontend.

Backend necessário:
Use o backend v5.4, pois ele adiciona /api/workout-plan.


V5.4.1:
- Ao finalizar um ciclo, o app abre um campo opcional para o usuário escrever o que quer mudar no próximo ciclo.
- Esse pedido é enviado para a IA junto com histórico, dores, cargas e exercícios pulados.
