// The 3 examples from SPEC §1 + select + selectordinal + =0 + offset.
export const RICH: Record<string, string> = {
  messageCount:
    "{count, plural, one {You have <strong># new message</strong> in your inbox.} other {You have <strong># new messages</strong> in your inbox.}}",
  credit:
    "{count, plural, =0 {You have no <strong>credit</strong> left. <link>Top up your account</link>.} one {You have <strong># credit</strong> left.} other {You have <strong># credits</strong> left.}}",
  terms:
    "{count, plural, one {By publishing your post, you accept our <termsLink>terms and conditions</termsLink>. You have <strong># comment</strong>.} other {By publishing your posts, you accept our <termsLink>terms and conditions</termsLink>. You have <strong># comments</strong>.}}",
};

// Corpus WITHOUT markup, for parity with @inlang/plugin-icu1.
export const PLAIN: Record<string, string> = {
  simple: "Hello {name}.",
  plural: "{count, plural, one {# apple} other {# apples}}",
  exact: "{count, plural, =0 {none} one {#} other {#}}",
  offset: "{count, plural, offset:1 other {#}}",
  ordinal: "{n, selectordinal, one {#st} two {#nd} other {#th}}",
  select: "{g, select, male {he} female {she} other {they}}",
};
