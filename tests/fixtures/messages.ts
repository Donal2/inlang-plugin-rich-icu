// The 3 examples from SPEC §1 + select + selectordinal + =0 + offset.
export const RICH: Record<string, string> = {
  resumeCount:
    "{count, plural, one {Vous avez <strong># CV</strong> dans votre compte.} other {Vous avez <strong># CV</strong> dans votre compte.}}",
  credit:
    "{count, plural, =0 {Vous n'avez plus de <strong>crédit</strong>. <link>Rechargez votre compte</link>.} one {Il vous reste <strong># crédit</strong>.} other {Il vous reste <strong># crédits</strong>.}}",
  terms:
    "{count, plural, one {En créant votre CV, vous acceptez nos <termsLink>conditions générales</termsLink>. Vous avez <strong># document</strong>.} other {En créant vos CV, vous acceptez nos <termsLink>conditions générales</termsLink>. Vous avez <strong># documents</strong>.}}",
};

// Corpus WITHOUT markup, for parity with @inlang/plugin-icu1.
export const PLAIN: Record<string, string> = {
  simple: "Bonjour {name}.",
  plural: "{count, plural, one {# pomme} other {# pommes}}",
  exact: "{count, plural, =0 {rien} one {#} other {#}}",
  offset: "{count, plural, offset:1 other {#}}",
  ordinal: "{n, selectordinal, one {#er} two {#e} other {#e}}",
  select: "{g, select, male {il} female {elle} other {iel}}",
};
