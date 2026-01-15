// app-shell.tsx
import { SidebarProvider } from '@/components/ui/sidebar';
import { SharedData } from '@/types';
import { usePage } from '@inertiajs/react';

interface AppShellProps {
    children: React.ReactNode;
    variant?: 'header' | 'sidebar';
}

export function AppShell({ children, variant = 'header' }: AppShellProps) {
    const isOpen = usePage<SharedData>().props.sidebarOpen;

    // 🔥 SIEMPRE envolvemos con SidebarProvider
    return (
        <SidebarProvider defaultOpen={isOpen}>
            {variant === 'header' ? (
                <div className="flex min-h-screen w-full flex-col">
                    {children}
                </div>
            ) : (
                children
            )}
        </SidebarProvider>
    );
}
