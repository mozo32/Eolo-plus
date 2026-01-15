// types.ts

export type TipoDanio =
    | "sin_danio"
    | "golpe"
    | "rayon"
    | "fisurado"
    | "quebrado"
    | "pintura_cuarteada"
    | "otro";

export type ChecklistEstado = {
    [clave: string]: TipoDanio[];
};
export type DanioPorLado = {
  izq?: boolean;
  der?: boolean;
};
