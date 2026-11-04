import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';

type Role = { slug: string; nombre: string; };
type AuthUser = { id: number; name: string; email: string; isAdmin: boolean; roles: Role[]; };
type PageProps = { auth: { user: AuthUser | null; }; };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Entrega de Turno' },
];

export default function EntregaTurno() {
    const { auth } = usePage<PageProps>().props;
    const user = auth.user;
    const rolesUsuario = new Set(
        (user?.roles ?? []).map(role => role.slug.trim().toLowerCase()),
    );
    const tieneRol = (...roles: string[]) => roles.some(role => rolesUsuario.has(role));
    const puedeEditar = tieneRol('fbo', 'admin');

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Entrega de Turno" />

            <div className="min-h-screen bg-[#f3f4f6] p-6">
                <div className="space-y-4">
                    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                        <h1 className="text-lg font-black uppercase text-slate-700">Entrega de Turno</h1>
                    </div>

                    {/* Las tareas 9 y 10 llenan la tabla y el formulario. */}
                    <div data-puede-editar={puedeEditar} />
                </div>
            </div>
        </AppLayout>
    );
}
