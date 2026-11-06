const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const bcrypt = require('bcryptjs');

test('cadastro, nome, sessão, privacidade e permissões', async t => {
  const { app, db } = createApp({ dbPath: ':memory:', secret: 'test-secret-32-characters-minimum-value' });
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.close(); db.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function api(url, method='GET', body, token) {
    const res = await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return {status:res.status, data:await res.json()};
  }
  await t.test('valida tipos, nome, email e senha', async () => {
    for (const body of [{name:' ',email:'a@a.com',password:'12345678'},{name:42,email:[],password:{}},{name:'Nome',email:'inválido',password:'12345678'},{name:'Nome',email:'a@a.com',password:'😀'.repeat(30)}]) assert.equal((await api('/api/register','POST',body)).status,400);
    const malformed = await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});
    assert.equal(malformed.status,400);
  });
  const a=await api('/api/register','POST',{name:'  Cauê   Ishiki ',email:' TESTE@GMAIL.COM ',password:'senha-forte-123'});
  const b=await api('/api/register','POST',{name:'Outro Usuário',email:'outro@example.com',password:'senha-forte-123'});
  assert.equal(a.status,201); assert.equal(a.data.user.name,'Cauê Ishiki');
  const token=a.data.token;
  await t.test('normaliza e-mail e mantém nome no login', async () => {
    const login=await api('/api/login','POST',{email:'TESTE@gmail.com',password:'senha-forte-123'});
    assert.equal(login.status,200);assert.equal(login.data.user.name,'Cauê Ishiki');
    assert.equal((await api('/api/register','POST',{name:'Cauê',email:'teste@gmail.com',password:'senha-forte-123'})).status,409);
    assert.equal((await api('/api/login','POST',{email:'teste@gmail.com',password:'errada'})).status,401);
  });
  const created=await api('/api/posts','POST',{content:'<script>alert(1)</script>'},token);
  assert.equal(created.status,201);
  await t.test('perfil atualiza nome e publicações sem mudar token', async () => {
    assert.equal((await api('/api/me','PATCH',{name:'Nome Novo'},token)).status,200);
    assert.equal((await api('/api/me','GET',null,token)).data.user.name,'Nome Novo');
    const list=(await api('/api/posts')).data.posts;
    assert.equal(list[0].author_name,'Nome Novo');assert.equal('author_email' in list[0],false);
    assert.equal((await api('/api/posts','POST',{content:{}},token)).status,400);
  });
  await t.test('exclusão exige dono; token falso não acessa perfil', async () => {
    assert.equal((await api('/api/posts/'+created.data.post.id,'DELETE',null,b.data.token)).status,403);
    assert.equal((await api('/api/me','GET',null,'invalido')).status,401);
    assert.equal((await api('/api/posts/'+created.data.post.id,'DELETE',null,token)).status,200);
  });
  await t.test('conta antiga sem nome permite completar perfil', async () => {
    db.prepare('INSERT INTO users (email,password_hash) VALUES (?,?)').run('antigo@example.com',await bcrypt.hash('senha-antiga',10));
    const old=await api('/api/login','POST',{email:'antigo@example.com',password:'senha-antiga'});
    assert.equal(old.data.user.name,null);
    assert.equal((await api('/api/me','PATCH',{name:'Nome Recuperado'},old.data.token)).data.user.name,'Nome Recuperado');
  });
  await t.test('servidor não publica banco e arquivos internos', async () => {
    for (const file of ['/ecorotas.db','/server.js','/package.json','/.env']) assert.equal((await fetch(base+file)).status,404);
    assert.equal((await fetch(base+'/')).status,200);
  });
});
