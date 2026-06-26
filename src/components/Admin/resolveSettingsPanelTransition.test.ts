import { describe, expect, it } from 'vitest';
import { resolveSettingsPanelTransition } from './settingsPanelTransition';

// P57-A: maps the `settingsPanelAnimation` setting to Mantine Drawer transitionProps.
describe('resolveSettingsPanelTransition', () => {
  it('maps slide-left to the legacy slide-left/200ms transition', () => {
    expect(resolveSettingsPanelTransition('slide-left')).toEqual({
      transition: 'slide-left',
      duration: 200,
    });
  });

  it('maps fade to the fade transition', () => {
    expect(resolveSettingsPanelTransition('fade')).toEqual({ transition: 'fade', duration: 200 });
  });

  it('maps scale to a custom bottom-right-origin scale transition', () => {
    const result = resolveSettingsPanelTransition('scale');
    expect(result.duration).toBe(200);
    expect(result.transition).toMatchObject({
      common: { transformOrigin: 'bottom right' },
      in: { transform: 'scale(1)' },
      out: { transform: 'scale(0)' },
      transitionProperty: 'transform, opacity',
    });
  });

  it('maps none to a zero-duration transition (instant, no flash)', () => {
    expect(resolveSettingsPanelTransition('none')).toEqual({ transition: 'fade', duration: 0 });
  });

  it('falls back to slide-left for unknown or undefined values', () => {
    expect(resolveSettingsPanelTransition(undefined)).toEqual({ transition: 'slide-left', duration: 200 });
    expect(resolveSettingsPanelTransition('bogus')).toEqual({ transition: 'slide-left', duration: 200 });
  });
});
