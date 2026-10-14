# Gym Bronze v7.7.1 — Conversão de perfil local em conta

- Em Perfil > Conta e sincronização, escolha **Criar conta com estes dados locais**.
- Nome, dados de perfil, rotina, lembretes, treinos, histórico, plano, dieta, XP e aulas permanecem no MESMO perfil local.
- O cadastro pede apenas o e-mail, senha, confirmação de senha e aceite dos termos; não repete o onboarding.
- Após confirmar o e-mail, entre com o mesmo e-mail e senha. O app vincula o ID existente à conta no Supabase e tenta enviar os dados antes de buscar qualquer plano vazio.
- Em caso de falha parcial de sincronização, o perfil local permanece salvo e um aviso informa o problema. Não remova o perfil enquanto a sincronização estiver pendente.
- Segurança: a conversão usa identificação de e-mail e ID do usuário devolvidos pelo cadastro para impedir vinculação acidental a outra conta.
- Teste num aparelho/dispositivo de desenvolvimento com contas descartáveis, e faça backup exportado antes de atualizar em produção.
- A migração só funciona para perfis locais ainda presentes no armazenamento do aparelho: ela não restaura dados excluídos do Supabase.
