import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

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

El informe puede contener uno o más servicios/paths. Para CADA servicio/path encontrado, extrae:

1. **Criterios de aceptación** (de las tablas de criterios del informe):
   - process: tipo de proceso ("Síncrono" o "Asíncrono")
   - path: el endpoint/path del servicio
   - responseTimeDesc: descripción textual completa del tiempo de respuesta (ej: "De 1 a 500 asegurados = 1 a 2 minutos")
   - responseTimeMaxMin: el valor MÁXIMO del tiempo de respuesta aplicable en MINUTOS. Si hay rangos, selecciona el máximo del rango que corresponda según los usuarios/asegurados usados en las pruebas. Por ejemplo si dice "De 1 a 500 asegurados = 1 a 2 min" y se probó con 200 asegurados (que está en ese rango), el max es 2.
   - userHrPrdNormal: usuarios por hora en PRD carga normal
   - trxDayPrdNormal: transacciones por día PRD carga normal
   - trxHrPrdPico: transacciones por hora PRD pico
   - maxErrorRate: porcentaje máximo de error aceptado (número, ej: 1 para 1%)

2. **Resultados de Carga** (SOLO los valores finales/resumen, NO los tramos intermedios):
   - process: tipo de proceso
   - uvc: usuarios virtuales concurrentes
   - trx: transacciones totales
   - asegurados: número de asegurados/registros usados
   - tProm: tiempo de respuesta promedio en segundos
   - tMin: tiempo de respuesta mínimo en segundos
   - tMax: tiempo de respuesta máximo en segundos
   - errorRate: tasa de error (ej: "0.0%")
   - errors: número de errores
   - tps: transacciones por segundo (throughput)
   - duration: duración de la prueba
   - date: fecha de la prueba (formato DD/MM/YYYY)

3. **Resultados de Estrés** (TODOS los tramos/escalones de usuarios, cada fila):
   Para cada tramo/escalón de usuarios concurrentes, extrae:
   - uvc: usuarios virtuales concurrentes de ese tramo
   - trx: transacciones
   - asegurados: registros
   - tProm: tiempo respuesta promedio en segundos
   - tMin: tiempo respuesta mínimo en segundos
   - tMax: tiempo respuesta máximo en segundos

4. **Análisis y Comentarios** (del texto de análisis/conclusiones del informe):
   - loadAnalysis: texto de análisis para pruebas de carga (copiar del informe)
   - loadComments: comentarios adicionales de carga (copiar del informe)
   - stressAnalysis: texto de análisis para pruebas de estrés (copiar del informe)
   - stressComments: comentarios adicionales de estrés (copiar del informe)

IMPORTANTE:
- Si hay procesos Síncronos y Asíncronos, crea un servicio separado para cada uno con el mismo path.
- Para Carga: solo extrae la fila FINAL/resumen, no los tramos intermedios.
- Para Estrés: extrae TODOS los tramos (cada nivel de usuarios concurrentes como fila separada).
- El análisis y comentarios son textos descriptivos del informe sobre los resultados.

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
      "loadAnalysis": "string_or_null",
      "loadComments": "string_or_null",
      "stressAnalysis": "string_or_null",
      "stressComments": "string_or_null"
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

    // Debug log
    for (const svc of (parsed.services ?? [])) {
      console.log(`[PDF] service path="${svc.criteria?.path}" process="${svc.criteria?.process}"`);
      console.log(`[PDF]   load: tProm=${svc.loadResult?.tProm} tMax=${svc.loadResult?.tMax}`);
      console.log(`[PDF]   stress steps: ${svc.stressSteps?.length ?? 0}`);
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
