import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[^\d,.-]/g, "").replace(",", ".").trim();
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
};

const formatNumber = (value: number | undefined, decimals = 2): string => {
  if (value === undefined || Number.isNaN(value)) return "N/D";
  const fixed = value.toFixed(decimals);
  return fixed.replace(/\.00$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
};

const parseDurationMinutes = (value: unknown): number | undefined => {
  const text = String(value ?? "").toLowerCase().trim();
  if (!text) return undefined;

  const hhmmss = text.match(/(\d{1,2})\s*:\s*(\d{1,2})(?:\s*:\s*(\d{1,2}))?/);
  if (hhmmss) {
    if (hhmmss[3] !== undefined) {
      const h = Number(hhmmss[1]);
      const m = Number(hhmmss[2]);
      const s = Number(hhmmss[3]);
      return h * 60 + m + s / 60;
    }
    const m = Number(hhmmss[1]);
    const s = Number(hhmmss[2]);
    return m + s / 60;
  }

  const hr = text.match(/(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hora|horas)/);
  if (hr) return Number(hr[1].replace(",", ".")) * 60;

  const min = text.match(/(\d+(?:[.,]\d+)?)\s*(m|min|mins|minuto|minutos)\b/);
  if (min) return Number(min[1].replace(",", "."));

  const raw = text.match(/(\d+(?:[.,]\d+)?)/);
  return raw ? Number(raw[1].replace(",", ".")) : undefined;
};

const extractMaxAsegurados = (responseTimeDesc: unknown): number | undefined => {
  const text = String(responseTimeDesc ?? "").toLowerCase();
  const match = text.match(/de\s*\d+\s*a\s*(\d+)\s*asegur/);
  return match ? Number(match[1]) : undefined;
};

const deriveStressSummary = (stressSteps: any[]): any | undefined => {
  if (!Array.isArray(stressSteps) || stressSteps.length === 0) return undefined;

  const toNums = (key: string) => stressSteps
    .map((s) => toNumber(s?.[key]))
    .filter((v): v is number => v !== undefined);

  const uvcVals = toNums("uvc");
  const trxVals = toNums("trx");
  const aseguradosVals = toNums("asegurados");
  const tPromVals = toNums("tProm");
  const tMinVals = toNums("tMin");
  const tMaxVals = toNums("tMax");

  return {
    uvc: uvcVals.length ? Math.max(...uvcVals) : undefined,
    trx: trxVals.length ? Math.max(...trxVals) : undefined,
    asegurados: aseguradosVals.length ? aseguradosVals[0] : undefined,
    tProm: tPromVals.length ? Number((tPromVals.reduce((a, b) => a + b, 0) / tPromVals.length).toFixed(2)) : undefined,
    tMin: tMinVals.length ? Math.min(...tMinVals) : undefined,
    tMax: tMaxVals.length ? Math.max(...tMaxVals) : undefined,
  };
};

const sameMetric = (a: unknown, b: unknown): boolean | null => {
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na === undefined || nb === undefined) return null;
  return Math.abs(na - nb) <= 0.01;
};

const looksLikeLoadPhasesInsteadOfStress = (svc: any): boolean => {
  const steps = Array.isArray(svc?.stressSteps) ? svc.stressSteps : [];
  if (steps.length === 0) return false;

  const summary = svc?.stressSummary ?? deriveStressSummary(steps) ?? steps[steps.length - 1];
  const load = svc?.loadResult;
  if (!summary || !load) return false;

  const checks = [
    sameMetric(summary.uvc, load.uvc),
    sameMetric(summary.trx, load.trx),
    sameMetric(summary.asegurados, load.asegurados),
    sameMetric(summary.tProm, load.tProm),
    sameMetric(summary.tMin, load.tMin),
    sameMetric(summary.tMax, load.tMax),
  ].filter((v): v is boolean => v !== null);

  return checks.length >= 4 && checks.every(Boolean);
};

