import { useEffect } from 'react';
import { fetchShowMovimientoCSAE } from '@/stores/apiMovimientoCSAE';
import Swal from 'sweetalert2';

import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    pdf,
    Image,
} from '@react-pdf/renderer';

const GREEN = '#003E51';
const BORDER = '#0f172a';

const SLATE_50 = '#f8fafc';
const SLATE_100 = '#f1f5f9';
const SLATE_200 = '#e2e8f0';
const SLATE_400 = '#94a3b8';
const SLATE_500 = '#64748b';
const SLATE_700 = '#334155';
const SLATE_800 = '#1e293b';
const SLATE_900 = '#0f172a';

const EMERALD_50 = '#ecfdf5';
const EMERALD_200 = '#a7f3d0';
const EMERALD_600 = '#059669';
const EMERALD_700 = '#047857';

const ORANGE_50 = '#fff7ed';
const ORANGE_200 = '#fed7aa';
const ORANGE_600 = '#ea580c';
const ORANGE_700 = '#c2410c';

const styles = StyleSheet.create({
    page: {
        paddingTop: 26,
        paddingRight: 28,
        paddingBottom: 26,
        paddingLeft: 28,
        fontFamily: 'Helvetica',
        fontSize: 8,
        color: SLATE_900,
        backgroundColor: '#ffffff',
    },

    watermark: {
        position: 'absolute',
        top: 170,
        left: 115,
        width: 365,
        height: 365,
        objectFit: 'contain',
        opacity: 0.04,
    },

    content: {
        position: 'relative',
    },

    /* Encabezado */
    header: {
        flexDirection: 'row',
        borderWidth: 2,
        borderColor: BORDER,
        marginBottom: 14,
    },

    headerLogo: {
        width: 105,
        minHeight: 62,
        backgroundColor: GREEN,
        color: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 10,
    },

    headerLogoText: {
        fontSize: 17,
        fontWeight: 'bold',
        letterSpacing: 4,
    },

    headerContent: {
        flex: 1,
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
    },

    headerTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        color: SLATE_900,
        marginBottom: 5,
    },

    headerMetaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },

    headerMeta: {
        fontSize: 7,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        color: SLATE_500,
        marginRight: 16,
    },

    /* Estado */
    statusBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderRadius: 5,
        paddingVertical: 9,
        paddingHorizontal: 12,
        marginBottom: 14,
    },

    statusComplete: {
        backgroundColor: EMERALD_50,
        borderColor: EMERALD_200,
    },

    statusPending: {
        backgroundColor: ORANGE_50,
        borderColor: ORANGE_200,
    },

    statusLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    statusIndicator: {
        width: 9,
        height: 9,
        borderRadius: 5,
        marginRight: 9,
    },

    statusIndicatorComplete: {
        backgroundColor: EMERALD_600,
    },

    statusIndicatorPending: {
        backgroundColor: ORANGE_600,
    },

    statusTitle: {
        fontSize: 8,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.7,
    },

    statusTitleComplete: {
        color: EMERALD_700,
    },

    statusTitlePending: {
        color: ORANGE_700,
    },

    statusDescription: {
        marginTop: 2,
        fontSize: 7,
        color: SLATE_500,
    },

    statusRight: {
        fontSize: 8,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },

    /* Títulos */
    sectionTitle: {
        fontSize: 9,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        color: GREEN,
        borderBottomWidth: 1.5,
        borderBottomColor: GREEN,
        paddingBottom: 3,
        marginTop: 10,
        marginBottom: 7,
        letterSpacing: 0.5,
    },

    /* Tabla principal */
    infoGrid: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderColor: BORDER,
    },

    infoItem: {
        width: '33.333%',
        minHeight: 43,
        justifyContent: 'center',
        paddingVertical: 7,
        paddingHorizontal: 8,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: BORDER,
    },

    infoLabel: {
        fontSize: 6,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        color: SLATE_400,
        letterSpacing: 0.5,
        marginBottom: 3,
    },

    infoValue: {
        fontSize: 9,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        color: SLATE_800,
    },

    /* Cajas de entrada/salida */
    detailsBox: {
        borderWidth: 1,
        borderColor: SLATE_200,
        borderRadius: 5,
        backgroundColor: SLATE_50,
        padding: 10,
    },

    pendingDetailsBox: {
        borderWidth: 1,
        borderColor: ORANGE_200,
        borderRadius: 5,
        backgroundColor: ORANGE_50,
        padding: 10,
    },

    detailsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },

    detailItem: {
        width: '33.333%',
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: 8,
        marginBottom: 4,
    },

    detailIndicator: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: GREEN,
        marginRight: 6,
    },

    detailContent: {
        flex: 1,
    },

    detailLabel: {
        fontSize: 6,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        color: SLATE_400,
        letterSpacing: 0.4,
        marginBottom: 2,
    },

    detailValue: {
        fontSize: 8,
        fontWeight: 'bold',
        color: SLATE_700,
    },

    observations: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: SLATE_200,
    },

    observationsLabel: {
        fontSize: 6,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        color: SLATE_400,
        letterSpacing: 0.5,
        marginBottom: 3,
    },

    observationsText: {
        fontSize: 8,
        color: SLATE_700,
        lineHeight: 1.35,
    },

    /* Salida pendiente */
    pendingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    pendingIndicator: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: ORANGE_600,
        marginRight: 9,
    },

    pendingTitle: {
        fontSize: 8,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        color: ORANGE_700,
        marginBottom: 2,
    },

    pendingDescription: {
        fontSize: 7,
        color: ORANGE_600,
    },

    /* Firmas */
    signatureSection: {
        marginTop: 22,
    },

    signaturesRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },

    signatureBox: {
        width: '44%',
        alignItems: 'center',
    },

    signatureImageArea: {
        height: 70,
        width: '100%',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },

    signatureImage: {
        width: 130,
        height: 62,
        objectFit: 'contain',
    },

    signatureEmpty: {
        fontSize: 7,
        color: SLATE_400,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 12,
    },

    signatureLine: {
        width: '100%',
        borderTopWidth: 1,
        borderTopColor: BORDER,
        paddingTop: 5,
        alignItems: 'center',
    },

    signatureLabel: {
        fontSize: 7,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        color: SLATE_500,
        letterSpacing: 0.5,
    },

    /* Pie */
    footer: {
        position: 'absolute',
        bottom: 11,
        left: 28,
        right: 28,
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 0.5,
        borderTopColor: SLATE_200,
        paddingTop: 4,
    },

    footerText: {
        fontSize: 5.5,
        color: SLATE_400,
        textTransform: 'uppercase',
    },
});

