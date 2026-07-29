import {
    useEffect,
    useState,
    type ChangeEvent,
    type FormEvent,
} from 'react';

import MovimientoCSAEEntrada from './MovimientoCSAEEntrada';
import MovimientoCSAESalida from './MovimientoCSAESalida';
import MovimientoCSAEEditarCompleto from './MovimientoCSAEEditarCompleto';

import {
    guardarMovimientoCSAEApi,
    guardarMovimientoCSASalida,
} from '@/stores/apiMovimientoCSAE';

import Swal from 'sweetalert2';
import { LoaderCircle, Save, Send } from 'lucide-react';

type Props = {
    isEdit: boolean;
    modoSalida?: boolean;
    modoCompleto?: boolean;
    data?: any;
    open: boolean;
    onSuccess?: () => void | Promise<void>;
};

const obtenerFechaMexico = (): string => {
    const partes = new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());

    const obtenerParte = (type: string) =>
        partes.find((parte) => parte.type === type)?.value ?? '';

    const anio = obtenerParte('year');
    const mes = obtenerParte('month');
    const dia = obtenerParte('day');

    return `${anio}-${mes}-${dia}`;
};

const separarFechaHora = (
    valor?: string | null,
): {
    fecha: string;
    hora: string;
} => {
    if (!valor) {
        return {
            fecha: '',
            hora: '',
        };
    }

    const normalizado = String(valor)
        .replace(' ', 'T')
        .replace('Z', '');

    const [fecha = '', horaCompleta = ''] =
        normalizado.split('T');

    return {
        fecha,
        hora: horaCompleta.slice(0, 5),
    };
};

const combinarFechaHora = (
    fecha?: string,
    hora?: string,
): string | null => {
    if (!fecha || !hora) {
        return null;
    }

    return `${fecha} ${hora}:00`;
};

const horaValida = (hora?: string): boolean => {
    if (!hora) return false;

    return /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
};

const getInitialForm = (
    data?: any,
    modoSalida = false,
) => {
    const entrada = separarFechaHora(
        data?.fecha_hora_entrada,
    );

    const salida = separarFechaHora(
        data?.fecha_hora_salida,
    );

    const firmaEntrada = data?.firmas?.find(
        (firma: any) =>
            firma.rol === 'firma_entrada' &&
            firma.status === 'A',
    );

    const firmaSalida = data?.firmas?.find(
        (firma: any) =>
            firma.rol === 'firma_salida' &&
            firma.status === 'A',
    );

    return {
        fecha_entrada:
            entrada.fecha ||
            (!data ? obtenerFechaMexico() : ''),

        hora_entrada: entrada.hora,

        matricula: data?.matricula ?? '',
        tipo_aeronave: data?.tipo_aeronave ?? '',
        como_llega: data?.como_llega ?? '',
        transportista: data?.transportista ?? '',
        observaciones_entrada:
            data?.observaciones_entrada ?? '',
        quien_recibe: data?.quien_recibe ?? '',
        firma_entrada: firmaEntrada?.url ?? '',

        fecha_salida:
            salida.fecha ||
            (modoSalida ? obtenerFechaMexico() : ''),

        hora_salida: salida.hora,

        observaciones_salida:
            data?.observaciones_salida ?? '',

        firma_salida: firmaSalida?.url ?? '',
    };
};

