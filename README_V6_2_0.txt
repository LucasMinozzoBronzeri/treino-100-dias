Gym Bronze v6.2.0

Correções:
- Sair e limpar app não deve mais sobrescrever o nome no banco com "Usuário".
- upsertCloudProfile agora preserva dados existentes do Supabase quando o valor local está vazio/default.
- Alternar conta atualiza a tela inteira e volta para Início.
- A lista de perfis foi removida do meio da página Perfil.

Reformulação do Perfil:
- Perfil agora fica organizado por blocos expansíveis:
  - Dados pessoais
  - Objetivo e treino
  - Conta e sincronização
  - IA e relatórios
  - Termos e avisos
  - Zona de segurança
- Alternar conta virou botão claro no topo e na seção de conta.
- Sair/limpar app fica só na Zona de segurança, no final.

Banco:
- Nenhum SQL novo.
- Backend não precisa subir.
