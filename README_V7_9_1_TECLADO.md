# Gym Bronze v7.9.1 — Correção do teclado

Corrige o teclado que abria e fechava sozinho nos campos de carga. Causa: desde a v7.8.1 os campos ficam dentro da tela (não mais no pop-up), e re-desenhos de fundo (login da conta, rede, sincronização) recriavam a tela e tiravam o foco. Agora o app adia esses re-desenhos enquanto você digita e atualiza ao sair do campo. Toques em botões continuam funcionando normalmente.

Suba todos os arquivos do app e abra 2 vezes. O backend não mudou (continua o v7.9.0).
