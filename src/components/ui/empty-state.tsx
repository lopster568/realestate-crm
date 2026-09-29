export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      {icon && (
        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          {icon}
        </div>
      )}
      <p className="font-display font-semibold text-ink">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink-faint max-w-sm">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
