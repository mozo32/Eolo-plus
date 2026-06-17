import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { useMemo } from 'react';
import OperacionesCards from './operacionesDiarias/OperacionesCards';
import { getNavModules } from '@/components/navigation';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Operaciones Diarias',
    },
];

export default function OperacionesDiarias() {
    const { auth } = usePage<{ auth: { user: any } }>().props;

    const pageUrl = usePage().url;

    const nombreRol = auth.user.roles?.[0]?.nombre;
    const idUser = auth.user.id;

    const activeModule = useMemo(() => {
        const modules = getNavModules(auth.user);
        const savedModuleKey = localStorage.getItem('activeModule');

        const matchingModules = modules.filter(m =>
            m.items?.some(item => {
                if (!item || !item.href) return false;
                const href = typeof item.href === 'string' ? item.href : item.href?.url;
                return href && pageUrl.includes(href);
            })
        );

        if (matchingModules.length > 0) {
            const perfectMatch = matchingModules.find(m => String(m.key) === String(savedModuleKey));

            if (perfectMatch) {
                return perfectMatch;
            }
            return matchingModules[0];
        }

        if (savedModuleKey) {
            const found = modules.find(m => String(m.key) === String(savedModuleKey));
            if (found) return found;
        }

        return modules[0];
    }, [auth.user, pageUrl]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Operaciones Diarias" />
            <OperacionesCards
                key={activeModule?.key}
                moduloNombre={activeModule?.module}
                nombreRol={nombreRol}
                idUser = {idUser}
            />
        </AppLayout>
    );
}
