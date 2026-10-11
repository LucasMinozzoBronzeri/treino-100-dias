Gym Bronze v5.7.7

Mudanças:
- Botão “Sair e limpar app” com confirmação.
- Antes de sair, o app tenta sincronizar perfil, histórico, plano atual e rotina alimentar na nuvem.
- Logout limpa sessão, localStorage do app, caches e service worker.
- Barra superior/status bar do celular alterada para preto (#09090b), removendo o laranja antigo.
- Rotina alimentar gerada agora tenta salvar em public.nutrition_plans quando o usuário está com conta real confirmada.
- Mantém modo local funcionando sem e-mail.

Importante:
- Rode o SQL v5.7/v5.7.4 se ainda não rodou, pois nutrition_plans precisa existir.
- Depois de subir, abra com ?v=5-7-7 e reinstale o PWA.
