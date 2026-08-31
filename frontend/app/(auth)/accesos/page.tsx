"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AccessLogsBoard from "@/components/admin/AccessLogsBoard";
import PageHeader from "@/components/ui/PageHeader";
import { canViewAccesos } from "@/lib/access";
import { useAuth } from "@/lib/auth";

export default function AccesosPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !canViewAccesos(user))) {
      router.replace("/cartas");
    }
  }, [loading, user, router]);

  if (loading || !user || !canViewAccesos(user)) return null;

  return (
    <div>
      <PageHeader
        eyebrow="Administración"
        title="Accesos"
        subtitle="Logins de todas las apps de Soporte Operativo."
      />
      <AccessLogsBoard />
    </div>
  );
}
