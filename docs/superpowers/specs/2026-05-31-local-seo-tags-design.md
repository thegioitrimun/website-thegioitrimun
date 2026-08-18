# Local SEO Tags Design

## Goal

Attach relevant Phu Quoc dermatology search tags directly to existing blog posts and services without creating a new landing page or stuffing every keyword into every page.

## Scope

- Add `local_seo_tags text[]` to `blog_posts` and `services`.
- Keep at most five relevant tags on each record.
- Render public hashtag chips after blog and service content.
- Include tags in browser SEO metadata and worker prerender HTML.
- Allow admins to edit the tags as comma-separated phrases.
- Backfill existing records with deterministic matching against title, summary, content, description and benefits.

## Taxonomy

The supported phrases are:

1. `phòng khám da liễu phú quốc`
2. `trị mụn phú quốc`
3. `bác sĩ da liễu phú quốc`
4. `khám da liễu ở đâu phú quốc`
5. `dị ứng hải sản phú quốc`
6. `trị nám tàn nhang phú quốc`
7. `cháy nắng biển phú quốc`
8. `thuốc bôi dị ứng phú quốc`
9. `spa chăm sóc da phú quốc`
10. `bắn tàn nhang ở phú quốc`
11. `khám da liễu bệnh viện phú quốc`
12. `thuốc trị sứa lửa cắn phú quốc`
13. `kem chống nắng đi biển phú quốc`
14. `trị mụn lưng phú quốc`

## Matching Rules

- Normalize Vietnamese accents and punctuation before matching.
- Add topic tags only when the content contains a matching signal.
- Add local clinic discovery tags only to dermatology-oriented pages after topic matching.
- Preserve admin-entered tags when they belong to the supported taxonomy.
- De-duplicate tags and cap the public list at five entries.
- Do not add unsupported phrases or all fourteen phrases to every record.

## Rendering

- Blog details show tags beneath the editorial body.
- Service details show tags beneath the primary service content.
- Tags are visible chips, not links. This keeps the page readable without generating thin query-string crawl paths.
- Blog browser SEO appends tags to article tag metadata.
- Worker blog JSON-LD appends tags to `keywords` and `about`.
- Worker service JSON-LD appends tags to `keywords` and renders a prerender section.

## Data Backfill

The backfill script obtains a temporary service-role key through the Supabase Management API, reads all existing blog posts and services, infers tags through the shared taxonomy module and patches only changed rows.

## Verification

- Unit tests verify normalization, classification, deduplication and the five-tag limit.
- TypeScript build verifies frontend integration.
- Supabase migration and backfill output verify persisted row counts.
- Googlebot detail smoke tests verify worker prerender remains functional.
