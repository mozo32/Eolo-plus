import React, { useState, useEffect } from 'react';
import { Save, X } from 'lucide-react';
import Swal from 'sweetalert2';
import { Header } from './Header';
import { SeccionInicio } from './SeccionInicio';
import { TablaRemisiones } from './TablaRemisiones';
import { ResumenBalance } from './ResumenBalance';
import { SeccionCierre } from './SeccionCierre';
import { BuscadorRemisiones } from './BuscadorRemisiones';
import { ModalConceptosSuman } from './ModalConceptosSuman';
import { guardarEntregarTurno, fetchTurnoActivo, fetchUltimoTotalizador, cancelarRemisionAPI } from '@/stores/apiAutoTanque';
import { CheckEstadoAutotanque } from '../VerificacionEstadoAutotanque/CheckEstadoAutotanque';

const TABLA_CALIBRACION: Record<number, number> = { 0: 0, 1: 38, 2: 76, 3: 114, 4: 152, 5: 190, 6: 228, 7: 266, 8: 304, 9: 342, 10: 380, 11: 418, 12: 456, 13: 493, 14: 559, 15: 624, 16: 690, 17: 756, 18: 822, 19: 888, 20: 954, 21: 994, 22: 1066, 23: 1137, 24: 1208, 25: 1279, 26: 1350, 27: 1422, 28: 1496, 29: 1574, 30: 1653, 31: 1731, 32: 1809, 33: 1887, 34: 1996, 35: 2085, 36: 2174, 37: 2263, 38: 2352, 39: 2441, 40: 2491, 41: 2587, 42: 2684, 43: 2780, 44: 2876, 45: 2999, 46: 3096, 47: 3193, 48: 3290, 49: 3388, 50: 3497 };

const obtenerLitrosInterpolados = (cm: number): number => {
    const puntos = Object.keys(TABLA_CALIBRACION).map(Number).sort((a, b) => a - b);
    if (TABLA_CALIBRACION[cm] !== undefined) return TABLA_CALIBRACION[cm];
    if (cm <= puntos[0]) return TABLA_CALIBRACION[puntos[0]];
    if (cm >= puntos[puntos.length - 1]) return TABLA_CALIBRACION[puntos[puntos.length - 1]];
    let x0 = puntos[0], x1 = puntos[puntos.length - 1];
    for (let i = 0; i < puntos.length; i++) { if (puntos[i] > cm) { x1 = puntos[i]; x0 = puntos[i - 1]; break; } }
    const y0 = TABLA_CALIBRACION[x0], y1 = TABLA_CALIBRACION[x1];
    return Math.round(y0 + (cm - x0) * ((y1 - y0) / (x1 - x0)));
};

interface DatosTurno {
    nombre: string; fecha: string; cmIni: number | null; litrosIni: number | null; totalizadorIni: number | null;
    nombreCierre: string; fechaCierre: string; cmCierre: number | null; litrosCierre: number | null; totalizadorCierre: number | null;
}

