# SEO_AUDIT_LIVE

## Summary
- Base URL: [https://thegioitrimun.vn](https://thegioitrimun.vn)
- Generated at: `2026-05-01T17:16:00.247Z`
- URLs audited: `10`
- Sitemap parity sampled: `40`
- Control audited: `/dang-nhap?lang=ru`
- Blocking findings: `0`
- Informational notes: `1`

## Findings
- No blocking SEO regressions found in the audited URLs.

## Informational Notes
- Product Detail: INFO: No live reviewed product found in sampled sitemap URLs; review-object path not observable on production data

## URL Matrix
| URL | HTTP | Canonical | OG Locale | JSON-LD | Notes |
| --- | --- | --- | --- | --- | --- |
| Home | 200 | `https://thegioitrimun.vn/` | `vi_VN` | WebPage, MedicalClinic, WebSite, CollectionPage, FAQPage | OK |
| Products List | 200 | `https://thegioitrimun.vn/san-pham` | `vi_VN` | BreadcrumbList, WebPage, CollectionPage, ItemList | OK |
| Product Category | 200 | `https://thegioitrimun.vn/san-pham/duoc-pham` | `vi_VN` | BreadcrumbList, WebPage, CollectionPage, ItemList | OK |
| Product Detail | 200 | `https://thegioitrimun.vn/san-pham/tinh-chat-dac-tri/gel-tri-mun-klenzit-ms-0-1` | `vi_VN` | BreadcrumbList, WebPage, Product, FAQPage | INFO: No live reviewed product found in sampled sitemap URLs; review-object path not observable on production data |
| Blog List | 200 | `https://thegioitrimun.vn/kien-thuc` | `vi_VN` | BreadcrumbList, WebPage, CollectionPage, ItemList | OK |
| Blog Category | 200 | `https://thegioitrimun.vn/kien-thuc/cham-soc-da` | `vi_VN` | BreadcrumbList, WebPage, CollectionPage, ItemList | OK |
| Blog Detail | 200 | `https://thegioitrimun.vn/kien-thuc/dieu-tri-mun/kem-tron-tri-mun-co-nen-dung-khong-6-tac-hai-khon-luong` | `vi_VN` | BreadcrumbList, WebPage, BlogPosting | OK |
| Services List | 200 | `https://thegioitrimun.vn/dich-vu` | `vi_VN` | BreadcrumbList, WebPage, CollectionPage, ItemList | OK |
| Service Detail | 200 | `https://thegioitrimun.vn/dich-vu/dieu-tri-mun-chuyen-sau` | `vi_VN` | BreadcrumbList, WebPage, MedicalProcedure, FAQPage | OK |
| About (RU) | 200 | `https://thegioitrimun.vn/ve-chung-toi?lang=ru` | `ru_RU` | BreadcrumbList, WebPage, AboutPage, MedicalClinic | OK |

## Sitemap Canonical Parity
- Sampled URLs: `40`
- OK. Sampled sitemap URLs resolve directly to their own canonical URLs.

## Private Route Control
| Control | HTTP | Canonical | Meta Robots | X-Robots-Tag | Result |
| --- | --- | --- | --- | --- | --- |
| `https://thegioitrimun.vn/dang-nhap?lang=ru` | 200 | `https://thegioitrimun.vn/dang-nhap?lang=ru` | `noindex, nofollow, noarchive` | `noindex, nofollow, noarchive` | OK |

## Notes
- Audit executed with both Googlebot and Facebook crawler user-agents.
- Canonical, hreflang, JSON-LD, robots, and OG parity were checked on live responses.
- Locale content quality still depends on translated content existing in Supabase rows; hreflang alone does not translate copy.
