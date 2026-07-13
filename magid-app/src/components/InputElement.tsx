import type { CSSProperties, ReactNode } from 'react';
import { useId } from 'react';
import type { DetachedElementResponse } from '../types/protocol';
import { useMagidStore } from '../store/magidStore';
import { parseMagidCss } from '../lib/magidCss';

interface Props {
  data: DetachedElementResponse;
}

interface InputTypeProps {
  id: string;
  name: string;
  value: string;
  className: string;
  style: CSSProperties | undefined;
  onChange: (value: string) => void;
}

// Single source of truth: maps input-type → renderer. Add new input types here only.
const INPUT_TYPE_RENDERERS: Record<string, (props: InputTypeProps) => ReactNode> = {
  text: ({ id, name, value, className, style, onChange }) => (
    <input
      id={id}
      name={`user-input-${name}`}
      type="text"
      value={value}
      className={className}
      style={style}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  number: ({ id, name, value, className, style, onChange }) => (
    <input
      id={id}
      name={`user-input-${name}`}
      type="number"
      value={value}
      className={className}
      style={style}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  checkbox: ({ id, name, value, className, style, onChange }) => (
    <input
      id={id}
      name={`user-input-${name}`}
      type="checkbox"
      checked={value === 'true'}
      className={className}
      style={style}
      onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
    />
  ),
};

export function InputElement({ data }: Props) {
  const id = useId();
  const name = data['input-name'] ?? '';
  const value = useMagidStore((s) => s.userInputs[name] ?? '');
  const setUserInput = useMagidStore((s) => s.setUserInput);

  const inputType = data['input-type'] ?? 'text';
  const render = INPUT_TYPE_RENDERERS[inputType];
  if (!render) {
    console.warn(`[magid] Unknown input-type: ${inputType}`);
    return null;
  }

  const style = data.css ? parseMagidCss(data.css) : undefined;
  const className = ['magid-input-element', data.class].filter(Boolean).join(' ');

  return (
    <span className="magid-input-wrapper">
      {data['input-label'] && <label htmlFor={id}>{data['input-label']}</label>}
      {render({ id, name, value, className, style, onChange: (v) => setUserInput(name, v) })}
    </span>
  );
}
