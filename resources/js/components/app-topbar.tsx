import { useEffect, useMemo, useState } from 'react'
import { Link, usePage } from '@inertiajs/react'
import { MegaMenu } from 'primereact/megamenu'
import { Ripple } from 'primereact/ripple'
import AppLogo from '@/components/app-logo'
import { NavUser } from '@/components/nav-user'
import { getNavModules, type AuthUser, type NavModule } from './navigation'
import { type BreadcrumbItem } from '@/types'

export function AppTopbar({ breadcrumbs = [] }: { breadcrumbs?: BreadcrumbItem[] }) {
    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props

    const NAV_MODULES = useMemo(
        () => getNavModules(auth.user),
        [auth.user]
    )

    const [activeModule, setActiveModule] = useState<string | null>(null)
    const [activeSub, setActiveSub] = useState<string | null>(null)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [openMobileModule, setOpenMobileModule] = useState<string | null>(null)

    /* ---------------------------
     * Restaurar estado
     * --------------------------- */
    useEffect(() => {
        setActiveModule(localStorage.getItem('activeModule'))
        setActiveSub(localStorage.getItem('activeSubmodule'))
    }, [])

    /* ---------------------------
     * Renderer MegaMenu
     * --------------------------- */
    const itemTemplate = (item: any, options: any) => {
        if (item.root) {
            return (
                <a
                    className="flex align-items-center px-4 py-2 cursor-pointer font-semibold text-sm uppercase p-ripple"
                    style={{ borderRadius: '2rem' }}
                    onClick={(e) => options.onClick(e)}
                >
                    <span>{item.label}</span>
                    <Ripple />
                </a>
            )
        }

        return (
            <Link
                href={item.href}
                className="flex align-items-center gap-3 p-3 cursor-pointer"
                onClick={() => {
                    localStorage.setItem('activeModule', item.moduleKey)
                    localStorage.setItem('activeSubmodule', item.id)
                    setActiveModule(item.moduleKey)
                    setActiveSub(item.id)
                }}
            >
                <span className="font-medium">{item.label}</span>
            </Link>
        )
    }

    /* ---------------------------
     * Módulos → MegaMenu
     * --------------------------- */
    const menuModel = NAV_MODULES.map((mod: NavModule) => ({
        label: mod.module,
        root: true,
        template: itemTemplate,
        items: [
            [
                {
                    items: mod.items.map(sub => ({
                        label: sub.title,
                        href: typeof sub.href === 'string' ? sub.href : sub.href.url,
                        id: sub.id,
                        moduleKey: String(mod.key),
                        template: itemTemplate
                    }))
                }
            ]
        ]
    }))

    return (
        <header className="sticky top-0 z-50 border-b border-border bg-background">
            {/* ================= DESKTOP + HEADER ================= */}
            <div className="mx-auto max-w-7xl px-4 flex items-center justify-between h-16">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3">
                    <AppLogo />
                </Link>

                {/* Desktop MegaMenu */}
                <div className="hidden lg:block flex-1 px-6">
                    <MegaMenu
                        model={menuModel}
                        orientation="horizontal"
                        breakpoint="960px"
                        className="surface-0"
                        style={{ borderRadius: '3rem' }}
                    />
                </div>

                {/* Right */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setMobileOpen(true)}
                        className="lg:hidden p-2 rounded-lg hover:bg-muted"
                        aria-label="Abrir menú"
                    >
                        ☰
                    </button>
                    <NavUser />
                </div>
            </div>

            {/* ================= BREADCRUMBS ================= */}
            {breadcrumbs.length > 0 && (
                <div className="mx-auto max-w-7xl px-6 py-2 text-xs text-muted-foreground">
                    {breadcrumbs.map((b, idx) => (
                        <span key={b.title}>
                            {idx > 0 && ' / '}
                            {b.href ? (
                                <Link href={b.href} className="hover:underline">
                                    {b.title}
                                </Link>
                            ) : (
                                b.title
                            )}
                        </span>
                    ))}
                </div>
            )}

            {/* ================= MOBILE DRAWER ================= */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    {/* Overlay */}
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setMobileOpen(false)}
                    />

                    {/* Drawer */}
                    <div className="absolute left-0 top-0 h-full w-80 bg-background shadow-xl p-4 overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <AppLogo />
                            <button
                                onClick={() => setMobileOpen(false)}
                                className="text-xl"
                            >
                                ✕
                            </button>
                        </div>

                        {NAV_MODULES.map(mod => (
                            <div key={mod.key} className="mb-3">
                                {/* Módulo */}
                                <button
                                    className="w-full flex justify-between items-center px-3 py-2 rounded-lg font-semibold hover:bg-muted"
                                    onClick={() =>
                                        setOpenMobileModule(
                                            openMobileModule === String(mod.key)
                                                ? null
                                                : String(mod.key)
                                        )
                                    }
                                >
                                    {mod.module}
                                    <span>
                                        {openMobileModule === String(mod.key) ? '−' : '+'}
                                    </span>
                                </button>

                                {/* Submódulos */}
                                {openMobileModule === String(mod.key) && (
                                    <div className="mt-2 space-y-1 pl-2">
                                        {mod.items.map(sub => (
                                            <Link
                                                key={sub.id}
                                                href={
                                                    typeof sub.href === 'string'
                                                        ? sub.href
                                                        : sub.href.url
                                                }
                                                className="block px-3 py-2 rounded-md text-sm hover:bg-accent"
                                                onClick={() => {
                                                    localStorage.setItem(
                                                        'activeModule',
                                                        String(mod.key)
                                                    )
                                                    localStorage.setItem(
                                                        'activeSubmodule',
                                                        sub.id
                                                    )
                                                    setMobileOpen(false)
                                                }}
                                            >
                                                {sub.title}
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </header>
    )
}
