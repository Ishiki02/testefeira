# EcoRotas

Projeto educacional de rotas de reciclagem, pontos de coleta e comunidade.
Os endereços, coordenadas, horários e estatísticas são demonstrativos; não representam uma operação de coleta validada.

## Executar localmente

Requer Node.js 22 ou superior.

```sh
npm ci
npm start
```

Abra http://localhost:3000. O servidor entrega a página e a API no mesmo endereço.
Sem JWT_SECRET em desenvolvimento, uma chave temporária é gerada; reiniciar o servidor encerra as sessões locais.

## O que foi corrigido

- Nome cadastrado recuperado da API `/api/me`, inclusive quando o navegador contém uma sessão antiga sem nome.
- Cabeçalho alinhado, avatar com iniciais, nomes longos abreviados visualmente e menu adaptado a telas menores.
- “Meu perfil” permite definir ou corrigir o nome; as publicações existentes são atualizadas junto.
- Cadastro entra automaticamente. Contas antigas sem nome podem completá-lo sem recriar a conta.
- Uma única implementação de autenticação e comunidade; os antigos handlers Netlify não utilizados foram removidos.
- E-mails não aparecem na listagem pública de posts; exclusão continua restrita ao autor.
- Validação no servidor, limite de tentativas de login/cadastro, consultas parametrizadas e verificação de sessão.
- Modal com Escape, foco contido, retorno de foco, rótulos acessíveis e autofill.
- Feedback de falhas, opção de tentar novamente e proteção contra cliques repetidos.
- Servidor entrega apenas os arquivos públicos permitidos; a publicação Netlify usa `public/`, sem expor o banco ou código interno.

## Atualizar o site existente

O frontend original chamava `https://testefeira.onrender.com`. Esta versão preserva esse backend e as contas que estiverem no banco dele; não migra os dados para outro provedor.

1. Faça backup do banco de produção antes de atualizar. **Não substitua o banco existente por um arquivo do repositório.**
2. No Render, use `npm ci` como build e `npm start` como comando de inicialização.
3. Defina `NODE_ENV=production` e `JWT_SECRET` com pelo menos 32 caracteres aleatórios. Gere uma chave com `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Mantenha a mesma chave segura entre deploys; trocar a chave exige novo login.
4. Use `DATABASE_PATH` apontando para um disco persistente, por exemplo `/var/data/ecorotas.db`. Copie seu banco atual para esse caminho uma vez, com o serviço parado. **Mudar apenas o caminho cria um banco vazio.** A disponibilidade de disco depende do serviço contratado.
5. Se estiver atrás de um proxy confiável, configure `TRUST_PROXY` com a quantidade correta de saltos para o limitador de tentativas distinguir clientes. Não configure um número sem verificar a infraestrutura.
6. Faça o deploy do backend antes do frontend, pois o perfil utiliza as novas rotas `/api/me`.
7. Se o frontend estiver no Netlify, a configuração incluída executa `npm run build`, publica somente `public/` e encaminha `/api/*` ao Render. Se mudar o endereço do Render, ajuste `netlify.toml`.
8. Se hospedar tudo no Render, basta acessar o próprio serviço; o frontend usa `/api` na mesma origem. Para outro host estático, configure proxy equivalente para `/api/*`.

`ALLOWED_ORIGINS` aceita origens separadas por vírgula quando for necessário chamar a API diretamente de outro domínio. O fluxo padrão, na mesma origem ou com proxy, não precisa dessa opção.

O banco `ecorotas.db` já constava no histórico original. Não o publique como arquivo estático nem use dados de produção em commits. A nova configuração ignora bancos novos; a cópia antiga e o histórico precisam de uma revisão separada antes de uma eventual remoção definitiva.

## Verificação

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Os testes de API usam banco temporário em memória; os testes de navegador sobem um serviço isolado na porta 3100. Nenhum teste usa contas ou publicações de produção.

A autenticação ainda usa token no armazenamento local. Para uma implantação mais robusta, uma futura mudança para cookies HttpOnly exigirá coordenar autenticação, proteção CSRF e configuração de domínio.
