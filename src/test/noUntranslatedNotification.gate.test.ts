/**
 * [P71-E] Verifies the `wpsg/no-untranslated-notification` lint gate is actually
 * wired into the project's eslint.config.js and behaves as intended — the
 * "deliberately introduce a violation, confirm it's caught; remove it, confirm
 * it passes" check the phase's acceptance criteria call for.
 *
 * This lints code STRINGS through the real ESLint config (not the rule module in
 * isolation), so it also proves the rule is registered and enabled repo-wide.
 */
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const RULE_ID = 'wpsg/no-untranslated-notification';

let eslint: ESLint;

async function ruleMessages(code: string) {
  // filePath must match the config's `src/**/*.{ts,tsx}` glob (and not be a
  // .test/.stories file) for the gate to apply. The file need not exist on disk.
  const [result] = await eslint.lintText(code, { filePath: 'src/__gate_probe__.tsx' });
  return result.messages.filter((m) => m.ruleId === RULE_ID);
}

describe('wpsg/no-untranslated-notification gate', () => {
  beforeAll(() => {
    eslint = new ESLint({ cwd: process.cwd() });
  });

  it('flags a hardcoded notification title AND message', async () => {
    const msgs = await ruleMessages(
      `notifications.show({ title: 'Hardcoded title', message: 'Hardcoded body.' });\n`,
    );
    expect(msgs).toHaveLength(2);
  });

  it("flags a hardcoded showNotification message", async () => {
    const msgs = await ruleMessages(`showNotification({ message: 'Nope, translate me.' });\n`);
    expect(msgs).toHaveLength(1);
  });

  // The i18next jsx-text-only rule has a blind spot for strings with 2+ trailing
  // periods (e.g. "Loading campaigns..."); this gate must NOT share it.
  it('flags a multi-trailing-period notification string (the i18next blind spot)', async () => {
    const msgs = await ruleMessages(`notifications.update({ message: 'Loading campaigns...' });\n`);
    expect(msgs).toHaveLength(1);
  });

  // Conditional/logical branches are recursed into.
  it('flags a hardcoded branch inside a conditional title', async () => {
    const msgs = await ruleMessages(
      `notifications.show({ title: hasIssues ? 'Done with issues' : t('ok', 'Done') });\n`,
    );
    expect(msgs).toHaveLength(1);
  });

  it('passes when title/message are routed through i18n.t (the fix)', async () => {
    const msgs = await ruleMessages(
      `notifications.show({ title: t('k_title', 'Hi'), message: i18n.t('k_msg', 'There'), color: 'red' });\n`,
    );
    expect(msgs).toHaveLength(0);
  });

  it('ignores non-title/message literals (color) and non-notification calls', async () => {
    const msgs = await ruleMessages(
      `notifications.show({ message: t('k', 'x'), color: 'red', id: 'abc' });\n` +
        `someOtherApi.call({ title: 'not a notification' });\n`,
    );
    expect(msgs).toHaveLength(0);
  });
});
