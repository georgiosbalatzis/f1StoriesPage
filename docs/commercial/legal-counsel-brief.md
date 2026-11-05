# Legal and tax counsel brief: F1 Stories commercial readiness

**Prepared for** a qualified Greek lawyer (IP, consumer/advertising, media and gambling law) and a tax adviser.
**Prepared by** the B-01 audit on 2026-11-05.

**Status.** This brief is a set of questions, not advice. Software agents compiled it, and none of its contents is a legal conclusion. Evidence IDs refer to [evidence-ledger.md](evidence-ledger.md).

**Confidentiality.** This repository is public. Confidential facts (finances, partner terms, personal details) are deliberately left out and should be supplied to counsel directly.

## 1. The organisation and what it wants to do

**The organisation**
- F1 Stories (`f1-stories.gr`) is a Greek-language independent Formula 1 editorial website [R02]. Several named contributors write for it (bylines in `blog-module/taxonomy.js`). Its legal form, and who operates it, are `OWNER_REPORTED` pending; no publisher entity is named on the site [R19].
- The site is free to read. It runs no ad network, retargeting or tracking pixels [R17].
- Six partner logos are already displayed on every page and inside several data tools. Whether those relationships are paid is an owner fact [R07–R09].

**What it wants to do.** The owner is considering selling new sponsorships. Six scenarios are under consideration:

| ID | Scenario |
|---|---|
| S1 | Paid logo and link in the existing homepage partner section, which is shown site-wide |
| S2 | A sponsor funds an editorial series on F1 engineering |
| S3 | A sponsor supports coverage of one Grand Prix weekend |
| S4 | A sponsor supports a data tool (results, telemetry or tyres) and is visible inside it |
| S5 | A company commissions a specific article or project |
| S6 | A partner supports BetCast, a betting-performance visualisation that publishes the author's own betting record. Variants: (a) a non-gambling sponsor; (b) a licensed gambling operator |

## 2. Questions

### A. Formula 1 trademarks, brand and domains

The relevant material is the F1 guidelines and legal notices [P01, P02] and the facts at [R01–R05], [N02].

1. Is "F1 Stories" use of "F1" as a brand? The name appears as a trade or publication name, in a logo that includes "F1 STORIES", in the domain and in social handles. Or is it descriptive or referential use of "F1" under EU Trade Mark Regulation 2017/1001 Art. 14, Directive 2015/2436 Art. 14 and the Greek implementing law? Does the answer change once paid sponsors appear?
2. Which EU or Greek registrations does Formula One Licensing B.V. hold for "F1" in the publishing, advertising and online-services classes? How do earlier "F1" distinctiveness cases bear on the question?
3. F1's guidelines say marks may not be used in domains of "commercialised websites" [P01 §4]. Does a sponsor strip make `f1-stories.gr` commercialised? What exposure follows, including under .gr dispute procedures?
4. Are the social handles "business accounts" once they promote sponsors?
5. F1 recommends a footer disclaimer for unofficial sites, which F1 Stories lacks [R05]. Would adding it change the risk at all, given that it cannot authorise commercial use?
6. `f1stories.gr` now resolves under unknown control [N02]. What should the owner do, and could recovering it itself raise the domain issue?
7. What layout, labelling and contract terms are enough to avoid implying an association between sponsors and F1, its official partners or its event titles (S1–S3)? In particular, how should Grand Prix names in titles and pages be handled [R44]?

### B. Commercial communication and disclosure

The relevant material is [P12–P15], [P17], [P18] and the facts at [R07], [R19], [R20], [R36].

8. Is F1 Stories, as an individual-run site, a "trader" under Law 2251/1994 and UCPD Art. 2(b) when it takes sponsorship? From what point?
9. Which current article of Law 2251/1994 transposes UCPD Annex I point 11 (advertorials), and what is its wording? [U01]
10. Do Greek rules place labelling duties on the publisher itself, given RLvS (C-391/12)?
11. Are the existing partner labels adequate if a relationship is paid, including in kind (C-371/20)? The labels are "ΜΑΖΙ ΣΤΗΝ ΕΚΚΙΝΗΣΗ", ΧΟΡΗΓΟΣ, ΣΥΝΕΡΓΑΤΗΣ, POWERED BY and ADVERTISING PARTNER [R07].
12. Are the labels in the draft policy adequate? They are «Χορηγία», «Διαφήμιση» and «Χορηγούμενο περιεχόμενο · σε συνεργασία με…» ([editorial-independence-policy.md](editorial-independence-policy.md) §4).
13. Must the site publish provider identity (name, address, tax/registry number) under PD 131/2003 / ECD Art. 5? From when? [U02]
14. Is F1 Stories a "media service provider" under EMFA Art. 2(2)? If so, what follows from Art. 6?
15. Is registration in the online press register (Law 5005/2022) required or advisable? [U03]
16. How should a related-party partner be disclosed, if any exists?

### C. Race data and software

