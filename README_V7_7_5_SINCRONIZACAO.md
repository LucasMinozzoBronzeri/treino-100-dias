# Gym Bronze v7.7.5 — proteção dos horários

- Ao entrar em uma conta existente, recupera `reminders` e `routine` do Supabase antes de sincronizar; não grava o perfil local sobre o banco na abertura.
- Somente contas inexistentes recebem upsert inicial.
- Salvar rotina agora tira um snapshot dos campos e faz um UPDATE específico de `reminders` e `routine`, verificando identidade e resposta.
- Outras gravações do perfil preservam os `reminders` já armazenados na nuvem, impedindo atualizações de treino/IA de reverter os horários.
- Suporte a perfis locais e múltiplas contas mantido. Backend sem alterações.

## Teste
1. Faça backup dos perfis locais.
2. No Supabase, defina água fim = 22:00 e abra o app: deve continuar 22:00 nos dois.
3. No app, salve outro horário (ex.: 20:00), aguarde confirmação, feche e reabra: deve permanecer 20:00 nos dois.
4. Alterne entre contas e confira as configurações de cada uma.

Observação: não é uma migração de banco. O aplicativo ainda precisa ser testado conectado ao Supabase real.
