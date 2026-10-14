# Gym Bronze v7.7.7 — Variações e progressão inteligente

Base: app v7.7.6. Esta atualização altera **app + backend de IA**.

## Novidades
- Alternativas de exercícios são incluídas no JSON pela IA (`variations` com `id`, `name`, `measurement`). Se o plano antigo contiver "ou" entre alternativas, há reconhecimento local como compatibilidade; nem todas as descrições livres podem ser inferidas com segurança.
- Botão para escolher a alternativa durante o treino. O seletor mantém a última escolha por exercício.
- `duration` (prancha/isometrias): tempo por série (segundos), quantidade de séries, dificuldade, dor e observação. `weight_reps`: carga/repetições por série e campos existentes.
- Meta automática para prancha; para exercícios com carga permanecem as regras existentes de progressão por desempenho. Cada alternativa recebe meta própria e a carga digitada por variante é armazenada separadamente.
- Relatório de IA: recebe a alternativa registrada, métricas de duração e orientações para evitar comparar máquinas/cabos como se os quilogramas fossem diretamente comparáveis.
- Histórico existente é preservado; dados sem identificação da alternativa anterior não são convertidos automaticamente em modalidade nova.

## Implantação
1. Faça um backup exportado do seu perfil antes de trocar arquivos.
2. Atualize o frontend no site com o ZIP do app.
3. Atualize o backend de IA com o ZIP da API (somente arquivo da API pode ser mesclado ao repositório; preserve suas variáveis de ambiente). `vercel.json` está `{}` para manter o agendador externo e evitar o erro de Cron no plano Vercel Hobby.
4. Não é preciso executar SQL novo. Publique o backend e frontend e confira versões/cache.
5. Teste num perfil de teste: abdominal máquina/prancha, Scott máquina/cabo, salvar e reabrir; registre séries, finalize, confira histórico e geração de relatório.

## Limitações
- A versão não tenta diagnosticar desequilíbrios musculares nem calcula equivalência numérica entre aparelhos diferentes.
- Variações no plano antigo são identificadas apenas quando a descrição tem formato inequívoco; se a IA não oferecer alternativas, pode ser necessário editar a descrição do exercício.
- O relatório de IA depende de conexão, autenticação, limite diário e das variáveis de ambiente existentes; as sugestões locais continuam funcionando offline.
- As validações aqui foram estáticas e unitárias; ainda precisa de teste real no navegador, celular e Supabase antes de disponibilizar amplamente.
