import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { Header } from './Header';
import { SeccionInicio } from './SeccionInicio';
import { TablaRemisiones } from './TablaRemisiones';
import { ResumenBalance } from './ResumenBalance';
import { SeccionCierre } from './SeccionCierre';
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

    const [datos, setDatos] = useState<DatosTurno>({
        nombre: '',
        fecha: '',
        cmIni: null,
        litrosIni: null,
        totalizadorIni: null,
        nombreCierre: '',
        fechaCierre: '',
        cmCierre: null,
        litrosCierre: null,
        totalizadorCierre: null
    });

    const handleUpdate = (key: string, val: any) => {
        setDatos(prev => {
            const nuevosDatos = { ...prev, [key]: val };

            if (key === 'cmIni') {
                const litrosEncontrados = TABLA_CALIBRACION[val];
                if (litrosEncontrados !== undefined) {
                    nuevosDatos.litrosIni = litrosEncontrados;
                }
            }

            return nuevosDatos;
        });
    };

    const [remisiones, setRemisiones] = useState<{folio: string, litros: number, isCancelled: boolean}[]>([]);

    const agregarRemision = () => {
        const folio = prompt("Ingrese el número de folio:");
        const litros = prompt("Ingrese los litros:");

        if (folio && litros) {
            setRemisiones([...remisiones, {
                folio,
                litros: Number(litros),
                isCancelled: false
            }]);
        }
    };

    const cancelarRemision = (index: number) => {
        if (confirm("¿Estás seguro de marcar esta remisión como CANCELADA?")) {
            setRemisiones(prevRemisiones =>
                prevRemisiones.map((rem, i) =>
                    i === index
                        ? { ...rem, isCancelled: true } // La marcamos y ponemos litros en 0
                        : rem
                )
            );
        }
    };
    const totalVendidos = remisiones.reduce((acc, curr) => acc + (curr.isCancelled ? 0 : curr.litros), 0);
    const aritmetico = (datos.litrosIni ?? 0) - totalVendidos;
    const diferencia =  aritmetico - (datos.litrosCierre ?? 0);

    return (
        <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen">
            <Header />
            <form className="bg-white shadow-xl rounded-b-lg p-6 space-y-8">
                <SeccionInicio
                    {...datos}
                    onUpdate={handleUpdate}
                />

                <TablaRemisiones
                    remisiones={remisiones}
                    total={totalVendidos}
                    onAdd={agregarRemision}
                    onDelete={cancelarRemision}
                />

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

                <button className="w-full bg-blue-900 text-white py-4 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition shadow-lg">
                    <Save size={20} /> GUARDAR Y FINALIZAR TURNO
                </button>
            </form>
        </div>
    );
};

export default EntregarTurnoAutotanque;
