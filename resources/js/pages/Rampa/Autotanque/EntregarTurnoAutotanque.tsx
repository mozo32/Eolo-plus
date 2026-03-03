import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import Swal from 'sweetalert2';
import { Header } from './Header';
import { SeccionInicio } from './SeccionInicio';
import { TablaRemisiones } from './TablaRemisiones';
import { ResumenBalance } from './ResumenBalance';
import { SeccionCierre } from './SeccionCierre';
import { BuscadorRemisiones } from './BuscadorRemisiones';
import { ModalConceptosSuman } from './ModalConceptosSuman';
import { guardarEntregarTurno, fetchTurnoActivo, fetchUltimoTotalizador,cancelarRemisionAPI} from '@/stores/apiAutoTanque';

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
    const [remisiones, setRemisiones] = useState<{ id: string, folio: string, litros: number, isCancelled: boolean }[]>([]);
    const [entradasASA, setEntradasASA] = useState<{ litros: number, remision: string }[]>([]);
    const [showBuscador, setShowBuscador] = useState(false);
    const [showSuman, setShowSuman] = useState(false);
    const [cargando, setCargando] = useState(false);

    const obtenerFechaMexico = () => {
        const ahora = new Date();
        const opciones: Intl.DateTimeFormatOptions = {
            timeZone: 'America/Mexico_City',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false
        };
        return new Intl.DateTimeFormat('sv-SE', opciones).format(ahora).replace(', ', 'T').replace(' ', 'T');
    };

    const estadoInicial: DatosTurno = {
        nombre: '',
        fecha: obtenerFechaMexico(),
        cmIni: null, litrosIni: null, totalizadorIni: null,
        nombreCierre: '', fechaCierre: '',
        cmCierre: null, litrosCierre: null, totalizadorCierre: null
    };

    const [datos, setDatos] = useState<DatosTurno>(estadoInicial);

    const inicializarPantalla = async () => {
        setCargando(true);
        try {
            setIdTurno(null);
            setDatos(estadoInicial);
            setRemisiones([]);
            setEntradasASA([]);

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
            }
            else {
                const lastData = await fetchUltimoTotalizador();
                if (lastData && lastData.totalizador !== undefined) {
                    setDatos(prev => ({
                        ...prev,
                        totalizadorIni: lastData.totalizador
                    }));
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        inicializarPantalla();
    }, []);

    const handleUpdate = (key: string, val: any) => {
        setDatos(prev => {
            const nuevosDatos = { ...prev, [key]: val };
            if (key === 'cmIni' || key === 'cmCierre') {
                const litros = TABLA_CALIBRACION[val];
                if (litros !== undefined) {
                    nuevosDatos[key === 'cmIni' ? 'litrosIni' : 'litrosCierre'] = litros;
                }
            }
            return nuevosDatos;
        });
    };

    const cancelarRemision = async (index: number) => {
        const remision = remisiones[index];
        console.log('remision', remision);

        if (!remision.folio) return;

        const result = await Swal.fire({
            title: '¿Marcar como cancelada?',
            text: `La remisión ${remision.folio} se cambiará a estatus 'N' en el sistema.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, cancelar',
            showLoaderOnConfirm: true,
            preConfirm: async () => {
                try {
                    await cancelarRemisionAPI(remision.id);
                    return true;
                } catch (error) {
                    Swal.showValidationMessage(`Error: ${error}`);
                }
            },
            allowOutsideClick: () => !Swal.isLoading()
        });

        if (result.isConfirmed) {
            // ACTUALIZACIÓN DEL ESTADO LOCAL
            setRemisiones(prev => prev.map((rem, i) =>
                i === index ? { ...rem, isCancelled: true } : rem
            ));

            Swal.fire('Cancelada', 'El estatus se actualizó a N', 'success');
        }
    };

    const handleAddSuman = (data: { litros: number, remision: string }) => {
        setEntradasASA(prev => [...prev, data]);
        setShowSuman(false);
        Swal.fire('Agregado', `${data.litros} Lts sumados`, 'success');
    };

    const totalSuman = entradasASA.reduce((acc, curr) => acc + curr.litros, 0);
    const totalVendidos = remisiones.reduce((acc, curr) => acc + (curr.isCancelled ? 0 : curr.litros), 0);
    const aritmetico = ((datos.litrosIni ?? 0) + totalSuman) - totalVendidos;
    const diferencia = aritmetico - (datos.litrosCierre ?? 0);

    const handleSubmit = async () => {
        if (!datos.nombreCierre || !datos.totalizadorCierre) {
            return Swal.fire('Atención', 'Por favor completa los datos de cierre antes de continuar', 'warning');
        }

        setCargando(true);
        try {
            const reporteFinal = {
                id: idTurno,
                ...datos,
                nombreCierre: datos.nombreCierre || 'PENDIENTE',
                remisiones: remisiones.map(r => ({
                    folio: r.folio,
                    litros: r.litros,
                    isCancelled: r.isCancelled
                })),
                entradasASA: entradasASA.map(e => ({
                    folio: e.remision,
                    litros: e.litros
                })),
                resumen: {
                    totalVendidos,
                    totalSuman,
                    balanceAritmetico: aritmetico,
                    balanceFisico: datos.litrosCierre ?? 0,
                    diferenciaFinal: diferencia
                }
            };

            await guardarEntregarTurno(reporteFinal);

            await Swal.fire({
                title: '¡Éxito!',
                text: 'El turno y sus movimientos han sido guardados.',
                icon: 'success',
                timer: 2000
            });

            inicializarPantalla();
        } catch (error: any) {
            Swal.fire('Error', error.message || 'No se pudo guardar el turno', 'error');
        } finally {
            setCargando(false);
        }
    };

    const handleSeleccionarRemision = (res: any) => {
        if (remisiones.some(r => r.folio === res.folio)) {
            return Swal.fire('Atención', 'Esta remisión ya está en la lista', 'warning');
        }
        setRemisiones(prev => [...prev, { id: res.id, folio: res.folio, litros: Number(res.total_litros), isCancelled: res.status === 'cancelado' || res.status === 'N' }]);
        setShowBuscador(false);
    };
    useEffect(() => {
        const calculado = (datos.totalizadorIni ?? 0) + totalVendidos;
        if (calculado !== datos.totalizadorCierre) {
            handleUpdate('totalizadorCierre', calculado);
        }
    }, [datos.totalizadorIni, totalVendidos]);
    return (
        <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen">
            {showBuscador && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <BuscadorRemisiones
                        onSelect={handleSeleccionarRemision}
                        onClose={() => setShowBuscador(false)}
                        foliosExistentes={remisiones.map(r => r.folio)}
                    />
                </div>
            )}
            {showSuman && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <ModalConceptosSuman onAdd={handleAddSuman} onClose={() => setShowSuman(false)} />
                </div>
            )}

            <Header />

            <form className="bg-white shadow-xl rounded-b-lg p-6 space-y-8" onSubmit={e => e.preventDefault()}>
                <SeccionInicio {...datos} onUpdate={handleUpdate}/>

                <div className={cargando ? "opacity-50 pointer-events-none" : ""}>
                    <TablaRemisiones
                        remisiones={remisiones}
                        entradasASA={entradasASA}
                        total={totalVendidos}
                        onAdd={() => setShowBuscador(true)}
                        onAddSuman={() => setShowSuman(true)}
                        onDeleteVenta={cancelarRemision}
                        onDeleteSuma={(idx) => setEntradasASA(prev => prev.filter((_, i) => i !== idx))}
                    />
                </div>

                <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <SeccionCierre {...datos} onUpdate={handleUpdate} />
                    <ResumenBalance aritmetico={aritmetico} fisico={datos.litrosCierre ?? 0} diferencia={diferencia} />
                </section>

                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={cargando}
                    className="w-full bg-blue-900 text-white py-4 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition disabled:bg-gray-400"
                >
                    <Save size={20} />
                    {cargando ? 'GUARDANDO...' : 'GUARDAR Y FINALIZAR TURNO'}
                </button>
            </form>
        </div>
    );
};

export default EntregarTurnoAutotanque;
