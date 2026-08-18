# Admin Dashboard Roadmap

## 1. Muc tieu

Xay dung mot dashboard quan tri co gia tri van hanh thuc te, tap trung vao 4 cau hoi:

1. Don hang dang o trang thai nao, co gi tre, co gi loi.
2. Doanh thu, hoan tien, thue, AOV, don hang thanh cong dang tang hay giam.
3. Khach hang moi, khach hang quay lai, nhom khach hang gia tri cao la ai.
4. Lich hen, dich vu, ton kho, san pham ban chay dang tac dong the nao den kinh doanh.

Dashboard phai:

- dung du lieu hien co trong Supabase
- co the mo rong dan, khong lam vo cac trang admin dang dung
- uu tien KPI dung va nhanh hon la lam dep som
- tach ro du lieu van hanh real-time va du lieu bao cao tong hop

## 2. Hien trang code va du lieu

### 2.1. UI admin hien co

Hien tai [components/AdminDashboardPage.tsx](/Users/PHUC/Downloads/32-kiến-trúc-mới-fullstack-iskin-clinic-+-supabase-ở-account-hovidaiphuc@gmail.com---website-project%20(1)/components/AdminDashboardPage.tsx) moi la trang dieu huong sang:

- quan ly nguoi dung
- quan ly dich vu
- quan ly nha thuoc
- quan ly blog
- quan ly noi dung site

Chua co dashboard KPI, chart, canh bao, hay bao cao tong hop.

### 2.2. Nguon du lieu da co san

He thong hien da co du lieu nen kha day du:

- `patients`: ho so khach hang, role, thong tin lien he
- `appointments`: lich hen dich vu
- `medical_records`, `performed_services`, `invoices`, `prescribed_medications`: du lieu sau tham kham/dieu tri
- `product_orders`: don hang san pham
- `product_order_items`: chi tiet san pham trong don
- `order_status_history`: lich su chuyen trang thai
- `order_payments`: lich su thanh toan
- `order_refunds`: hoan tien
- `discount_codes`, `discount_code_usages`: ma giam gia
- `funnel_events`: su kien funnel
- `products`, `product_images`, `product_categories`, `product_brands`: danh muc nha thuoc
- `services`, `procedure_steps`: danh muc dich vu
- `tax_profiles`, `tax_rates`: VAT va quy tac thue
- GHTK fields trong `product_orders`: van chuyen va tracking

### 2.3. API admin dang co

Trong [services/api.ts](/Users/PHUC/Downloads/32-kiến-trúc-mới-fullstack-iskin-clinic-+-supabase-ở-account-hovidaiphuc@gmail.com---website-project%20(1)/services/api.ts) da co:

- `getAllPatients()`
- `getDoctorDetails()`
- `getAllProductOrders()`
- `getOrderLifecycleLogs(orderId)`
- `transitionOrderStatus(orderId, toStatus, note)`
- `createOrderRefund(...)`
- fetch user profile + appointments + orders

Tuc la phan van hanh co san, nhung phan tong hop KPI va bao cao chua duoc dong goi thanh lop metrics.

## 3. Nguyen tac thiet ke dashboard

### 3.1. Khong tinh KPI nang trong React

Khong nen de frontend tu:

- map toan bo orders
- reduce tren hang nghin records
- tinh doanh thu va cohort trong browser

Can dua metric ve Supabase bang:

- `views` cho list/tong hop de doc
- `rpc` cho KPI co tham so ngay thang, branch, status
- co the them `materialized view` neu ve sau du lieu lon

### 3.2. Tach 3 lop du lieu

1. `Operational real-time`
- don moi
- lich hen moi
- ton kho canh bao
- don tre chua xu ly

2. `Daily business metrics`
- doanh thu
- so don
- AOV
- refund
- khach moi / quay lai

3. `Analytical deep dive`
- cohort
- san pham ban chay
- performance theo thuong hieu
- service revenue mix
- conversion funnel

### 3.3. Role va quyen

- `master_admin`: xem toan bo
- `admin`: xem operational + business
- `doctor`: chi xem metrics lien quan lich hen, lich dieu tri, khong xem tai chinh full neu khong duoc cap quyen

Khuyen nghi: dashboard metrics chi mo cho `admin` va `master_admin`.

## 4. Cau truc dashboard de xay

### 4.1. Tang 1: Executive Overview

Day la trang `/adminDashboard` moi, dung thay cho trang menu don gian hien tai, nhung van giu cac link dieu huong cu.

#### KPI cards dau trang

Trong 7 ngay / 30 ngay / tuan nay / thang nay:

- doanh thu thuan
- tong so don hang
- AOV
- so don chua xu ly
- ti le thanh toan thanh cong
- tong tien hoan
- so lich hen moi
- so khach hang moi

