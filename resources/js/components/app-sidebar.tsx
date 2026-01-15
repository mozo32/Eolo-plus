import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Link, usePage } from '@inertiajs/react';
import AppLogo from './app-logo';

import { getNavModules, type AuthUser, type Href } from './navigation';

/* -------------------------------------------------------
 | Helpers
------------------------------------------------------- */
function hrefToString(href: Href): string {
    return typeof href === 'string' ? href : href.url;
}

export function AppSidebar() {
    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props;
    const user = auth.user;

    const NAV_MODULES = getNavModules(user);

    const homeHref =
        NAV_MODULES?.[0]?.items?.[0]?.href ?? '/';

    return (
        <Sidebar collapsible="icon" variant="inset">
            {/* ===== HEADER ===== */}
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={hrefToString(homeHref)} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            {/* ===== CONTENT ===== */}
            <SidebarContent className="space-y-4">
                {NAV_MODULES.map((group) => (
                    <div key={group.module}>
                        <div className="px-3 pb-1 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                            {group.module}
                        </div>

                        <NavMain items={group.items as any} />
                    </div>
                ))}
            </SidebarContent>

            {/* ===== FOOTER ===== */}
            <SidebarFooter>
                <NavFooter items={[]} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
