import { useMemo, useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { ChevronDown, ChevronRight, Menu, X } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavUser } from '@/components/nav-user';
import { getNavModules, type AuthUser, type NavModule } from './navigation';
import { type BreadcrumbItem } from '@/types';
import { cn } from '@/lib/utils';

export function AppTopbar({ breadcrumbs = [] }: { breadcrumbs?: BreadcrumbItem[] }) {
    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props;
    const [mobileOpen, setMobileOpen] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
    const [activeSubDropdown, setActiveSubDropdown] = useState<string | null>(null);

    const NAV_MODULES = useMemo(() => {
        const modules = getNavModules(auth.user);
        return [...modules].sort((a, b) => a.module.localeCompare(b.module));
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

                    <nav className="hidden lg:flex items-center gap-1">
                        {NAV_MODULES.map((mod) => (
                            <div
                                key={mod.key}
                                className="relative"
                                onMouseEnter={() => setActiveDropdown(mod.key)}
                                onMouseLeave={handleMainMouseLeave}
                            >
                                <button className={cn(
                                    "flex items-center gap-1 px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-accent hover:text-accent-foreground",
                                    activeDropdown === mod.key && "bg-accent text-accent-foreground"
                                )}>
                                    {mod.module}
                                    <ChevronDown className={cn(
                                        "h-4 w-4 opacity-50 transition-transform duration-200",
                                        activeDropdown === mod.key && "rotate-180"
                                    )} />
                                </button>

                                {activeDropdown === mod.key && (
                                    <div
                                        className="absolute left-0 top-full pt-2 w-64 animate-in fade-in zoom-in-95 duration-200"
                                        onMouseLeave={() => setActiveSubDropdown(null)}
                                    >
                                        <div className="rounded-xl border bg-popover p-1.5 shadow-2xl ring-1 ring-black/5">
                                            <div className="grid gap-0.5">
                                                {mod.items.map((sub) => {
                                                    const hasChildren = sub.children && sub.children.length > 0;
                                                    return (
                                                        <div
                                                            key={sub.id}
                                                            className="relative"
                                                            onMouseEnter={() => hasChildren && setActiveSubDropdown(sub.id)}
                                                        >
                                                            {hasChildren ? (
                                                                <button
                                                                    className={cn(
                                                                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                                                                        activeSubDropdown === sub.id && "bg-accent text-accent-foreground"
                                                                    )}
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="flex h-7 w-7 items-center justify-center rounded-md border bg-background shadow-sm">
                                                                            {sub.icon ? <sub.icon className="h-3.5 w-3.5" /> : '•'}
                                                                        </div>
                                                                        {sub.title}
                                                                    </div>
                                                                    <ChevronRight className="h-4 w-4 opacity-50" />
                                                                </button>
                                                            ) : (
                                                                <Link
                                                                    href={getSafeHref(sub.href)}
                                                                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                                                                >
                                                                    <div className="flex h-7 w-7 items-center justify-center rounded-md border bg-background shadow-sm">
                                                                        {sub.icon ? <sub.icon className="h-3.5 w-3.5" /> : '•'}
                                                                    </div>
                                                                    {sub.title}
                                                                </Link>
                                                            )}

                                                            {hasChildren && activeSubDropdown === sub.id && (
                                                                <div className="absolute left-[calc(100%+0.5rem)] top-0 w-60 animate-in fade-in slide-in-from-left-2 duration-200">
                                                                    <div className="rounded-xl border bg-popover p-1.5 shadow-2xl ring-1 ring-black/5">
                                                                        <div className="mb-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 border-b">
                                                                            {sub.title}
                                                                        </div>
                                                                        {sub.children?.map((child) => (
                                                                            <Link
                                                                                key={child.id}
                                                                                href={getSafeHref(child.href)}
                                                                                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-primary"
                                                                            >
                                                                                <span className="relative flex h-2 w-2">
                                                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/30 opacity-75"></span>
                                                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary/60"></span>
                                                                                </span>
                                                                                {child.title}
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
                        className="inline-flex h-10 w-10 items-center justify-center rounded-md border lg:hidden hover:bg-accent focus:outline-none"
                    >
                        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </div>
            </div>

            {breadcrumbs.length > 0 && (
                <div className="flex h-10 items-center border-t bg-muted/30 px-4 sm:px-8 overflow-x-auto">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground whitespace-nowrap">
                        {breadcrumbs.map((b, idx) => (
                            <div key={b.title} className="flex items-center gap-2">
                                {idx > 0 && <span className="opacity-40">/</span>}
                                {b.href ? (
                                    <Link href={b.href} className="transition-colors hover:text-primary">
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
                <div className="fixed inset-0 top-16 z-50 grid h-[calc(100vh-4rem)] auto-rows-max overflow-y-auto p-6 pb-32 lg:hidden bg-background border-t">
                    <div className="relative z-20 grid gap-8">
                        {NAV_MODULES.map((mod) => (
                            <div key={mod.key} className="flex flex-col gap-3">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 px-2">
                                    {mod.module}
                                </h4>
                                <div className="grid gap-1">
                                    {mod.items.map((sub) => (
                                        <div key={sub.id} className="group flex flex-col">
                                            {sub.children ? (
                                                <details className="w-full">
                                                    <summary className="flex cursor-pointer items-center justify-between rounded-xl border bg-card p-4 text-sm font-bold shadow-sm list-none">
                                                        {sub.title}
                                                        <ChevronDown className="h-4 w-4 opacity-50 transition-transform group-open:rotate-180" />
                                                    </summary>
                                                    <div className="mt-1 flex flex-col gap-1 ml-4 border-l-2 border-primary/20 pl-4 py-2">
                                                        {sub.children.map((child) => (
                                                            <Link
                                                                key={child.id}
                                                                href={getSafeHref(child.href)}
                                                                onClick={() => setMobileOpen(false)}
                                                                className="p-3 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
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
                                                    className="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm font-bold shadow-sm hover:bg-accent transition-all"
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
