import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
const load = async path => {
  const source = await fs.readFile(new URL(path, import.meta.url),'utf8');
  const {outputText} = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
};
const {AdminDataProvider} = await load('../src/admin/AdminDataProvider.ts');
const {ADMIN_NAV_REGISTRY,resolveActiveAdminModule,isAdminSubItemActive,resolveAdminPageTitle} = await load('../src/admin/adminNavRegistry.ts');
const {pathToView,viewToPath,buildViewSearch} = await load('../src/appRouting.ts');

test('all registered module and tab URLs preserve their active module',()=>{
  assert.equal(ADMIN_NAV_REGISTRY.length,10);
  for(const module of ADMIN_NAV_REGISTRY) for(const view of [module.defaultView,...module.subItems.map(item=>item.view)]) {
    const roundtrip=pathToView(viewToPath(view),buildViewSearch(view,'vi'));
    assert.equal(resolveActiveAdminModule(roundtrip).id,module.id,JSON.stringify(view));
    const active=module.subItems.filter(item=>isAdminSubItemActive(roundtrip,item.view));
    assert.ok(active.length<=1,`Multiple active tabs: ${JSON.stringify(view)}`);
    if(module.subItems.length) assert.equal(active.length,1,JSON.stringify(roundtrip));
  }
});
test('orders title and POS/Online tabs are distinct',()=>{
  assert.equal(resolveAdminPageTitle({page:'adminPharmacyManagement',section:'orders'}),'Đơn hàng');
  for(const channel of ['online','pos']) {
    const view={page:'adminPharmacyManagement',section:'orders',action:'new-order',orderChannel:channel};
    assert.deepEqual(ADMIN_NAV_REGISTRY.find(m=>m.id==='orders').subItems.filter(s=>isAdminSubItemActive(view,s.view)).map(s=>s.key),[`new-${channel}`]);
  }
});
test('VAT and Pancake invalid tabs normalize; accountant navigation remains restricted',()=>{
  assert.equal(pathToView('/admin/ke-toan-vat','?section=invalid').section,undefined);
  assert.equal(pathToView('/admin/pancake-pos','?section=invalid').section,undefined);
  assert.deepEqual(ADMIN_NAV_REGISTRY.filter(m=>m.allowedRoles.includes('accountant')).map(m=>m.id),['vat']);
  assert.ok(!ADMIN_NAV_REGISTRY.find(m=>m.id==='vat').allowedRoles.includes('admin'));
});
test('concurrent refreshes deduplicate without dropping valid zero values',async()=>{
  const cache=new AdminDataProvider();let calls=0;
  const loader=async()=>{calls++;return 0;};
  assert.deepEqual(await Promise.all([cache.read('orders',loader,{force:true}),cache.read('orders',loader,{force:true})]),[0,0]);
  assert.equal(calls,1);assert.equal(cache.peek('orders'),0);
});
test('invalidated in-flight read cannot restore stale data',async()=>{
  const cache=new AdminDataProvider();let complete;
  const pending=cache.read('orders',()=>new Promise(resolve=>{complete=resolve;}));
  await Promise.resolve();cache.invalidate('orders');
  await cache.read('orders',async()=>['new']);
  complete(['old']);await assert.rejects(pending,{name:'AbortError'});
  assert.deepEqual(cache.peek('orders'),['new']);
});
test('account switch clears cached details and invalidates pending requests',async()=>{
  const cache=new AdminDataProvider();cache.setScope('a');cache.set('user-detail:1',{name:'fixture'});
  let complete;const pending=cache.read('orders',()=>new Promise(resolve=>{complete=resolve;}));
  await Promise.resolve();cache.setScope('b');complete(['old account']);
  await assert.rejects(pending,{name:'AbortError'});assert.equal(cache.peek('user-detail:1'),undefined);
});
