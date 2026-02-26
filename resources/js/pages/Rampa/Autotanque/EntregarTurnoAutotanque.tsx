import EoloForm from './EoloForm';
import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { Header } from './Header';
import { SeccionInicio } from './SeccionInicio';
import { TablaRemisiones } from './TablaRemisiones';
import { ResumenBalance } from './ResumenBalance';
import { SeccionCierre } from './SeccionCierre';
import Swal from 'sweetalert2';
import { fetchRemisionesDelDia, guardarEntregarTurno, fetchTurnoActivo } from '@/stores/apiAutoTanque';

const TABLA_CALIBRACION: Record<number, number> = {
    0: 0, 1: 38, 2: 76, 3: 114, 4: 152, 5: 190, 6: 228, 7: 266, 8: 304, 9: 342, 10: 380,
    11: 418, 12: 456, 13: 493, 14: 559, 15: 624, 16: 690, 17: 756, 18: 822, 19: 888, 20: 954,
    21: 994, 22: 1066, 23: 1137, 24: 1208, 25: 1279, 26: 1350, 27: 1422, 28: 1496, 29: 1574, 30: 1653,
    31: 1731, 32: 1809, 33: 1887, 34: 1996, 35: 2085, 36: 2174, 37: 2263, 38: 2352, 39: 2441, 40: 2491,
    41: 2587, 42: 2684, 43: 2780, 44: 2876, 45: 2999, 46: 3096, 47: 3193, 48: 3290, 49: 3388, 50: 3497
};

interface DatosTurno {
    nombre: string;
    fecha: string;
    cmIni: number | null;
    litrosIni: number | null;
    totalizadorIni: number | null;
    nombreCierre: string;
    fechaCierre: string;
    cmCierre: number | null;
    litrosCierre: number | null;
    totalizadorCierre: number | null;
}