const buildLoadAnalysis = (svc: any): string => {
  const c = svc?.criteria ?? {};
  const r = svc?.loadResult ?? {};

  const responseTimeMaxMin = toNumber(c.responseTimeMaxMin);
  const tProm = toNumber(r.tProm);
  const tMin = toNumber(r.tMin);
  const tMax = toNumber(r.tMax);
  const trx = toNumber(r.trx);
  const uvc = toNumber(r.uvc);
  const asegurados = toNumber(r.asegurados);
  const maxErrorRate = toNumber(c.maxErrorRate);
  const trxHrPrdPico = toNumber(c.trxHrPrdPico);

  const durationText = String(r.duration ?? "").trim() || "N/D";
  const durationMin = parseDurationMinutes(durationText);
  const throughputReal = trx !== undefined && durationMin && durationMin > 0 ? (trx / durationMin) * 60 : undefined;

  const uvcEsperado = trxHrPrdPico !== undefined && responseTimeMaxMin !== undefined
    ? Math.round((trxHrPrdPico * responseTimeMaxMin) / 60)
    : undefined;
  const aseguradosSla = extractMaxAsegurados(c.responseTimeDesc);

  const errorRateText = String(r.errorRate ?? "0").trim() || "0";
  const errorRateNum = toNumber(errorRateText.replace("%", "")) ?? 0;

  const tiempoConforme = (tProm !== undefined && responseTimeMaxMin !== undefined && tProm > responseTimeMaxMin)
    ? `☑ Conforme : Si bien es ligeramente superior al máximo del SLA productivo, se considera conforme porque se ejecutó en entorno pre productivo, considerando una ejecución con ${formatNumber(uvc, 0)} usuarios concurrentes${uvcEsperado !== undefined ? ` que es mayor a los ${formatNumber(uvcEsperado, 0)} esperados` : ""}.`
    : `☑ Conforme : El tiempo de respuesta obtenido de ${formatNumber(tProm)} min está dentro del máximo del SLA productivo.`;

  const errorConforme = (maxErrorRate !== undefined && errorRateNum > maxErrorRate)
    ? "☒ No Conforme : Se superó el máximo de error permitido."
    : "☑ Conforme : No se presentaron errores en la ejecución.";

  return [
    `Tiempo Rpta Esperado: ${formatNumber(responseTimeMaxMin)} min max`,
    `Tiempo Rpta Obtenido: ${formatNumber(tProm)} min`,
    tiempoConforme,
    `% Error esperado: ${formatNumber(maxErrorRate)}% max`,
    `% Error obtenido: ${errorRateText}`,
    errorConforme,
    "",
    `Duración: ${durationText}`,
    `Throughput real: ${formatNumber(trx, 0)} trx / ${durationText} x 60 min / hs = ${formatNumber(throughputReal)} trx/hr`,
    `No alcanza el pico (${formatNumber(trxHrPrdPico)} trx/hr) debido a la variabilidad en los tiempos de respuesta observados (${formatNumber(tMin)} min - ${formatNumber(tMax)} min), lo que reduce el throughput efectivo durante la ejecución.`,
    "",
    "Considerar que el throughput de producción es referencial y el throughput medido ha sido en entorno pre productivo.",
    "",
    `Se entiende que si bien no son ${formatNumber(aseguradosSla, 0)} asegurados con los que se prueba, igual ${formatNumber(asegurados, 0)} está dentro del rango aceptable. Y también las pruebas de carga se realizan entre 30 a 60 min, ${durationText} es aceptable.`,
  ].join("\n");
};

