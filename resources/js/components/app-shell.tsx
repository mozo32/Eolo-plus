// app-shell.tsx
import { SidebarProvider } from '@/components/ui/sidebar'
import { SharedData } from '@/types'
import { usePage } from '@inertiajs/react'

interface AppShellProps {
    children: React.ReactNode
    variant?: 'header' | 'sidebar'
}

export function AppShell({ children, variant = 'header' }: AppShellProps) {
    const isOpen = usePage<SharedData>().props.sidebarOpen

    return (
        <SidebarProvider defaultOpen={isOpen}>
            <div className="relative min-h-screen w-full">
                {/* WATERMARK */}
                <div
                    className="
                        pointer-events-none
                        absolute inset-0
                        bg-no-repeat bg-center
                        opacity-[0.10]
                        z-0
                    "
                    style={{
                        backgroundImage: "url('/1c463caa-e3a1-4093-a00b-1c0da40795f6.jpg')",
                        backgroundSize: '420px',
                    }}
                />

                <div className="relative z-10">
                    {variant === 'header' ? (
                        <div className="flex min-h-screen w-full flex-col">
                            {children}
                        </div>
                    ) : (
                        children
                    )}
                </div>
            </div>
        </SidebarProvider>
    )
}