type FirmasBase64 = {
    firma_entrada: string | null;
    firma_salida: string | null;
};

type MovimientoPdfDocProps = {
    data: any;
    firmasBase64: FirmasBase64;
    watermarkBase64: string | null;
};

function getFirmaByRol(detalle: any, rol: string) {
    const firmas = Array.isArray(detalle?.firmas)
        ? detalle.firmas
        : [];

    return (
        firmas.find(
            (firma: any) =>
                firma?.rol === rol &&
                (firma?.status ?? 'A') === 'A',
        ) ?? null
    );
}

function formatFecha(fecha?: string | null): string {
    if (!fecha) return '—';

    const normalizada = String(fecha)
        .replace(' ', 'T')
        .replace('Z', '');

    const [fechaParte] = normalizada.split('T');
    const [anio, mes, dia] = fechaParte.split('-');

    if (!anio || !mes || !dia) {
        return String(fecha);
    }

    return `${dia}/${mes}/${anio}`;
}

function formatHora(fecha?: string | null): string {
    if (!fecha) return '—';

    const normalizada = String(fecha)
        .replace(' ', 'T')
        .replace('Z', '');

    const [, horaParte = ''] = normalizada.split('T');

    return horaParte.slice(0, 5) || '—';
}

function formatFechaMexicoActual(): string {
    return new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(new Date());
}

