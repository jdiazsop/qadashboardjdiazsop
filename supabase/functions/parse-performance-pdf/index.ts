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

3. **Resultados de Estrés** (TODOS los tramos/escalones de usuarios del proceso asíncrono):
   Para cada tramo/escalón de usuarios concurrentes (SIN incluir la fila de Total/Resumen), extrae:
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
      },
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
