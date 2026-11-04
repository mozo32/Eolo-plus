import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { ClipboardCheck, Plus } from 'lucide-react';
import { useState } from 'react';
import Swal from 'sweetalert2';
import { ErrorDeApi, fetchRelevo } from '@/stores/apiEntregaTurnoSeguridad';
import FormEntregaTurno from './entregaTurno/FormEntregaTurno';
import PendientesFirmaFbo from './entregaTurno/PendientesFirmaFbo';
import TablaEntregaTurno from './entregaTurno/TablaEntregaTurno';
import VistaPreviaEntregaTurno from './entregaTurno/VistaPreviaEntregaTurno';
import type { DetalleRelevo, FilaRelevo } from './entregaTurno/types';

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
    const [formAbierto, setFormAbierto] = useState(false);
    const [relevoEnEdicion, setRelevoEnEdicion] = useState<DetalleRelevo | null>(null);

    const [recargar, setRecargar] = useState(0);
    const [previa, setPrevia] = useState<FilaRelevo | null>(null);
    const [pendientesAbierto, setPendientesAbierto] = useState(false);

    const cerrarForm = () => {
        setFormAbierto(false);
        setRelevoEnEdicion(null);
    };

    const guardado = () => {
        cerrarForm();
        setRecargar(n => n + 1);
    };

    const editar = async (id: number) => {
        try {
            const { data } = await fetchRelevo(id);
            setRelevoEnEdicion(data);
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'No se pudo abrir el relevo',
                text: error instanceof Error ? error.message : 'Error inesperado',
            });

            // Un 404 es que alguien ya lo borró: se refresca para quitar el renglón.
            if (error instanceof ErrorDeApi && error.status === 404) {
                setRecargar(n => n + 1);
            }
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Entrega de Turno" />

            <div className="min-h-screen bg-[#f3f4f6] p-6">
                <div className="space-y-4">
                    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-4">
                            <h1 className="text-lg font-black uppercase text-slate-700">Entrega de Turno</h1>
                            <div className="flex items-center gap-2">
                            {puedeEditar && (
                                <button
                                    type="button"
                                    onClick={() => setPendientesAbierto(true)}
                                    className="flex items-center gap-2 rounded border border-amber-300 bg-amber-50 px-4 py-2 text-[10px] font-black text-amber-700 transition-all hover:bg-amber-100 active:scale-95"
                                >
                                    <ClipboardCheck size={14} />
                                    PENDIENTES
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    setRelevoEnEdicion(null);
                                    setFormAbierto(true);
                                }}
                                className="flex items-center gap-2 rounded bg-indigo-600 px-4 py-2 text-[10px] font-black text-white shadow-md shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95"
                            >
                                <Plus size={14} />
                                NUEVO RELEVO
                            </button>
                            </div>
                        </div>
                    </div>

                    <TablaEntregaTurno
                        puedeEditar={puedeEditar}
                        recargar={recargar}
                        onRecargar={() => setRecargar(n => n + 1)}
                        onEditar={editar}
                        onVerPrevia={setPrevia}
                    />
                </div>
            </div>

            <VistaPreviaEntregaTurno fila={previa} onCerrar={() => setPrevia(null)} />

            {puedeEditar && (
                <PendientesFirmaFbo
                    abierto={pendientesAbierto}
                    onCerrar={() => setPendientesAbierto(false)}
                    onFirmar={id => {
                        setPendientesAbierto(false);
                        editar(id);
                    }}
                />
            )}

            <FormEntregaTurno
                abierto={formAbierto || relevoEnEdicion !== null}
                relevo={relevoEnEdicion}
                nombreUsuario={user?.name ?? ''}
                puedeFirmarComoFbo={puedeEditar}
                onCerrar={cerrarForm}
                onGuardado={guardado}
            />
        </AppLayout>
    );
}
