const { test, expect } = require('@playwright/test');
test('cadastro, perfil, publicação, alinhamento e celular', async ({ page }) => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button',{name:'Cadastrar',exact:true}).first().click();
  await page.locator('#regName').fill('Cauê Ishiki');
  await page.locator('#regEmail').fill('caue@example.com');
  await page.locator('#regPassword').fill('senha-teste-123');
  await page.locator('#registerSubmitBtn').click();
  await expect(page.locator('#navUserName')).toHaveText('Olá, Cauê');
  const label=await page.locator('#navUserName').boundingBox();
  const logout=await page.locator('#logoutBtn').boundingBox();
  expect(Math.abs(label.y+label.height/2-logout.y-logout.height/2)).toBeLessThan(2);
  await page.locator('#openProfileBtn').click();
  await page.locator('#profileName').fill('Ishiki da Silva');
  await page.locator('#profileSubmitBtn').click();
  await expect(page.locator('#navUserName')).toHaveText('Olá, Ishiki');
  await page.locator('#postContent').fill('<img src=x onerror=alert(1)> Reciclagem');
  await page.locator('#postSubmitBtn').click();
  await expect(page.locator('.post-card p')).toHaveText('<img src=x onerror=alert(1)> Reciclagem');
  await expect(page.locator('.post-card img')).toHaveCount(0);
  await page.evaluate(()=>localStorage.setItem('ecorotas_user',JSON.stringify({email:'caue@example.com'})));
  await page.reload();
  await expect(page.locator('#navUserName')).toHaveText('Olá, Ishiki');
  await page.screenshot({path:'test-results/desktop.png',fullPage:true});
  for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:850});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('#menuBtn').click();
  await expect(page.locator('#menuBtn')).toHaveAttribute('aria-expanded','true');
  await page.screenshot({path:'test-results/mobile.png'});
  await page.locator('#logoutBtn').click();
  await expect(page.locator('#navAuth')).toBeVisible();
  await page.locator('#openLoginBtn').click();
  await expect(page.locator('#loginEmail')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#authModal')).not.toBeVisible();
  expect(errors).toEqual([]);
});
test('armazenamento corrompido não interrompe navegação',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('ecorotas_user','{invalido'));
  await page.goto('/');await expect(page.locator('#openLoginBtn')).toBeVisible();
  await page.locator('#openLoginBtn').click();await expect(page.locator('#loginEmail')).toBeFocused();
});
