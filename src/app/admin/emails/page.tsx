"use client";

import { Suspense } from "react";
import { EmailsDashboard } from "./_components/emails-dashboard";

export default function AdminEmailsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <EmailsDashboard />
    </Suspense>
  );
}
