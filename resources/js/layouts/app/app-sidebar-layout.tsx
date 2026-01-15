// resources/js/layouts/app/app-sidebar-layout.tsx
import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppTopbar } from '@/components/app-topbar';
import { type BreadcrumbItem } from '@/types';
import { type PropsWithChildren } from 'react';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: PropsWithChildren<{ breadcrumbs?: BreadcrumbItem[] }>) {
    return (
        <AppShell variant="header">
            {/* 🔝 SOLO Topbar */}
            <AppTopbar breadcrumbs={breadcrumbs} />

            {/* 📄 Contenido real */}
            <AppContent
                variant="header"
                className="px-3 py-4 sm:px-6"
            >
                {children}
            </AppContent>
        </AppShell>
    );
}