function PdfInfoItem({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>
                {label}
            </Text>

            <Text style={styles.infoValue}>
                {value || 'N/A'}
            </Text>
        </View>
    );
}

function PdfDetailItem({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <View style={styles.detailItem}>
            <View style={styles.detailIndicator} />

            <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>
                    {label}
                </Text>

                <Text style={styles.detailValue}>
                    {value || 'N/A'}
                </Text>
            </View>
        </View>
    );
}

function PdfSignature({
    label,
    src,
}: {
    label: string;
    src: string | null;
}) {
    return (
        <View style={styles.signatureBox}>
            <View style={styles.signatureImageArea}>
                {src ? (
                    <Image
                        src={src}
                        style={styles.signatureImage}
                    />
                ) : (
                    <Text style={styles.signatureEmpty}>
                        Sin firma
                    </Text>
                )}
            </View>

            <View style={styles.signatureLine}>
                <Text style={styles.signatureLabel}>
                    {label}
                </Text>
            </View>
        </View>
    );
}

function MovimientoPdfDoc({
    data,
    firmasBase64,
    watermarkBase64,
}: MovimientoPdfDocProps) {
    const salio = Boolean(
        data?.fecha_hora_salida,
    );

    return (
        <Document
            title={`Manifiesto_${data?.matricula || data?.id}`}
            author="EOLO"
            subject="Movimiento de aeronave CSAE"
        >
            <Page size="A4" style={styles.page}>
                {watermarkBase64 && (
                    <Image
                        src={watermarkBase64}
                        style={styles.watermark}
                        fixed
                    />
                )}

                <View style={styles.content}>
                    {/* Encabezado */}
                    <View style={styles.header} wrap={false}>
                        <View style={styles.headerLogo}>
                            <Text style={styles.headerLogoText}>
                                EOLO
                            </Text>
                        </View>

                        <View style={styles.headerContent}>
                            <Text style={styles.headerTitle}>
                                Manifiesto de movimiento de aeronave
                            </Text>

                            <View style={styles.headerMetaRow}>
                                <Text style={styles.headerMeta}>
                                    Folio: #CSAE-{data.id}
                                </Text>

                                <Text style={styles.headerMeta}>
                                    Estado:{' '}
                                    {salio
                                        ? 'Salida registrada'
                                        : 'Pendiente de salida'}
                                </Text>

                                <Text style={styles.headerMeta}>
                                    Impresión: {formatFechaMexicoActual()}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Estado */}
                    <View
                        style={[
                            styles.statusBox,
                            salio
                                ? styles.statusComplete
                                : styles.statusPending,
                        ]}
                        wrap={false}
                    >
                        <View style={styles.statusLeft}>
                            <View
                                style={[
                                    styles.statusIndicator,
                                    salio
                                        ? styles.statusIndicatorComplete
                                        : styles.statusIndicatorPending,
                                ]}
                            />

                            <View>
                                <Text
                                    style={[
                                        styles.statusTitle,
                                        salio
                                            ? styles.statusTitleComplete
                                            : styles.statusTitlePending,
                                    ]}
                                >
                                    {salio
                                        ? 'Movimiento completado'
                                        : 'Aeronave en CSAE'}
                                </Text>

                                <Text style={styles.statusDescription}>
                                    {salio
                                        ? 'La entrada y la salida se encuentran registradas.'
                                        : 'La aeronave aún no cuenta con una salida registrada.'}
                                </Text>
                            </View>
                        </View>

                        <Text
                            style={[
                                styles.statusRight,
                                salio
                                    ? styles.statusTitleComplete
                                    : styles.statusTitlePending,
                            ]}
                        >
                            {salio ? 'COMPLETADO' : 'PENDIENTE'}
                        </Text>
                    </View>

                    {/* Datos generales */}
                    <Text style={styles.sectionTitle}>
                        Datos de la aeronave
                    </Text>

                    <View style={styles.infoGrid} wrap={false}>
                        <PdfInfoItem
                            label="Matrícula"
                            value={data.matricula || 'N/A'}
                        />

                        <PdfInfoItem
                            label="Tipo de aeronave"
                            value={data.tipo_aeronave || 'N/A'}
                        />

                        <PdfInfoItem
                            label="Transportista o piloto"
                            value={data.transportista || 'N/A'}
                        />
                    </View>

                    {/* Entrada */}
                    <Text style={styles.sectionTitle}>
                        Registro de entrada
                    </Text>

                    <View style={styles.detailsBox} wrap={false}>
                        <View style={styles.detailsGrid}>
                            <PdfDetailItem
                                label="Fecha de entrada"
                                value={formatFecha(
                                    data.fecha_hora_entrada,
                                )}
                            />

                            <PdfDetailItem
                                label="Hora de entrada"
                                value={formatHora(
                                    data.fecha_hora_entrada,
                                )}
                            />

                            <PdfDetailItem
                                label="Cómo llega"
                                value={
                                    data.como_llega || 'N/A'
                                }
                            />
                        </View>

                        <View style={styles.observations}>
                            <Text style={styles.observationsLabel}>
                                Observaciones de entrada
                            </Text>

                            <Text style={styles.observationsText}>
                                {data.observaciones_entrada ||
                                    'Sin observaciones.'}
                            </Text>
                        </View>
                    </View>

                    {/* Salida */}
                    <Text style={styles.sectionTitle}>
                        Registro de salida
                    </Text>

                    {salio ? (
                        <View
                            style={styles.detailsBox}
                            wrap={false}
                        >
                            <View style={styles.detailsGrid}>
                                <PdfDetailItem
                                    label="Fecha de salida"
                                    value={formatFecha(
                                        data.fecha_hora_salida,
                                    )}
                                />

                                <PdfDetailItem
                                    label="Hora de salida"
                                    value={formatHora(
                                        data.fecha_hora_salida,
                                    )}
                                />
                            </View>

                            <View style={styles.observations}>
                                <Text style={styles.observationsLabel}>
                                    Observaciones de salida
                                </Text>

                                <Text style={styles.observationsText}>
                                    {data.observaciones_salida ||
                                        'Sin observaciones.'}
                                </Text>
                            </View>
                        </View>
                    ) : (
                        <View
                            style={styles.pendingDetailsBox}
                            wrap={false}
                        >
                            <View style={styles.pendingRow}>
                                <View style={styles.pendingIndicator} />

                                <View>
                                    <Text style={styles.pendingTitle}>
                                        Salida pendiente
                                    </Text>

                                    <Text style={styles.pendingDescription}>
                                        Aún no se registra la fecha,
                                        hora ni firma de salida.
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Firmas */}
                    <View
                        style={styles.signatureSection}
                        wrap={false}
                    >
                        <Text style={styles.sectionTitle}>
                            Validaciones
                        </Text>

                        <View style={styles.signaturesRow}>
                            <PdfSignature
                                label="Firma de entrada"
                                src={
                                    firmasBase64.firma_entrada
                                }
                            />

                            <PdfSignature
                                label="Firma de salida"
                                src={
                                    firmasBase64.firma_salida
                                }
                            />
                        </View>
                    </View>
                </View>

                <View style={styles.footer} fixed>
                    <Text style={styles.footerText}>
                        EOLO · Movimiento de aeronaves CSAE
                    </Text>

                    <Text
                        style={styles.footerText}
                        render={({ pageNumber, totalPages }) =>
                            `Página ${pageNumber} de ${totalPages}`
                        }
                    />
                </View>
            </Page>
        </Document>
    );
}

