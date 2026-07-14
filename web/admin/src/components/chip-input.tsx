import { useState, type KeyboardEvent } from 'react';
import { inputClass } from './form-field';

// Editable set of short string values (scopes, claims). Enter or comma commits
// the current entry; duplicates and blanks are ignored, matching the backend
// normalizeStringList behavior.
export function ChipInput({
  values,
  onChange,
  placeholder,
  ariaLabel,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const value = draft.trim();

    if (value.length > 0 && !values.includes(value)) {
      onChange([...values, value]);
    }

    setDraft('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Backspace' && draft === '' && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div className="rounded-card border border-line bg-surface p-2">
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1 rounded-card bg-page px-2 py-0.5 text-xs font-semibold text-ink"
          >
            {value}
            <button
              type="button"
              aria-label={`Remove ${value}`}
              onClick={() => onChange(values.filter((item) => item !== value))}
              className="text-muted hover:text-danger"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder={values.length === 0 ? placeholder : undefined}
          aria-label={ariaLabel}
          className={`${inputClass} flex-1 border-0 p-1 focus:border-0`}
        />
      </div>
    </div>
  );
}
