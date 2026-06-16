import { useMemo, useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { ChevronDown, ChevronRight, Menu, X } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavUser } from '@/components/nav-user';
import { getNavModules, type AuthUser } from './navigation';
import { type BreadcrumbItem } from '@/types';
import { cn } from '@/lib/utils';

export function AppTopbar({ breadcrumbs = [] }: { breadcrumbs?: BreadcrumbItem[] }) {
    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props;
    const [mobileOpen, setMobileOpen] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
    const [activeSubDropdown, setActiveSubDropdown] = useState<string | null>(null);

    const NAV_MODULES = useMemo(() => {
        const modules = getNavModules(auth.user);

        const modulesOrdenados = modules.map((mod) => {
            const itemsOrdenados = [...mod.items]
                .sort((a, b) => a.title.localeCompare(b.title))
                .map((item) => {
                    if (item.children && item.children.length > 0) {
                        return {
                            ...item,
                            children: [...item.children].sort((a, b) =>
                                a.title.localeCompare(b.title)
                            ),
                        };
                    }

                    return item;
                });

            return {
                ...mod,
                items: itemsOrdenados,
            };
        });

        return [...modulesOrdenados].sort((a, b) =>
            a.module.localeCompare(b.module)
        );
    }, [auth.user]);

    const getSafeHref = (href: any): string => {
        if (!href) return '#';
        return typeof href === 'string' ? href : href.url;
    };

    const handleMainMouseLeave = () => {
        setActiveDropdown(null);
        setActiveSubDropdown(null);
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center justify-between px-4 sm:px-8">
                <div className="flex items-center gap-8">
                    <Link href="/" className="flex items-center gap-2">
                        <AppLogo />
                    </Link>

                    <nav className="hidden items-center gap-1 lg:flex">
                        {NAV_MODULES.map((mod) => (
                            <div
                                key={mod.key}
                                className="relative"
                                onMouseEnter={() => setActiveDropdown(mod.key)}
                                onMouseLeave={handleMainMouseLeave}
                            >
                                <button
                                    className={cn(
                                        'flex items-center gap-1 rounded-md px-4 py-2 text-sm font-medium text-[#003E51] transition-colors hover:bg-[#003E51] hover:text-white',
                                        activeDropdown === mod.key && 'bg-[#003E51] text-white'
                                    )}
                                >
                                    {mod.module}
                                    <ChevronDown
                                        className={cn(
                                            'h-4 w-4 opacity-70 transition-transform duration-200',
                                            activeDropdown === mod.key && 'rotate-180'
                                        )}
                                    />
                                </button>

                                {activeDropdown === mod.key && (
                                    <div
                                        className="absolute left-0 top-full w-64 animate-in fade-in zoom-in-95 pt-2 duration-200"
                                        onMouseLeave={() => setActiveSubDropdown(null)}
                                    >
                                        <div className="rounded-xl border bg-white p-1.5 shadow-2xl ring-1 ring-black/5">
                                            <div className="grid gap-0.5">
                                                {mod.items.map((sub) => {
                                                    const hasChildren =
                                                        sub.children && sub.children.length > 0;

                                                    return (
                                                        <div
                                                            key={sub.id}
                                                            className="relative"
                                                            onMouseEnter={() =>
                                                                hasChildren && setActiveSubDropdown(sub.id)
                                                            }
                                                        >
                                                            {hasChildren ? (
                                                                <button
                                                                    className={cn(
                                                                        'group flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-[#003E51] transition-colors hover:bg-[#003E51] hover:text-white',
                                                                        activeSubDropdown === sub.id &&
                                                                            'bg-[#003E51] text-white'
                                                                    )}
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="flex h-7 w-7 items-center justify-center rounded-md border bg-white text-[#003E51] shadow-sm transition-colors group-hover:border-white/30 group-hover:bg-white/15 group-hover:text-white">
                                                                            {sub.icon ? (
                                                                                <sub.icon className="h-3.5 w-3.5" />
                                                                            ) : (
                                                                                '•'
                                                                            )}
                                                                        </div>
                                                                        <span>{sub.title}</span>
                                                                    </div>

                                                                    <ChevronRight className="h-4 w-4 opacity-70" />
                                                                </button>
                                                            ) : (
                                                                <Link
                                                                    href={getSafeHref(sub.href)}
                                                                    onClick={() => {
                                                                        localStorage.setItem(
                                                                            'activeModule',
                                                                            String(mod.key)
                                                                        );
                                                                        setMobileOpen(false);
                                                                    }}
                                                                    className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#003E51] transition-colors hover:bg-[#003E51] hover:text-white"
                                                                >
                                                                    <div className="flex h-7 w-7 items-center justify-center rounded-md border bg-white text-[#003E51] shadow-sm transition-colors group-hover:border-white/30 group-hover:bg-white/15 group-hover:text-white">
                                                                        {sub.icon ? (
                                                                            <sub.icon className="h-3.5 w-3.5" />
                                                                        ) : (
                                                                            '•'
                                                                        )}
                                                                    </div>
                                                                    <span>{sub.title}</span>
                                                                </Link>
                                                            )}

                                                            {hasChildren && activeSubDropdown === sub.id && (
                                                                <div className="absolute left-[calc(100%+0.5rem)] top-0 w-60 animate-in fade-in slide-in-from-left-2 duration-200">
                                                                    <div className="rounded-xl border bg-white p-1.5 shadow-2xl ring-1 ring-black/5">
                                                                        <div className="mb-2 border-b px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                                                            {sub.title}
                                                                        </div>

                                                                        {sub.children?.map((child) => (
                                                                            <Link
                                                                                key={child.id}
                                                                                href={getSafeHref(child.href)}
                                                                                onClick={() => {
                                                                                    localStorage.setItem(
                                                                                        'activeModule',
                                                                                        String(mod.key)
                                                                                    );
                                                                                    setMobileOpen(false);
                                                                                }}
                                                                                className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#003E51] transition-colors hover:bg-[#003E51] hover:text-white"
                                                                            >
                                                                                <span className="relative flex h-2 w-2">
                                                                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#003E51]/30 opacity-75 group-hover:bg-white/40"></span>
                                                                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#003E51]/60 group-hover:bg-white"></span>
                                                                                </span>
                                                                                <span>{child.title}</span>
                                                                            </Link>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden sm:block">
                        <NavUser />
                    </div>

                    <button
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-md border text-[#003E51] hover:bg-[#003E51] hover:text-white focus:outline-none lg:hidden"
                    >
                        {mobileOpen ? (
                            <X className="h-5 w-5" />
                        ) : (
                            <Menu className="h-5 w-5" />
                        )}
                    </button>
                </div>
            </div>

            {breadcrumbs.length > 0 && (
                <div className="flex h-10 items-center overflow-x-auto border-t bg-muted/30 px-4 sm:px-8">
                    <div className="flex items-center gap-2 whitespace-nowrap text-xs font-medium text-muted-foreground">
                        {breadcrumbs.map((b, idx) => (
                            <div key={b.title} className="flex items-center gap-2">
                                {idx > 0 && <span className="opacity-40">/</span>}

                                {b.href ? (
                                    <Link href={b.href} className="transition-colors hover:text-[#003E51]">
                                        {b.title}
                                    </Link>
                                ) : (
                                    <span className="text-foreground/80">{b.title}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {mobileOpen && (
                <div className="fixed inset-0 top-16 z-50 grid h-[calc(100vh-4rem)] auto-rows-max overflow-y-auto border-t bg-background p-6 pb-32 lg:hidden">
                    <div className="relative z-20 grid gap-8">
                        {NAV_MODULES.map((mod) => (
                            <div key={mod.key} className="flex flex-col gap-3">
                                <h4 className="px-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                                    {mod.module}
                                </h4>

                                <div className="grid gap-1">
                                    {mod.items.map((sub) => (
                                        <div key={sub.id} className="group flex flex-col">
                                            {sub.children ? (
                                                <details className="w-full">
                                                    <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border bg-card p-4 text-sm font-bold text-[#003E51] shadow-sm transition-colors hover:bg-[#003E51] hover:text-white">
                                                        {sub.title}
                                                        <ChevronDown className="h-4 w-4 opacity-70 transition-transform group-open:rotate-180" />
                                                    </summary>

                                                    <div className="ml-4 mt-1 flex flex-col gap-1 border-l-2 border-[#003E51]/20 py-2 pl-4">
                                                        {sub.children.map((child) => (
                                                            <Link
                                                                key={child.id}
                                                                href={getSafeHref(child.href)}
                                                                onClick={() => setMobileOpen(false)}
                                                                className="rounded-lg p-3 text-sm font-medium text-[#003E51] transition-colors hover:bg-[#003E51] hover:text-white"
                                                            >
                                                                {child.title}
                                                            </Link>
                                                        ))}
                                                    </div>
                                                </details>
                                            ) : (
                                                <Link
                                                    href={getSafeHref(sub.href)}
                                                    onClick={() => setMobileOpen(false)}
                                                    className="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm font-bold text-[#003E51] shadow-sm transition-colors hover:bg-[#003E51] hover:text-white"
                                                >
                                                    {sub.title}
                                                </Link>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </header>
    );
}
