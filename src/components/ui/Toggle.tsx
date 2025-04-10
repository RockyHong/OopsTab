import React from "react";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  className = "",
}) => {
  return (
    <label
      className={`flex items-center cursor-pointer ${
        disabled ? "opacity-50" : ""
      } ${className}`}
    >
      {label && <span className="mr-3 text-sm font-body">{label}</span>}
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div
          className={`block w-10 h-6 rounded-full ${
            checked ? "bg-primary" : "bg-gray-300"
          } transition-colors`}
        ></div>
        <div
          className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
            checked ? "transform translate-x-4" : ""
          }`}
        ></div>
      </div>
    </label>
  );
};

export default Toggle;
