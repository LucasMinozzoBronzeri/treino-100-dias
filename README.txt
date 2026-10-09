TREINO 100 DIAS PRO

Como usar:
1. Suba todos os arquivos desta pasta na raiz do repositório GitHub.
2. Ative GitHub Pages em Settings > Pages > main > /root.
3. Abra o link no celular.
4. No Android/Chrome: menu ⋮ > Instalar app / Adicionar à tela inicial.
   No iPhone/Safari: Compartilhar > Adicionar à Tela de Início.

Arquivos principais:
- index.html
- style.css
- app.js
- manifest.json
- service-worker.js
- icons/icon-192.png
- icons/icon-512.png

Recursos:
- PWA instalável e com cache offline.
- Perfis locais sem login.
- Treinos A/B/C/D/E com fila rotativa.
- Bloqueio para concluir apenas o treino correto.
- Registro de cargas, metas, dificuldade, dor e observações por exercício.
- Histórico, progresso e análise local.
- Check-in físico com fotos.
- Bioimpedância manual e tentativa de leitura por PDF.
- Backup exportar/importar em JSON.

Observações:
- Os dados ficam no armazenamento do navegador/celular.
- Use Exportar backup com frequência.
- A análise é local por regras, não uma IA online ainda.
- A leitura de PDF depende do PDF ter texto extraível e da biblioteca PDF.js carregar online.


IA ONLINE - VERCEL
------------------
Esta versão está pronta para gerar relatório automático ao finalizar treino via backend Vercel.
Não coloque a OPENAI_API_KEY no app.js.
No app, vá em Perfil > IA online via Vercel e preencha:
- URL do backend Vercel, exemplo: https://treino-100-api.vercel.app
- APP_TOKEN: o mesmo configurado na Vercel
- Marque gerar relatório automaticamente ao finalizar treino.

O backend deve expor /api/workout-report e usar OPENAI_API_KEY como variável de ambiente.
