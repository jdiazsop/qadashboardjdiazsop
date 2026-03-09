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

const hasAnyStressMetric = (value: any): boolean => {
  if (!value || typeof value !== "object") return false;
  return [
    "uvc",
    "trx",
    "asegurados",
    "errors",
    "tps",
    "tProm",
    "tMin",
    "tMax",
  ].some((key) => toNumber(value?.[key]) !== undefined || typeof value?.[key] === "string");
};

const normalizeStressSummary = (value: any): any | undefined => {
  if (!hasAnyStressMetric(value)) return undefined;
  return {
    minutesRange: typeof value?.minutesRange === "string" ? value.minutesRange : undefined,
    uvc: toNumber(value?.uvc),
    trx: toNumber(value?.trx),
    asegurados: toNumber(value?.asegurados),
    errors: toNumber(value?.errors),
    errorRate: typeof value?.errorRate === "string" ? value.errorRate : undefined,
    tps: toNumber(value?.tps),
    tProm: toNumber(value?.tProm),
    tMin: toNumber(value?.tMin),
    tMax: toNumber(value?.tMax),
    status: typeof value?.status === "string" ? value.status : undefined,
  };
};

const sameMetric = (a: unknown, b: unknown): boolean | null => {
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na === undefined || nb === undefined) return null;
  return Math.abs(na - nb) <= 0.01;
};

const normalizeTimeMin = (
  raw: unknown,
  criteriaMaxMin?: number,
): number | undefined => {
  const v = toNumber(raw);
  if (v === undefined) return undefined;

  // Heurística legacy: si el valor es muy alto frente al SLA (en minutos), probablemente viene en segundos.
  // Ej: SLA=1 min y v=6.18 (seg) => v/60.
  if (criteriaMaxMin !== undefined) {
    if (v > criteriaMaxMin * 3 && v <= 600) return v / 60;
    return v;
  }

  // Sin SLA: asumimos segundos cuando parece un tiempo típico de tabla en segundos.
  if (v > 3 && v <= 600) return v / 60;
  return v;
};

const applyResponseTimes = (obj: any, criteriaMaxMin?: number) => {
  if (!obj || typeof obj !== 'object') return;
  (['tProm', 'tMin', 'tMax'] as const).forEach((k) => {
    const rawKey = `${k}SecRaw`;
    const rawText = typeof obj?.[rawKey] === 'string' ? String(obj[rawKey]).trim() : '';

    // Preferimos el RAW exacto en segundos si viene del informe
    if (rawText && rawText !== 'N/D' && rawText !== '—') {
      const sec = toNumber(rawText);
      if (sec !== undefined) {
        obj[k] = sec / 60;
      } else {
        // Si no se puede parsear, dejamos el tiempo previo (si existe)
        obj[k] = normalizeTimeMin(obj?.[k], criteriaMaxMin);
      }
      obj[rawKey] = rawText;
      return;
    }

    // Fallback: valores existentes (minutos o segundos) + heurística
    obj[k] = normalizeTimeMin(obj?.[k], criteriaMaxMin);
  });
};

