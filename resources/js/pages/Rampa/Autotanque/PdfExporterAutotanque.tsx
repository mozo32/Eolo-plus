import React, { useEffect, useState, useRef, useMemo } from "react";
import { showAutotanque } from "@/stores/apiAutoTanque";
import Swal from "sweetalert2";
import { Document, Page, Text, View, StyleSheet, pdf, Image } from "@react-pdf/renderer";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import * as THREE from "three";

const GREEN = "#003E51";
const BORDER = "#111111";
const GRAY_TEXT = "#374151";
const MODELO_DIR = "/models/Meshy_AI_Jet_A1_Aviation_Fuel__0615234341_texture_obj/";
const MODELO_OBJ = `${MODELO_DIR}Meshy_AI_Jet_A1_Aviation_Fuel__0615234341_texture.obj`;
const MODELO_MTL = `${MODELO_DIR}Meshy_AI_Jet_A1_Aviation_Fuel__0615234341_texture.mtl`;
const ITEMS_CALIDAD = ["Toma de Muestra de Combustible", "Prueba de claridad y Brillantez", "Presencia de Sólidos y/o agua de forma visual"];
const NOMBRES_DRENES: Record<number, string> = { 1: "Delantero del tanque", 2: "Strainer", 3: "Succión auxiliar", 4: "Trasero del tanque", 5: "Entrada a elementos filtrantes", 6: "Salida de elementos filtrantes" };

useLoader.preload(MTLLoader, MODELO_MTL);
useLoader.preload(OBJLoader, MODELO_OBJ);

