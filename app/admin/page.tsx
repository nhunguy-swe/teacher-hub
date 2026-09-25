"use client";

import { useEffect } from "react";
import { redirect } from "next/navigation";

export default function AdminPage() {
  useEffect(() => {
    // Lưu lại mốc rằng người dùng đang ở khu vực admin
    localStorage.setItem("last_visited_route", "/admin/statistics");
    localStorage.setItem("is_admin_logged", "true");
  }, []);

  redirect("/admin/statistics");
}
