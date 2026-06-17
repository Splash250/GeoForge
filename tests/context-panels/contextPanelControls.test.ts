// @vitest-environment jsdom

import {
  createContextPanelActionButton,
  createContextPanelDescriptionList,
  createContextPanelTextInput,
  createContextPanelValidationList,
} from '@/context-panels/controls.ts';
import { describe, expect, test, vi } from 'vitest';

describe('context panel controls', () => {
  test('creates safe description list rows with text content', () => {
    const list = createContextPanelDescriptionList([
      ['Length', '710.1 m'],
      ['segmentValue', '<img src=x alt="unsafe-segment-value">'],
    ]);

    expect(list.tagName).toBe('DL');
    expect(list.textContent).toContain('<img src=x alt="unsafe-segment-value">');
    expect(list.querySelector('img')).toBeNull();
  });

  test('creates explicitly labeled text input and emits parsed change values', () => {
    const onChange = vi.fn();
    const inputControl = createContextPanelTextInput({
      label: 'Set segment value',
      value: 300,
      hint: 'Stored on this segment',
      parse: (value) => {
        const numericValue = Number(value);
        return value === '' ? undefined : Number.isFinite(numericValue) ? numericValue : value;
      },
      onChange,
    });
    const input = inputControl.querySelector('input');
    const label = inputControl.querySelector('.gm-context-panel-field__label');

    expect(inputControl.textContent).toContain('Set segment value');
    expect(inputControl.textContent).toContain('Stored on this segment');
    expect(input?.value).toBe('300');
    expect(input?.id).toMatch(/^gm-context-panel-field-input-\d+$/);
    expect(label?.tagName).toBe('LABEL');
    expect(label?.getAttribute('for')).toBe(input?.id);
    expect(input?.hasAttribute('aria-label')).toBe(false);
    expect(input?.getAttribute('aria-describedby')).toBeTruthy();
    expect(
      inputControl.querySelector(`#${input?.getAttribute('aria-describedby')}`)?.textContent,
    ).toBe('Stored on this segment');

    input!.value = '450';
    input!.dispatchEvent(new Event('change'));

    expect(onChange).toHaveBeenCalledWith(450);
  });

  test('associates aria label, hint, and error with text input', () => {
    const inputControl = createContextPanelTextInput({
      label: 'Set slope',
      ariaLabel: 'Segment slope percentage',
      value: '<script>unsafe()</script>',
      hint: 'Use percent without a sign',
      error: '<strong>Enter a number</strong>',
      onChange: vi.fn(),
    });
    const input = inputControl.querySelector('input');
    const describedBy = input?.getAttribute('aria-describedby')?.split(' ') ?? [];

    expect(input?.getAttribute('aria-label')).toBe('Segment slope percentage');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
    expect(describedBy).toHaveLength(2);
    expect(inputControl.querySelector(`#${describedBy[0]}`)?.textContent).toBe(
      'Use percent without a sign',
    );
    expect(inputControl.querySelector(`#${describedBy[1]}`)?.textContent).toBe(
      '<strong>Enter a number</strong>',
    );
    expect(inputControl.querySelector(`#${describedBy[1]}`)?.getAttribute('role')).toBe('alert');
    expect(inputControl.querySelector('script')).toBeNull();
    expect(inputControl.querySelector('strong')).toBeNull();
  });

  test('text input exposes getParsedValue and applyChange for direct action clicks', () => {
    const onChange = vi.fn();
    const inputControl = createContextPanelTextInput({
      label: 'Set segment value',
      value: 300,
      parse: (value) => Number(value),
      onChange,
    });
    const input = inputControl.querySelector('input')!;

    input.value = '450';

    expect(inputControl.getParsedValue()).toBe(450);
    expect(inputControl.applyChange()).toBe(450);
    expect(onChange).toHaveBeenCalledWith(450);
  });

  test('creates accessible validation list with alert semantics', () => {
    const validation = createContextPanelValidationList([
      'Segment value is required',
      'Slope is invalid',
    ]);

    expect(validation.getAttribute('role')).toBe('alert');
    expect(validation.getAttribute('aria-live')).toBe('polite');
    expect(validation.textContent).toContain('Segment value is required');
    expect(validation.textContent).toContain('Slope is invalid');
  });

  test('creates action button that handles pointer activation before blur-driven rerender', () => {
    const onAction = vi.fn();
    const button = createContextPanelActionButton({
      label: 'Save',
      ariaLabel: 'Save segment edit',
      onAction,
    });

    button.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    button.click();

    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('aria-label')).toBe('Save segment edit');
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  test('does not invoke action for non-primary pointer activation', () => {
    const onAction = vi.fn();
    const button = createContextPanelActionButton({
      label: 'Save',
      onAction,
    });

    button.dispatchEvent(new MouseEvent('pointerdown', { button: 1, bubbles: true }));
    button.dispatchEvent(new MouseEvent('pointerdown', { button: 2, bubbles: true }));

    expect(onAction).not.toHaveBeenCalled();
  });

  test('suppresses delayed click after pointer activation', async () => {
    vi.useFakeTimers();

    try {
      const onAction = vi.fn();
      const button = createContextPanelActionButton({
        label: 'Save',
        onAction,
      });

      button.dispatchEvent(
        new MouseEvent('pointerdown', { button: 0, bubbles: true, cancelable: true }),
      );
      await vi.runAllTimersAsync();
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(onAction).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
