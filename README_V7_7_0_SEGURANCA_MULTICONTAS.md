# Gym Bronze v7.7.0 — correção de segurança mult contas

## Mudanças
- Chaves de armazenamento Auth independentes por perfil; entrar em uma conta não encerra a sessão de outra.
- Troca de perfil ativa o cliente Supabase da respectiva conta e verifica o ID autenticado. Caso a sessão tenha expirado, o perfil continua disponível, mas operações remotas ficam bloqueadas até novo login.
- Ação **Sair desta conta neste aparelho** remove somente o perfil ativo e encerra somente a sessão local dele. Não remove o cadastro em Supabase nem limpa caches compartilhados do dispositivo.
- Ação **Excluir conta** recusa operação sem sessão ativa correspondente ao perfil; o backend exige `expectedUserId` igual ao ID da identidade validada pelo bearer token.
- Verificação final da identidade antes da exclusão. O backend não remove Auth se encontrar erro inesperado apagando tabelas de dados.
- O cadastro novo não reaproveita nem sobrescreve o perfil anterior no dispositivo.

## Atenção
O backend e o app DEVEM ser publicados juntos. O endpoint de exclusão foi alterado para exigir `expectedUserId`; uma versão antiga do app receberá HTTP 403 e não excluirá usuários — bloqueio intencional.
Antes de publicar, faça backup dos ZIPs anteriores e dos dados Supabase. Não apague cache/localStorage do app existente: contém dados locais e também a sessão herdada que pode ser migrada.

## Teste obrigatório antes de produção
1. Use duas contas de TESTE com históricos e e-mails diferentes. Entre em A, adicione B, alterne A/B/A e confirme que as duas mostram 'conectado' em Conta e Sincronização após reiniciar o PWA.
2. No perfil A, use Sair desta conta neste aparelho; confirme que B permanece conectada e que A existe no Supabase.
3. Refaça login em A, vá para B e faça exclusão apenas com B autenticada. Confirme que A e os dados de A não foram tocados.
4. Faça tentativa com sessão expirada/perfil desconectado e confirme que exclusão é BLOQUEADA.
5. Teste separadamente fluxo de e-mail com verificação, Google OAuth e modo local. O fluxo Google OAuth precisa de ensaio real no navegador e no APK; não foi testado automaticamente.
6. Teste Web Push para cada conta/assinatura no mesmo dispositivo; a alteração de conta não deve cruzar notificações.

## Limites
Não houve execução de testes end-to-end contra seu Supabase/Vercel de produção, nem testes instrumentados no Android. Não liberar deleção real sem o checklist acima. Contas anteriormente apagadas pelo backend não são recuperadas automaticamente por essa correção; verifique os backups do Supabase.
