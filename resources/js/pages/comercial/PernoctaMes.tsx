import React, { useMemo, useState, useEffect } from "react";
import AppLayout from "@/layouts/app-layout";
import { Head } from "@inertiajs/react";
import { type BreadcrumbItem } from "@/types";
import PernoctaFiltros from "./PernoctaMes/PernoctaFiltros";
import PernoctaTablaMes from "./PernoctaMes/PernoctaTablaMes";

const breadcrumbs: BreadcrumbItem[] = [
    { title: "Pernocta del Año" },
];
type MesProcesado = {
    mes: string;
    days: number;
    rows: Row[];
};
type Row = {
    matricula: string;
    aeronave: string;
    estatus: string;
    categoria: string;
    ubicacion: "H1" | "H2";
    dias: Record<number, 0 | 1>;
};

const MESES = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

export default function PernoctaMes() {
    const [modo, setModo] = useState<"anio" | "mes" | "rango">("anio");
    const [mes, setMes] = useState("Enero");
    const [mesDesde, setMesDesde] = useState("Enero");
    const [mesHasta, setMesHasta] = useState("Marzo");
    const [ubicacion, setUbicacion] = useState("");
    const [matricula, setMatricula] = useState("");
    const [apiData, setApiData] = useState<any[]>([]);
    const [aniosDisponibles, setAniosDisponibles] = useState<string[]>([]);
    const [anio, setAnio] = useState("2026");
    useEffect(() => {
        fetch("/api/PernoctaDia/pernocta-anios")
            .then((r) => r.json())
            .then((data) => setAniosDisponibles(data.map(String)));
    }, []);

    useEffect(() => {
        fetch(`/api/PernoctaMes/pernocta-mes?anio=${aniosDisponibles}`)
            .then((r) => r.json())
            .then(setApiData);
    }, [aniosDisponibles]);

    const agruparPorMes = (rows: any[]): MesProcesado[] => {
        const resultado: Record<string, { days: number; rows: Record<string, Row> }> = {};

        rows.forEach((r) => {
            const [year, month, day] = r.fecha.split("-").map(Number);
            const mesIndex = month - 1;
            const mesNombre = MESES[mesIndex];
            const daysInMonth = new Date(year, month, 0).getDate();

            if (!resultado[mesNombre]) {
                resultado[mesNombre] = {
                    days: daysInMonth,
                    rows: {},
                };
            }

            if (!resultado[mesNombre].rows[r.matricula]) {
                resultado[mesNombre].rows[r.matricula] = {
                    matricula: r.matricula,
                    aeronave: r.aeronave,
                    estatus: r.estatus,
                    ubicacion: r.ubicacion,
                    categoria: r.categoria,
                    dias: {},
                };
            }

            resultado[mesNombre].rows[r.matricula].dias[day] = 1;
        });

        return Object.entries(resultado).map(([mes, data]) => ({
            mes,
            days: data.days,
            rows: Object.values(data.rows) as Row[],
        }));
    };

    const mesesProcesados = useMemo(
        () => agruparPorMes(apiData),
        [apiData]
    );

    const mesesAMostrar = useMemo(() => {
        if (modo === "anio") return mesesProcesados;
        if (modo === "mes") return mesesProcesados.filter((m) => m.mes === mes);

        const start = MESES.indexOf(mesDesde);
        const end = MESES.indexOf(mesHasta);

        return mesesProcesados.filter(
            (m) =>
                MESES.indexOf(m.mes) >= start &&
                MESES.indexOf(m.mes) <= end
        );
    }, [modo, mes, mesDesde, mesHasta, mesesProcesados]);

    const filtrarRows = (rows: Row[]) =>
        rows.filter((r) => {
            if (ubicacion && r.ubicacion !== ubicacion) return false;
            if (matricula && !r.matricula.toLowerCase().includes(matricula.toLowerCase())) return false;
            return true;
        });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Pernocta del Mes" />

            <div className="flex flex-col gap-4 p-4">
                <PernoctaFiltros
                    modo={modo}
                    setModo={setModo}
                    anio={anio}
                    setAnio={setAnio}
                    mes={mes}
                    setMes={setMes}
                    mesDesde={mesDesde}
                    setMesDesde={setMesDesde}
                    mesHasta={mesHasta}
                    setMesHasta={setMesHasta}
                    ubicacion={ubicacion}
                    setUbicacion={setUbicacion}
                    matricula={matricula}
                    setMatricula={setMatricula}
                    anios={aniosDisponibles}
                />

                {mesesAMostrar.map(({ mes, days, rows }) => (
                    <PernoctaTablaMes
                        key={mes}
                        mesNombre={mes}
                        days={days}
                        rows={filtrarRows(rows)}
                    />
                ))}
            </div>
        </AppLayout>
    );
}