const styles = StyleSheet.create({
    page: { padding: 20, fontSize: 9, color: "#111827", fontFamily: "Helvetica", backgroundColor: "#ffffff" },
    watermark: { position: "absolute", top: 160, left: 95, width: 380, opacity: 0.08, zIndex: -1, objectFit: "contain" },
    headerLogo: { width: "100%", height: 45, objectFit: "contain" },
    headerWrap: { flexDirection: "row", borderWidth: 2, borderColor: BORDER, marginBottom: 8 },
    headerLeft: { width: 120, justifyContent: "center", alignItems: "flex-start", paddingVertical: 10, paddingLeft: 14, paddingRight: 8 },
    headerMid: { flex: 1, paddingVertical: 6, paddingHorizontal: 10, justifyContent: "center" },
    headerTitle: { fontSize: 11, fontWeight: "bold" as any, textTransform: "uppercase", marginBottom: 2 },
    headerSub: { fontSize: 8, color: GRAY_TEXT },
    fieldsWrap: { borderWidth: 2, borderColor: BORDER, marginBottom: 8 },
    fieldsRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: BORDER },
    fieldCell: { flex: 1, borderRightWidth: 1, borderColor: BORDER, paddingVertical: 4, paddingHorizontal: 6 },
    label: { fontSize: 7, fontWeight: "bold" as any, textTransform: "uppercase", color: "#111", marginBottom: 1 },
    value: { fontSize: 9, fontWeight: "bold" as any, textTransform: "uppercase" },
    boxTitle: { fontSize: 9, fontWeight: "bold" as any, textTransform: "uppercase", color: GREEN, marginBottom: 4, marginTop: 8 },
    inspeccionBox: { borderWidth: 2, borderColor: BORDER, padding: 8, marginBottom: 8 },
    checklistPanel: { marginTop: 6, borderTopWidth: 1, borderColor: "#e5e7eb", paddingTop: 6 },
    checklistTitle: { fontSize: 7.5, fontWeight: "bold" as any, textTransform: "uppercase", color: GREEN, marginBottom: 5 },
    checklistGrid: { flexDirection: "row", flexWrap: "wrap" },
    checkItem: { width: "49%", borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#f9fafb", borderRadius: 5, padding: 5, marginBottom: 5, marginRight: "1%" },
    checkItemWide: { width: "100%", marginRight: 0, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#f9fafb", borderRadius: 5, padding: 5, marginBottom: 5 },
    checkItemTop: { flexDirection: "row" },
    checkBullet: { fontSize: 8, color: GREEN, marginRight: 3 },
    checkTextWrap: { flex: 1 },
    checkKey: { fontSize: 6.7, color: "#111827", lineHeight: 1.25 },
    checkDren: { fontSize: 6, color: "#2563eb", fontWeight: "bold" as any, textTransform: "uppercase", marginTop: 2 },
    checkValueBox: { marginTop: 4, alignSelf: "flex-start", borderWidth: 1, borderRadius: 10, paddingVertical: 2, paddingHorizontal: 5 },
    checkValueText: { fontSize: 6.2, fontWeight: "bold" as any },
    qualityDrenBox: { borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#ffffff", borderRadius: 6, padding: 6, marginBottom: 7 },
    qualityDrenTitle: { fontSize: 7.5, fontWeight: "bold" as any, color: GREEN, textTransform: "uppercase", marginBottom: 5 },
    damageContainer: { width: "100%", marginTop: 8, alignSelf: "center", borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#f8fafc", padding: 10 },
    leyendaContainer: { flexDirection: "row", justifyContent: "center", gap: 30, marginBottom: 12, padding: 6, backgroundColor: "#ffffff", borderRadius: 6, borderWidth: 1, borderColor: "#e2e8f0" },
    leyendaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    dotRojo: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#ef4444" },
    dotAmarillo: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#f59e0b" },
    leyendaText: { fontSize: 8, fontWeight: "bold" as any, textTransform: "uppercase" },
    capturasGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
    capturaImg: { width: 250, height: 180, borderWidth: 1, borderColor: "#cbd5e1", objectFit: "cover" },
    tableWrap: { borderWidth: 2, borderColor: BORDER },
    tableHeader: { flexDirection: "row", backgroundColor: "#e5e7eb", borderBottomWidth: 1, borderColor: BORDER },
    th: { paddingVertical: 4, fontSize: 7.5, fontWeight: "bold" as any, textTransform: "uppercase", borderRightWidth: 1, borderColor: BORDER, textAlign: "center" },
    tr: { flexDirection: "row", borderBottomWidth: 1, borderColor: BORDER },
    td: { paddingVertical: 4, fontSize: 8, borderRightWidth: 1, borderColor: BORDER, textAlign: "center" },
    balanceBox: { marginTop: 10, flexDirection: "row", justifyContent: "flex-end", gap: 10 },
    balanceCard: { borderWidth: 2, borderColor: BORDER, padding: 6, minWidth: 100, alignItems: "center" },
    evidenciasTitle: { fontSize: 9, fontWeight: "bold" as any, textTransform: "uppercase", color: GREEN, marginTop: 15, marginBottom: 5 },
    evidenciasGrid: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
    evidenciaImage: { width: 130, height: 100, borderWidth: 1, borderColor: BORDER, objectFit: "cover" },
    firmasSection: { flexDirection: "row", justifyContent: "space-around", marginTop: 30, paddingBottom: 20 },
    firmaBox: { alignItems: "center", width: 150 },
    firmaImage: { width: 120, height: 60, marginBottom: 5, objectFit: "contain" },
    firmaLine: { width: "100%", borderTopWidth: 1, borderColor: BORDER, marginTop: 2 },
    firmaLabel: { fontSize: 7, fontWeight: "bold" as any, textTransform: "uppercase", marginTop: 4, textAlign: "center" }
});

function Watermark({ src }: { src: string }) {
    return <Image src={src} fixed style={styles.watermark} />;
}

function AutotanquePdfDoc({ detalle, capturas3D }: { detalle: any; capturas3D: string[] }) {
    const turno = detalle?.data?.turno || {};
    const inspeccion = detalle?.data?.inspeccion || turno?.inspeccion;
    const remisiones = Array.isArray(detalle?.data?.remision) ? detalle.data.remision : [];
    const watermarkUrl = `${window.location.origin}/1c463caa-e3a1-4093-a00b-1c0da40795f6.jpg`;
    const firmas = Array.isArray(inspeccion?.firmas) ? inspeccion.firmas : [];
    const fotos = Array.isArray(inspeccion?.imagenes) ? inspeccion.imagenes : [];
    const logoUrl = `${window.location.origin}/54657b8c-8428-41cc-a654-794ca81943d6.jpg`;
    const respuestas = inspeccion?.checklist_respuestas || {};

    const getFullUrl = (path: string) => {
        if (!path) return "";
        if (path.startsWith("http") || path.startsWith("data:image")) return path;
        return `${window.location.origin}/storage/${path.replace("public/", "")}`;
    };

    const suministroCombustible = inspeccion?.suministro_combustible ?? inspeccion?.suministroCombustible ?? (inspeccion?.suministrado !== undefined || inspeccion?.horometro !== undefined || inspeccion?.hora !== undefined || inspeccion?.litros !== undefined ? inspeccion : {});
    const valorTexto = (valor: any) => valor === null || valor === undefined || valor === "" ? "-" : valor.toString();

    const valorNumero = (valor: any) => {
        const numero = Number(valor);
        if (Number.isNaN(numero)) return "-";
        return numero.toLocaleString("en-US", { maximumFractionDigits: 2 });
    };

    const formatearFechaHora = (valor: any) => {
        if (!valor) return "N/A";
        const texto = String(valor).trim();
        const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::\d{2})?)?/);
        if (!match) return texto;
        const [, anio, mes, dia, hora, minuto] = match;
        return hora && minuto ? `${dia}/${mes}/${anio} ${hora}:${minuto}` : `${dia}/${mes}/${anio}`;
    };

    const separarLlaveChecklist = (key: string) => {
        const partes = key.split(" - Dren ");
        if (partes.length > 1) return { concepto: partes[0], detalle: `Dren ${partes.slice(1).join(" - Dren ")}` };
        return { concepto: key, detalle: "" };
    };

    const formatearValorChecklist = (valor: any) => valor === null || valor === undefined || valor === "" ? "-" : String(valor).replace(/\s*\|\s*/g, " / ");

    const obtenerColoresRespuesta = (valor: any) => {
        const texto = String(valor || "").toLowerCase();
        if (texto.includes("no se realizaron pruebas")) return { background: "#f3f4f6", border: "#d1d5db", text: "#64748b" };
        if (texto === "ok" || texto.includes("claro y brillante") || texto.includes("sin presencia")) return { background: "#dcfce7", border: "#86efac", text: "#166534" };
        if (texto === "no" || texto.includes("no claro") || texto.includes("no brillante") || texto.includes("con presencia")) return { background: "#fee2e2", border: "#fecaca", text: "#991b1b" };
        return { background: "#f3f4f6", border: "#d1d5db", text: "#374151" };
    };

    const obtenerRespuestaCalidad = (item: string, dren: number) => {
        const nombreDren = NOMBRES_DRENES[dren] || `${dren}`;
        const keyNombre = `${item} - Dren ${nombreDren.toLowerCase()}`;
        const keyNumero = `${item} - Dren ${dren}`;
        return respuestas[keyNombre] ?? respuestas[keyNumero] ?? "";
    };

    const renderChecklistItem = ([key, val]: [string, any], i: number) => {
        const info = separarLlaveChecklist(key);
        const colores = obtenerColoresRespuesta(val);
        return (
            <View key={`${key}-${i}`} style={styles.checkItem}>
                <View style={styles.checkItemTop}>
                    <Text style={styles.checkBullet}>•</Text>
                    <View style={styles.checkTextWrap}>
                        <Text style={styles.checkKey}>{info.concepto}</Text>
                        {info.detalle !== "" && <Text style={styles.checkDren}>{info.detalle}</Text>}
                    </View>
                </View>
                <View style={[styles.checkValueBox, { backgroundColor: colores.background, borderColor: colores.border }]}>
                    <Text style={[styles.checkValueText, { color: colores.text }]}>{formatearValorChecklist(val)}</Text>
                </View>
            </View>
        );
    };

    const renderCalidadItem = (item: string, dren: number) => {
        const toma = obtenerRespuestaCalidad("Toma de Muestra de Combustible", dren);
        const esToma = item === "Toma de Muestra de Combustible";
        const valorOriginal = obtenerRespuestaCalidad(item, dren);
        const valor = !esToma && String(toma).toLowerCase() === "no" ? "No se realizaron pruebas" : valorOriginal || "-";
        const colores = obtenerColoresRespuesta(valor);
        return (
            <View key={`${item}-${dren}`} style={styles.checkItemWide}>
                <View style={styles.checkItemTop}>
                    <Text style={styles.checkBullet}>•</Text>
                    <View style={styles.checkTextWrap}>
                        <Text style={styles.checkKey}>{item}</Text>
                        <Text style={styles.checkDren}>Dren {NOMBRES_DRENES[dren] || dren}</Text>
                    </View>
                </View>
                <View style={[styles.checkValueBox, { backgroundColor: colores.background, borderColor: colores.border }]}>
                    <Text style={[styles.checkValueText, { color: colores.text }]}>{formatearValorChecklist(valor)}</Text>
                </View>
            </View>
        );
    };

    const checklistEntries = Object.entries(respuestas) as [string, any][];
    const checklistGenerales = checklistEntries.filter(([key]) => !key.toLowerCase().includes(" - dren "));

    const HeaderPdf = ({ title }: { title: string }) => (
        <View style={styles.headerWrap}>
            <View style={styles.headerLeft}><Image src={logoUrl} style={styles.headerLogo} /></View>
            <View style={styles.headerMid}>
                <Text style={styles.headerTitle}>{title}</Text>
                <Text style={styles.headerSub}>Folio Turno: #{turno.id || "N/A"} · Fecha: {formatearFechaHora(turno.fecha)}</Text>
            </View>
        </View>
    );

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Watermark src={watermarkUrl} />
                <HeaderPdf title="Reporte de Turno Autotanque" />

                <View style={styles.fieldsWrap} wrap={false}>
                    <View style={styles.fieldsRow}>
                        <View style={styles.fieldCell}><Text style={styles.label}>Responsable Apertura</Text><Text style={styles.value}>{turno.nombre || "-"}</Text></View>
                        <View style={styles.fieldCell}><Text style={styles.label}>Litros Iniciales</Text><Text style={styles.value}>{Number(turno.litrosIni || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} L</Text></View>
                    </View>
                    <View style={[styles.fieldsRow, { borderBottomWidth: 0 }]}>
                        <View style={styles.fieldCell}><Text style={styles.label}>Responsable Cierre</Text><Text style={styles.value}>{turno.nombreCierre || "-"}</Text></View>
                        <View style={styles.fieldCell}><Text style={styles.label}>Litros Finales</Text><Text style={styles.value}>{Number(turno.litrosCierre || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} L</Text></View>
                    </View>
                </View>

                {inspeccion && (
                    <>
                        <Text style={styles.boxTitle}>Inspección de Unidad</Text>
                        <View style={styles.inspeccionBox}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4, gap: 6 }}>
                                <Text style={styles.label}>Operador: {inspeccion.operador || "-"}</Text>
                                <Text style={styles.label}>KM: {inspeccion.kilometraje ? valorNumero(inspeccion.kilometraje) : "-"}</Text>
                                <Text style={styles.label}>Combustible: {inspeccion.porcentaje_combustible !== null && inspeccion.porcentaje_combustible !== undefined ? `${inspeccion.porcentaje_combustible}%` : "-"}</Text>
                            </View>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4, gap: 6 }}>
                                <Text style={styles.label}>Suministro diésel: {valorTexto(suministroCombustible.suministrado)}</Text>
                                <Text style={styles.label}>Horómetro: {valorTexto(suministroCombustible.horometro)} HRS</Text>
                            </View>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6, gap: 6 }}>
                                <Text style={styles.label}>Hora suministro: {valorTexto(suministroCombustible.hora)}</Text>
                                <Text style={styles.label}>Litros suministrados: {suministroCombustible.litros ? `${valorNumero(suministroCombustible.litros)} LTS` : "-"}</Text>
                            </View>
                            <View style={styles.checklistPanel}>
                                {checklistGenerales.length > 0 && (
                                    <View>
                                        <Text style={styles.checklistTitle}>Checklist general de unidad</Text>
                                        <View style={styles.checklistGrid}>{checklistGenerales.map((entry, i) => renderChecklistItem(entry, i))}</View>
                                    </View>
                                )}
                            </View>
                        </View>
                    </>
                )}
            </Page>

            {inspeccion && (
                <Page size="A4" style={styles.page}>
                    <Watermark src={watermarkUrl} />
                    <HeaderPdf title="Pruebas de Calidad de Combustible" />
                    <Text style={styles.boxTitle}>Pruebas de Calidad de Combustible</Text>
                    <View style={styles.inspeccionBox}>
                        {[1, 2, 3, 4, 5, 6].map((dren) => (
                            <View key={dren} style={styles.qualityDrenBox} wrap={false}>
                                <Text style={styles.qualityDrenTitle}>Dren {dren}: {NOMBRES_DRENES[dren]}</Text>
                                <View style={styles.checklistGrid}>{ITEMS_CALIDAD.map((item) => renderCalidadItem(item, dren))}</View>
                            </View>
                        ))}
                    </View>
                </Page>
            )}

            <Page size="A4" style={styles.page}>
                <Watermark src={watermarkUrl} />
                <HeaderPdf title="Daños, Remisiones y Firmas" />

                <Text style={styles.boxTitle}>Inspección Histórica de Daños</Text>
                <View style={styles.damageContainer} wrap={false}>
                    {capturas3D.length > 0 ? (
                        <>
                            <View style={styles.leyendaContainer}>
                                <View style={styles.leyendaItem}><View style={styles.dotRojo} /><Text style={styles.leyendaText}>Faltante</Text></View>
                                <View style={styles.leyendaItem}><View style={styles.dotAmarillo} /><Text style={styles.leyendaText}>Daño</Text></View>
                            </View>
                            <View style={styles.capturasGrid}>{capturas3D.map((src, idx) => <Image key={idx} src={src} style={styles.capturaImg} />)}</View>
                        </>
                    ) : (
                        <View style={{ justifyContent: "center", alignItems: "center", paddingVertical: 20 }}>
                            <Text style={{ color: "#9ca3af" }}>No se adjuntó captura del modelo 3D de los daños.</Text>
                        </View>
                    )}
                </View>

                <Text style={styles.boxTitle}>Remisiones de Combustible</Text>
                <View style={styles.tableWrap} wrap={false}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.th, { width: "15%" }]}>Folio</Text>
                        <Text style={[styles.th, { width: "40%" }]}>Cliente</Text>
                        <Text style={[styles.th, { width: "25%" }]}>Matrícula</Text>
                        <Text style={[styles.th, { width: "20%", borderRightWidth: 0 }]}>Total Lts</Text>
                    </View>
                    {remisiones.length > 0 ? remisiones.map((r: any, idx: number) => (
                        <View key={idx} style={styles.tr}>
                            <Text style={[styles.td, { width: "15%" }]}>{r.folio}</Text>
                            <Text style={[styles.td, { width: "40%", textAlign: "left", paddingLeft: 4 }]}>{r.cliente}</Text>
                            <Text style={[styles.td, { width: "25%" }]}>{r.matricula}</Text>
                            <Text style={[styles.td, { width: "20%", borderRightWidth: 0, fontWeight: "bold" as any }]}>{r.total_litros}</Text>
                        </View>
                    )) : (
                        <View style={styles.tr}><Text style={[styles.td, { width: "100%", borderRightWidth: 0 }]}>No hay remisiones registradas</Text></View>
                    )}
                </View>

                <View style={styles.balanceBox} wrap={false}>
                    <View style={styles.balanceCard}><Text style={styles.label}>Total Vendido</Text><Text style={[styles.value, { color: GREEN }]}>{Number(turno.totalVendidos || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} L</Text></View>
                    <View style={styles.balanceCard}><Text style={styles.label}>Diferencia Final</Text><Text style={[styles.value, { color: "#dc2626" }]}>{Number(turno.diferenciaFinal || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} L</Text></View>
                </View>

                {fotos.length > 0 && (
                    <View>
                        <Text style={styles.evidenciasTitle}>Evidencias Fotográficas</Text>
                        <View style={styles.evidenciasGrid}>{fotos.map((foto: any, idx: number) => <Image key={idx} src={getFullUrl(foto.path)} style={styles.evidenciaImage} />)}</View>
                    </View>
                )}

                {firmas.length > 0 && (
                    <View style={styles.firmasSection} wrap={false}>
                        {firmas.map((firma: any, idx: number) => (
                            <View key={idx} style={styles.firmaBox}>
                                <Image src={getFullUrl(firma.path)} style={styles.firmaImage} />
                                <View style={styles.firmaLine} />
                                <Text style={styles.firmaLabel}>{firma.pivot?.tag || "Firma Autorizada"}</Text>
                            </View>
                        ))}
                    </View>
                )}
            </Page>
        </Document>
    );
}

