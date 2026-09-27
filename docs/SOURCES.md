# Research and source inventory

Reviewed September 26, 2026. Hartford's main service directory had 43 entries across five pages. The application paraphrases those descriptions in English and Spanish; it does not reproduce their interface or claim official endorsement.

## Official service sources

- [Hartford 311 directory](https://www.hartfordct.gov/Government/Departments/Public-Works/Hartford-311): scope, 43 services, telephone 860-757-9311, weekdays 8 a.m.–5 p.m., and City Hall address 550 Main Street, Suite 001, Hartford CT 06103. Browse all five pages for the complete inventory.
- [Tree emergency guidance](https://www.hartfordct.gov/Government/Departments/Public-Works/Forestry/Report-a-Tree-Emergency): linked directly for urgent tree reports rather than inventing an emergency dispatch promise.
- [Existing Accela record lookup](https://aca-prod.accela.com/HARTFORD/Default.aspx): separate official system, not integrated with this demo.

Every `lib/services.ts` entry contains a stable application ID, group, English and Spanish title, descriptions, urgency flag, and source URL. These 43 entries are the machine-readable source inventory:

| Group | Included services |
|---|---|
| Streets and sidewalks (7) | Blocked sidewalk/crosswalk; dead animal in roadway; pothole/sidewalk/curb repair; sneakers on power lines; snow removal violation; leaf bags/flooding/manhole covers/street sweeping; streetlight/utility pole repair |
| Waste (4) | Replacement bin; illegal dumping; trash/recycling violation; missed collection |
| Property and housing (9) | Apartment non-urgent; apartment urgent; blighted property; zoning violation; nuisance vehicle on property; lawn parking; overgrown vegetation; building non-urgent; building urgent |
| Health and neighborhood (8) | Weights/measures; hotel bed bugs; outdoor rodents; restaurant health; livestock; loud noise; standing water; plastic bag ban |
| Parking and traffic (9) | Abandoned roadway vehicle; VEO scooters/bikes; parking/meters/trailer trucks; traffic violations; accessible parking sign; traffic calming; traffic sign repair; traffic signal repair; new signs/markings |
| Trees (2) | Non-urgent tree service; urgent tree service |
| Parks and public spaces (4) | City-property graffiti; parks/cemeteries; bus shelter; public trash can |

The exact count is asserted in automated tests; see the catalog for authoritative application grouping. Group names are our usability organization, not a claim about city departmental ownership.

Important routing: bulky-waste collection must be scheduled by telephone (860-757-9311 or Public Works 860-757-9983); city-property graffiti is distinct from private-property blight; replacement bins and curbside trash violations have 1–6-family eligibility; essential housing service losses are urgent. No promised response/resolution times are invented.

## Design and implementation references

- [CT.gov](https://portal.ct.gov/) and [official color standards](https://portal.ct.gov/sitecore-center/standards/colors): solid dark blue #00214D, blue #1F64E5, white/gray, strong headings, service-first navigation. No state seal or official-site label is used.
- [Car Craft public site](https://carcraftautobodytowing.com/): guided customer information/photo submission. Local `car-craft/script.js` and `-admin-carcraft/src/components/EstimateLeads.jsx` informed step navigation, photos, notes, and staff review. No customer data, secrets, or proprietary imagery was copied.
- Local `empire-elite-rides/convex/quotes.ts` and `booking.js`: confirmed Geoapify autocomplete/reverse geocoding and browser location. This app adds Leaflet pin placement rather than claiming the reference already had a draggable map.
- [Geoapify maps](https://apidocs.geoapify.com/docs/maps/) and [geocoding](https://apidocs.geoapify.com/docs/geocoding/api): provider APIs and attribution.
- [Convex file security](https://docs.convex.dev/file-storage/overview), [serving files](https://docs.convex.dev/file-storage/serve-files), [Clerk integration](https://docs.convex.dev/auth/clerk), [best practices](https://docs.convex.dev/understanding/best-practices), and [limits](https://docs.convex.dev/production/state/limits).
- [Clerk sign-in/MFA configuration](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options).

Spanish copy is implemented throughout the resident experience. Before official launch, have city staff and a qualified Spanish-language reviewer approve service names, emergency guidance, and privacy wording.


## Cloudflare rewrite references

- [D1 transactions and batches](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Access JWT verification](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Access independent MFA](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/independent-mfa/)
- [Images binding and local testing](https://developers.cloudflare.com/images/optimization/binding/)
- [Private R2 object storage](https://developers.cloudflare.com/r2/)
- [Workers static asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)

Earlier Convex references above document the original research; the implemented backend was replaced with Cloudflare at the user's request. No private data from the reference projects was migrated.