function toSameOrigin(url: string): string {
    try {
        const parsedUrl = new URL(
            url,
            window.location.origin,
        );

        return `${window.location.origin}${parsedUrl.pathname}${parsedUrl.search}`;
    } catch {
        return url;
    }
}

async function urlToDataUrl(
    url: string,
): Promise<string> {
    const sameOriginUrl = toSameOrigin(url);

    const response = await fetch(sameOriginUrl, {
        cache: 'no-store',
        credentials: 'same-origin',
    });

    if (!response.ok) {
        throw new Error(
            `No se pudo cargar la imagen: ${sameOriginUrl}`,
        );
    }

    const blob = await response.blob();

    return await new Promise<string>(
        (resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () =>
                resolve(String(reader.result));

            reader.onerror = () =>
                reject(
                    new Error(
                        'No se pudo convertir la imagen',
                    ),
                );

            reader.readAsDataURL(blob);
        },
    );
}

interface PdfCsaeProps {
    id: number | null;
    onDone: () => void;
}

export default function PdfCsae({
    id,
    onDone,
}: PdfCsaeProps) {
    useEffect(() => {
        if (!id) return;

        let activo = true;

        const generatePdf = async () => {
            Swal.fire({
                title: 'Generando PDF',
                text: 'Preparando manifiesto y firmas...',
                allowOutsideClick: false,
                allowEscapeKey: false,
                didOpen: () => Swal.showLoading(),
            });

            try {
                const response =
                    await fetchShowMovimientoCSAE(id);

                const finalData = response?.data
                    ? response.data
                    : response;

                const firmaEntrada = getFirmaByRol(
                    finalData,
                    'firma_entrada',
                );

                const firmaSalida = getFirmaByRol(
                    finalData,
                    'firma_salida',
                );

                const watermarkUrl =
                    `${window.location.origin}/1c463caa-e3a1-4093-a00b-1c0da40795f6.jpg`;

                const [
                    firmaEntradaBase64,
                    firmaSalidaBase64,
                    watermarkBase64,
                ] = await Promise.all([
                    firmaEntrada?.url
                        ? urlToDataUrl(firmaEntrada.url)
                        : Promise.resolve(null),

                    firmaSalida?.url
                        ? urlToDataUrl(firmaSalida.url)
                        : Promise.resolve(null),

                    urlToDataUrl(watermarkUrl).catch(
                        () => null,
                    ),
                ]);

                const firmasBase64: FirmasBase64 = {
                    firma_entrada:
                        firmaEntradaBase64,
                    firma_salida:
                        firmaSalidaBase64,
                };

                const blob = await pdf(
                    <MovimientoPdfDoc
                        data={finalData}
                        firmasBase64={firmasBase64}
                        watermarkBase64={
                            watermarkBase64
                        }
                    />,
                ).toBlob();

                if (!activo) return;

                const url =
                    URL.createObjectURL(blob);

                const link =
                    document.createElement('a');

                link.href = url;
                link.download =
                    `Manifiesto_${finalData.matricula || finalData.id}.pdf`;

                document.body.appendChild(link);
                link.click();
                link.remove();

                window.setTimeout(() => {
                    URL.revokeObjectURL(url);
                }, 1000);

                await Swal.fire({
                    icon: 'success',
                    title: 'PDF descargado',
                    text: 'El manifiesto fue generado correctamente.',
                    timer: 1400,
                    showConfirmButton: false,
                });
            } catch (error) {
                console.error(
                    'Error al generar PDF:',
                    error,
                );

                if (activo) {
                    await Swal.fire({
                        icon: 'error',
                        title: 'No se pudo generar',
                        text: 'Ocurrió un error al preparar el documento.',
                        confirmButtonColor: GREEN,
                    });
                }
            } finally {
                if (activo) {
                    onDone();
                }
            }
        };

        generatePdf();

        return () => {
            activo = false;
        };
    }, [id, onDone]);

    return null;
}
