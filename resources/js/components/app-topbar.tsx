import { useEffect, useMemo, useState } from 'react'
import AppLogo from '@/components/app-logo'
import { NavUser } from '@/components/nav-user'
import { getNavModules, type AuthUser, type Href, type NavModule } from './navigation'
import { type BreadcrumbItem } from '@/types'
import { Link, usePage } from '@inertiajs/react'
import { ChevronDown, Menu } from 'lucide-react'

function hrefToString(href: Href): string {
    return typeof href === 'string' ? href : href.url
}

function isActive(currentUrl: string, href: Href) {
    const target = hrefToString(href)

    if (target === '/') return currentUrl === '/'

    return (
        currentUrl === target ||
        currentUrl.startsWith(target + '/')
    )
}

export function AppTopbar({ breadcrumbs = [] }: { breadcrumbs?: BreadcrumbItem[] }) {
    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props
    const currentUrl = usePage().url

    const NAV_MODULES = useMemo(() => getNavModules(auth.user), [auth.user])

    const [selectedModule, setSelectedModule] = useState<NavModule | null>(null)
    const [activeSub, setActiveSub] = useState<string | null>(null)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [moduleOpen, setModuleOpen] = useState(false)

    useEffect(() => {
        if (!NAV_MODULES.length) return
        const saved = localStorage.getItem('activeModule')
        const found = NAV_MODULES.find(m => String(m.key) === saved)
        setSelectedModule(found ?? NAV_MODULES[0])
    }, [NAV_MODULES])

    useEffect(() => {
        if (!selectedModule) return
        localStorage.setItem('activeModule', String(selectedModule.key))
        localStorage.removeItem('activeSubmodule')
        setActiveSub(null)
    }, [selectedModule])

    useEffect(() => {
        const savedSub = localStorage.getItem('activeSubmodule')
        if (savedSub) setActiveSub(savedSub)
    }, [])

    const homeHref = NAV_MODULES?.[0]?.items?.[0]?.href
    const homeUrl = homeHref ? hrefToString(homeHref) : '/'

    return (
        <header className="sticky top-0 z-50 bg-background border-b border-border">
            <div className="mx-auto max-w-7xl h-[72px] px-6 flex items-center justify-between">
                <div className="flex items-center gap-6 min-w-0">
                    <Link href={homeUrl} prefetch>
                        <AppLogo />
                    </Link>

                    <div className="relative hidden lg:block">
                        <button
                            onClick={() => setModuleOpen(v => !v)}
                            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground transition"
                        >
                            {selectedModule?.module ?? 'Módulos'}
                            <ChevronDown size={16} />
                        </button>

                        {moduleOpen && (
                            <div className="absolute mt-3 w-64 rounded-xl border border-border bg-popover shadow-lg z-50 overflow-hidden">
                                {NAV_MODULES.map(mod => (
                                    <button
                                        key={mod.key}
                                        onClick={() => {
                                            setSelectedModule(mod)
                                            setModuleOpen(false)
                                        }}
                                        className={`w-full px-5 py-3 text-left text-sm transition ${
                                            selectedModule?.key === mod.key
                                                ? 'bg-primary text-primary-foreground'
                                                : 'hover:bg-muted'
                                        }`}
                                    >
                                        {mod.module}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {selectedModule && (
                        <div className="hidden lg:flex gap-2 overflow-x-auto whitespace-nowrap scroll-smooth">
                            {selectedModule.items.map(item => {
                                const isSelected =
                                    activeSub === item.title ||
                                    isActive(currentUrl, item.href)

                                return (
                                    <Link
                                        key={item.title}
                                        href={hrefToString(item.href)}
                                        prefetch
                                        onClick={() => {
                                            setActiveSub(item.title)
                                            localStorage.setItem('activeSubmodule', item.title)
                                        }}
                                        className={`flex-shrink-0 rounded-full px-6 py-2.5 text-sm font-semibold transition-all ${
                                            isSelected
                                                ? 'bg-primary text-primary-foreground shadow-md scale-[1.02]'
                                                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                        }`}
                                    >
                                        {item.title}
                                    </Link>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setMobileOpen(v => !v)}
                        className="lg:hidden p-2 rounded-lg hover:bg-muted transition"
                    >
                        <Menu size={22} />
                    </button>
                    <NavUser />
                </div>
            </div>

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

            {mobileOpen && (
                <div className="lg:hidden border-t border-border bg-background">
                    <div className="px-4 py-5 space-y-5">
                        {NAV_MODULES.map(mod => (
                            <div key={mod.key}>
                                <div className="text-xs font-semibold uppercase text-muted-foreground mb-3">
                                    {mod.module}
                                </div>
                                <div className="space-y-2">
                                    {mod.items.map(item => {
                                        const active =
                                            isActive(currentUrl, item.href)

                                        return (
                                            <Link
                                                key={item.title}
                                                href={hrefToString(item.href)}
                                                prefetch
                                                onClick={() => {
                                                    setActiveSub(item.title)
                                                    localStorage.setItem('activeSubmodule', item.title)
                                                    setMobileOpen(false)
                                                }}
                                                className={`block px-4 py-3 rounded-lg text-sm transition ${
                                                    active
                                                        ? 'bg-primary text-primary-foreground'
                                                        : 'hover:bg-muted'
                                                }`}
                                            >
                                                {item.title}
                                            </Link>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </header>
    )
}