const EntregarTurnoAutotanque = () => {
    const [idTurno, setIdTurno] = useState<number | null>(null);
    const [remisiones, setRemisiones] = useState<{ folio: string, litros: number, isCancelled: boolean }[]>([]);
    const [showEoloForm, setShowEoloForm] = useState(false);
    const [cargando, setCargando] = useState(false);

    const obtenerFechaMexico = () => {
        const ahora = new Date();
        const opciones: Intl.DateTimeFormatOptions = {
            timeZone: 'America/Mexico_City',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        const formateador = new Intl.DateTimeFormat('sv-SE', opciones);
        return formateador.format(ahora).replace(', ', 'T').replace(' ', 'T');
    };

    const estadoInicial: DatosTurno = {
        nombre: '',
        fecha: obtenerFechaMexico(),
        cmIni: null,
        litrosIni: null,
        totalizadorIni: null,
        nombreCierre: '',
        fechaCierre: '',
        cmCierre: null,
        litrosCierre: null,
        totalizadorCierre: null
    };

    const [datos, setDatos] = useState<DatosTurno>(estadoInicial);

    const inicializarPantalla = async () => {
        setCargando(true);
        try {
            setIdTurno(null);
            setDatos(estadoInicial);
            setRemisiones([]);

            const data = await fetchTurnoActivo();

            if (data?.active) {
                setIdTurno(data.turno.id);
                setDatos(prev => ({
                    ...prev,
                    nombre: data.turno.nombre,
                    fecha: data.turno.fecha.replace(' ', 'T'),
                    cmIni: data.turno.cmIni,
                    litrosIni: data.turno.litrosIni,
                    totalizadorIni: data.turno.totalizadorIni,
                    nombreCierre: data.turno.nombreCierre || '',
                    cmCierre: data.turno.cmCierre || null,
                    totalizadorCierre: data.turno.totalizadorCierre || null
                }));

                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'info',
                    title: 'Editando turno pendiente',
                    showConfirmButton: false,
                    timer: 2000
                });

                await cargarDatosRemisiones(data.turno.fecha.split(' ')[0]);
            } else {
                await cargarDatosRemisiones(obtenerFechaMexico().split('T')[0]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setCargando(false);
        }
    };

    const cargarDatosRemisiones = async (fechaManual?: string) => {
        const fechaSoloDia = fechaManual || datos.fecha.split('T')[0];
        if (!fechaSoloDia) return;

        try {
            const data = await fetchRemisionesDelDia(fechaSoloDia);
            const formateadas = data.map((item: any) => ({
                folio: item.folio,
                litros: Number(item.total_litros),
                isCancelled: item.status === 'cancelado' || item.status === 'N'
            }));
            setRemisiones(formateadas);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        inicializarPantalla();
    }, []);

    useEffect(() => {
        if (!idTurno) {
            cargarDatosRemisiones();
        }
    }, [datos.fecha.split('T')[0]]);

    const handleUpdate = (key: string, val: any) => {
        setDatos(prev => {
            const nuevosDatos = { ...prev, [key]: val };
            if (key === 'cmIni' || key === 'cmCierre') {
                const litrosEncontrados = TABLA_CALIBRACION[val];
                if (litrosEncontrados !== undefined) {
                    const campoLitros = key === 'cmIni' ? 'litrosIni' : 'litrosCierre';
                    nuevosDatos[campoLitros] = litrosEncontrados;
                }
            }
            return nuevosDatos;
        });
    };

    const cancelarRemision = (index: number) => {
        Swal.fire({
            title: '¿Marcar como cancelada?',
            text: "Los litros se pondrán en 0 para el balance.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sí, cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                setRemisiones(prev => prev.map((rem, i) =>
                    i === index ? { ...rem, isCancelled: true } : rem
                ));
            }
        });
    };

    const totalVendidos = remisiones.reduce((acc, curr) => acc + (curr.isCancelled ? 0 : curr.litros), 0);
    const aritmetico = (datos.litrosIni ?? 0) - totalVendidos;
    const diferencia = aritmetico - (datos.litrosCierre ?? 0);

    const handleSuccessVenta = () => {
        cargarDatosRemisiones();
        setShowEoloForm(false);
        Swal.fire('Éxito', 'Remisión agregada correctamente', 'success');
    };

    const handleSubmit = async () => {
        const reporteFinal = {
            id: idTurno,
            ...datos,
            nombreCierre: datos.nombreCierre || 'PENDIENTE',
            cmCierre: datos.cmCierre || 0,
            litrosCierre: datos.litrosCierre || 0,
            totalizadorCierre: datos.totalizadorCierre || 0,
            resumen: {
                totalVendidos,
                balanceAritmetico: aritmetico,
                balanceFisico: datos.litrosCierre ?? 0,
                diferenciaFinal: diferencia
            }
        };

        try {
            setCargando(true);
            await guardarEntregarTurno(reporteFinal);
            await Swal.fire('¡Éxito!', 'El turno ha sido guardado correctamente.', 'success');
            await inicializarPantalla();
        } catch (error: any) {
            Swal.fire('Error', error.message, 'error');
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen">
            {showEoloForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="relative w-full max-w-5xl my-auto">
                        <button
                            onClick={() => setShowEoloForm(false)}
                            className="absolute top-4 right-4 z-10 bg-red-500 text-white px-4 py-2 rounded-full hover:bg-red-600 shadow-lg font-bold"
                        >
                            ✕ Cerrar
                        </button>
                        <EoloForm onSuccess={handleSuccessVenta} />
                    </div>
                </div>
            )}

            <Header />

            <form className="bg-white shadow-xl rounded-b-lg p-6 space-y-8" onSubmit={(e) => e.preventDefault()}>
                <SeccionInicio
                    {...datos}
                    onUpdate={handleUpdate}
                />

                <div className={cargando ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
                    <TablaRemisiones
                        remisiones={remisiones}
                        total={totalVendidos}
                        onAdd={() => setShowEoloForm(true)}
                        onDelete={cancelarRemision}
                    />
                </div>

                <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <SeccionCierre
                        nombreCierre={datos.nombreCierre}
                        fechaCierre={datos.fechaCierre}
                        cmCierre={datos.cmCierre}
                        litrosCierre={datos.litrosCierre}
                        totalizadorCierre={datos.totalizadorCierre}
                        onUpdate={handleUpdate}
                    />
                    <ResumenBalance
                        aritmetico={aritmetico}
                        fisico={datos.litrosCierre ?? 0}
                        diferencia={diferencia}
                    />
                </section>

                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={cargando}
                    className="w-full bg-blue-900 text-white py-4 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition shadow-lg disabled:bg-gray-400"
                >
                    <Save size={20} />
                    {cargando ? 'GUARDANDO...' : idTurno ? 'ACTUALIZAR Y FINALIZAR TURNO' : 'GUARDAR Y FINALIZAR TURNO'}
                </button>
            </form>
        </div>
    );
};

export default EntregarTurnoAutotanque;
