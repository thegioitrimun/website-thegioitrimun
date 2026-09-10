import React, { useDeferredValue, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../index.css';
import AdminWorkspaceLayout from '../../../components/AdminWorkspaceLayout';
import { AdminLayoutProvider } from '../../../components/AdminLayoutContext';
import { AdminInput } from '../../../components/admin/AdminInput';
import { AdminButton } from '../../../components/admin/AdminButton';
import { AdminDataTable } from '../../../components/admin/AdminDataTable';
import { AdminDialog } from '../../../components/admin/AdminDialog';
import { AdminSurface } from '../../../components/admin/AdminSurface';
import { AdminStatusBadge } from '../../../components/admin/AdminStatusBadge';
import { AdminSelectionBar } from '../../../components/admin/AdminSelectionBar';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { pathToView, viewToPath, buildViewSearch } from '../../appRouting';
import type { AdminNavigationView, View } from '../../../types';

const records = Array.from({length: 35}, (_, index) => ({ id: `DH-${String(index + 1).padStart(4,'0')}`, name: index === 0 ? 'Khách hàng thử nghiệm có tên rất dài để kiểm tra xuống dòng tiếng Việt' : `Khách hàng mẫu ${index + 1}`, total: index * 125000, status: index % 2 ? 'Đang xử lý' : 'Hoàn thành' }));
function Preview() {
  const url = new URL(location.href);
  const [view,setView] = useState<View>(() => pathToView(url.searchParams.get('route') || '/admin/don-hang', url.searchParams.get('query') || ''));
  const [search,setSearch] = useState('');
  const deferred = useDeferredValue(search);
  const [selected,setSelected] = useState<string[]>([]);
  const [descending,setDescending] = useState(false);
  const [page,setPage] = useState(1);
  const [dialog,setDialog] = useState(false);
  const [busy,setBusy] = useState(false);
  const mobile = useMediaQuery('(max-width:1023px)');
  const filtered = records.filter(row => `${row.id} ${row.name}`.toLowerCase().includes(deferred.toLowerCase())).sort((a,b) => descending ? b.total-a.total : a.total-b.total);
  const rows = filtered.slice((page-1)*30,page*30);
  const select = (id:string, checked:boolean) => setSelected(previous => checked ? [...new Set([...previous,id])] : previous.filter(key => key !== id));
  const navigate = (next:AdminNavigationView) => { setView(next); setSearch(''); setSelected([]); setPage(1); };
  return <AdminLayoutProvider><AdminWorkspaceLayout currentView={view} currentRole="master_admin" onBack={() => navigate({page:'adminDashboard'})} onNavigate={navigate}>
    <p className="mb-3 text-xs text-muted-foreground">Dữ liệu mẫu trên máy · Không kết nối nghiệp vụ · <output data-testid="route">{viewToPath(view)+buildViewSearch(view,'vi')}</output></p>
    <AdminSurface variant="toolbar" className="mb-3 flex flex-wrap items-center gap-3 p-3 lg:p-4">
      <div className="min-w-[180px] flex-1"><AdminInput aria-label="Tìm đơn mẫu" value={search} onValueChange={value => {setSearch(value);setPage(1);setSelected([]);}} clearable /></div>
      <AdminButton variant="primary" onClick={() => setDialog(true)}>Tạo đơn mẫu</AdminButton>
      <AdminButton onClick={() => setBusy(value => !value)}>Đổi trạng thái bận</AdminButton>
      <AdminButton data-testid="stable-button" loading={busy}>Lưu thay đổi</AdminButton>
    </AdminSurface>
    <AdminSelectionBar selectedCount={selected.length} onClearSelection={() => setSelected([])} />
    {mobile ? <AdminSurface className="mt-3 divide-y divide-border">{rows.map(row => <article key={row.id} className="flex min-h-20 gap-3 p-3"><input type="checkbox" aria-label={`Chọn mục ${row.id}`} checked={selected.includes(row.id)} onChange={e => select(row.id,e.target.checked)} /><div className="min-w-0 flex-1"><button type="button" onClick={() => setDialog(true)} className="font-semibold text-primary">{row.id}</button><p className="line-clamp-2 text-sm">{row.name}</p><div className="mt-2 flex items-center justify-between gap-2"><AdminStatusBadge tone={row.status==='Hoàn thành'?'emerald':'sky'} label={row.status}/><span className="tabular-nums">{row.total.toLocaleString('vi-VN')} ₫</span></div></div></article>)}</AdminSurface> : <AdminDataTable data={rows} rowKey={row=>row.id} selectedKeys={selected} onSelectKey={select} onSelectAll={checked => setSelected(previous => checked ? [...new Set([...previous,...rows.map(row=>row.id)])] : previous.filter(id=>!rows.some(row=>row.id===id)))} columns={[
      {id:'id',label:'Mã đơn',render:row=><button type="button" className="font-semibold text-primary" onClick={()=>setDialog(true)}>{row.id}</button>},
      {id:'customer',label:'Khách hàng',render:row=><span className="line-clamp-2 max-w-md">{row.name}</span>},
      {id:'status',label:'Trạng thái',render:row=><AdminStatusBadge tone={row.status==='Hoàn thành'?'emerald':'sky'} label={row.status}/>},
      {id:'total',label:'Tổng tiền',align:'right',sortable:true,sortDirection:descending?'desc':'asc',onSort:()=>setDescending(value=>!value),render:row=>`${row.total.toLocaleString('vi-VN')} ₫`}
    ]}/>}
    <div className="mt-3 flex items-center justify-between"><p role="status">{filtered.length} kết quả · Trang {page}</p><div className="flex gap-2"><AdminButton disabled={page===1} onClick={()=>setPage(page-1)}>Trước</AdminButton><AdminButton disabled={page*30>=filtered.length} onClick={()=>setPage(page+1)}>Sau</AdminButton></div></div>
    <AdminDialog open={dialog} onClose={()=>setDialog(false)} title="Đơn hàng mẫu"><label htmlFor="fixture-name" className="mb-2 block text-xs font-semibold">Tên khách hàng</label><AdminInput id="fixture-name" defaultValue="Khách hàng mẫu"/><AdminButton className="mt-4" onClick={()=>setDialog(false)}>Đóng bản mẫu</AdminButton></AdminDialog>
  </AdminWorkspaceLayout></AdminLayoutProvider>;
}
// This entry is served only by Vite development. It is absent from the production build input.
if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<Preview />);
