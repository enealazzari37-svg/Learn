# Studix Study Pro – Bezahlung mit Stripe Managed Payments

**Alles kommt live von Stripe.** Es gibt keine Abo-Tabelle in unserer Datenbank und kein Webhook: Die App fragt das Abo direkt über die Stripe-API ab
(`/api/subscription`) und zeigt es 1:1 an (Status, Plan, Preis, Testversion, nächste Zahlung, Zahlungsmittel, Rechnungen).

**Managed Payments** ist Stripes Merchant-of-Record-Lösung: Stripe verkauft Studix Study Pro rechtlich selbst, berechnet und kassiert die **Mehrwertsteuer in über 80 Ländern**,
führt sie ab, stellt Rechnungen aus (Kund:innen sehen „Sold through Link“) und übernimmt Betrugsabwehr und Streitfälle.
Infos: https://stripe.com/managed-payments · https://docs.stripe.com/payments/managed-payments

## Ablauf
1. Klick auf „14 Tage gratis testen“ → `/api/checkout` erstellt eine Stripe-Checkout-Sitzung (Managed Payments, Testversion, Preis **inklusive MwSt.**).
2. Kauf bei Stripe → zurück in die App (`?plus=success`) → `/api/subscription` lädt das Abo live.
3. Verwalten (Einstellungen → Study Pro): Kündigen / Wieder aktivieren direkt in der App (setzt `cancel_at_period_end` bei Stripe),
   Zahlungsart ändern und alle Rechnungen im Stripe-Kundenportal (`/api/portal`).

Das Abo wird dem Konto über `metadata.user_id` zugeordnet (Stripe-Suche), mit Fallback über die Checkout-Sitzungen (`client_reference_id`).

