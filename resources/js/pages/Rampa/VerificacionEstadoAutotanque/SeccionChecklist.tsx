import React from 'react';

interface Props {
    secciones: any[];
    respuestas: Record<string, string>;
    onToggle: (item: string, valor: 'Ok' | 'No') => void;
}

export const SeccionChecklist = ({ secciones, respuestas, onToggle }: Props) => (
    <div className="space-y-6 animate-in fade-in duration-300">
        {secciones.map((seccion, sIdx) => (
            <div key={sIdx} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <h2 className="bg-gray-50 px-4 py-2 text-blue-800 font-bold text-xs uppercase border-b">
                    {seccion.titulo}
                </h2>
                <div className="divide-y divide-gray-50">
                    {seccion.items.map((item: string, iIdx: number) => (
                        <div key={iIdx} className="flex items-center justify-between p-4">
                            <span className="text-sm text-gray-600 font-medium">{item}</span>
                            <div className="flex bg-gray-100 rounded-lg p-1">
                                <button
                                    type="button"
                                    onClick={() => onToggle(item, 'Ok')}
                                    className={`px-4 py-1.5 rounded-md text-xs font-black transition-all ${respuestas[item] === 'Ok' ? 'bg-green-500 text-white shadow-md' : 'text-gray-400'}`}
                                >OK</button>
                                <button
                                    type="button"
                                    onClick={() => onToggle(item, 'No')}
                                    className={`px-4 py-1.5 rounded-md text-xs font-black transition-all ${respuestas[item] === 'No' ? 'bg-red-500 text-white shadow-md' : 'text-gray-400'}`}
                                >NO</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        ))}
    </div>
);
