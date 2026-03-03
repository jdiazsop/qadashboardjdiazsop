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

    const prompt = `Analiza este informe de pruebas de rendimiento (performance) y extrae los resultados de cada tipo de prueba encontrado (puede ser: Prueba de carga, Prueba de estrés, u otros tipos).

Para CADA tipo de prueba encontrado, extrae:
- type: tipo de prueba (ej: "Carga", "Estrés")
- startDate: fecha de inicio (formato YYYY-MM-DD si es posible)
- trx: número de transacciones (TRX)
- simulatedUsers: usuarios simulados (ej: "hasta 10 usuarios")
- duration: duración (ej: "30 minutos")
- errors: número de errores
- errorRate: porcentaje de error (ej: "0.0%")
- responseTimeAvg: tiempo de respuesta promedio en segundos
- responseTimeMin: tiempo de respuesta mínimo en segundos
- responseTimeMax: tiempo de respuesta máximo en segundos
- tps: transacciones por segundo
- status: estado final (ej: "CONFORME", "NO CONFORME")

Responde SOLO con un JSON válido con esta estructura exacta:
{
  "results": [
    {
      "type": "string",
      "startDate": "string or null",
      "trx": number_or_null,
      "simulatedUsers": "string or null",
      "duration": "string or null",
      "errors": number_or_null,
      "errorRate": "string or null",
      "responseTimeAvg": number_or_null,
      "responseTimeMin": number_or_null,
      "responseTimeMax": number_or_null,
      "tps": number_or_null,
      "status": "string or null"
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
      return new Response(JSON.stringify({ error: `AI Gateway error [${response.status}]` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content ?? "";

    // Extract JSON from response (may be wrapped in markdown code block)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "Could not parse AI response", raw: content }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(jsonMatch[0]);

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
