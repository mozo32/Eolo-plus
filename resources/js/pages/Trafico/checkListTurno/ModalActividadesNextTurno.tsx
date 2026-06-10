import { useState } from 'react';
import { X, ClipboardList } from 'lucide-react';
import Swal from 'sweetalert2';
import { usePage } from '@inertiajs/react';

type Props = {
    isOpen: boolean;
    onClose: () => void;
};
type Role = { slug: string; nombre: string; };
export type AuthUser = {
    id: number;
    name: string;
    email: string;
    isAdmin: boolean;
    roles: Role[];
    departamentos: {
        id: number;
        nombre: string;
        subdepartamentos: { id: number; nombre: string; route: string; }[];
    }[];
};
function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}
export default function ModalActividadesNextTurno({ isOpen, onClose }: Props) {
    const [nota, setNota] = useState('');
    const [guardando, setGuardando] = useState(false);
    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props;
    const user = auth?.user;
    if (!isOpen) return null;

    const handleGuardar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nota.trim()) {
            Swal.fire({ icon: 'warning', title: 'Nota vacía', text: 'Por favor escribe alguna actividad o pendiente.' });
            return;
        }
        const xsrf = getXsrfToken();
        setGuardando(true);
        try {
            const response = await fetch('/api/CheckListTurno/notas', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': xsrf,
                },
                body: JSON.stringify({
                    descripcion: nota
                })
            });

            // Convertimos la respuesta a un objeto JSON
            const resData = await response.json();

            // Validamos si el servidor respondió con un estatus exitoso (200-299) y nuestra bandera ok
            if (response.ok && resData.ok) {
                Swal.fire({ icon: 'success', title: 'Nota Guardada', text: 'Las actividades para el siguiente turno se registraron.', timer: 2000, showConfirmButton: false });
                setNota('');
                onClose();
            } else {
                // Manejo en caso de que el backend mande un error controlado (ej: validación)
                Swal.fire({ icon: 'error', title: 'Error', text: resData.message || 'No se pudo guardar la nota operacional.' });
            }
        } catch (error) {
            // Error de red o fallo general
            Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo conectar con el servidor.' });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">

                {/* Encabezado */}
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div>
                        <h3 className="text-sm font-black uppercase text-slate-800 tracking-tighter flex items-center gap-2">
                            <ClipboardList size={16} className="text-indigo-500" />
                            Actividades Siguiente Turno
                        </h3>
                        <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest">Notas operacionales de relevo</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Formulario */}
                <form onSubmit={handleGuardar} className="p-6 space-y-4">
                    <div className="space-y-1">
                        <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                            Pendientes / Consignas especiales
                        </label>
                        <textarea
                            rows={5}
                            className="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400 placeholder:font-normal uppercase"
                            placeholder="EJ. DEJAR AUTOTANQUE 2 EN RAMPA, REVISAR SUMINISTROS DE CAFETERÍA EN SALA VIP PARA MAÑANA, ETC..."
                            value={nota}
                            onChange={(e) => setNota(e.target.value)}
                            disabled={guardando}
                        />
                    </div>

                    {/* Botones de Control */}
                    <div className="flex gap-2 justify-end pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={guardando}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md shadow-indigo-100 transition-all disabled:opacity-50"
                        >
                            {guardando ? 'Guardando...' : 'Guardar Nota'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