The relevant material is [P01], [P03–P07] and the facts at [R26–R35], [R46].

17. Is a free site that shows sponsor logos "primarily intended for or directed towards commercial advantage or monetary compensation" under CC BY-NC-SA 4.0 §1(k)? Does the answer differ per page or per app?
18. The current strip already renders inside OpenF1-powered tools [R09]. What does that mean under §6(a), automatic termination with a 30-day cure, for the site owner's 2026-11-02 acceptance [R26]?
19. Are F1's statements that it holds copyright and database rights in timing and results data [P01] enforceable against data obtained through OpenF1 or Jolpica? Are full standings tables, lap tables and telemetry traces "substantial"?
20. Are the committed derived datasets and raw captures "Adapted Material" requiring a ShareAlike notice [R29, R30, R33]? Or are they unprotected facts?
21. Open-Meteo's free tier excludes sites that "display advertisements" [P07]. Does the domain-wide partner strip affect TYRES today?
22. Pirelli tyre facts transcribed from press graphics: what is their status as facts or database content, and does "media use" cover a sponsored tool? [P08, U12]
23. Could a sponsor be shown only on a data-free page next to a tool, without the tool counting as commercial?

### D. Images and graphics

The relevant material is [P02], [P09], [P10] and the facts at [R22–R25], [R45].

24. Do the news-reporting and quotation exceptions (Directive 2001/29/EC Art. 5(3)(c)/(d), Law 2121/1993) cover the existing archive? About 950 images have no source recorded [U05].
25. Which uses fall outside those exceptions once a page, series or social card is sponsored?
26. Driver headshots and team logos are copied from `media.formula1.com` (personal, non-commercial terms) [R24]. Can they appear on sponsored surfaces?
27. Withdrawn third-party images remain in public Git history [R23]. Does that matter?
28. What are the rights in AI-generated article images and in illustrated author avatars, one of which shows team branding [R22, R45]?
29. How should the placeholdered image of an identifiable minor be handled [R23]?
30. Two sets of third-party design assets need a view [R47]:
    - TYRES uses a CC BY 4.0 3D car model, and Ghost Car appears to use the same model. Does the model, which depicts an F1-style car, raise design or trademark issues in a sponsored tool?
    - Do circuit layout outlines carry any FOM or circuit-owner rights?

### E. Gambling (S6 and existing content)

The relevant material is [P19], [P20] and the facts at [R38–R41].

31. Do ΥΑ 79292 ΕΞ 2020 or the ΕΕΕΠ principles apply to unpaid editorial betting content? Does the guide naming three operators with enrichment wording create exposure [R39]?
32. Would any operator sponsorship of BetCast make F1 Stories an advertising-service provider or "affiliate" needing ΕΕΕΠ approval and an affiliate suitability licence (509/1/2020)? [U04]
33. Can a non-gambling sponsor be shown next to betting content? What notices would then be needed?
34. Does the BetCast YouTube show fall under Law 4779/2021 (AVMSD) or ΕΣΡ commercial-communication rules?

### F. Business, tax and contracts (tax adviser)

The relevant material is [P21].

35. Is a business start (έναρξη εργασιών) with ΑΑΔΕ and/or a ΓΕΜΗ entry required before the first invoice? Which ΚΑΔ codes fit?
36. Which myDATA and e-invoicing obligations apply, and when?
37. VAT: does the small-business scheme apply? The current threshold is €10,000 per the ΑΑΔΕ page. Is the governing article now in the new VAT code?
38. Non-Greek sponsors: how are reverse charge, VIES checks and recapitulative statements handled for EU sponsors? What about non-EU sponsors?
39. How is sponsorship income, including in-kind, classified for income tax and ΕΦΚΑ?
40. What minimum terms should a sponsorship contract contain? Scope, labelling, no editorial control, logo licence, data-provider restrictions, termination, liability and governing law.
41. When sponsors receive aggregated GA4 click reports from consenting visitors [R15], is any data-protection agreement or privacy-notice change needed? [U06]

## 3. What software agents cannot conclude

The following require a qualified professional or the rights holder. The B-01 documents do not decide any of them:

- whether any current or proposed use of "F1" is lawful;
- whether F1's guidelines, OpenF1, Jolpica or Open-Meteo terms are enforceable as applied;
- whether the site is "commercial" or "commercialised" in any licence or policy sense;
- the scope of copyright exceptions under Greek law;
- the Greek transposition of the UCPD and its wording;
- whether gambling rules reach editorial content;
- tax, VAT and registration obligations;
- adequacy of the privacy notice;
- any grant of permission. Only the rights holder can give that.

## 4. Material counsel should request from the owner directly (not in this repo)

- The relationship and consideration for each of the six partner listings, and any related-party connection.
- Any past consideration from betting operators.
- Who registered both domains, and the ownership of the social accounts.
- Who created the logo and the avatars, and the tools used.
- Any existing permissions from photographers, agencies or teams.
- The intended price ranges and partner categories.