#### Charts chinh

- doanh thu theo ngay
- so don theo ngay
- lich hen theo ngay
- co cau doanh thu: san pham vs dich vu
- co cau thanh toan: COD vs bank transfer

#### Action strip

- don moi can xu ly
- lich hen hom nay
- san pham sap het hang
- refund dang cho xu ly

### 4.2. Tang 2: Orders Operations

Muc tieu: thay cho admin nha thuoc viec phai mo list order roi moi biet tinh hinh.

#### Blocks can co

- pending orders
- processing / shipped / completed / cancelled
- paid / unpaid / refunded
- don GHTK gap loi / chua tao van don
- top don gia tri cao trong 7 ngay

#### Bang van hanh don hang

Cot khuyen nghi:

- ma don
- thoi gian tao
- khach hang
- so dien thoai
- so mat hang
- tong thanh toan
- payment status
- fulfillment status
- shipping provider
- shipping code
- discount code
- tax amount
- hanh dong nhanh

#### Bo loc can co

- date range
- payment status
- fulfillment status
- shipping provider
- discount code
- province / district
- guest order vs logged-in order

### 4.3. Tang 3: Business Report

#### Chi so bat buoc

- gross merchandise value
- net revenue
- discount amount
- tax collected
- shipping revenue
- refund amount
- paid orders count
- cancelled orders count
- refunded orders count
- average items per order
- AOV

#### Phan tich chuyen sau

- revenue theo category
- revenue theo brand
- revenue theo product
- revenue theo payment method
- revenue theo province
- revenue theo source funnel neu du lieu `funnel_events` du

#### Bao cao thang

Can co khu xuat file:

- bao cao doanh thu thang
- VAT/tax summary
- order export CSV/XLSX
- refund report

### 4.4. Tang 4: Customer Dashboard

Day la phan user management business-oriented, khong chi la list account.

#### KPI

- tong khach hang
- khach hang moi 7/30 ngay
- khach quay lai
- khach co ca mua hang va dat lich
- khach hang ngu dong > 60 ngay
- top customers theo doanh thu

#### Phan nhom

- chi mua san pham
- chi dat lich dich vu
- vua mua san pham vua dat lich
- khach guest order
- khach co thanh toan thanh cong
- khach co refund / cancel nhieu

#### Bang customer intelligence

Cot khuyen nghi:

- ten
- email
- phone
- ngay tao
- tong so don
- tong chi tieu
- don gan nhat
- so lich hen
- lan hoat dong gan nhat
- segment

#### Tinh nang

- tim khach VIP
- tim khach sap roi bo
- tim khach moi chua mua lan 2

### 4.5. Tang 5: Service / Appointment Dashboard

#### KPI

- lich hen moi hom nay
- lich hen dang cho
- lich hen da xac nhan
- lich hen hoan tat
- lich hen huy
- ti le no-show neu sau nay them trang thai

#### Bao cao dich vu

- so lich hen theo service
- top service theo nhu cau
- top doctor theo so ca
- doanh thu dich vu neu invoice co du lieu
- lead-to-appointment conversion neu co event

#### Bang hom nay

- lich hen hom nay theo khung gio
- bac si
- dich vu
- ten khach
- trang thai
- ghi chu

### 4.6. Tang 6: Inventory / Pharmacy Control

Phan nay mo rong tu admin pharmacy hien co.

#### KPI

- san pham dang ban
- san pham an
- sap het hang
- het hang
- sap het han
- gia tri ton kho uoc tinh

#### Bao cao

- top selling products 7/30/90 ngay
- low stock urgency
- stock aging
- products with zero sales
- brand performance
- category performance

### 4.7. Tang 7: Alerts & Exceptions

Mot dashboard tot phai chi ra viec can lam ngay.

#### Alert feed

- don pending > 2h chua xu ly
- order paid nhung chua tao van don
- shipping loi GHTK
- product out of stock nhung van dang published
- refund pending > 24h
- appointment pending khong co doctor
- customer tao nhieu don huy

#### Muc tieu

Admin mo dashboard la thay ngay hang doi cong viec, khong chi thay so dep.

## 5. Data model can them cho dashboard

### 5.1. Views / RPC uu tien

#### `admin_kpi_snapshot(p_from, p_to)`

Tra ve 1 row tong hop:

- total_orders
- paid_orders
- pending_orders
- completed_orders
- cancelled_orders
- refunded_orders
- gross_revenue
- net_revenue
- discount_total
- tax_total
- shipping_total
- refund_total
- average_order_value
- new_customers
- returning_customers
- appointments_total
- appointments_pending
- appointments_completed

#### `admin_orders_timeseries(p_from, p_to, p_granularity)`

Tra ve series theo `day` / `week`:

