import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { useMemo, useEffect } from 'react';
import OperacionesCards from './operacionesDiarias/OperacionesCards';
import { getNavModules } from '@/components/navigation';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Operaciones Diarias',
    },
];

export default function OperacionesDiarias() {
    const { auth } = usePage<{ auth: { user: any } }>().props;

    const activeModule = useMemo(() => {
        const modules = getNavModules(auth.user);
        const savedModuleKey = localStorage.getItem('activeModule');

        if (savedModuleKey) {
            const found = modules.find(m => String(m.key) === savedModuleKey);
            if (found) return found;
        }
        return modules.find(m =>
            m.items.some(item => {
                const href = typeof item.href === 'string' ? item.href : item.href.url;
                return usePage().url === href;
            })
        );
    }, [auth.user]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Operaciones Diarias" />
            <OperacionesCards
                key={activeModule?.key}
                moduloNombre={activeModule?.module}
            />
        </AppLayout>
    );
}
