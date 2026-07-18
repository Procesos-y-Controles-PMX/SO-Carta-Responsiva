"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { moduleIndexForPath } from "@/lib/moduleOrder";

let lastModuleIndex = -1;

export default function ModuleTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const index = moduleIndexForPath(pathname);
  const previous = lastModuleIndex;
  const animation =
    previous === -1 || index === -1 || index === previous
      ? "module-enter-fade"
      : index > previous
        ? "module-enter-up"
        : "module-enter-down";

  useEffect(() => {
    if (index !== -1) lastModuleIndex = index;
  }, [index]);

  return (
    <div key={pathname} className={`flex min-h-full flex-1 flex-col ${animation}`}>
      {children}
    </div>
  );
}