## Einrichtung in Stripe (zuerst im Testmodus)
1. **Managed Payments aktivieren:** *Settings → Managed Payments* (https://dashboard.stripe.com/settings/managed-payments).
2. **Produkt „Studix Study Pro“** mit einem zulässigen Produktsteuercode („Eligible for Managed Payments“) und monatlichen Preisen in **CHF, EUR und USD** (je 8).
   Entweder je Währung ein eigener Preis oder ein Preis mit „Weitere Währungen“ – beides wird erkannt. Der Server nimmt die neuesten **aktiven** Preise des Produkts.
   Preis 0 (Gratis) wird ignoriert.
3. **Mehrwertsteuer immer enthalten:** Der Checkout setzt `tax_behavior: inclusive` selbst, die Kund:innen zahlen also genau 8 inkl. MwSt. – in jeder Währung.
   Zusätzlich empfohlen: *Settings → Tax → „Include tax in prices“* aktivieren (gilt für Preise ohne Angabe).
4. **Kundenportal aktivieren:** *Settings → Billing → Customer portal* (Zahlungsart ändern, Rechnungen).
5. **API-Key:** *Developers → API keys* → Secret key (`sk_test_…`, später `sk_live_…`).

Ein Webhook wird **nicht** mehr gebraucht. Ein bereits angelegter Endpunkt in Stripe kann gelöscht werden.

## Studix Essential (günstiger Tarif)
Dritte Stufe zwischen Gratis und Pro: **3 CHF pro Monat oder 20 CHF pro Jahr**, halb so viel Studix AI wie Pro (60 000 Token pro Woche, 12 000 pro 5 Std.), unbegrenzt Dokumente und Whiteboards, längere Antworten –
aber **ohne Bild-Analyse und Sprachgespräch** (die bleiben Pro) und ohne Testversion. Wechsel Essential ↔ Pro geht direkt in der App (Einstellungen → Pro), der Preisunterschied wird anteilig abgerechnet.

Einrichtung: In Stripe ein **zweites Produkt „Studix Essential“** mit demselben Produktsteuercode wie Pro anlegen (der Preis wird aus `ESSENTIAL_MONTHLY_CENTS` gebildet, ein Stripe-Preis ist nicht nötig).
Ohne dieses Produkt bleibt Essential unsichtbar und es gibt nur Gratis und Pro. Das Abo erkennt die Stufe an `metadata.tier` bzw. am Produkt.

## Vercel-Umgebungsvariablen
| Name | Wert |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` bzw. `sk_live_…` (einzige Pflichtvariable) |
| `STRIPE_PRODUCT_ID` | optional, falls das Produkt nicht „Studix Study Pro“ heißt |
| `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY` | optional, feste Preis-IDs statt automatischer Suche |
| `STRIPE_PUBLISHABLE_KEY` (oder `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`) | `pk_test_…` / `pk_live_…` (öffentlicher Schlüssel): schaltet den **eingebetteten Checkout** im Studix-Fenster ein, ohne Weiterleitung. Ohne ihn (oder falls Stripe das für Managed Payments ablehnt) öffnet sich die Stripe-Seite |
| `SITE_URL` | optional, z. B. `https://lumi.example.ch` |
| `STRIPE_API_VERSION` | optional, Standard `2025-03-31.basil` |
| `STRIPE_MANAGED_PAYMENTS` | `off` schaltet Managed Payments für Tests ab |
| `PRO_MONTHLY_CENTS` | Monatspreis von Pro in Rappen/Cent, in jeder Währung (Standard `600` = 6). Überschreibt die Stripe-Preise |
| `PRO_YEARLY_CENTS` | Jahrespreis von Pro in Rappen/Cent (Standard `4000` = 40). Alternativ `PRO_YEARLY_DISCOUNT` (Rabatt in % auf 12 Monate), dann wird er daraus berechnet |
| `STRIPE_ESSENTIAL_PRODUCT_ID` | optional, falls das Produkt nicht „Studix Essential“ heißt |
| `ESSENTIAL_MONTHLY_CENTS` / `ESSENTIAL_YEARLY_CENTS` | Preise von **Studix Essential** in Rappen/Cent, in jeder Währung (Standard `300` = 3 und `2000` = 20 pro Jahr) |
| `AI_ESSENTIAL_WINDOW_TOKENS` / `AI_ESSENTIAL_SESSION_TOKENS` | KI-Token von Essential pro Woche / pro 5 Std. (Standard `60000` / `12000`, also die Hälfte von Pro) |
| `PRO_TRIAL_DAYS` | Testversion in Tagen, Standard `14` |
| `AI_FREE_WINDOW_TOKENS` | KI-Token pro Woche für Gratis-Konten (Standard `12500` Studix-Token = echte Token ÷ 10, `0` = unbegrenzt) |
| `AI_PRO_WINDOW_TOKENS` | KI-Token pro Woche für Studix Study Pro (Standard `120000`, `0` = unbegrenzt) |
| `AI_WINDOW_HOURS` | Länge des Fensters in Stunden (Standard `168` = eine Woche; startet mit der ersten Anfrage); alle drei brauchen `SUPABASE_SERVICE_ROLE_KEY` und `supabase/billing.sql` |

Prüfen: `https://DEINE-DOMAIN/api/config` muss `"plus":{"enabled":true,…}` mit den drei Währungen unter `opts.monthly` zeigen.
Testkauf mit `4242 4242 4242 4242`. Für Live: Live-Key, Produkt und Preise im Livemodus neu anlegen.

## Rechtliches
`legal.html` enthält Impressum, Datenschutzerklärung, AGB und Widerrufsbelehrung, abgestimmt auf die tatsächlichen Datenflüsse (Supabase, Vercel, Stripe/Link, Gemini/Groq). Vor dem Livegang in `config.js` unter `legal` Name, Anschrift, E-Mail (optional Telefon, MWST-/USt-Nr.) und das Datum `privacyDate` eintragen und die Texte von einer Fachperson prüfen lassen. Ändern sich Anbieter oder Datenflüsse, muss die Datenschutzerklärung angepasst werden.
