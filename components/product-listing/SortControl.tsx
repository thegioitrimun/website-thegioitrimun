import React from 'react';
import { ChevronDownIcon } from '../icons';

export type SortOption = {
  value: string;
  label: string;
};

interface SortControlProps {
  label: string;
  value: string;
  options: SortOption[];
  onChange: (value: string) => void;
  compact?: boolean;
}

const SortControl: React.FC<SortControlProps> = ({ label, value, options, onChange, compact = false }) => {
  return (
    <label className="block">
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`w-full appearance-none rounded-full border-0 bg-muted/60 pr-10 text-sm font-semibold text-foreground shadow-xs outline-none transition hover:bg-muted/80 focus:ring-2 focus:ring-primary/20 dark:bg-card dark:shadow-[0_14px_26px_-24px_rgba(4,10,24,0.52)] ${
            compact ? 'h-11 pl-4' : 'h-12 pl-5'
          }`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </label>
  );
};

export default SortControl;