export default function MovimientoCSAEForm({
    isEdit,
    modoSalida = false,
    modoCompleto = false,
    data,
    open,
    onSuccess,
}: Props) {
    const [formData, setFormData] = useState(() =>
        getInitialForm(data, modoSalida),
    );

    const [isSubmitting, setIsSubmitting] =
        useState(false);

    useEffect(() => {
        if (!open) return;

        setFormData(
            getInitialForm(
                isEdit ? data : undefined,
                modoSalida,
            ),
        );
    }, [
        data,
        isEdit,
        modoSalida,
        modoCompleto,
        open,
    ]);

    const updateField = (
        key: string,
        value: any,
    ) => {
        setFormData((previous) => ({
            ...previous,
            [key]: value,
        }));
    };

    const handleChange = (
        event: ChangeEvent<
            | HTMLInputElement
            | HTMLTextAreaElement
            | HTMLSelectElement
        >,
    ) => {
        const { name, value } = event.target;

        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const handleSubmit = async (
        event: FormEvent,
    ) => {
        event.preventDefault();

        if (isSubmitting) return;

        if (!modoSalida) {
            if (!formData.fecha_entrada) {
                await Swal.fire({
                    icon: 'warning',
                    title: 'Fecha requerida',
                    text: 'No fue posible establecer la fecha de entrada.',
                    confirmButtonColor: '#1d4ed8',
                });

                return;
            }

            if (!horaValida(formData.hora_entrada)) {
                await Swal.fire({
                    icon: 'warning',
                    title: 'Hora incorrecta',
                    text: 'Escriba la hora de entrada en formato de 24 horas, por ejemplo 18:30.',
                    confirmButtonColor: '#1d4ed8',
                });

                return;
            }
        }

        if (modoSalida) {
            if (!formData.fecha_salida) {
                await Swal.fire({
                    icon: 'warning',
                    title: 'Fecha requerida',
                    text: 'No fue posible establecer la fecha de salida.',
                    confirmButtonColor: '#1d4ed8',
                });

                return;
            }

            if (!horaValida(formData.hora_salida)) {
                await Swal.fire({
                    icon: 'warning',
                    title: 'Hora incorrecta',
                    text: 'Escriba la hora de salida en formato de 24 horas, por ejemplo 21:45.',
                    confirmButtonColor: '#1d4ed8',
                });

                return;
            }
        }

        const {
            fecha_entrada,
            hora_entrada,
            fecha_salida,
            hora_salida,
            ...otrosCampos
        } = formData;

        const payload = {
            ...otrosCampos,

            fecha_hora_entrada:
                combinarFechaHora(
                    fecha_entrada,
                    hora_entrada,
                ),

            fecha_hora_salida:
                combinarFechaHora(
                    fecha_salida,
                    hora_salida,
                ),
        };

        setIsSubmitting(true);

        try {
            Swal.fire({
                title: 'Procesando...',
                text: 'Guardando información del movimiento',
                allowOutsideClick: false,
                allowEscapeKey: false,
                didOpen: () => Swal.showLoading(),
            });

            if (isEdit && data?.id) {
                await guardarMovimientoCSASalida(
                    data.id,
                    payload,
                );
            } else {
                await guardarMovimientoCSAEApi(
                    payload,
                );
            }

            await Swal.fire({
                icon: 'success',
                title: modoCompleto
                    ? 'Registro actualizado correctamente'
                    : modoSalida
                        ? 'Salida guardada correctamente'
                        : 'Entrada guardada correctamente',
                timer: 1400,
                showConfirmButton: false,
            });

            await onSuccess?.();
        } catch (error: any) {
            await Swal.fire({
                icon: 'error',
                title: 'No se pudo guardar',
                text:
                    error?.message ||
                    'Ocurrió un error al guardar la información',
                confirmButtonColor: '#1d4ed8',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const buttonText = modoCompleto
        ? 'Actualizar registro completo'
        : modoSalida
            ? 'Guardar salida'
            : 'Guardar movimiento';

    return (
        <form
            onSubmit={handleSubmit}
            className="animate-in fade-in duration-500"
        >
            <div className="bg-[#f8fafc] p-4 md:p-6">
                {modoCompleto ? (
                    <MovimientoCSAEEditarCompleto
                        data={formData}
                        onChange={handleChange}
                        updateField={updateField}
                    />
                ) : modoSalida ? (
                    <MovimientoCSAESalida
                        data={formData}
                        onChange={handleChange}
                        updateField={updateField}
                    />
                ) : (
                    <MovimientoCSAEEntrada
                        data={formData}
                        onChange={handleChange}
                        updateField={updateField}
                    />
                )}
            </div>

            <div className="border-t border-slate-100 bg-white p-5 md:p-8">
                <div className="mx-auto max-w-6xl">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`flex w-full items-center justify-center gap-3 rounded-[1.5rem] py-4 text-xs font-black uppercase tracking-[0.18em] text-white shadow-xl transition-all ${
                            isSubmitting
                                ? 'cursor-not-allowed bg-slate-300 shadow-none'
                                : 'bg-blue-600 shadow-blue-200 hover:bg-blue-700 active:scale-[0.99]'
                        }`}
                    >
                        {isSubmitting ? (
                            <>
                                <LoaderCircle
                                    size={20}
                                    className="animate-spin"
                                />

                                Guardando información...
                            </>
                        ) : (
                            <>
                                {modoSalida ? (
                                    <Send size={20} />
                                ) : (
                                    <Save size={20} />
                                )}

                                {buttonText}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </form>
    );
}