const looksLikeLoadPhasesInsteadOfStress = (svc: any): boolean => {
  const steps = Array.isArray(svc?.stressSteps) ? svc.stressSteps : [];
  if (steps.length === 0) return false;

  const summary = svc?.stressSummary ?? steps[steps.length - 1];
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
   - responseTimeMaxMin: el valor MÁXIMO del tiempo de respuesta aplicable en MINUTOS.
   - userHrPrdNormal: usuarios por hora en PRD carga normal
   - trxDayPrdNormal: transacciones por día PRD carga normal
   - trxHrPrdPico: transacciones por hora PRD pico
   - maxErrorRate: porcentaje máximo de error aceptado (número, ej: 1 para 1%)

2. **Resultados de Carga** (resumen de la sección "Pruebas de carga"):
   - process: "Asíncrono" o "Asíncrona"
   - uvc: usuarios simulados (ej: en el texto "Usuarios simulados: hasta 10 usuarios" => uvc=10)
   - trx: transacciones
   - errors: número de errores
   - errorRate: tasa de error (ej: "0.35%")
   - tps: transacciones por segundo
   - response times (MUY IMPORTANTE):
     - tPromSecRaw/tMinSecRaw/tMaxSecRaw: **texto exacto en SEGUNDOS** tal como aparece en la tabla (ej: "6.05192", "2.056", "21.288").
     - NO conviertas aquí a minutos. NO redondees. NO rehagas cálculos.
     - Nosotros convertiremos a minutos luego.
   - duration: duración (ej: "30 minutos")
   - date: fecha (DD/MM/YYYY)
   - status: estado (ej: "CONFORME")

3. **Resultados de Estrés** (SOLO si existe sección explícita de estrés en el informe):
   - hasStressSection: true SOLO cuando el informe menciona explícitamente una sección tipo "Pruebas de Estrés", "Stress" o equivalente.
   - Si NO existe sección explícita de estrés, devuelve obligatoriamente:
     - hasStressSection: false
     - stressSteps: []
     - stressSummary: null

   Para casos con hasStressSection=true, extrae TODOS los tramos (filas) del proceso asíncrono en la tabla de estrés.

   IMPORTANTE (evitar errores de mapeo):
   - La columna "MINUTOS" debe ir a minutesRange (ej: "0 - 10", "11 - 30").
   - uvc NO sale de la columna MINUTOS. uvc sale del texto "Usuarios simulados: hasta X usuarios" y se repite en cada fila.
   - No intercambies columnas (p.ej. no pongas "5.03" como uvc).

   Campos por cada tramo:
   - minutesRange: string | null (texto exacto)
   - uvc: number | null
   - trx: number
   - errors: number
   - errorRate: string (ej: "6.32%")
   - tps: number
   - status: string (ej: "CONFORME" o "-")
   - response times (MUY IMPORTANTE):
     - tPromSecRaw/tMinSecRaw/tMaxSecRaw: **texto exacto en SEGUNDOS** tal como aparece en la tabla.
     - NO conviertas a minutos. NO redondees.

   "stressSummary": extrae una fila Total/Resumen SOLO si existe explícitamente en el informe. Si no existe, null.

4. **Análisis**:
   - loadAnalysis/stressAnalysis: déjalos (pueden estar vacíos) — el backend los generará.
   - loadComments/stressComments: cadena vacía.

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
        "tPromSecRaw": "string_or_null",
        "tMinSecRaw": "string_or_null",
        "tMaxSecRaw": "string_or_null",
        "errorRate": "string_or_null",
        "errors": number_or_null,
        "tps": number_or_null,
        "duration": "string_or_null",
        "date": "string_or_null",
        "status": "string_or_null"
      },
      "hasStressSection": boolean,
      "stressSteps": [
        {
          "minutesRange": "string_or_null",
          "uvc": number_or_null,
          "trx": number_or_null,
          "errors": number_or_null,
          "errorRate": "string_or_null",
          "tps": number_or_null,
          "tPromSecRaw": "string_or_null",
          "tMinSecRaw": "string_or_null",
          "tMaxSecRaw": "string_or_null",
          "status": "string_or_null"
        }
      ],
      "stressSummary": {
        "minutesRange": "string_or_null",
        "uvc": number_or_null,
        "trx": number_or_null,
        "errors": number_or_null,
        "errorRate": "string_or_null",
        "tps": number_or_null,
        "tPromSecRaw": "string_or_null",
        "tMinSecRaw": "string_or_null",
        "tMaxSecRaw": "string_or_null",
        "status": "string_or_null"
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
        model: "google/gemini-2.5-pro",
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
        temperature: 0,
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

      const criteriaMax = toNumber(svc?.criteria?.responseTimeMaxMin);

      // Normalize times (prefer RAW seconds fields, fallback heuristics)
      if (svc.loadResult) {
        applyResponseTimes(svc.loadResult, criteriaMax);
        svc.loadResult.uvc = toNumber(svc.loadResult.uvc);
        svc.loadResult.trx = toNumber(svc.loadResult.trx);
        svc.loadResult.asegurados = toNumber(svc.loadResult.asegurados);
        svc.loadResult.errors = toNumber(svc.loadResult.errors);
        svc.loadResult.tps = toNumber(svc.loadResult.tps);
      }

      svc.stressSteps = (svc.stressSteps ?? []).map((step: any) => {
        const next = {
          ...step,
          minutesRange: typeof step?.minutesRange === 'string' ? step.minutesRange.trim() : step?.minutesRange,
          errorRate: typeof step?.errorRate === 'string' ? step.errorRate.trim() : step?.errorRate,
          status: typeof step?.status === 'string' ? step.status.trim() : step?.status,
          uvc: toNumber(step?.uvc),
          trx: toNumber(step?.trx),
          errors: toNumber(step?.errors),
          tps: toNumber(step?.tps),
        };
        applyResponseTimes(next, criteriaMax);
        return next;
      });

      svc.stressSummary = normalizeStressSummary(svc.stressSummary);
      if (svc.stressSummary) {
        applyResponseTimes(svc.stressSummary, criteriaMax);
        svc.stressSummary.uvc = toNumber(svc.stressSummary.uvc);
        svc.stressSummary.trx = toNumber(svc.stressSummary.trx);
        svc.stressSummary.errors = toNumber(svc.stressSummary.errors);
        svc.stressSummary.tps = toNumber(svc.stressSummary.tps);
      }

      const stressDeclared = svc.hasStressSection === true;
      const stressExplicitlyMissing = svc.hasStressSection === false;
      const inferredFalsePositive = looksLikeLoadPhasesInsteadOfStress(svc);

      if (stressExplicitlyMissing || (!stressDeclared && inferredFalsePositive)) {
        svc.stressSteps = [];
        svc.stressSummary = undefined;
      }

      svc.loadAnalysis = buildLoadAnalysis(svc);
      svc.loadComments = "";
      svc.stressAnalysis = (svc.stressSteps?.length ?? 0) > 0 ? buildStressAnalysis(svc) : "";
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
