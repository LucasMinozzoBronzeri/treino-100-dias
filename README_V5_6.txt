Gym Bronze v5.6 — Fluxo sem treino default inicial

Mudanças:
- Ao criar conta ou iniciar localmente, o app tenta gerar o treino específico com IA antes de exibir treinos.
- Se a IA falhar, o app aplica o treino padrão como fallback.
- Quando estiver com treino padrão por fallback, a tela inicial mostra:
  - Atualizar treino para específico
  - Ficar com treino default
- O prompt enviado para IA não manda mais o treino padrão como template obrigatório, reduzindo viés.

Subida:
- Suba primeiro o backend v5.6 e faça redeploy.
- Depois suba o app v5.6 e abra com ?v=5-6.
