# HTTPS origin benchmark

This mode replays a captured site and provider fixtures under its HTTPS origin
for Lighthouse measurement and attribution. Budgets remain unchanged.

The server binds an ephemeral port on 127.0.0.1; Chrome maps the selected
hostname's port 443 to that port. Ephemeral loopback binding avoids requiring port 443 availability.
A fresh private key is generated per campaign in a 0700 temporary directory,
reused for its attempts, and removed on normal exit or handled SIGINT/SIGTERM.
The SPKI flag disables all certificate checks for that key, including hostname
checks. Key secrecy, cleanup, and the resolver mapping are controls.
Negative navigation tests demonstrate proxy refusal; resolver containment remains independently unverified.
This mode is not a sandbox for untrusted pages; independent egress isolation
is still assumed.

Redirected captures replay their terminal response at the original URL; they
do not reproduce redirect timing or destination semantics. Lighthouse counts
fixture-fulfilled bodies as transfer bytes: model bytes, not provider wire
traffic. Native lazy iframes may load during measurement; the separate probe
checks the embed after the measured navigation.

The server uses HTTP/1.1 and the HTTPS URL makes the Lantern model include TLS.
Numbers are not interchangeable with HTTP-loopback mode or production h2.

```sh
node scripts/perf/lighthouse-rate-safe.mjs --self-test
node scripts/perf/lighthouse-rate-safe.mjs --https-selftest
node scripts/perf/lighthouse-rate-safe.mjs --target-dir SITE --label replay --out OUTPUT --origin https://f1-stories.gr --routes Article --article ARTICLE_ID --manifest MANIFEST --expect-betcast
```
