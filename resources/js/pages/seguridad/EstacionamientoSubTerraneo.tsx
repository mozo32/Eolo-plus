import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import EstaSubTerraneoTable from './estacionamientoSubTerraneo/EstaSubTerraneoTable';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Estacionamiento SubTerráneo',
    },
];

export default function EstacionamientoSubTerraneo() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Estacionamiento SubTerráneo" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="relative flex-1 rounded-xl border border-sidebar-border/70 p-6 dark:border-sidebar-border">
                    <EstaSubTerraneoTable/>
                </div>
            </div>
        </AppLayout>
    );
}
