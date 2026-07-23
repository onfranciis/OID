import { useState, type KeyboardEvent } from 'react';
import { inputClass } from './form-field';

// Toggleable chips for a known set of options (e.g. OIDC scopes/claims), plus
// a small free-text add for values outside that set — client policy isn't
// actually restricted to the advertised list server-side, so this stays
// additive rather than a strict enum picker.
export function ChoiceChips({
  options,
  values,
  onChange,
  ariaLabel,
  customPlaceholder = 'Add another…',
}: {
  options: string[];
  values: string[];
  onChange: (next: string[]) => void;
  ariaLabel: string;
  customPlaceholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const customValues = values.filter((value) => !options.includes(value));

  const toggleOption = (option: string) => {
    onChange(
      values.includes(option)
        ? values.filter((value) => value !== option)
        : [...values, option],
    );
  };

  const removeCustom = (value: string) => {
    onChange(values.filter((item) => item !== value));
  };

  const commitDraft = () => {
    const value = draft.trim();

    if (value.length > 0 && !values.includes(value)) {
      onChange([...values, value]);
    }

    setDraft('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitDraft();
    }
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="rounded-card border border-line bg-surface p-3"
    >
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const selected = values.includes(option);

          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleOption(option)}
              className={`rounded-card px-2.5 py-1 text-xs font-semibold ${
                selected
                  ? 'bg-accent text-surface'
                  : 'bg-page text-muted hover:text-ink'
              }`}
            >
              {option}
            </button>
          );
        })}
        {customValues.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1 rounded-card border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent"
          >
            {value}
            <button
              type="button"
              aria-label={`Remove ${value}`}
              onClick={() => removeCustom(value)}
              className="hover:text-danger"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
        placeholder={customPlaceholder}
        aria-label={`${ariaLabel}: add another`}
        className={`${inputClass} mt-2 w-full`}
      />
    </div>
  );
}
