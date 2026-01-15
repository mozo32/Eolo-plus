export type TipoDanio =
    | "sin_danio"
    | "golpe"
    | "rayon"
    | "fisurado"
    | "quebrado"
    | "pintura_cuarteada"
    | "otro";

export type EstadoPreguntaHelicoptero = {
    izq: boolean;
    der: boolean;
    danios: TipoDanio[];
};

export type ChecklistHelicopteroEstado = {
    [pregunta: string]: EstadoPreguntaHelicoptero;
};

export type EstadoPreguntaAvion = {
    izq: boolean;
    der: boolean;
    danios: TipoDanio[];
};

export type ChecklistAvionEstado = {
    [pregunta: string]: EstadoPreguntaAvion;
};
