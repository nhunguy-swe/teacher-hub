"use client";

import { useRouter } from "next/navigation";
import AdminCompetitionGroups from "@/components/admin/AdminCompetitionGroups";

export default function CompetitionGroupsPage() {
  const router = useRouter();

  return (
    <AdminCompetitionGroups
      setActiveTab={(tab) => {
        if (tab === "seating-chart") {
          router.push("/admin/seating-chart");
        }
      }}
    />
  );
}