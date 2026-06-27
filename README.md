# inlang-plugin-rich-icu

An inlang storage plugin that reads/writes **inline ICU MessageFormat** catalogs
**and preserves rich-text markup tags** (`<strong>…</strong>`, `<link>…</link>`)
as first-class inlang markup — so Paraglide JS renders them as real components,
even inside plural/select branches.

## Install

The plugin is loaded by inlang as an ESM module from a CDN — you don't install it
as a dependency. Add it to your `project.inlang/settings.json`:

```json
{
  "$schema": "https://inlang.com/schema/project-settings",
  "baseLocale": "en",
  "locales": ["en", "fr"],
  "modules": [
    "https://cdn.jsdelivr.net/npm/inlang-plugin-rich-icu@latest/dist/index.js"
  ],
  "plugin.donal2.richIcu": {
    "pathPattern": "./messages/{locale}.json"
  }
}
```

Catalogs are JSON maps of `key → ICU string`, one file per locale:

```json
{ "resumeCount": "{count, plural, one {Vous avez <strong># CV</strong>.} other {Vous avez <strong># CV</strong>.}}" }
```

## Render (Paraglide + React)

```tsx
<ParaglideMessage
  message={m.resumeCount}
  inputs={{ count }}
  markup={{ strong: ({ children }) => <strong>{children}</strong> }}
/>
```

## Supported ICU features

- **`select`, `plural`, `selectordinal`** — including exact matches (`=0`, `=1`, …)
  and `offset:`. Sibling selectors keep their source order.
- **`#`** (octothorpe) inside `plural` / `selectordinal` cases.
- **Markup tags** — paired (`<strong>…</strong>`) and self-closing (`<br/>`),
  including selectors nested inside a tag (`<b>{n, plural, …}</b>`).
- **Formatter functions** `number`, `date`, `time` — with named styles
  (`percent`, `short`, …) **and** `::` skeletons (`{p, number, ::currency/USD}`),
  preserved on round-trip.

## Not supported in v1

These throw a clear error on import (the offending message is skipped, the rest
of the file still imports):

- The `spellout`, `ordinal` and `duration` **formatter functions**
  (`{n, spellout}`, `{n, ordinal}`, `{d, duration}`). Note: `selectordinal`
  *is* supported — only the standalone `ordinal` number formatter is not.
- Markup **attributes / options** (`<link href="…">`) — tags carry their name only.

Other notes:

- `pathPattern` is a single string (must contain `{locale}` and end in `.json`).
- A `plural` / `select` / `selectordinal` without an `other` clause is rejected,
  as required by ICU MessageFormat.

## Tested with

- `@inlang/sdk` 2.10.2
- `@formatjs/icu-messageformat-parser` ^2
- Parité d'AST vérifiée contre `@inlang/plugin-icu1` 1.1.0 (corpus sans markup)

## Development

```bash
pnpm install
pnpm test
pnpm build
```

## License

MIT
