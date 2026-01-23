const Section = ({ title, children }: any) => (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h3 className="mb-4 border-b pb-2 text-sm font-bold uppercase text-orange-600">
            {title}
        </h3>
        {children}
    </div>
);

export default function GPUs({ form, updateField }: any) {
    const input =
        "w-full rounded-lg border-2 border-slate-400 bg-slate-100 px-3 py-2 text-sm font-bold focus:border-orange-500 focus:bg-white focus:outline-none";

    const select = input;

    const card =
        "rounded-xl border-2 border-slate-300 bg-slate-50 p-4 shadow";

    const gpuCard = (
        key: string,
        label: string,
        path: string
    ) => (
        <div className={card}>
            <h4 className="mb-4 text-xs font-extrabold uppercase tracking-widest text-slate-700">
                {label}
            </h4>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                    <label className="label">Limpia</label>
                    <select
                        className={select}
                        value={form.gpus[key].limpia}
                        onChange={(e) =>
                            updateField(`${path}.limpia`, e.target.value)
                        }
                    >
                        <option value="">Elija una opción</option>
                        <option value="Si">Sí</option>
                        <option value="No">No</option>
                    </select>
                </div>

                <div>
                    <label className="label">Horometro</label>
                    <input
                        className={input}
                        placeholder="28"
                        value={form.gpus[key].horometro}
                        onChange={(e) =>
                            updateField(`${path}.horometro`, e.target.value)
                        }
                    />
                </div>

                <div>
                    <label className="label">Número</label>
                    <input
                        className={input}
                        placeholder="No. GPU"
                        value={form.gpus[key].cantidad}
                        onChange={(e) =>
                            updateField(`${path}.cantidad`, e.target.value)
                        }
                    />
                </div>

                <div>
                    <label className="label">Enchufe</label>
                    <select
                        className={select}
                        value={form.gpus[key].enchufe}
                        onChange={(e) =>
                            updateField(`${path}.enchufe`, e.target.value)
                        }
                    >
                        <option value="">Elija una opción</option>
                        <option value="Bien">Bien</option>
                        <option value="Mal">Mal</option>
                    </select>
                </div>

                <div>
                    <label className="label">Llantas</label>
                    <select
                        className={select}
                        value={form.gpus[key].llantas}
                        onChange={(e) =>
                            updateField(`${path}.llantas`, e.target.value)
                        }
                    >
                        <option value="">Elija una opción</option>
                        <option value="Bien">Bien</option>
                        <option value="Mal">Mal</option>
                    </select>
                </div>

                <div className="md:col-span-3">
                    <label className="label">Observaciones</label>
                    <input
                        className={input}
                        placeholder="Observaciones"
                        value={form.gpus[key].obs ?? ""}
                        onChange={(e) =>
                            updateField(`${path}.obs`, e.target.value)
                        }
                    />
                </div>
            </div>
        </div>
    );

    return (
        <Section title="GPU's">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {gpuCard(
                    "gpu115",
                    "GPU 115",
                    "gpus.gpu115"
                )}

                {gpuCard(
                    "hobart600",
                    "GPU Hobart 600",
                    "gpus.hobart600"
                )}

                {gpuCard(
                    "foxtronics",
                    "GPU Foxtronics",
                    "gpus.foxtronics"
                )}
            </div>
        </Section>
    );
}
