/**
 * [P71-E / P72-A] ESLint rule: no-untranslated-notification
 *
 * Flags a hardcoded string (or non-empty template) literal passed to one of the
 * known non-JSX user-facing string sinks — the exact gap the project-wide
 * `i18next/no-literal-string` rule cannot see, because it runs in `jsx-text-only`
 * mode and these strings live in plain-object / call arguments inside `.ts`/`.tsx`
 * hooks, not in JSX text.
 *
 * The rule name is retained from P71-E for config/continuity; as of P72-A it
 * guards three sinks, not only notifications:
 *   - Notifications: `showNotification({ title, message })`,
 *     `notifications.show({ title, message })`, `notifications.update({...})`.
 *   - A11y live-region announcements: `announce('…')` — the screen-reader-only
 *     text is invisible to any visual QA, so an unenforced literal here is a
 *     silent i18n regression (P72-A).
 *   - Confirm-modal chrome: `modals.openConfirmModal({ title, labels: { confirm,
 *     cancel } })` — the modal `children` body is JSX and already covered by the
 *     `i18next` jsx rule; this guards the non-JSX `title`/`labels` props.
 *
 * The inspected value is checked for a bare static string — a string Literal, a
 * TemplateLiteral with static text, or such a literal reached through a
 * conditional/logical branch (`cond ? 'a' : 'b'`, `x ?? 'default'`). This is
 * deliberately narrow: it gives a zero-false-positive gate (it never touches
 * `color`, `id`, or internal string constants). The fix is to route the string
 * through `i18n.t('key', 'English default')` (or a `useTranslation` binding),
 * which is a CallExpression and not flagged.
 *
 * Known, accepted limitations (both require interprocedural / cross-file
 * analysis ESLint cannot do, so they stay manually swept):
 *   - A fallback string nested inside a helper — e.g.
 *     `message: getErrorMessage(err, 'Failed…')` — is NOT flagged (the value is a
 *     CallExpression, not a literal).
 *   - A validator's own `return { error: '…' }` literals surfaced elsewhere as
 *     `message: result.error` are NOT flagged (the literal lives in another
 *     function). These are translated by hand at the validator during the sweep.
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

// announce('…') — the a11y live-region announcer (P72-A).
function isAnnounceCall(callee) {
  return callee.type === 'Identifier' && callee.name === 'announce';
}

// modals.openConfirmModal({ ... }) — confirm-dialog chrome (P72-A).
function isOpenConfirmModalCall(callee) {
  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'modals' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'openConfirmModal'
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
        "Untranslated user-facing {{prop}} string. Wrap it in i18n.t('key', 'English default') so it is localizable.",
    },
  },
  create(context) {
    const report = (valueNode, prop) => {
      if (containsStaticText(valueNode)) {
        context.report({ node: valueNode, messageId: 'untranslated', data: { prop } });
      }
    };

    // In an object argument, report the named props whose value is a bare literal.
    const checkObjectProps = (objectNode, names) => {
      if (!objectNode || objectNode.type !== 'ObjectExpression') return;
      for (const prop of objectNode.properties) {
        const name = propertyName(prop);
        if (name && names.includes(name)) report(prop.value, name);
      }
    };

    return {
      CallExpression(node) {
        const callee = node.callee;

        if (isNotificationCall(callee)) {
          checkObjectProps(node.arguments[0], ['title', 'message']);
          return;
        }

        if (isAnnounceCall(callee)) {
          // First argument is the announced string.
          report(node.arguments[0], 'announce()');
          return;
        }

        if (isOpenConfirmModalCall(callee)) {
          const arg = node.arguments[0];
          if (!arg || arg.type !== 'ObjectExpression') return;
          checkObjectProps(arg, ['title']);
          // labels: { confirm, cancel } — inspect the nested object.
          for (const prop of arg.properties) {
            if (propertyName(prop) === 'labels') {
              checkObjectProps(prop.value, ['confirm', 'cancel']);
            }
          }
        }
      },
    };
  },
};
