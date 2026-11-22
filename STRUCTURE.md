# Coffret & Cie site structure

The build generates a static French-language B2B product catalogue.

## Public indexable routes

- `/` and `/page/<n>/`: main catalogue pagination
- `/collections/<family>/` and `/collections/<family>/page/<n>/`: product-family pagination
- `/produits/<product>/`: product detail pages
- `/aide/`: customer support and ordering information
- `/catalogue-pdf/`: catalogue PDF landing page

Every public HTML route has a self-referencing HTTPS canonical URL and is included once in `/sitemap.xml`.

## Non-indexable route

- `/devis/`: client-side quote workspace; crawlable links remain available, but the page is excluded from search indexing and from the sitemap.

## Crawler discovery

- `/robots.txt`: allows general search crawlers plus named AI search, user-triggered and training crawlers; advertises the sitemap.
- `/sitemap.xml`: generated from the same route set as the HTML build.
- `/llms.txt`: concise catalogue discovery file for compatible AI clients.

Set `CATALOG_ORIGIN` to the production HTTPS origin when building for a custom domain. The build rejects origins containing a path, query, credentials, or fragment.
