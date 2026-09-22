import React, { useState } from 'react';
import { parseNumber, formatNumber } from '../../lib/number';

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number;
  onValueChange: (value: number) => void;
  /** 'money' interpreta "1.500" como mil quinientos */
  mode?: 'decimal' | 'money';
  minDecimals?: number;
  maxDecimals?: number;
}

/**
 * Input numérico que acepta "." o "," como decimal mientras se escribe y
 * muestra formato oficial (1.234,56) al perder el foco.
 */
const NumberInput: React.FC<NumberInputProps> = ({
  value, onValueChange, mode = 'decimal', minDecimals = 0, maxDecimals = 3, onFocus, onBlur, ...rest
}) => {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? formatNumber(Number(value) || 0, minDecimals, maxDecimals);

  return (
    <input
      type="text"
      inputMode="decimal"
      {...rest}
      value={display}
      onFocus={e => {
        const n = Number(value) || 0;
        setDraft(n === 0 ? '' : String(Math.round(n * 1e6) / 1e6).replace('.', ','));
        requestAnimationFrame(() => e.target.select());
        onFocus?.(e);
      }}
      onChange={e => {
        const raw = e.target.value.replace(/[^\d.,\-\s$]/g, '');
        setDraft(raw);
        onValueChange(parseNumber(raw, mode as 'decimal' | 'money'));
      }}
      onBlur={e => {
        if (draft !== null) onValueChange(parseNumber(draft, mode as 'decimal' | 'money'));
        setDraft(null);
        onBlur?.(e);
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        rest.onKeyDown?.(e);
      }}
    />
  );
};

export default NumberInput;
