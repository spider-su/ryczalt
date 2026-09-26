# Ryczałt MVP scope

- Three tabs: Przychód, Podatek, Ustawienia.
- Manage rental properties with name, optional address, default monthly rent, current tenant name/phone/email, optional tenancy start date, and notes. Tenant details stay embedded in the property.
- Record, correct, and delete manually confirmed rental payments. Each payment stores the actual amount and receipt date, an optional rental month and description, and a snapshot of the tenant name. Partial payments are supported.
- Default rent may prefill a new payment amount but never creates confirmed income on its own.
- Manually confirmed tax payments; annual PIT-28-oriented summary after tax rules are implemented and tested.
- Local versioned JSON document with runtime validation; optional manual export/import later.
- No bank integration, automatic payments, tenant contract lifecycle, valuation, yield, or retirement features.
- Source reference: `ryczalt_it/develop` Expo mobile stack only, not its backend or JDG domain.
