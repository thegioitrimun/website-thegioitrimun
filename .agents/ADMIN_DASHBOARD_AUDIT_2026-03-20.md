# Admin Dashboard Audit

- Project ref: `vjowphilfeoqesvcfqnb`
- Generated at: `2026-05-08T08:31:59.825Z`
- Total anomaly findings: **24**

## Summary

| total_customers | total_orders | paid_orders | pending_orders | total_appointments | published_products | gross_revenue | refund_total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 14 | 59 | 0 | 22 | 6 | 301 | 0 | 0 |

## Anomaly Counts

| check_name | finding_count |
| --- | --- |
| orders_missing_total | 0 |
| paid_orders_without_payment_logs | 0 |
| pending_orders_older_than_2h | 22 |
| appointments_missing_doctor_or_service | 0 |
| published_products_out_of_stock | 0 |
| published_products_low_stock | 1 |
| duplicate_customer_emails | 0 |
| duplicate_customer_phones | 1 |

## Pending Orders Older Than 2 Hours

| order_code | customer_name | customer_phone | created_at |
| --- | --- | --- | --- |
| DRHAPPYPI61CFF86A | Thế Giới Trị Mụn | 0934086843 | 2026-04-03 09:22:17.022116+00 |
| DRHAPPYPIE6297261 | Thế Giới Trị Mụn | 0934086843 | 2026-04-03 09:23:03.304971+00 |
| DRHAPPYPI6B76FCE4 | Thế Giới Trị Mụn | 0934086843 | 2026-04-17 10:32:43.62522+00 |
| DRHAPPYPI99EA8A5E | Dr. Happy | 0934086843 | 2026-04-17 14:15:15.410432+00 |
| DRHAPPYPI57D3E2AE | Dr. Happy | 0934086843 | 2026-04-17 14:17:54.523939+00 |
| DRHAPPYPID5A3794B | Thế Giới Trị Mụn | 0934086843 | 2026-04-17 14:20:53.355918+00 |
| DRHAPPYPI734000D8 | Thế Giới Trị Mụn | 0934086843 | 2026-04-17 14:21:45.364267+00 |
| DRHAPPYPI4C28B6AC | Thế Giới Trị Mụn | 0934086843 | 2026-04-17 14:22:57.300395+00 |
| DRHAPPYPI56D95C63 | Thế Giới Trị Mụn | 0934086843 | 2026-04-17 14:24:15.938738+00 |
| DRHAPPYPI2B86FD23 | Dr. Happy | 0934086843 | 2026-04-17 14:43:17.666441+00 |

## Appointment Drilldown Spot Check

| rows_count | pending_count | billed_count |
| --- | --- | --- |
| 6 | 2 | 0 |
