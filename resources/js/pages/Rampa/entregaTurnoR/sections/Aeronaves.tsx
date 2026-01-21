export default function Aeronaves({ form, updateField }: any) {
    const inputMain =
        "w-full rounded-xl border-2 border-orange-500 bg-orange-50 px-6 py-4 text-2xl font-extrabold text-center focus:bg-white focus:outline-none";

    const inputSub =
        "w-full rounded-lg border-2 border-slate-400 bg-slate-100 px-4 py-3 text-xl font-bold text-center focus:border-orange-500 focus:bg-white focus:outline-none";

    const labelMain =
        "mb-2 text-xs font-bold uppercase tracking-widest text-orange-700 text-center";

    const labelSub =
        "mb-1 text-xs font-bold uppercase tracking-wide text-slate-600 text-center";

    return (
        <div className="rounded-2xl border-2 border-slate-300 bg-white p-6 shadow-sm">
            <h3 className="mb-6 text-center text-sm font-bold uppercase tracking-widest text-orange-600">
                Aeronaves
            </h3>

            {/* TOTAL */}
            <div className="mb-8 rounded-xl border-2 border-orange-500 bg-orange-100 p-6">
                <div className={labelMain}>Total de Aeronaves</div>
                <input
                    className={inputMain}
                    placeholder="0"
                    value={form.aeronaves.total}
                    onChange={(e) =>
                        updateField("aeronaves.total", e.target.value)
                    }
                />
            </div>

            {/* DISTRIBUCIÓN */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-lg border-2 border-slate-400 bg-slate-50 p-4">
                    <div className={labelSub}>Posición H1</div>
                    <input
                        className={inputSub}
                        placeholder="0"
                        value={form.aeronaves.h1}
                        onChange={(e) =>
                            updateField("aeronaves.h1", e.target.value)
                        }
                    />
                </div>

                <div className="rounded-lg border-2 border-slate-400 bg-slate-50 p-4">
                    <div className={labelSub}>Posición H2</div>
                    <input
                        className={inputSub}
                        placeholder="0"
                        value={form.aeronaves.h2}
                        onChange={(e) =>
                            updateField("aeronaves.h2", e.target.value)
                        }
                    />
                </div>
            </div>

            {/* AYUDA */}
            <div className="mt-6 text-center text-xs font-medium text-slate-600">
                Captura el total de aeronaves y su distribución por posición
            </div>
        </div>
    );
}