const EntregarTurnoAutotanque = ({ initialData, onSuccess }: { initialData?: any, onSuccess?: () => void }) => {
    const [idTurno, setIdTurno] = useState<number | null>(null);
    const [remisiones, setRemisiones] = useState<{ id: string, folio: string, litros: number, isCancelled: boolean }[]>([]);
    const [entradasASA, setEntradasASA] = useState<{ litros: number, remision: string }[]>([]);
    const [showBuscador, setShowBuscador] = useState(false);
    const [showSuman, setShowSuman] = useState(false);
    const [showInspeccion, setShowInspeccion] = useState(false);
    const [cargando, setCargando] = useState(false);

    const obtenerFechaMexico = () => {
        const ahora = new Date();
        const opciones: Intl.DateTimeFormatOptions = { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
        return new Intl.DateTimeFormat('sv-SE', opciones).format(ahora).replace(', ', 'T').replace(' ', 'T');
    };

    const [datos, setDatos] = useState<DatosTurno>({
        nombre: '', fecha: obtenerFechaMexico(), cmIni: null, litrosIni: null, totalizadorIni: null,
        nombreCierre: '', fechaCierre: '', cmCierre: null, litrosCierre: null, totalizadorCierre: null
    });

    const inicializarPantalla = async () => {
        setCargando(true);
        try {
            const source = initialData?.data ? initialData.data : initialData;
            if (source && source.turno) {
                const t = source.turno;
                setIdTurno(t.id);
                setDatos({
                    nombre: t.nombre || '',
                    fecha: t.fecha ? t.fecha.replace(' ', 'T') : obtenerFechaMexico(),
                    cmIni: t.cmIni,
                    litrosIni: parseFloat(t.litrosIni) || 0,
                    totalizadorIni: t.totalizadorIni,
                    nombreCierre: t.nombreCierre || '',
                    fechaCierre: t.fechaCierre ? t.fechaCierre.replace(' ', 'T') : '',
                    cmCierre: t.cmCierre,
                    litrosCierre: parseFloat(t.litrosCierre) || 0,
                    totalizadorCierre: t.totalizadorCierre
                });
                if (source.remision) {
                    setRemisiones(source.remision.map((r: any) => ({
                        id: r.id, folio: r.folio, litros: parseFloat(r.total_litros), isCancelled: r.status === 'N' || r.status === 'cancelado'
                    })));
                }
                if (source.sumaAutotanque) {
                    setEntradasASA(source.sumaAutotanque.map((s: any) => ({
                        litros: parseFloat(s.litros), remision: s.folio
                    })));
                }
            } else {
                setIdTurno(null);
                setRemisiones([]);
                setEntradasASA([]);
                const response = await fetchTurnoActivo();
                if (response?.active && response.data) {
                    const active = response.data.turno;
                    setIdTurno(active.id);
                    setDatos(prev => ({
                        ...prev,
                        nombre: active.nombre,
                        fecha: active.fecha.replace(' ', 'T'),
                        cmIni: active.cmIni,
                        litrosIni: parseFloat(active.litrosIni) || 0,
                        totalizadorIni: active.totalizadorIni,
                        nombreCierre: active.nombreCierre || '',
                        cmCierre: active.cmCierre || null,
                        totalizadorCierre: active.totalizadorCierre || null
                    }));
                    if (response.data.remision) {
                        setRemisiones(response.data.remision.map((r: any) => ({
                            id: r.id, folio: r.folio, litros: parseFloat(r.total_litros), isCancelled: r.status === 'N' || r.status === 'cancelado'
                        })));
                    }
                    if (response.data.sumaAutotanque) {
                        setEntradasASA(response.data.sumaAutotanque.map((s: any) => ({
                            litros: parseFloat(s.litros), remision: s.folio
                        })));
                    }
                } else {
                    const lastData = await fetchUltimoTotalizador();
                    if (lastData && lastData.totalizador !== undefined) setDatos(prev => ({ ...prev, totalizadorIni: lastData.totalizador }));
                }
            }
        } catch (error) { console.error(error); } finally { setCargando(false); }
    };

    useEffect(() => { inicializarPantalla(); }, [initialData]);

    const handleUpdate = (key: string, val: any) => {
        setDatos(prev => {
            const nuevosDatos = { ...prev, [key]: val };
            if (key === 'cmIni' || key === 'cmCierre') {
                const cmValue = parseFloat(val);
                nuevosDatos[key === 'cmIni' ? 'litrosIni' : 'litrosCierre'] = !isNaN(cmValue) ? obtenerLitrosInterpolados(cmValue) : null;
            }
            return nuevosDatos;
        });
    };

    const cancelarRemision = async (index: number) => {
        const remision = remisiones[index];
        const result = await Swal.fire({ title: '¿Marcar como cancelada?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' });
        if (result.isConfirmed) {
            try {
                await cancelarRemisionAPI(remision.id);
                setRemisiones(prev => prev.map((rem, i) => i === index ? { ...rem, isCancelled: true } : rem));
                Swal.fire('Cancelada', 'Estatus actualizado', 'success');
            } catch (error) { Swal.fire('Error', 'No se pudo cancelar', 'error'); }
        }
    };

    const totalSuman = entradasASA.reduce((acc, curr) => acc + curr.litros, 0);
    const totalVendidos = remisiones.reduce((acc, curr) => acc + (curr.isCancelled ? 0 : curr.litros), 0);
    const aritmetico = ((datos.litrosIni ?? 0) + totalSuman) - totalVendidos;
    const diferencia = aritmetico - (datos.litrosCierre ?? 0);

    const handleSubmit = async () => {
        const estaCierreCompleto =
            datos.nombreCierre.trim() !== '' &&
            datos.fechaCierre !== '' &&
            datos.cmCierre !== null &&
            datos.totalizadorCierre !== null;

        setCargando(true);
        try {
            const response = await guardarEntregarTurno({
                id: idTurno,
                ...datos,
                remisiones,
                entradasASA,
                resumen: {
                    totalVendidos,
                    totalSuman,
                    balanceAritmetico: aritmetico,
                    balanceFisico: datos.litrosCierre ?? 0,
                    diferenciaFinal: diferencia
                }
            });

            const turnoIdFinal = idTurno || response?.data?.id;

            if (estaCierreCompleto) {
                const result = await Swal.fire({
                    title: '¡Turno Guardado!',
                    text: 'Los datos se registraron correctamente. ¿Deseas realizar la inspección de la unidad ahora?',
                    icon: 'success',
                    showCancelButton: true,
                    confirmButtonColor: '#2563eb',
                    cancelButtonColor: '#64748b',
                    confirmButtonText: 'Sí, ir a inspección',
                    cancelButtonText: 'No, después',
                });

                if (result.isConfirmed) {
                    setIdTurno(turnoIdFinal);
                    setShowInspeccion(true);
                } else if (onSuccess) {
                    onSuccess();
                }
            } else {
                await Swal.fire({
                    title: 'Progreso Guardado',
                    text: 'Los datos de inicio de turno se han guardado correctamente.',
                    icon: 'success',
                    confirmButtonColor: '#2563eb',
                });
                if (onSuccess) onSuccess();
            }

        } catch (error: any) {
            Swal.fire('Error', 'No se pudo guardar el turno', 'error');
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        const calculado = (datos.totalizadorIni ?? 0) + totalVendidos;
        if (calculado !== datos.totalizadorCierre) handleUpdate('totalizadorCierre', calculado);
    }, [datos.totalizadorIni, totalVendidos]);

    return (
        <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen relative">
            {showBuscador && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"><BuscadorRemisiones onSelect={(res) => { if (remisiones.some(r => r.folio === res.folio)) return Swal.fire('Error', 'Ya existe', 'warning'); setRemisiones(prev => [...prev, { id: res.id, folio: res.folio, litros: Number(res.litros), isCancelled: res.status === 'cancelado' || res.status === 'N' }]); setShowBuscador(false); }} onClose={() => setShowBuscador(false)} foliosExistentes={remisiones.map(r => r.folio)} /></div>}
            {showSuman && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"><ModalConceptosSuman onAdd={(d) => { setEntradasASA(prev => [...prev, d]); setShowSuman(false); }} onClose={() => setShowSuman(false)} /></div>}
            {showInspeccion && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="relative z-10 w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                        <div className="absolute top-4 right-4 z-50">
                            <button onClick={() => setShowInspeccion(false)} className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="max-h-[90vh] overflow-y-auto">
                            <CheckEstadoAutotanque
                                data={{ id: idTurno }}
                                onSuccess={() => {
                                    setShowInspeccion(false);
                                    if (onSuccess) onSuccess();
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            <Header />
            <form className="bg-white shadow-xl rounded-b-lg p-6 space-y-8" onSubmit={e => e.preventDefault()}>
                <SeccionInicio {...datos} onUpdate={handleUpdate} />
                <TablaRemisiones remisiones={remisiones} entradasASA={entradasASA} total={totalVendidos} onAdd={() => setShowBuscador(true)} onAddSuman={() => setShowSuman(true)} onDeleteVenta={cancelarRemision} onDeleteSuma={(idx) => setEntradasASA(prev => prev.filter((_, i) => i !== idx))} />
                <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <SeccionCierre {...datos} onUpdate={handleUpdate} />
                    <ResumenBalance aritmetico={aritmetico} fisico={datos.litrosCierre ?? 0} diferencia={diferencia} />
                </section>
                <button type="button" onClick={handleSubmit} disabled={cargando} className="w-full bg-blue-900 text-white py-4 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition disabled:bg-gray-400">
                    <Save size={20} /> {cargando ? 'GUARDANDO...' : 'GUARDAR Y FINALIZAR TURNO'}
                </button>
            </form>
        </div>
    );
};

export default EntregarTurnoAutotanque;
