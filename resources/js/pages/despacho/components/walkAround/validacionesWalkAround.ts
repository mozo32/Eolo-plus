import { FotoItem } from "./EvidenciFotografica";
import {
    TipoDanio,
    ChecklistAvionEstado,
    ChecklistHelicopteroEstado,
} from "@/types/typesChecklist";

function preguntasNoContestadasAvion(
    estado: ChecklistAvionEstado,
    preguntas: string[]
): string[] {
    return preguntas.filter((p) => {
        const e = estado[p];
        if (!e) return true;

        if (e.danios.includes("sin_danio")) return false;
        if (Array.isArray(e.danios) && e.danios.length > 0) return false;

        return true;
    });
}
function preguntasNoContestadasHelicoptero(
    estado: ChecklistHelicopteroEstado,
    preguntas: string[]
): string[] {
    return preguntas.filter((p) => {
        const e = estado[p];
        if (!e) return true;

        if (e.danios.includes("sin_danio")) return false;

        if (Array.isArray(e.danios) && e.danios.length > 0) return false;

        return true;
    });
}


export const PREGUNTAS_AVION = [
    "Tren de nariz",
    "Compuertas tren de aterrizaje",
    "Parabrisas / limpiadores",
    "Radomo",
    "Tubo Pitot",
    "Fuselaje",
    "Antena",
    "Aleta",
    "Aleron",
    "Compensador de aleron",
    "Mechas de descarga estatica",
    "Punta de ala",
    "Luces de carreteo / aterrizaje",
    "Luces de navegación, beacon",
    "Borde de ataque",
    "Tren de aterrizaje principal",
    "Válvulas de servicio (combustible, etc...)",
    "Motor",
    "Estabilizador vertical",
    "Timón de dirección",
    "Compensador timón de dirección",
    "Estabilizador horizontal",
    "Timón de profundidad",
    "Compensador timón de profundidad",
    "Borde de empenaje",
    "Alas delta",
];

export const PREGUNTAS_HELICOPTERO = [
    "Fuselaje",
    "Puertas, ventanas, antenas, luces",
    "Esquí / Neumáticos",
    "Palas",
    "Boom",
    "Estabilizadores",
    "Rotor de cola",
    "Parabrisas",
];


const contarFotos = (fotos: FotoItem[]) =>
    fotos.filter((f) => {
        if (f.kind === "new") return true;
        return (f.status ?? "A") === "A";
    }).length;

export function validarPaso(step: number, data: any): string[] {
    const errores: string[] = [];

    if (step === 1) {
        if (!data.movimiento) errores.push("Movimiento");
        if (!data.matricula) errores.push("Matrícula");
        if (!data.AeronaveId) errores.push("Tipo de aeronave");
        if (!data.hora) errores.push("Hora");
        if (!data.movimiento) {
            if (!data.procedensia) {
                errores.push("Procedencia");
            }
            if (!data.procedensia) {
                errores.push("Destino");
            }
        }
        if (data.movimiento === "entrada") {
            if (!data.procedensia) {
                errores.push("Procedencia");
            }
        }

        if (data.movimiento === "salida") {
            if (!data.destino) {
                errores.push("Destino");
            }
        }
    }

    if (step === 2) {

        if (!data.tipo) errores.push("Tipo de aeronave");
        if (data.tipo === "avion") {
            const faltantes = preguntasNoContestadasAvion(
                data.checklistAvion,
                PREGUNTAS_AVION
            );


            if (faltantes.length) {
                errores.push(
                    `Checklist avión incompleto: ${faltantes.join(", ")}`
                );
            }
        }

        if (data.tipo === "helicoptero") {
            const faltantes = preguntasNoContestadasHelicoptero(
                data.checklistHelicoptero,
                PREGUNTAS_HELICOPTERO
            );

            if (faltantes.length) {
                errores.push(
                    `Checklist helicóptero incompleto: ${faltantes.join(", ")}`
                );
            }
        }

        if (!data.numeroEstatica) errores.push("Número de estáticas");
    }

    return errores;
}

export function validarWalkAroundFinal(data: any): string[] {
    const errores: string[] = [];

    [1, 2, 4].forEach((s) => {
        errores.push(...validarPaso(s, data));
    });

    if (!data.elabora) errores.push("Elabora");
    if (!data.responsable) errores.push("Responsable");

    return errores;
}
