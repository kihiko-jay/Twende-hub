import React from "react";

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const handleClick = () => {
    if (action?.onClick) {
      action.onClick();
    } else if (action?.href) {
      window.location.href = action.href;
    }
  };

  return (
    <div className="py-16 flex flex-col items-center text-center px-4">
      {icon && <div className="mb-4 text-stone-400">{icon}</div>}
      <h3 className="text-lg font-semibold text-stone-900 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-stone-500 max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <button
          type="button"
          onClick={handleClick}
          className="mt-2 inline-flex items-center justify-center px-4 py-2 rounded-full border border-stone-300 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

