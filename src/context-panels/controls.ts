export type ContextPanelTextInputOptions<TValue = string | undefined> = {
  label: string;
  ariaLabel?: string;
  value?: unknown;
  hint?: string;
  error?: string;
  inputMode?: HTMLInputElement['inputMode'];
  parse?: (value: string) => TValue;
  onChange: (value: TValue) => void;
};

export type ContextPanelTextInputControl<TValue = string | undefined> = HTMLElement & {
  input: HTMLInputElement;
  getParsedValue: () => TValue;
  applyChange: () => TValue;
};

export type ContextPanelActionButtonOptions = {
  label: string;
  ariaLabel?: string;
  className?: string;
  onAction: () => void;
};

let contextPanelFieldIdCounter = 0;

export function createContextPanelDescriptionList(rows: Array<[string, unknown]>) {
  const list = document.createElement('dl');
  list.className = 'gm-context-panel-description-list';

  for (const [label, value] of rows) {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const description = document.createElement('dd');

    term.textContent = label;
    description.textContent = value == null ? 'Not set' : String(value);
    row.append(term, description);
    list.append(row);
  }

  return list;
}

export function createContextPanelTextInput<TValue = string | undefined>(
  options: ContextPanelTextInputOptions<TValue>,
): ContextPanelTextInputControl<TValue> {
  const field = document.createElement('div');
  const labelText = document.createElement('label');
  const input = document.createElement('input');
  const fieldId = ++contextPanelFieldIdCounter;
  const describedByIds: string[] = [];

  field.className = 'gm-context-panel-field';
  labelText.className = 'gm-context-panel-field__label';
  input.className = 'gm-context-panel-field__input';

  labelText.textContent = options.label;
  labelText.htmlFor = `gm-context-panel-field-input-${fieldId}`;
  input.type = 'text';
  input.id = labelText.htmlFor;
  input.inputMode = options.inputMode ?? 'text';
  input.autocomplete = 'off';
  input.value = options.value == null ? '' : String(options.value);

  const getParsedValue = () => {
    const value = input.value.trim();

    return options.parse ? options.parse(value) : ((value || undefined) as TValue);
  };
  const applyChange = () => {
    const value = getParsedValue();

    options.onChange(value);
    return value;
  };

  if (options.ariaLabel) {
    input.setAttribute('aria-label', options.ariaLabel);
  }

  input.addEventListener('change', () => {
    applyChange();
  });

  field.append(labelText, input);

  if (options.hint) {
    const hint = document.createElement('span');
    hint.id = `gm-context-panel-field-hint-${fieldId}`;
    hint.className = 'gm-context-panel-field__hint';
    hint.textContent = options.hint;
    describedByIds.push(hint.id);
    field.append(hint);
  }

  if (options.error) {
    const error = document.createElement('span');
    error.id = `gm-context-panel-field-error-${fieldId}`;
    error.className = 'gm-context-panel-field__error';
    error.textContent = options.error;
    error.setAttribute('role', 'alert');
    input.setAttribute('aria-invalid', 'true');
    describedByIds.push(error.id);
    field.append(error);
  }

  if (describedByIds.length > 0) {
    input.setAttribute('aria-describedby', describedByIds.join(' '));
  }

  return Object.assign(field, {
    input,
    getParsedValue,
    applyChange,
  });
}

export function createContextPanelValidationList(messages: string[]): HTMLElement {
  const list = document.createElement('ul');

  list.className = 'gm-context-panel-validation-list';
  list.setAttribute('role', 'alert');
  list.setAttribute('aria-live', 'polite');
  list.hidden = messages.length === 0;

  for (const message of messages) {
    const item = document.createElement('li');

    item.textContent = message;
    list.append(item);
  }

  return list;
}

export function createContextPanelActionButton(
  options: ContextPanelActionButtonOptions,
): HTMLButtonElement {
  const button = document.createElement('button');
  let suppressNextClick = false;

  button.type = 'button';
  button.textContent = options.label;
  button.className = ['gm-context-panel-action-button', options.className]
    .filter(Boolean)
    .join(' ');

  if (options.ariaLabel) {
    button.setAttribute('aria-label', options.ariaLabel);
  }

  button.addEventListener('pointerdown', (event) => {
    if ((event.button ?? 0) !== 0) {
      return;
    }

    event.preventDefault();
    suppressNextClick = true;
    options.onAction();
  });

  button.addEventListener('click', () => {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }

    options.onAction();
  });

  return button;
}