- bucket_date
- order_count
- paid_order_count
- gross_revenue
- net_revenue
- refund_total

#### `admin_order_status_breakdown(p_from, p_to)`

- fulfillment_status
- payment_status
- count
- amount

#### `admin_customer_metrics(p_from, p_to)`

Theo customer:

- patient_id
- name
- email
- phone
- total_orders
- total_spent
- avg_order_value
- first_order_at
- last_order_at
- appointments_count
- last_appointment_at
- segment

#### `admin_inventory_metrics()`

- total_products
- published_products
- low_stock_count
- out_of_stock_count
- near_expiry_count
- inventory_estimated_value

#### `admin_product_performance(p_from, p_to)`

- product_id
- product_name
- category_name
- brand
- units_sold
- gross_revenue
- net_revenue
- refund_amount

#### `admin_service_performance(p_from, p_to)`

- service_id
- service_name
- appointment_count
- completed_count
- cancelled_count
- revenue_if_available

#### `admin_alert_feed()`

Tra ve list canh bao co severity:

- id
- type
- severity
- title
- description
- ref_type
- ref_id
- created_at

### 5.2. Bang / truong nen them sau

Khong can them ngay trong phase 1, nhung nen co trong roadmap:

- `appointments.confirmed_at`
- `appointments.completed_at`
- `appointments.cancelled_at`
- `appointments.no_show_reason`
- `patients.last_seen_at`
- `product_orders.source_channel`
- `product_orders.utm_*` neu muon doc marketing
- `appointments.source_channel`

Neu khong them cac truong nay, van lam duoc dashboard co ban, nhung khong di sau ve cohort va attribution.

## 6. UI layout de xay

### 6.1. Thong tin cau truc man hinh

#### Header filter chung

- date range picker
- so sanh voi ky truoc
- reset filters
- export

#### Tab dashboard

- Tong quan
- Don hang
- Doanh thu
- Khach hang
- Dich vu
- Kho hang
- Canh bao

Dashboard khong nen tach thanh nhieu page rieng tu dau. Nen lam mot admin dashboard co tabs lon de giu context.

### 6.2. Component can tai su dung

- KPI card
- trend chip: `+12.4% vs ky truoc`
- empty state
- loading skeleton
- alert row
- chart card
- filter bar
- export action bar

### 6.3. Visual priorities

- hang 1: KPI cards
- hang 2: 2 chart lon
- hang 3: alert feed + operational queue
- hang 4: bang top products / top customers / top services

## 7. Bao cao kinh doanh chi tiet can co

### 7.1. Bao cao ngay

- doanh thu hom nay
- don moi hom nay
- don dang tre
- lich hen hom nay
- ton kho canh bao hom nay

### 7.2. Bao cao tuan

- doanh thu theo ngay
- AOV
- ty le paid
- ty le refund
- top 10 san pham
- top 5 dich vu

### 7.3. Bao cao thang

- tong doanh thu
- net doanh thu sau refund
- tong thue
- tong giam gia
- top brand
- top category
- khach hang moi / quay lai
- danh sach 20 khach chi tieu cao nhat

### 7.4. Bao cao tai chinh

- tong tien da thu
- tong tien chua thu
- tong tien hoan
- tong tien COD vs bank transfer
- tong tax/VAT

## 8. Bao cao khach hang chi tiet

### 8.1. Segmentation logic

- `new_customer`: co don dau tien trong ky
- `returning_customer`: co hon 1 don
- `service_only_customer`: co lich hen, khong co order
- `product_only_customer`: co order, khong co lich hen
- `hybrid_customer`: co ca hai
- `vip_customer`: tong chi tieu vuot threshold
- `at_risk_customer`: 60 ngay khong co order/appointment

### 8.2. KPI customer

- total_customers
- customers_with_orders
- customers_with_appointments
- hybrid_customers
- guests_to_registered_ratio
- repeat_purchase_rate

## 9. Realtime strategy

### 9.1. Realtime cho operational cards

Dung Supabase realtime subscriptions cho:

- `product_orders`
- `appointments`
- `order_refunds`

Muc tieu:

- card `don moi`
- `lich hen moi`
- `pending queue`
- `alerts`

duoc cap nhat ngay khi co insert/update.

### 9.2. Polling cho analytics

Chart va KPI tong hop khong can realtime theo tung giay.

Khuyen nghi:

- refresh thu cong
- auto refresh 60-120s
- tinh toan trong RPC/view

## 10. Ke hoach trien khai de xay that

### Phase 0: Data hardening

Muc tieu: khoa metric definitions truoc khi build UI.

Viec can lam:

- audit `appointments` statuses va timestamps
- audit `product_orders` totals / tax / refund consistency
- audit `patients` roles, guests, duplicate phone/email
- chot cong thuc:
  - gross revenue
  - net revenue
  - refund total
  - new customer
  - returning customer