const buildStressAnalysis = (svc: any): string => {
  const steps = Array.isArray(svc?.stressSteps) ? svc.stressSteps : [];
  if (steps.length === 0) return "";

  const responseTimeMaxMin = toNumber(svc?.criteria?.responseTimeMaxMin);
  const firstOutIndex = responseTimeMaxMin !== undefined
    ? steps.findIndex((step: any) => {
      const tProm = toNumber(step?.tProm);
      return tProm !== undefined && tProm > responseTimeMaxMin;
    })
    : -1;

  const splitIndex = firstOutIndex >= 0 ? firstOutIndex : (steps.length > 1 ? 1 : 0);
  const untilUvc = toNumber(steps[Math.max(0, splitIndex - 1)]?.uvc) ?? toNumber(steps[0]?.uvc);
  const fromUvc = toNumber(steps[splitIndex]?.uvc) ?? untilUvc;

  return [
    `El servicio mantiene tiempos dentro del SLA hasta ${formatNumber(untilUvc, 0)} usuarios concurrentes, mientras que a partir de ${formatNumber(fromUvc, 0)} se observa un aumento considerable en los tiempos de respuesta.`,
    "",
    `Evidenciando que el punto de inicio de degradación se observa alrededor de ${formatNumber(fromUvc, 0)} usuarios concurrentes.`,
  ].join("\n");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { pdfBase64 } = await req.json();
    if (!pdfBase64) {
      return new Response(JSON.stringify({ error: "pdfBase64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Analiza este informe de pruebas de rendimiento y extrae TODA la información estructurada.

IMPORTANTE: Solo extrae información de los procesos ASÍNCRONOS. Si el informe contiene tanto procesos síncronos como asíncronos para el mismo servicio/path, SOLO extrae el asíncrono.

Para CADA servicio/path asíncrono encontrado, extrae:

1. **Criterios de aceptación** (de las tablas de criterios del informe):
   - process: tipo de proceso (siempre "Asíncrono" ya que solo extraemos estos)
   - path: el endpoint/path del servicio
   - responseTimeDesc: descripción textual completa del tiempo de respuesta (ej: "De 1 a 500 asegurados = 1 a 2 minutos")
   - responseTimeMaxMin: el valor MÁXIMO del tiempo de respuesta aplicable en MINUTOS. Si hay rangos, selecciona el máximo del rango que corresponda según los usuarios/asegurados usados en las pruebas. Por ejemplo si dice "De 1 a 500 asegurados = 1 a 2 min" y se probó con 200 asegurados (que está en ese rango), el max es 2.
   - userHrPrdNormal: usuarios por hora en PRD carga normal
   - trxDayPrdNormal: transacciones por día PRD carga normal
   - trxHrPrdPico: transacciones por hora PRD pico
   - maxErrorRate: porcentaje máximo de error aceptado (número, ej: 1 para 1%)

2. **Resultados de Carga** (SOLO los valores finales/resumen del proceso asíncrono, NO los tramos intermedios):
   - process: "Asíncrono" o "Asíncrona"
   - uvc: usuarios virtuales concurrentes
   - trx: transacciones totales
   - asegurados: número de asegurados/registros usados
   - tProm: tiempo de respuesta promedio en minutos (convertir si está en segundos)
   - tMin: tiempo de respuesta mínimo en minutos
   - tMax: tiempo de respuesta máximo en minutos
   - errorRate: tasa de error (ej: "0.0%")
   - errors: número de errores
   - tps: transacciones por segundo (throughput)
   - duration: duración de la prueba
   - date: fecha de la prueba (formato DD/MM/YYYY)

3. **Resultados de Estrés** (SOLO si existe sección explícita de estrés en el informe):
   - hasStressSection: true SOLO cuando el informe menciona explícitamente una sección tipo "Pruebas de Estrés", "Stress" o equivalente.
   - Si NO existe sección explícita de estrés, devuelve obligatoriamente:
     - hasStressSection: false
     - stressSteps: []
     - stressSummary: null

   Para casos con hasStressSection=true, extrae TODOS los tramos/escalones de usuarios del proceso asíncrono (SIN incluir la fila de Total/Resumen):
   - uvc: usuarios virtuales concurrentes de ese tramo
   - trx: transacciones
   - asegurados: registros
   - tProm: tiempo respuesta promedio en minutos
   - tMin: tiempo respuesta mínimo en minutos
   - tMax: tiempo respuesta máximo en minutos

   Además, extrae por separado la fila de **Total/Resumen** del informe como "stressSummary" con los mismos campos (uvc, trx, asegurados, tProm, tMin, tMax). Esta fila tiene valores agregados/totales que pueden ser DIFERENTES a la última fila de tramos individuales. Extraerla exactamente como aparece en el informe.

4. **Análisis** (TODO va en un solo campo por sección):

   "loadAnalysis" - Genera TODO el análisis de carga en este único campo, con esta estructura y tono exacto (reemplaza los valores con los datos reales del informe):
   "Para la validación asíncrona, el proceso inicia con la invocación del servicio de [nombre del servicio], el cual genera un ID de trabajo utilizado posteriormente para consultar el estado de procesamiento hasta alcanzar el estado [estado final] (\"Terminado\").
   El proceso asíncrono, evaluado bajo un escenario de [X] asegurados y [Y] usuarios concurrentes, registró un tiempo de respuesta promedio de [tProm] minutos y un tiempo máximo de [tMax] minutos. Estos valores se mantienen dentro de los criterios de aceptación establecidos para el proceso ([rango de tiempo] en condiciones promedio).
   Asimismo, se observa una tendencia de incremento proporcional de los tiempos de respuesta en función del aumento de la concurrencia y del volumen de procesamiento.
   Se procesaron [trx] transacciones en el escenario con [asegurados] asegurados y [uvc] usuarios concurrentes, manteniendo un comportamiento estable.
   Tiempo Rpta Esperado: [responseTimeMaxMin] min max
   Tiempo Rpta Obtenido: [tProm] min.
   ☑ Conforme - El tiempo de respuesta obtenido de [tProm] minutos está dentro del rango aceptable de [rango] minutos con [asegurados] asegurados, cumple el SLA del proceso.
   % Error esperado: [maxErrorRate]% max
   % Error obtenido: [errorRate]%
   ☑ Conforme : No se presentan errores en la ejecución.
   Duración: [duration]
   Throughput real: [trx] trx / [duration] = [cálculo] trx/hr
   No alcanza al pico ([trxHrPrdPico] trx/hr) debido a la variabilidad en los tiempos de respuesta observados ([tMin] min - [tMax] min), lo que reduce el throughput efectivo durante la ejecución.
   Considerar que el throughput de producción es referencial y el throughput medido ha sido en entorno pre productivo.
   Se entiende que si bien no son [asegurados SLA] asegurados con los que se prueba, igual [asegurados probados] está dentro del rango aceptable. Y también las pruebas de carga se realizan entre [rango de duración aceptable]."

   "loadComments" - Dejar como cadena VACÍA "". NO generes nada aquí.

   "stressAnalysis" - Todo el análisis de estrés en este campo:
   "El servicio mantiene tiempos dentro del SLA hasta [X] usuarios concurrentes, mientras que a partir de [Y] se observa un aumento considerable en los tiempos de respuesta.
   Evidenciando que el punto de inicio de degradación se observa alrededor de [Z] usuarios concurrentes.
   Se evidenció un aumento progresivo en los tiempos de respuesta conforme incrementó la cantidad de usuarios concurrentes, lo que demuestra el impacto directo de la carga en la latencia del sistema.
   En las pruebas con [asegurados] asegurados, el tiempo promedio pasó de [tProm menor] minutos con [uvc menor] usuarios un máximo de [tMax mayor] minutos, lo que confirma que el servicio presenta degradación progresiva bajo condiciones de mayor carga.
   En el escenario con [asegurados] asegurados y [uvc mayor] usuarios, se registraron [trx] transacciones completadas, evidenciando que a medida que aumenta la cantidad de usuarios y el volumen de datos procesados, el número de transacciones exitosas disminuye, lo que sugiere una limitación en la capacidad del sistema para sostener altos niveles de concurrencia."

   "stressComments" - Dejar como cadena VACÍA "". NO generes nada aquí.

IMPORTANTE: Adapta los valores reales del informe en cada campo. Los análisis y comentarios deben reflejar exactamente los datos numéricos extraídos.

Responde SOLO con un JSON válido con esta estructura exacta:
{
  "services": [
    {
      "criteria": {
        "process": "string",
        "path": "string",
        "responseTimeDesc": "string",
        "responseTimeMaxMin": number,
        "userHrPrdNormal": number_or_null,
        "trxDayPrdNormal": number_or_null,
        "trxHrPrdPico": number_or_null,
        "maxErrorRate": number_or_null
      },
      "loadResult": {
        "process": "string",
        "uvc": number_or_null,
        "trx": number_or_null,
        "asegurados": number_or_null,
        "tProm": number_or_null,
        "tMin": number_or_null,
        "tMax": number_or_null,
        "errorRate": "string_or_null",
        "errors": number_or_null,
        "tps": number_or_null,
        "duration": "string_or_null",
        "date": "string_or_null"
      },
      "hasStressSection": boolean,
      "stressSteps": [
        {
          "uvc": number,
          "trx": number,
          "asegurados": number,
          "tProm": number,
          "tMin": number,
          "tMax": number
        }
      ],
      "stressSummary": {
        "uvc": number,
        "trx": number,
        "asegurados": number,
        "tProm": number,
        "tMin": number,
        "tMax": number
      } | null,
      "loadAnalysis": "string",
      "loadComments": "string",
      "stressAnalysis": "string",
      "stressComments": "string"
    }
  ]
}

No incluyas explicaciones, solo el JSON.`;

    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, intente de nuevo en unos segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `AI Gateway error [${response.status}]` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content ?? "";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "Could not parse AI response", raw: content }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    for (const svc of (parsed.services ?? [])) {
      const stressSteps = Array.isArray(svc.stressSteps) ? svc.stressSteps : [];
      svc.stressSteps = stressSteps;
      svc.stressSummary = deriveStressSummary(stressSteps);

      svc.loadAnalysis = buildLoadAnalysis(svc);
      svc.loadComments = "";
      svc.stressAnalysis = buildStressAnalysis(svc);
      svc.stressComments = "";

      console.log(`[PDF] service path="${svc.criteria?.path}" process="${svc.criteria?.process}"`);
      console.log(`[PDF]   load: tProm=${svc.loadResult?.tProm} tMax=${svc.loadResult?.tMax}`);
      console.log(`[PDF]   stress steps: ${svc.stressSteps?.length ?? 0}`);
      console.log(`[PDF]   stressSummary: uvc=${svc.stressSummary?.uvc} trx=${svc.stressSummary?.trx} tProm=${svc.stressSummary?.tProm} tMin=${svc.stressSummary?.tMin} tMax=${svc.stressSummary?.tMax}`);
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
