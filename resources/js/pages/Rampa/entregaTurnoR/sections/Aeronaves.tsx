export default function Aeronaves({ form, updateField }: any) {
    const inputSub =
        "w-full rounded-lg border-2 border-slate-400 bg-slate-100 px-4 py-3 text-xl font-bold text-center focus:border-orange-500 focus:bg-white focus:outline-none";

    const labelSub =
        "mb-1 text-xs font-bold uppercase tracking-wide text-slate-600 text-center";

    return (
        <div className="rounded-2xl border-2 border-slate-300 bg-white p-6 shadow-sm">
            <h3 className="mb-6 text-center text-sm font-bold uppercase tracking-widest text-orange-600">
                Aeronaves
            </h3>

            {/* DISTRIBUCIÓN */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* HANGAR 1 */}
                <div className="rounded-lg border-2 border-slate-400 bg-slate-50 p-4">
                    <div className={labelSub}>Hangar 1</div>
                    <input
                        className={inputSub}
                        placeholder="0"
                        value={form.aeronaves.hangar1}
                        onChange={(e) =>
                            updateField("aeronaves.hangar1", e.target.value)
                        }
                    />
                </div>

                {/* HANGAR 2 */}
                <div className="rounded-lg border-2 border-slate-400 bg-slate-50 p-4">
                    <div className={labelSub}>Hangar 2</div>
                    <input
                        className={inputSub}
                        placeholder="0"
                        value={form.aeronaves.hangar2}
                        onChange={(e) =>
                            updateField("aeronaves.hangar2", e.target.value)
                        }
                    />
                </div>

                {/* PLATAFORMA H1 */}
                <div className="rounded-lg border-2 border-slate-400 bg-slate-50 p-4">
                    <div className={labelSub}>Plataforma H1</div>
                    <input
                        className={inputSub}
                        placeholder="0"
                        value={form.aeronaves.plataforma_h1}
                        onChange={(e) =>
                            updateField("aeronaves.plataforma_h1", e.target.value)
                        }
                    />
                </div>

                {/* PLATAFORMA H2 */}
                <div className="rounded-lg border-2 border-slate-400 bg-slate-50 p-4">
                    <div className={labelSub}>Plataforma H2</div>
                    <input
                        className={inputSub}
                        placeholder="0"
                        value={form.aeronaves.plataforma_h2}
                        onChange={(e) =>
                            updateField("aeronaves.plataforma_h2", e.target.value)
                        }
                    />
                </div>
            </div>

            {/* AYUDA */}
            <div className="mt-6 text-center text-xs font-medium text-slate-600">
                Captura la distribución de aeronaves por hangar y plataforma
            </div>
        </div>
    );
}
