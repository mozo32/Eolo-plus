import { useEffect, useMemo, useState } from 'react'
import AppLogo from '@/components/app-logo'
import { NavUser } from '@/components/nav-user'
import { getNavModules, type AuthUser, type Href, type NavModule } from './navigation'
import { type BreadcrumbItem } from '@/types'
import { Link, usePage } from '@inertiajs/react'

function hrefToString(href: Href): string {
    return typeof href === 'string' ? href : href.url
}

function isActive(currentUrl: string, href: Href) {
    const target = hrefToString(href)
    return currentUrl === target || (target !== '/' && currentUrl.startsWith(target))
}

export function AppTopbar({ breadcrumbs = [] }: { breadcrumbs?: BreadcrumbItem[] }) {
    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props
    const currentUrl = usePage().url

    const NAV_MODULES = useMemo(() => getNavModules(auth.user), [auth.user])

    const [selectedModule, setSelectedModule] = useState<NavModule | null>(null)
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
    }, [selectedModule])

    const homeHref = NAV_MODULES?.[0]?.items?.[0]?.href
    const homeUrl = homeHref ? hrefToString(homeHref) : '/'

    return (
        <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href={homeUrl} prefetch>
                        <AppLogo />
                    </Link>

                    <div className="relative hidden md:block">
                        <button
                            onClick={() => setModuleOpen(v => !v)}
                            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
                        >
                            {selectedModule?.module ?? 'Módulos'}
                            <span className="text-xs">▼</span>
                        </button>

                        {moduleOpen && (
                            <div className="absolute mt-2 w-56 rounded-xl shadow-lg bg-white dark:bg-gray-900 border dark:border-gray-700 z-50">
                                {NAV_MODULES.map(mod => (
                                    <button
                                        key={mod.key}
                                        onClick={() => {
                                            setSelectedModule(mod)
                                            setModuleOpen(false)
                                        }}
                                        className={
                                            'w-full text-left px-4 py-2 text-sm transition ' +
                                            (selectedModule?.key === mod.key
                                                ? 'bg-primary text-white'
                                                : 'hover:bg-gray-100 dark:hover:bg-gray-800')
                                        }
                                    >
                                        {mod.module}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setMobileOpen(v => !v)}
                        className="md:hidden rounded-lg border px-3 py-2 text-sm dark:border-gray-700"
                    >
                        ☰
                    </button>
                    <NavUser />
                </div>
            </div>

            {selectedModule && (
                <div className="hidden md:block border-t border-gray-100 dark:border-gray-800">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-2">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                            {selectedModule.items.map(item => {
                                const active =
                                    isActive(currentUrl, item.href) &&
                                    item.moduleKey === selectedModule.key

                                return (
                                    <Link
                                        key={item.title}
                                        href={hrefToString(item.href)}
                                        prefetch
                                        className={
                                            'rounded-lg px-3 py-2 text-sm font-medium transition ' +
                                            (active
                                                ? 'bg-primary text-white'
                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700')
                                        }
                                    >
                                        {item.title}
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {breadcrumbs.length > 0 && (
                <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-2 text-xs text-gray-500 dark:text-gray-400">
                    {breadcrumbs.map((b, idx) => (
                        <span key={b.title}>
                            {idx > 0 && ' / '}
                            {b.href ? (
                                <Link href={b.href} className="hover:underline">
                                    {b.title}
                                </Link>
                            ) : (
                                <span>{b.title}</span>
                            )}
                        </span>
                    ))}
                </div>
            )}

            {mobileOpen && (
                <div className="md:hidden border-t border-gray-200 dark:border-gray-800">
                    <div className="px-4 py-3 space-y-4">
                        {NAV_MODULES.map(mod => (
                            <div key={mod.key}>
                                <div className="text-xs font-semibold uppercase text-gray-500 mb-2">
                                    {mod.module}
                                </div>
                                <div className="space-y-1">
                                    {mod.items.map(item => {
                                        const active =
                                            isActive(currentUrl, item.href) &&
                                            item.moduleKey === mod.key

                                        return (
                                            <Link
                                                key={item.title}
                                                href={hrefToString(item.href)}
                                                prefetch
                                                onClick={() => setMobileOpen(false)}
                                                className={
                                                    'block rounded-lg px-3 py-2 text-sm ' +
                                                    (active
                                                        ? 'bg-primary text-white'
                                                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800')
                                                }
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
