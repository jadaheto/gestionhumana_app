const CHARLA =
  /^(hola|buen[oa]s?( d[ií]as| tardes| noches)?|gracias|muchas gracias|ok|vale|listo|perfecto|adi[oó]s|chao|hasta luego|qu[ée] puedes hacer|qu[ée] sabes hacer|ayuda|help|qui[ée]n eres|c[oó]mo funcionas)[\s!.?¡¿]*$/u;

/** Saludos, agradecimientos y preguntas sobre el propio asistente no requieren consultar la base. */
export function esCharla(pregunta: string): boolean {
  const q = pregunta.trim().toLowerCase();
  return q.length <= 3 || CHARLA.test(q);
}
