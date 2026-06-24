MEU TREINO 100 DIAS - VERSAO PWA

Arquivos principais:
- index.html
- style.css
- app.js
- manifest.json
- service-worker.js
- icons/icon-192.png
- icons/icon-512.png

O que esta versao tem:
- Fila rotativa A/B/C/D/E
- Progresso 0/100
- Modal com exercicios
- Concluir exercicio apenas no proximo treino da fila
- Finalizar treino com confirmacao
- Aviso para finalizar tambem no app da academia
- Cargas salvas por exercicio
- Historico
- Desfazer ultimo treino
- Reset com confirmacao reforcada
- Exportar backup em JSON
- Importar backup em JSON
- Manifest e service worker para instalar como PWA e funcionar offline apos o primeiro acesso

Como instalar no celular:
1. Hospede esta pasta em um servico com HTTPS, como Netlify, Vercel ou GitHub Pages.
2. Abra o link no celular.
3. No Android/Chrome: menu de tres pontos > Instalar app ou Adicionar a tela inicial.
4. No iPhone/Safari: compartilhar > Adicionar a Tela de Inicio.

Observacao importante:
Os dados ficam salvos no proprio navegador/celular. Use Exportar backup de tempos em tempos para evitar perder progresso caso limpe dados do navegador, troque de celular ou desinstale o PWA.
