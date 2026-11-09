export async function register(p, name = 'Админ') {
  await p.getByText('Пропустить').click(); await p.waitForTimeout(500);
  await p.locator('input').first().fill(name);
  await p.getByText('Начать путешествие').click(); await p.waitForTimeout(2500);
  for (let i = 0; i < 6; i++) { const b = p.getByRole('button', {name: /Пропустить|Далее|Понятно|Закрыть|Начать/}).first(); if (await b.count() && await b.isVisible().catch(()=>false)) { await b.click().catch(()=>{}); await p.waitForTimeout(500); } }
}
export const text = async p => (await p.innerText('body')).replace(/\n{2,}/g, '\n');