const CaptureScene = ({ danos, onComplete }: { danos: any[]; onComplete: (photos: string[]) => void }) => {
    const { gl, camera, scene } = useThree();
    const materials = useLoader(MTLLoader, MODELO_MTL, (loader) => { loader.setPath(MODELO_DIR); loader.setResourcePath(MODELO_DIR); });
    const loadedObject = useLoader(OBJLoader, MODELO_OBJ, (loader) => { materials.preload(); loader.setMaterials(materials); });
    const meshesRef = useRef<(THREE.Mesh | null)[]>([]);

    const object = useMemo(() => {
        const clone = loadedObject.clone(true);
        clone.position.set(0, 0, 0);
        clone.rotation.set(0, 0, 0);
        clone.scale.set(1, 1, 1);
        clone.traverse((child: any) => {
            if (child.isMesh) {
                child.geometry.computeVertexNormals();
                child.geometry.computeBoundingSphere();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach((mat: any) => { mat.side = THREE.DoubleSide; mat.needsUpdate = true; });
                    else { child.material.side = THREE.DoubleSide; child.material.needsUpdate = true; }
                } else child.material = new THREE.MeshStandardMaterial({ color: "#777777", roughness: 0.7, metalness: 0.05, side: THREE.DoubleSide });
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        const box = new THREE.Box3().setFromObject(clone);
        const center = box.getCenter(new THREE.Vector3());
        clone.position.sub(center);
        return clone;
    }, [loadedObject]);

    useEffect(() => {
        let cancelado = false;
        const capture = async () => {
            const photos: string[] = [];
            await new Promise((resolve) => setTimeout(resolve, 1000));
            if (!danos.length) { onComplete([]); return; }
            for (let i = 0; i < danos.length; i++) {
                if (cancelado) return;
                meshesRef.current.forEach((mesh) => { if (mesh) mesh.visible = false; });
                if (meshesRef.current[i]) meshesRef.current[i]!.visible = true;
                const d = danos[i];
                const target = new THREE.Vector3(Number(d.x), Number(d.y), Number(d.z));
                object.localToWorld(target);
                const dir = target.clone().normalize();
                if (dir.lengthSq() === 0) dir.set(0, 0, 1);
                camera.position.copy(target.clone().add(dir.multiplyScalar(1.4)).add(new THREE.Vector3(0, 0.25, 0)));
                camera.lookAt(target);
                gl.render(scene, camera);
                await new Promise((resolve) => setTimeout(resolve, 180));
                photos.push(gl.domElement.toDataURL("image/png"));
            }
            if (!cancelado) onComplete(photos);
        };
        capture();
        return () => { cancelado = true; };
    }, [danos, camera, gl, scene, onComplete, object]);

    return (
        <group>
            <color attach="background" args={["#f8fafc"]} />
            <ambientLight intensity={0.65} />
            <directionalLight position={[10, 10, 10]} intensity={1.8} />
            <directionalLight position={[-10, 5, -10]} intensity={0.8} />
            <hemisphereLight intensity={0.7} groundColor="#e5e7eb" />
            <primitive object={object}>
                {danos.map((d, i) => (
                    <mesh key={i} position={[Number(d.x), Number(d.y), Number(d.z)]} ref={(el) => { meshesRef.current[i] = el; }}>
                        <sphereGeometry args={[0.03, 12, 12]} />
                        <meshStandardMaterial color={d.tipo === "X" ? "#ef4444" : "#f59e0b"} emissive={d.tipo === "X" ? "#ef4444" : "#f59e0b"} emissiveIntensity={0.4} />
                    </mesh>
                ))}
            </primitive>
        </group>
    );
};

const ModelCapturer = ({ danos, onComplete }: { danos: any[]; onComplete: (photos: string[]) => void }) => (
    <div style={{ position: "absolute", left: "-9999px", top: "-9999px", width: "1024px", height: "768px" }}>
        <Canvas gl={{ preserveDrawingBuffer: true, antialias: true, powerPreference: "high-performance" }} camera={{ fov: 40 }}>
            <CaptureScene danos={danos} onComplete={onComplete} />
        </Canvas>
    </div>
);

export default function PdfExporterAutotanque({ id, onDone }: { id: number | null; onDone: () => void }) {
    const [needsCapture, setNeedsCapture] = useState(false);
    const [dataToRender, setDataToRender] = useState<any>(null);

    const generatePdf = async (detalle: any, fotos3D: string[]) => {
        try {
            const blob = await pdf(<AutotanquePdfDoc detalle={detalle} capturas3D={fotos3D} />).toBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Reporte_Autotanque_${detalle.data.turno.id}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            Swal.fire({ icon: "success", title: "PDF Generado", timer: 1500, showConfirmButton: false });
        } catch (error) {
            Swal.fire("Error", "No se pudo generar el PDF", "error");
        } finally {
            onDone();
        }
    };

    useEffect(() => {
        if (!id) return;
        const fetchData = async () => {
            Swal.fire({ title: "Generando Reporte", text: "Procesando capturas 3D...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            try {
                const response = await showAutotanque(id);
                if (!response?.data) throw new Error("Sin datos");
                setDataToRender(response);
                if (response.data.inspeccion?.danos_grafico?.length > 0) setNeedsCapture(true);
                else generatePdf(response, []);
            } catch (e) {
                Swal.fire("Error", "No se pudo obtener la información", "error");
                onDone();
            }
        };
        fetchData();
    }, [id]);

    if (needsCapture && dataToRender) {
        return <ModelCapturer danos={dataToRender.data.inspeccion.danos_grafico} onComplete={(fotos) => { setNeedsCapture(false); generatePdf(dataToRender, fotos); }} />;
    }

    return null;
}
