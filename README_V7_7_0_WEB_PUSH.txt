GYM BRONZE v7.7.0 — WEB PUSH

- Preservada a lógica existente de treinos, IA, nutrição e perfis.
- No Perfil > ativar notificações, um usuário logado autoriza Web Push.
- Para funcionar fechado é obrigatório HTTPS, suporte a Push API, permissão e uma conta verificada.
- Navegadores sem suporte mantêm alertas locais enquanto o app estiver aberto.
- Para Android instalado via Capacitor (WebView), esta versão NÃO substitui notificações nativas FCM/Capacitor.
- Teste de notificação existente permanece local.
- Web Push só está funcional depois da implantação e configurações no backend.
- As notificações de treino no servidor ainda NÃO checam se o treino do dia foi concluído; estão restritas às preferências/horário. É uma limitação deliberadamente identificada para não inferir dados locais como sincronizados.
- O envio usa horário exato por minuto; em hospedagens com cron atrasado pode perder disparos. Considere execução mais confiável na produção.
- Consulte README_V7_7_0_WEB_PUSH.md no pacote backend para implantação.