Deliverables:

- tai lieu metric definitions
- danh sach anomalies
- danh sach field can them sau

### Phase 1: KPI foundation

Muc tieu: co du lieu tong hop de UI goi.

Viec can lam:

- tao `admin_kpi_snapshot`
- tao `admin_orders_timeseries`
- tao `admin_inventory_metrics`
- tao `admin_customer_metrics`
- tao `admin_alert_feed`
- them API wrappers trong `services/api.ts`

Deliverables:

- data layer dung duoc
- test query theo ngay
- benchmark response time

### Phase 2: Admin dashboard UI v1

Muc tieu: thay `AdminDashboardPage` tu menu card thanh dashboard that.

Viec can lam:

- KPI cards
- 2 chart lon
- alert feed
- order queue
- navigation cards giu lai o cuoi trang

Deliverables:

- usable dashboard home
- mobile/tablet layout on dinh

### Phase 3: Business report modules

Muc tieu: them cac tab bao cao chuyen sau.

Viec can lam:

- orders analytics tab
- revenue tab
- customer tab
- service tab
- inventory tab

Deliverables:

- export CSV/XLSX
- saved filters
- compare previous period

### Phase 4: Alerts & automation

Muc tieu: dashboard khong chi hien so ma con day viec can xu ly.

Viec can lam:

- alert severity
- SLA cho order pending / refund pending
- color coding
- quick actions

### Phase 5: Optimization

Muc tieu: dashboard nhanh khi du lieu lon.

Viec can lam:

- materialized views neu can
- incremental refresh
- cache layer trong worker neu can
- background rebuild jobs

## 11. Tieu chi nghiem thu

Dashboard chi duoc xem la xong phase 1-2 khi:

- mo admin dashboard thay KPI trong < 2 giay
- metric card va data export khop nhau
- orders/appointments moi xuat hien trong alert feed trong <= 5 giay
- co the loc theo date range va cac loc chinh ma khong loi
- admin co the xuat bao cao ngay / thang

## 12. Rủi ro chinh va cach tranh

### Rủi ro 1: KPI khong khop

Nguyen nhan:

- lay status sai
- tinh doanh thu gross/net sai
- tinh refund 2 lan

Giai phap:

- metric definitions ro rang
- unit test cho RPC
- 1 nguon cong thuc duy nhat

### Rủi ro 2: Frontend qua nang

Nguyen nhan:

- keo full orders list vao browser de reduce

Giai phap:

- aggregate trong SQL
- pagination cho bang lon

### Rủi ro 3: Du lieu dich vu chua du

Nguyen nhan:

- appointments chua co enough timestamps / status history

Giai phap:

- phase 0 audit
- bo sung fields toi thieu truoc khi so sau

## 13. Thu tu xay dung toi de xuat

Neu lam ngay bay gio, thu tu dung nhat la:

1. audit metric definitions
2. tao RPC/views tong hop
3. build `Tong quan`
4. build `Don hang`
5. build `Khach hang`
6. build `Dich vu`
7. build `Kho hang`
8. them exports va alerts

## 14. De xuat thuc thi ngay trong repo nay

### File UI se dong vao

- [components/AdminDashboardPage.tsx](/Users/PHUC/Downloads/32-kiến-trúc-mới-fullstack-iskin-clinic-+-supabase-ở-account-hovidaiphuc@gmail.com---website-project%20(1)/components/AdminDashboardPage.tsx)
- [App.tsx](/Users/PHUC/Downloads/32-kiến-trúc-mới-fullstack-iskin-clinic-+-supabase-ở-account-hovidaiphuc@gmail.com---website-project%20(1)/App.tsx)
- co the them:
  - `components/admin-dashboard/*`

### File data layer se dong vao

- [services/api.ts](/Users/PHUC/Downloads/32-kiến-trúc-mới-fullstack-iskin-clinic-+-supabase-ở-account-hovidaiphuc@gmail.com---website-project%20(1)/services/api.ts)
- [types.ts](/Users/PHUC/Downloads/32-kiến-trúc-mới-fullstack-iskin-clinic-+-supabase-ở-account-hovidaiphuc@gmail.com---website-project%20(1)/types.ts)
- `supabase/migrations/*_admin_dashboard_*.sql`

### Viec nen lam ngay trong wave dau tien

1. tao `admin_kpi_snapshot`
2. tao `admin_orders_timeseries`
3. tao `admin_inventory_metrics`
4. tao `admin_alert_feed`
5. build dashboard top-level voi KPI + chart + alert + queue

Neu lam dung thu tu nay, dashboard se co gia tri van hanh ngay tu dot dau, thay vi mat nhieu thoi gian vao chart dep nhung chua giai quyet bai toan admin.
