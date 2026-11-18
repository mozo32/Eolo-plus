import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { ErrorDeApi, fetchPendientesRelevo, fetchRelevo } from '@/stores/apiEntregaTurnoSeguridad';
import FormEntregaTurno from './entregaTurno/FormEntregaTurno';
import PendientesDeFirma from './entregaTurno/PendientesDeFirma';
import TablaEntregaTurno from './entregaTurno/TablaEntregaTurno';
import VistaPreviaEntregaTurno from './entregaTurno/VistaPreviaEntregaTurno';
import type { DetalleRelevo } from './entregaTurno/types';

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
    const puedeEditar = tieneRol('fbo', 'jefe_area', 'admin');
    // Qué firma de cierre puede poner ESTE usuario. El administrador las dos.
    const puedeFirmarJefe = tieneRol('jefe_area', 'admin');
    const puedeFirmarFbo = tieneRol('fbo', 'admin');
    const [formAbierto, setFormAbierto] = useState(false);
    const [relevoEnEdicion, setRelevoEnEdicion] = useState<DetalleRelevo | null>(null);

    const [recargar, setRecargar] = useState(0);
    const [previa, setPrevia] = useState<number | null>(null);
    const [pendientesAbierto, setPendientesAbierto] = useState(false);
    const [pendientes, setPendientes] = useState(0);
    // El FBO vacía la cola: si el formulario se abrió desde ella, al guardar vuelve a ella.
    const [veniaDeLaCola, setVeniaDeLaCola] = useState(false);

    /*
     * La cuenta se trae al cargar la pantalla y se refresca sola cada dos
     * minutos, igual que en Operaciones Diarias.
     *
     * Hace falta porque el botón solo aparece cuando hay algo pendiente: sin
     * la cuenta por delante, el FBO no sabría que tiene trabajo hasta abrir
     * el cajón, que es justo lo que este botón viene a evitar. `recargar`
     * entra en las dependencias para que guardar o eliminar la actualicen.
     */
    useEffect(() => {
        if (!puedeEditar) {
            return;
        }

        let vigente = true;

        const contar = async () => {
            try {
                const { data } = await fetchPendientesRelevo();

                if (vigente) {
                    setPendientes(data.length);
                }
            } catch {
                // Un fallo al contar no debe tumbar la pantalla: se queda la
                // cuenta anterior y el siguiente refresco lo corrige.
            }
        };

        contar();
        const intervalo = setInterval(contar, 120000);

        return () => {
            vigente = false;
            clearInterval(intervalo);
        };
    }, [puedeEditar, recargar]);

    const cerrarForm = () => {
        setFormAbierto(false);
        setRelevoEnEdicion(null);
        setVeniaDeLaCola(false);
    };

    const guardado = () => {
        const volverALaCola = veniaDeLaCola;

        cerrarForm();
        setRecargar(n => n + 1);

        if (volverALaCola) setPendientesAbierto(true);
    };

    // `desdeLaCola` va como argumento: leer la bandera del estado aquí daría el valor del render anterior.
    const editar = async (id: number, desdeLaCola = false) => {
        try {
            const { data } = await fetchRelevo(id);
            setRelevoEnEdicion(data);
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'No se pudo abrir el relevo',
                text: error instanceof ErrorDeApi ? error.message : 'No se pudo conectar con el servidor.',
            });

            // Un 404 es que alguien ya lo borró: se refresca para quitar el renglón.
            if (error instanceof ErrorDeApi && error.status === 404) {
                setRecargar(n => n + 1);
            }

            // Si venía de la cola, se la devuelve: así desaparece el pendiente que ya no existe.
            setVeniaDeLaCola(false);

            if (desdeLaCola) setPendientesAbierto(true);
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
                            {/*
                              * Mismo botón que en Operaciones Diarias: rojo,
                              * pulsante, con la cuenta, y SOLO cuando hay algo.
                              * Que desaparezca es parte del diseño: su ausencia
                              * es la respuesta a «¿tengo algo por firmar?».
                              */}
                            {puedeEditar && pendientes > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setPendientesAbierto(true)}
                                    className="relative flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white shadow-md transition-all animate-pulse hover:bg-red-700"
                                >
                                    <span className="flex h-3 w-3">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
                                        <span className="relative inline-flex h-3 w-3 rounded-full bg-white"></span>
                                    </span>
                                    <span className="text-sm font-bold">
                                        PENDIENTES ({pendientes})
                                    </span>
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

            <VistaPreviaEntregaTurno id={previa} onCerrar={() => setPrevia(null)} />

            {puedeEditar && (
                <PendientesDeFirma
                    abierto={pendientesAbierto}
                    onCerrar={() => setPendientesAbierto(false)}
                    onFirmar={id => {
                        setPendientesAbierto(false);
                        setVeniaDeLaCola(true);
                        editar(id, true);
                    }}
                />
            )}

            <FormEntregaTurno
                abierto={formAbierto || relevoEnEdicion !== null}
                relevo={relevoEnEdicion}
                nombreUsuario={user?.name ?? ''}
                puedeFirmarJefe={puedeFirmarJefe}
                puedeFirmarFbo={puedeFirmarFbo}
                onCerrar={cerrarForm}
                onGuardado={guardado}
            />
        </AppLayout>
    );
}
