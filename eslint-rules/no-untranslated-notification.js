/**
 * [P71-E] ESLint rule: no-untranslated-notification
 *
 * Flags a hardcoded string (or non-empty template) literal passed as the
 * `title` or `message` of a Mantine notification call — the exact gap the
 * project-wide `i18next/no-literal-string` rule cannot see, because it runs in
 * `jsx-text-only` mode and these strings live in plain-object arguments inside
 * `.ts`/`.tsx` hooks, not in JSX text.
 *
 * Matched call shapes:
 *   - `showNotification({ title, message })`
 *   - `notifications.show({ title, message })`
 *   - `notifications.update({ title, message })`
 *
 * The value of `title`/`message` is inspected for a bare static string — a
 * string Literal, a TemplateLiteral with static text, or such a literal reached
 * through a conditional/logical branch (`cond ? 'a' : 'b'`, `x ?? 'default'`).
 * This is deliberately narrow: it gives a zero-false-positive gate (it never
 * touches `color`, `id`, or internal string constants elsewhere in the file —
 * unlike `i18next`'s `mode: 'all'`, which flags things like extension arrays and
 * `return 'video'`). The fix is to route the string through
 * `i18n.t('key', 'English default')`, which is a CallExpression and not flagged.
 *
 * Known, accepted limitation: a fallback string nested inside a helper — e.g.
 * `message: getErrorMessage(err, 'Failed…')` — is NOT flagged (the value is a
 * CallExpression, not a literal). Those are handled by translating the helper's
 * fallback argument during the sweep; the rule intentionally stays precise
 * rather than recursing into arbitrary expressions.
 *
 * Unlike the `i18next` plugin, this rule has no word-exclusion heuristics, so it
 * does NOT share that plugin's blind spot for `"…"`-style strings with two or
 * more trailing periods (e.g. `"Loading campaigns..."`) — any non-empty text is
 * flagged.
 */

const NOTIFY_METHODS = new Set(['show', 'update']);

function isNotificationCall(callee) {
  // showNotification(...)
  if (callee.type === 'Identifier' && callee.name === 'showNotification') {
    return true;
  }
  // notifications.show(...) / notifications.update(...)
  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'notifications' &&
    callee.property.type === 'Identifier' &&
    NOTIFY_METHODS.has(callee.property.name)
  );
}

function propertyName(prop) {
  if (prop.type !== 'Property') return null;
  if (prop.key.type === 'Identifier') return prop.key.name;
  if (prop.key.type === 'Literal') return String(prop.key.value);
  return null;
}

/**
 * True if `node` is (or, through conditional/logical branches, contains) a bare
 * static string — a string Literal or a TemplateLiteral with static text.
 *
 * Recurses through `ConditionalExpression` (`cond ? 'a' : 'b'`) and
 * `LogicalExpression` (`x ?? 'default'`, `a || 'fallback'`) so a hardcoded
 * branch is still caught. Anything else — a `CallExpression` (`t(...)`,
 * `getErrorMessage(...)`), an Identifier, a member access — is treated as
 * already-safe (not a bare literal), which is what keeps this zero-false-positive.
 */
function containsStaticText(node) {
  if (!node) return false;
  switch (node.type) {
    case 'Literal':
      return typeof node.value === 'string' && node.value.trim() !== '';
    case 'TemplateLiteral':
      return node.quasis.some((q) => q.value.raw.trim() !== '');
    case 'ConditionalExpression':
      return containsStaticText(node.consequent) || containsStaticText(node.alternate);
    case 'LogicalExpression':
      return containsStaticText(node.left) || containsStaticText(node.right);
    default:
      return false;
  }
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow hardcoded string literals in a notification title/message; route them through i18n.t().',
    },
    schema: [],
    messages: {
      untranslated:
        "Untranslated notification {{prop}} string. Wrap it in i18n.t('key', 'English default') so it is localizable.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isNotificationCall(node.callee)) return;
        const arg = node.arguments[0];
        if (!arg || arg.type !== 'ObjectExpression') return;
        for (const prop of arg.properties) {
          const name = propertyName(prop);
          if (name !== 'title' && name !== 'message') continue;
          if (containsStaticText(prop.value)) {
            context.report({
              node: prop.value,
              messageId: 'untranslated',
              data: { prop: name },
            });
          }
        }
      },
    };
  },
};
