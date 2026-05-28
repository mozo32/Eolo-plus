import React from 'react';

const formatNumberWithCommas = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) return '0';
    return new Intl.NumberFormat('en-US').format(value);
};

export const ResumenBalance = ({ aritmetico, fisico, diferencia }: { aritmetico: number, fisico: number, diferencia: number }) => (
    <div className="bg-blue-900 text-white p-6 rounded-xl shadow-inner border-l-4 border-yellow-400">
        <h2 className="text-yellow-400 font-bold mb-4 uppercase tracking-tighter">Balance de Inventario</h2>
        <div className="space-y-2">
            <div className="flex justify-between text-sm opacity-80">
                <span>Inventario Aritmético:</span>
                <span>{formatNumberWithCommas(aritmetico)} Lts</span>
            </div>
            <div className="flex justify-between text-sm opacity-80">
                <span>Toma Física:</span>
                <span>{formatNumberWithCommas(fisico)} Lts</span>
            </div>
            <hr className="border-blue-700" />
            <div className="flex justify-between items-center pt-2">
                <span className="font-bold">DIFERENCIA:</span>
                <span className="text-2xl font-mono text-green-400">
                    {diferencia > 0 ? '+' : ''}{formatNumberWithCommas(diferencia)} LTS
                </span>
            </div>
        </div>
    </div>
);
