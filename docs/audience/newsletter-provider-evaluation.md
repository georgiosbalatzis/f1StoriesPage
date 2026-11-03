# Newsletter provider evaluation (A-06)

Status: research only, 2026-11-03 UTC, base `8af4f09e5`. **No provider is selected, purchased, connected or configured.**
Provider selection is an explicit [owner decision](newsletter-activation-checklist.md#owner-decisions). Nothing here is
legal advice. A DPA or transfer finding below is a pointer for the reviewer named in the checklist, not a conclusion.

## Method

- Candidates: Brevo, MailerLite, Buttondown. They are research candidates, not approved providers.
- Sources: official provider pages (pricing, help centre, API docs, legal). All were read on 2026-11-03. Some pricing
  pages render prices only in the browser. Where an official page showed no figure, the figure comes from third-party
  reviews dated 2026 and is marked **(3P)**. Re-verify every **(3P)** figure on the provider's own page before deciding.
- "Not verified" means the official material we read did not establish the claim. It does not mean the feature is absent.
- Requirements come from this site's constraints: static GitHub Pages hosting, no backend, a strict per-route CSP
  ([`scripts/build/security-policy.mjs`](../../scripts/build/security-policy.mjs)), Greek-language readers mostly in
  the EU, a weekly editorial cadence ([A-05](briefings.md)) and a single operator.

## Comparison matrix

| Criterion | Brevo | MailerLite | Buttondown |
| --- | --- | --- | --- |
| Operator / HQ | Brevo SAS, France | MailerLite (UAB), Lithuania | Buttondown LLC, United States |
| Free tier: contacts | Up to 100,000 stored contacts **(3P)** | 250 subscribers (cut in June 2026) [pricing][ml-price] | 100 subscribers **(3P)** |
| Free tier: sending | 300 emails/day, no rollover **(3P)**. A 300+ list cannot get one weekly issue in a single day. | 2,500 emails/month [pricing][ml-price] | Priced for at most one email a day to the whole list [pricing][bd-price] |
| Paid entry | Starter from about $9/mo for 5,000 emails/mo **(3P)** | Comfort from $12/mo, Power from $25/mo [pricing][ml-price] | Basic about $9/mo for up to 1,000 subscribers **(3P)**. Tagging +$9/mo, automations +$29/mo [pricing][bd-price] |
| Free-tier branding | Brevo logo in emails **(3P)** | Logo removal only on paid plans [pricing][ml-price] | Not verified |
| Double opt-in | Native setting on Brevo-built forms. External forms need a DOI automation. A `DOUBLE_OPT-IN` attribute records the result. [form][br-form], [external DOI][br-doi-ext] | On by default for forms. A separate account toggle covers API/integrations. Unconfirmed subscribers stay "Unconfirmed". [DOI][ml-doi], [unconfirmed][ml-unconf] | Mandatory by default. API-created subscribers start as `unactivated` until they confirm. [API][bd-api], [regulations][bd-reg] |
| Unsubscribe | Provider-managed. Not deep-verified here. | Provider-managed. Not deep-verified here. | Terminal `unsubscribed` type; `blocked` / `complained` / `undeliverable` are sticky. [API][bd-api] |
| Preferences | Profile-update form for contact attributes and lists [profile][br-profile] | Groups. Not deep-verified here. | Tags, paid add-on [tags][bd-tags] |
| Provider-hosted / embed forms | iFrame on `sibforms.com` (recommended), full HTML with JS, or "Simple HTML" with no JS. CAPTCHA requires JS. [form][br-form] | JavaScript snippet or HTML embed, plus hosted landing page [embed][ml-embed] | Plain HTML `POST` to `https://buttondown.com/api/emails/embed-subscribe/{username}`. The docs advise a native form post, not `fetch`. [subscriber base][bd-embed] |
| Browser-side key exposure | Embed needs no API key. The API key is server-only. | Embed needs no API key. The API key is server-only. | Embed needs no API key. API `Authorization: Token` is server-only. [API][bd-api] |
| CSP impact (future) | `frame-src` or `form-action` for the account's `sibforms.com` origin. Known only after the account exists. | `script-src` + `connect-src` for its form hosts. Not verified; the host list is unknown. | `form-action https://buttondown.com`; no script needed for the plain form |
| GDPR / DPA | DPA is Appendix 3 of the Terms: Brevo is processor. Uses the EU–US DPF/SCCs for US transfers. [DPA][br-dpa], [GDPR][br-gdpr] | DPA is part of the Terms of Use: MailerLite is processor. Breach notice within 48 h. [DPA][ml-dpa], [GDPR][ml-gdpr] | DPA refreshed March 2026, with a processing annex and a GDPR precedence clause [legal refresh][bd-legal] |
| Hosting region | EU: Google Cloud Belgium, OVH France/Germany. Some sub-processors are EU/USA. [GDPR][br-gdpr], [storage][br-storage] | EU: Google Cloud Netherlands (new) / Germany (classic). The DPA allows processing wherever sub-processors operate. [DPA][ml-dpa] | United States: AWS `us-west-2` (Oregon). Sub-processors mostly US (list updated 2026-10-28). [sub-processors][bd-sub] |
| International transfer | Primary hosting in the EU; residual US sub-processors | Primary hosting in the EU; worldwide clause in the DPA | Every subscriber record leaves the EU. A transfer assessment is needed. |
| Consent proof | `DOUBLE_OPT-IN` attribute; other proof fields not verified | Records IP, location, date/time and source form for its own forms [GDPR][ml-gdpr] | Not verified |
| Retention / deletion | Not verified in depth | "Forget" wipes a subscriber; "Delete" may not be complete (pages conflict) [GDPR][ml-gdpr] | Not verified |
| Suppression | Not verified | Not verified | Sticky terminal types (see unsubscribe) [API][bd-api] |
| Abuse prevention | reCAPTCHA / Turnstile on forms (needs JS) [CAPTCHA][br-captcha] | Not verified | Provider-side CAPTCHA/validation after the form post [subscriber base][bd-embed] |
| Export / migration | Not verified | Not verified | Full API [API][bd-api] |
| Deliverability / domain auth | Sender domain authentication expected. Not verified here. | A valid sender address is required or confirmations do not send [DOI][ml-doi] | Custom sending domain on the base plan [pricing][bd-price] |
| Aggregate reporting | Not verified | Not verified | Not verified |
| Operational complexity | Medium: forms, DOI automation for external forms, daily caps | Medium: forms + JS embed, API DOI toggle | Low: one plain form, DOI built in |
| Lock-in | Medium (automations, templates) | Medium (automations, groups) | Low (Markdown issues, simple API) |

## Assessment against this site

1. **Static host and CSP.** All three can work without our own backend, because the provider hosts the subscription
   endpoint and sends the confirmation. A plain HTML form post with no third-party script fits the current CSP pattern
   best. Activation would add one exact `form-action` origin. Buttondown's documented embed and Brevo's
   "Simple HTML" form both work this way. MailerLite's documented embed is script-based, which expands `script-src`.
2. **Data location.** Brevo and MailerLite host subscriber data in the EU. Buttondown hosts it in the US. For a
   Greek-language audience this is the most material legal difference. The reviewer decides whether it matters.
3. **Volume.** A weekly issue to an early list (well under 250) fits every free tier. Brevo's 300/day cap and
   MailerLite's 250-subscriber cap are the first limits the site would reach.
4. **Preferences.** At this stage the only real preference is "weekly briefing: yes/no", and unsubscribe expresses
   that. None of the providers needs category preferences yet (see [newsletter-a06.md](newsletter-a06.md#preferences-and-unsubscribe)).

## Preferred candidate (provisional, owner decides)

**Brevo**, with MailerLite as the close alternative.

- For: EU-headquartered and EU-hosted. Native double opt-in and a `DOUBLE_OPT-IN` record. A no-JavaScript "Simple HTML"
  form (one `form-action` origin, no third-party script). A profile-update form for later preferences. A free tier
  whose contact limit will not bind early.
- Against: the 300/day free cap, the free-tier logo, CAPTCHA requires JavaScript, and the exact form origin is
  per-account (a `sibforms.com` subdomain), so the CSP entry is known only after the account exists. Some
  sub-processors operate in the US.
- MailerLite would win if the owner prefers its consent-proof capture (IP/date/source) and accepts a JS embed and the
  250 cap. Buttondown would win on simplicity if the reviewer accepts US hosting.

## Unresolved questions (block activation)

1. Exact form origin(s) and whether the no-JS form gives a neutral response for new, duplicate and suppressed
   addresses (enumeration). Test on a sandbox account during the activation PR.
2. Consent-proof fields actually retained per contact (timestamp, policy version, source form), how to export them,
   and for how long.
3. Unconfirmed-contact expiry: how long pending contacts are kept and whether they are deleted automatically.
4. Unsubscribe and suppression semantics: whether an unsubscribed address can be re-added by a new form post, and
   whether that requires fresh double opt-in.
5. Greek-language confirmation and unsubscribe pages and emails (UTF-8 subject lines, editable copy on the chosen plan).
6. Sender-domain authentication (SPF/DKIM/DMARC) for `f1-stories.gr`, and who controls DNS.
7. Current prices and caps on the official pages (every **(3P)** figure above).
8. DPA acceptance mechanism, sub-processor list review and transfer assessment, by the reviewer named in the
   [activation checklist](newsletter-activation-checklist.md).

## Sources (read 2026-11-03)

Official pages, all read on 2026-11-03. The links in the matrix resolve to these:

- **Brevo:** [sign-up forms][br-form], [DOI for external forms][br-doi-ext], [profile update form][br-profile],
  [CAPTCHA][br-captcha], [GDPR][br-gdpr], [data storage][br-storage] (returned HTTP 403 to our fetcher; content
  summarised from the search index), [Terms incl. DPA Appendix 3][br-dpa], [pricing](https://www.brevo.com/pricing/)
  (prices are not in the static page).
- **MailerLite:** [pricing][ml-price], [double opt-in][ml-doi], [unconfirmed subscribers][ml-unconf],
  [add a form][ml-embed], [DPA][ml-dpa], [GDPR][ml-gdpr].
- **Buttondown:** [pricing][bd-price], [create subscriber API][bd-api], [email regulations][bd-reg],
  [subscriber base / embed][bd-embed], [tags][bd-tags], [legal refresh 2026-03-16][bd-legal],
  [sub-processors (updated 2026-10-28)][bd-sub].

Third-party pricing cross-checks **(3P)**: https://www.emailvendorselection.com/brevo-pricing/ ·
https://www.emailtooltester.com/en/reviews/mailerlite/pricing/ · https://www.trustradius.com/products/buttondown/pricing.

[br-form]: https://help.brevo.com/hc/en-us/articles/208771869-Create-a-sign-up-form-in-Brevo
[br-doi-ext]: https://help.brevo.com/hc/en-us/articles/27353832123026-Set-up-a-double-opt-in-process-for-a-sign-up-form-created-outside-of-Brevo
[br-profile]: https://help.brevo.com/hc/en-us/articles/360003644360-Update-your-contacts-details-and-preferences-profile-update-form
[br-captcha]: https://help.brevo.com/hc/en-us/articles/360019551939-Add-a-CAPTCHA-to-a-sign-up-form-created-in-Brevo
[br-gdpr]: https://help.brevo.com/hc/en-us/articles/360001258744-How-does-Brevo-comply-with-the-GDPR
[br-storage]: https://help.brevo.com/hc/en-us/articles/360001005510-Data-storage-location
[br-dpa]: https://www.brevo.com/legal/termsofuse/
[ml-price]: https://www.mailerlite.com/pricing
[ml-doi]: https://www.mailerlite.com/help/how-to-use-double-opt-in-when-collecting-subscribers
[ml-unconf]: https://www.mailerlite.com/help/what-are-unconfirmed-subscribers
[ml-embed]: https://www.mailerlite.com/help/how-to-add-a-form-to-your-website
[ml-dpa]: https://www.mailerlite.com/legal/data-processing-agreement
[ml-gdpr]: https://www.mailerlite.com/gdpr-compliance
[bd-price]: https://buttondown.com/pricing
[bd-api]: https://docs.buttondown.com/api-subscribers-create
[bd-reg]: https://docs.buttondown.com/glossary-email-regulations
[bd-embed]: https://docs.buttondown.com/building-your-subscriber-base
[bd-tags]: https://docs.buttondown.com/tags
[bd-legal]: https://buttondown.com/blog/2026-03-16-legal-docs-refresh
[bd-sub]: https://buttondown.com/legal/subprocessors
