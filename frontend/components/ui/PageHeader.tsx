import { ThemeToggle } from "@promexma/ui";

interface Props {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** Show the light/dark toggle in the actions row (default true). */
  showThemeToggle?: boolean;
}

export default function PageHeader({ eyebrow, title, subtitle, actions, showThemeToggle = true }: Props) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div>
        {eyebrow ? (
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-brand">{eyebrow}</p>
        ) : null}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions || showThemeToggle ? (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {actions}
          {showThemeToggle ? <ThemeToggle /> : null}
        </div>
      ) : null}
    </div>
  );
}
