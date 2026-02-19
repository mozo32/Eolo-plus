import React, { useState, useEffect } from 'react';
import { Plane, Fuel, Clock, MapPin, ClipboardList, Gauge, Calendar } from 'lucide-react';
import Swal from 'sweetalert2';

const EoloForm = () => {
    const [lecturaInicial, setLecturaInicial] = useState<number>(9830428);
    const [lecturaFinal, setLecturaFinal] = useState<number>(9830638);
    const [litros, setLitros] = useState<number>(0);
    const [esVuelo, setEsVuelo] = useState<string>("no");

    const [datosVuelo, setDatosVuelo] = useState({ cliente: '', requisicion: '', formaPago: 'Efectivo' });
    const [datosAeronave, setDatosAeronave] = useState({ tipo: '', matricula: '', destino: '' });
    const [tiempos, setTiempos] = useState({ llegada: '', inicio: '', final: '' });
    const [observaciones, setObservaciones] = useState<string>("");
    const [nombreCliente, setNombreCliente] = useState<string>("");
    const [nombreOperador, setNombreOperador] = useState<string>("");

    function getXsrfToken(): string {
        const match = document.cookie
            .split('; ')
            .find(row => row.startsWith('XSRF-TOKEN='));
        return match ? decodeURIComponent(match.split('=')[1]) : '';
    }

    useEffect(() => {
        const res = lecturaFinal - lecturaInicial;
        setLitros(res > 0 ? res : 0);
    }, [lecturaInicial, lecturaFinal]);

    const resetForm = () => {
        setLecturaInicial(9830428);
        setLecturaFinal(9830638);
        setEsVuelo("no");
        setDatosVuelo({ cliente: '', requisicion: '', formaPago: 'Efectivo' });
        setDatosAeronave({ tipo: '', matricula: '', destino: '' });
        setTiempos({ llegada: '', inicio: '', final: '' });
        setObservaciones("");
        setNombreCliente("");
        setNombreOperador("");
        // window.location.reload(); // Descomenta esta línea si prefieres recarga total
    };

    const handleFinalizar = async () => {
        const payload = {
            folio: "#8942",
            fecha: new Date().toISOString().split('T')[0],
            es_vuelo: esVuelo === "si",
            cliente_vuelo: esVuelo === "si" ? datosVuelo.cliente : null,
            requisicion: esVuelo === "si" ? datosVuelo.requisicion : null,
            forma_pago: esVuelo === "si" ? datosVuelo.formaPago : null,
            tipo_aeronave: datosAeronave.tipo,
            matricula: datosAeronave.matricula.toUpperCase(),
            destino: datosAeronave.destino,
            hora_llegada: tiempos.llegada,
            hora_inicio: tiempos.inicio,
            hora_final: tiempos.final,
            lectura_inicial: lecturaInicial,
            lectura_final: lecturaFinal,
            total_litros: litros,
            observaciones: observaciones,
            nombre_cliente_firma: nombreCliente,
            nombre_operador_firma: nombreOperador
        };

        if (!nombreCliente || !nombreOperador || !datosAeronave.matricula) {
            Swal.fire({
                icon: 'warning',
                title: 'Campos incompletos',
                text: 'Por favor, asegúrate de que la matrícula y las firmas estén llenas.',
                confirmButtonColor: '#2563eb'
            });
            return;
        }

        Swal.fire({
            title: '¿Finalizar remisión?',
            text: `Se registrarán ${litros} litros para la aeronave ${datosAeronave.matricula}`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, guardar',
            cancelButtonText: 'Revisar',
            confirmButtonColor: '#2563eb',
            showLoaderOnConfirm: true,
            preConfirm: async () => {
                try {
                    const xsrf = getXsrfToken();
                    const response = await fetch('api/Remision/remisiones', {
                        method: 'POST',
                        headers: {
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'X-XSRF-TOKEN': xsrf,
                        },
                        body: JSON.stringify(payload)
                    });

                    const data = await response.json();
                    if (!response.ok) throw new Error(data.message || 'Error al guardar');
                    return data;
                } catch (error) {
                    Swal.showValidationMessage(`${error}`);
                }
            },
            allowOutsideClick: () => !Swal.isLoading()
        }).then((result) => {
            if (result.isConfirmed) {
                Swal.fire({
                    icon: 'success',
                    title: '¡Guardado!',
                    text: 'La remisión se ha registrado correctamente.',
                    timer: 2000,
                    showConfirmButton: false
                }).then(() => {
                    resetForm();
                });
            }
        });
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-slate-700">
            <div className="max-w-4xl mx-auto bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-200">

                <div className="bg-slate-100 border-b border-gray-200 p-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <Fuel className="w-8 h-8 text-blue-600" /> EOLO <span className="font-light text-slate-500 uppercase text-xs tracking-[0.3em]">Combustibles</span>
                        </h1>
                        <p className="text-slate-400 text-[10px] mt-1 font-bold uppercase tracking-wider">Remisión Digital • ID: #8941</p>
                    </div>
                    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
                        <Calendar className="w-4 h-4 text-blue-500" />
                        <span className="text-slate-700 text-sm font-bold">18 FEB 2026</span>
                    </div>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-2 space-y-8">
                        <section className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-800 uppercase tracking-wider">¿Es un Vuelo?</span>
                                <div className="flex gap-4">
                                    {['si', 'no'].map((opcion) => (
                                        <label key={opcion} className="flex items-center gap-2 cursor-pointer capitalize font-bold text-sm">
                                            <input type="radio" name="vuelo" value={opcion} checked={esVuelo === opcion} onChange={(e) => setEsVuelo(e.target.value)} className="w-4 h-4 text-blue-600" />
                                            {opcion}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            {esVuelo === "si" && (
                                <div className="mt-4 pt-4 border-t border-blue-100 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <input type="text" value={datosVuelo.cliente} placeholder="Cliente" className="bg-white border border-blue-200 rounded-xl p-2 text-sm outline-none" onChange={(e) => setDatosVuelo({ ...datosVuelo, cliente: e.target.value })} />
                                    <input type="text" value={datosVuelo.requisicion} placeholder="Requisición" className="bg-white border border-blue-200 rounded-xl p-2 text-sm outline-none" onChange={(e) => setDatosVuelo({ ...datosVuelo, requisicion: e.target.value })} />
                                    <select value={datosVuelo.formaPago} className="bg-white border border-blue-200 rounded-xl p-2 text-sm outline-none" onChange={(e) => setDatosVuelo({ ...datosVuelo, formaPago: e.target.value })}>
                                        <option>Efectivo</option><option>Crédito</option><option>Transferencia</option>
                                    </select>
                                </div>
                            )}
                        </section>

                        <section>
                            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-800 mb-4 flex gap-2"><Plane className="w-5 h-5 text-blue-600" /> Datos de la Aeronave</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <input type="text" value={datosAeronave.tipo} placeholder="Tipo (Ej. A109)" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 focus:bg-white outline-none" onChange={(e) => setDatosAeronave({ ...datosAeronave, tipo: e.target.value })} />
                                <input type="text" value={datosAeronave.matricula} placeholder="Matrícula" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 focus:bg-white outline-none uppercase" onChange={(e) => setDatosAeronave({ ...datosAeronave, matricula: e.target.value })} />
                                <input type="text" value={datosAeronave.destino} placeholder="Destino" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 focus:bg-white outline-none" onChange={(e) => setDatosAeronave({ ...datosAeronave, destino: e.target.value })} />
                            </div>
                        </section>

                        <section>
                            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-800 mb-4 flex gap-2"><Clock className="w-5 h-5 text-emerald-600" /> Cronología</h2>
                            <div className="grid grid-cols-3 gap-4">
                                <input type="time" value={tiempos.llegada} className="bg-gray-50 p-3 rounded-2xl border border-gray-200 font-bold outline-none" onChange={(e) => setTiempos({ ...tiempos, llegada: e.target.value })} />
                                <input type="time" value={tiempos.inicio} className="bg-gray-50 p-3 rounded-2xl border border-gray-200 font-bold outline-none" onChange={(e) => setTiempos({ ...tiempos, inicio: e.target.value })} />
                                <input type="time" value={tiempos.final} className="bg-gray-50 p-3 rounded-2xl border border-gray-200 font-bold outline-none" onChange={(e) => setTiempos({ ...tiempos, final: e.target.value })} />
                            </div>
                        </section>
                    </div>

                    <div className="space-y-6">
                        <section className="bg-white border-2 border-blue-600 rounded-3xl p-6 shadow-xl h-full flex flex-col">
                            <div className="flex items-center gap-2 mb-8 pb-4 border-b border-gray-100">
                                <Gauge className="w-6 h-6 text-blue-600" />
                                <h2 className="font-bold uppercase text-xs tracking-widest">Flujo</h2>
                            </div>
                            <div className="space-y-6 flex-grow">
                                <input type="number" value={lecturaInicial} onChange={(e) => setLecturaInicial(Number(e.target.value))} className="w-full bg-slate-50 border rounded-2xl p-4 text-2xl font-mono font-bold" />
                                <input type="number" value={lecturaFinal} onChange={(e) => setLecturaFinal(Number(e.target.value))} className="w-full bg-slate-50 border rounded-2xl p-4 text-2xl font-mono font-bold" />
                            </div>
                            <div className="mt-12 bg-blue-600 rounded-2xl p-6 text-white text-center">
                                <p className="text-[10px] uppercase font-black opacity-80">Total Litros</p>
                                <span className="text-5xl font-black">{litros.toLocaleString()}</span>
                            </div>
                        </section>
                    </div>
                </div>

                <div className="bg-slate-50 p-8 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-12">
                    <textarea
                        className="w-full bg-white border border-gray-200 rounded-2xl p-4 text-sm h-24 outline-none focus:ring-4 focus:ring-blue-500/5 transition-all"
                        placeholder="Observaciones..."
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                    ></textarea>

                    <div className="flex flex-col justify-end gap-6">
                        <div className="grid grid-cols-2 gap-8 text-center">
                            <div className="border-b-2 border-gray-200">
                                <input type="text" value={nombreCliente} onChange={(e) => setNombreCliente(e.target.value)} placeholder="Firma Cliente" className="w-full bg-transparent text-center font-serif italic text-blue-600 outline-none" />
                                <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Cliente</span>
                            </div>
                            <div className="border-b-2 border-gray-200">
                                <input type="text" value={nombreOperador} onChange={(e) => setNombreOperador(e.target.value)} placeholder="Firma Operador" className="w-full bg-transparent text-center font-serif italic text-slate-500 outline-none" />
                                <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Operador</span>
                            </div>
                        </div>
                        <button
                            onClick={handleFinalizar}
                            className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 transition-all uppercase tracking-widest text-xs"
                        >
                            Finalizar Remisión
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EoloForm;
