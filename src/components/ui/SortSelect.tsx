import React from "react";
import { ArrowsUpDownIcon } from "@heroicons/react/24/solid";

export type SortOption = {
  value: string;
  label: string;
};

interface SortSelectProps {
  options: SortOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const SortSelect: React.FC<SortSelectProps> = ({
  options,
  value,
  onChange,
  className = "",
}) => {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <ArrowsUpDownIcon className="h-5 w-5 text-gray-500" aria-hidden="true" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block py-1.5 pl-3 pr-10 text-sm border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary bg-white"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SortSelect;
