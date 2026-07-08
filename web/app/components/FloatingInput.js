"use client";

import { useId, useState } from "react";

// Shared floating-label input for the auth forms — label sits inside the
// field until focused/filled, then floats up. Handles its own password
// show/hide toggle when type="password" so callers don't have to.
export default function FloatingInput({ label, type = "text", value, onChange, icon, error, ...rest }) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const resolvedType = isPassword && showPassword ? "text" : type;
  const floated = focused || Boolean(value);

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        {icon && (
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">
            {icon}
          </span>
        )}
        <input
          id={id}
          className={`peer w-full bg-surface-glass border rounded-lg pt-5 pb-2 text-label-md font-label-md text-on-surface focus:outline-none focus:ring-1 transition-colors ${
            icon ? "pl-10" : "pl-3"
          } ${isPassword ? "pr-10" : "pr-3"} ${
            error
              ? "border-error focus:border-error focus:ring-error"
              : "border-border-subtle focus:border-primary focus:ring-primary"
          }`}
          onBlur={() => setFocused(false)}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          placeholder=" "
          type={resolvedType}
          value={value}
          {...rest}
        />
        <label
          className={`absolute pointer-events-none font-label-sm transition-all duration-150 ${icon ? "left-10" : "left-3"} ${
            floated ? "top-1.5 text-[10px] text-primary" : "top-1/2 -translate-y-1/2 text-label-md text-on-surface-variant"
          }`}
          htmlFor={id}
        >
          {label}
        </label>
        {isPassword && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
            onClick={() => setShowPassword((s) => !s)}
            tabIndex={-1}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">
              {showPassword ? "visibility_off" : "visibility"}
            </span>
          </button>
        )}
      </div>
      {error && <span className="font-body-sm text-body-sm text-error">{error}</span>}
    </div>
  );
}
