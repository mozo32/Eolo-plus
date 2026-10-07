import { obtenerPersonalTraficoApi } from '@/stores/apiPrestamoChalecos';
import { useVentanaDeFecha } from '@/lib/ventanasDeFecha';
import { fechaHoy } from '@/pages/despacho/operacionesProgramadas/types';
import { Eraser, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import FotoIne from './FotoIne';
import { NOMBRE_MAX, validarArchivoFoto, type ErroresPrestamoChaleco, type PrestamoChalecoForm as Formulario, type UsuarioTrafico } from './types';

interface Props {
    /** Guarda el formulario ya validado; resuelve false si el servidor lo rechazó. */
    onGuardado: (datos: Formulario) => Promise<boolean>;
    /** Avisa si hay algo capturado, para que el modal pida confirmación al cerrar. */
    onCambioCaptura?: (tieneDatos: boolean) => void;
}

const formularioInicial = (): Formulario => ({
    fecha: fechaHoy(),
    nombre_recibe: '',
    usuario_entrega_id: null,
    foto_ine: null,
});

// Mismas constantes de estilo que ServicioComisariatoForm (Tráfico).
const inputStyle =
    'w-full rounded-lg border-2 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-[#00677F] focus:bg-white focus:ring-2 focus:ring-[#00677F]/20 focus:outline-none';
const labelStyle = 'mb-1 block text-xs font-extrabold uppercase text-slate-600';
const sectionTitle = 'mb-4 text-xs font-extrabold uppercase tracking-widest text-[#00677F]';
const campoConError = (conError: boolean) => `${inputStyle} ${conError ? 'border-red-400' : 'border-slate-300'}`;
// Tráfico no muestra errores en línea; se toma el de las evidencias de Vehículos EOLO.
const errorStyle = 'mt-1 text-sm font-medium text-red-600';

/**
 * Formulario del préstamo. Prototipo: valida en el navegador y entrega los
 * datos al padre; no hace ninguna petición HTTP.
 */
export default function PrestamoChalecoForm({ onGuardado, onCambioCaptura }: Props) {
    const { min, max } = useVentanaDeFecha('chalecos.prestamo');
    // Solo personal del área de Tráfico; lo filtra el backend.
    const [usuariosTrafico, setUsuariosTrafico] = useState<UsuarioTrafico[]>([]);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        let cancelado = false;

        obtenerPersonalTraficoApi()
            .then(lista => {
                if (!cancelado) setUsuariosTrafico(lista);
            })
            .catch(() => {
                if (!cancelado) setUsuariosTrafico([]);
            });

        return () => {
            cancelado = true;
        };
    }, []);

    const [form, setForm] = useState<Formulario>(formularioInicial);
    const [errores, setErrores] = useState<ErroresPrestamoChaleco>({});

    const fechaRef = useRef<HTMLInputElement>(null);
    const nombreRef = useRef<HTMLInputElement>(null);
    const entregaRef = useRef<HTMLSelectElement>(null);
    const fotoRef = useRef<HTMLButtonElement>(null);

    const actualizar = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => {
        setForm(previo => ({ ...previo, [campo]: valor }));
        setErrores(previos => (previos[campo] ? { ...previos, [campo]: undefined } : previos));
    };

    const validar = (): ErroresPrestamoChaleco => {
        const nuevos: ErroresPrestamoChaleco = {};

        if (!form.fecha) nuevos.fecha = 'La fecha es obligatoria.';

        const nombre = form.nombre_recibe.trim();
        if (!nombre) nuevos.nombre_recibe = 'Escribe el nombre de quien recibe el chaleco.';
        else if (nombre.length > NOMBRE_MAX) nuevos.nombre_recibe = `El nombre no debe exceder ${NOMBRE_MAX} caracteres.`;

        if (form.usuario_entrega_id === null) nuevos.usuario_entrega_id = 'Selecciona quién entrega el chaleco.';

        if (!form.foto_ine) nuevos.foto_ine = 'Toma o selecciona la fotografía de la INE.';
        else {
            const errorFoto = validarArchivoFoto(form.foto_ine);
            if (errorFoto) nuevos.foto_ine = errorFoto;
        }

        return nuevos;
    };

    const enfocarPrimerError = (nuevos: ErroresPrestamoChaleco) => {
        if (nuevos.fecha) return fechaRef.current?.focus();
        if (nuevos.nombre_recibe) return nombreRef.current?.focus();
        if (nuevos.usuario_entrega_id) return entregaRef.current?.focus();
        if (nuevos.foto_ine) return fotoRef.current?.focus();
    };

    const guardar = (e: React.FormEvent) => {
        if (guardando) return;

        e.preventDefault();

        const nuevos = validar();
        setErrores(nuevos);

        if (Object.keys(nuevos).length > 0) {
            enfocarPrimerError(nuevos);
            return;
        }

        setGuardando(true);
        void onGuardado({ ...form, nombre_recibe: form.nombre_recibe.trim() }).finally(() => setGuardando(false));
    };

    const tieneInformacion = form.nombre_recibe.trim() !== '' || form.usuario_entrega_id !== null || form.foto_ine !== null || form.fecha !== fechaHoy();

    useEffect(() => {
        onCambioCaptura?.(tieneInformacion);
    }, [tieneInformacion, onCambioCaptura]);

    const limpiar = async () => {
        if (tieneInformacion) {
            const confirmacion = await Swal.fire({
                title: 'Limpiar formulario',
                text: 'Se perderá la información capturada, incluida la fotografía.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, limpiar',
                cancelButtonText: 'Regresar',
                confirmButtonColor: '#dc2626',
                reverseButtons: true,
            });

            if (!confirmacion.isConfirmed) return;
        }

        // Al quitar el File del estado, FotoIne revoca la URL temporal.
        setForm(formularioInicial());
        setErrores({});
    };

    return (
        <form onSubmit={guardar} noValidate className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="border bg-slate-50 p-5 space-y-4">
                    <h4 className={sectionTitle}>Datos del préstamo</h4>

                    <div>
                        <label htmlFor="fecha" className={labelStyle}>
                            Fecha <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="fecha"
                            ref={fechaRef}
                            type="date"
                            min={min}
                            max={max}
                            value={form.fecha}
                            onChange={e => actualizar('fecha', e.target.value)}
                            className={campoConError(!!errores.fecha)}
                            required
                        />
                        {errores.fecha && <p className={errorStyle}>{errores.fecha}</p>}
                    </div>

                    <div>
                        <label htmlFor="nombre_recibe" className={labelStyle}>
                            Nombre de quien recibe el chaleco <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="nombre_recibe"
                            ref={nombreRef}
                            type="text"
                            value={form.nombre_recibe}
                            onChange={e => actualizar('nombre_recibe', e.target.value.toUpperCase())}
                            onBlur={e => actualizar('nombre_recibe', e.target.value.trim())}
                            placeholder="NOMBRE COMPLETO"
                            maxLength={NOMBRE_MAX}
                            autoComplete="off"
                            className={`${campoConError(!!errores.nombre_recibe)} uppercase`}
                            required
                        />
                        {errores.nombre_recibe && <p className={errorStyle}>{errores.nombre_recibe}</p>}
                    </div>

                    <div>
                        <label htmlFor="usuario_entrega_id" className={labelStyle}>
                            Nombre de quien entrega el chaleco <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="usuario_entrega_id"
                            ref={entregaRef}
                            value={form.usuario_entrega_id ?? ''}
                            onChange={e => actualizar('usuario_entrega_id', e.target.value === '' ? null : Number(e.target.value))}
                            className={`${campoConError(!!errores.usuario_entrega_id)} ${form.usuario_entrega_id === null ? 'text-slate-400' : ''}`}
                            required
                        >
                            <option value="">Selecciona quién entrega</option>
                            {usuariosTrafico.map(usuario => (
                                <option key={usuario.id} value={usuario.id} className="text-slate-700">
                                    {usuario.nombre}
                                </option>
                            ))}
                        </select>
                        {errores.usuario_entrega_id && <p className={errorStyle}>{errores.usuario_entrega_id}</p>}
                        <p className="mt-1 text-[10px] font-bold text-slate-400 italic">Solo personal del área de Tráfico.</p>
                    </div>
                </div>

                <div className="border bg-slate-50 p-5 space-y-4">
                    <h4 className={sectionTitle}>Evidencia</h4>
                    <FotoIne value={form.foto_ine} onChange={archivo => actualizar('foto_ine', archivo)} error={errores.foto_ine} focoRef={fotoRef} />
                </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <button
                    type="button"
                    onClick={limpiar}
                    className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                    <Eraser size={16} />
                    Limpiar formulario
                </button>
                <button
                    type="submit"
                    disabled={guardando}
                    className="flex items-center justify-center gap-2 rounded-lg bg-[#00677F] px-12 py-4 disabled:opacity-50 text-sm font-extrabold uppercase tracking-widest text-white transition-colors hover:bg-[#00586D] shadow-md active:scale-95"
                >
                    <Save size={16} />
                    {guardando ? 'Guardando…' : 'Guardar préstamo'}
                </button>
            </div>
        </form>
    );
}
