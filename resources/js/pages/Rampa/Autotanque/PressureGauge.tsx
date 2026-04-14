import React, { useRef, useState } from 'react';

interface PressureGaugeProps {
    value: number;
    onChange: (value: number) => void;
}

const PressureGauge = ({ value, onChange }: PressureGaugeProps) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const handleUpdate = (clientY: number) => {
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const y = clientY - rect.top;
        const topPadding = 50;
        const bottomPadding = 400;
        const usableHeight = bottomPadding - topPadding;

        let percentage = (y - topPadding) / usableHeight;
        let psiValue = Math.round(percentage * 30);

        onChange(Math.max(0, Math.min(30, psiValue)));
    };
    const getPointY = (psi: number) => 50 + (psi / 30) * 350;
    const pistonY = getPointY(value);

    return (
        <div className="flex flex-col items-center bg-slate-50 p-8 rounded-[3rem] shadow-xl border border-slate-200">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Differential Pressure</h3>

            <div className="relative touch-none select-none">
                <svg
                    ref={svgRef}
                    width="140"
                    height="460"
                    viewBox="0 0 140 460"
                    onMouseDown={(e) => { setIsDragging(true); handleUpdate(e.clientY); }}
                    onMouseMove={(e) => isDragging && handleUpdate(e.clientY)}
                    onMouseUp={() => setIsDragging(false)}
                    onMouseLeave={() => setIsDragging(false)}
                    onTouchMove={(e) => handleUpdate(e.touches[0].clientY)}
                    className="cursor-crosshair"
                >
                    <defs>
                        <linearGradient id="metal-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#cbd5e1" />
                            <stop offset="50%" stopColor="#f8fafc" />
                            <stop offset="100%" stopColor="#cbd5e1" />
                        </linearGradient>
                        <linearGradient id="piston-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#1d4ed8" />
                            <stop offset="50%" stopColor="#60a5fa" />
                            <stop offset="100%" stopColor="#1d4ed8" />
                        </linearGradient>
                    </defs>
                    <rect x="10" y="10" width="120" height="440" rx="25" fill="url(#metal-grad)" stroke="#94a3b8" strokeWidth="1" />
                    <rect x="52" y={getPointY(0)} width="36" height={getPointY(8) - getPointY(0)} fill="#22c55e" opacity="0.2" />
                    <rect x="52" y={getPointY(8)} width="36" height={getPointY(14) - getPointY(8)} fill="#eab308" opacity="0.3" />
                    <rect x="52" y={getPointY(14)} width="36" height={getPointY(30) - getPointY(14)} fill="#ef4444" opacity="0.2" />
                    <rect x="52" y="30" width="36" height="390" rx="18" fill="#0f172a" opacity="0.05" />
                    <rect x="55" y="35" width="30" height="380" rx="15" fill="white" stroke="#e2e8f0" />

                    <text x="35" y="35" fontSize="9" fontWeight="900" textAnchor="middle" className="fill-slate-400 font-sans">P.S.I.</text>
                    {Array.from({ length: 16 }).map((_, i) => {
                        const psi = i * 2;
                        const y = getPointY(psi);
                        return (
                            <g key={`psi-${i}`}>
                                <line x1="45" y1={y} x2="55" y2={y} stroke="#475569" strokeWidth="1.5" />
                                <text x="40" y={y + 3} fontSize="9" fontWeight="bold" textAnchor="end" className="fill-slate-600 font-mono">{psi}</text>
                            </g>
                        );
                    })}
                    <text x="105" y="35" fontSize="9" fontWeight="900" textAnchor="middle" className="fill-slate-400 font-sans">KG/CM</text>
                    {Array.from({ length: 11 }).map((_, i) => {
                        const kgcm = (i * 0.2).toFixed(1);
                        const y = 50 + (i / 10.5) * 350;
                        return (
                            <g key={`kg-${i}`}>
                                <line x1="85" y1={y} x2="95" y2={y} stroke="#475569" strokeWidth="1.5" />
                                <text x="100" y={y + 3} fontSize="9" fontWeight="bold" textAnchor="start" className="fill-slate-600 font-mono">{kgcm}</text>
                            </g>
                        );
                    })}
                    <rect
                        x="58"
                        y={pistonY}
                        width="24"
                        height={415 - pistonY}
                        rx="2"
                        fill="url(#piston-grad)"
                        className="transition-all duration-300 ease-out"
                    />
                    <g transform={`translate(0, ${pistonY})`} className="transition-all duration-300 ease-out">
                        <line x1="30" y1="0" x2="110" y2="0" stroke="#ef4444" strokeWidth="2" strokeDasharray="2,1" />
                        <polygon points="50,0 45,-4 45,4" fill="#ef4444" />
                        <polygon points="90,0 95,-4 95,4" fill="#ef4444" />
                    </g>

                    <text x="70" y="440" fontSize="7" textAnchor="middle" fontWeight="bold" className="fill-slate-400 uppercase tracking-tighter">
                        Read at top of piston
                    </text>
                </svg>
                <div
                    className={`absolute -right-20 border-2 px-3 py-1 rounded-lg shadow-xl transition-all duration-300 ${
                        value >= 14 ? 'bg-red-50 border-red-500' : value >= 8 ? 'bg-yellow-50 border-yellow-500' : 'bg-green-50 border-green-500'
                    }`}
                    style={{ top: `${(pistonY / 460) * 100}%`, transform: 'translateY(-50%)' }}
                >
                    <span className={`font-black text-lg tabular-nums ${
                        value >= 14 ? 'text-red-600' : value >= 8 ? 'text-yellow-700' : 'text-blue-600'
                    }`}>{value}</span>
                    <span className="text-[10px] text-slate-400 ml-1 font-bold">PSI</span>
                </div>
            </div>
        </div>
    );
};

export default PressureGauge;
