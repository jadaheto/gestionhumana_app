/**
 * Fragmentos de texto representativos de lo que produce `pdftotext -layout`
 * sobre el reporte "LIQUIDACIÓN DE NOMINA", construidos a partir de las
 * expresiones regulares que espera el parser.
 */
export const TEXTO_NOMINA_DOS_EMPLEADOS = `
                         CAJA DE COMPENSACION FAMILIAR DE SUCRE
                               LIQUIDACIÓN DE NOMINA
Fecha Liquidación: 04/30/2026                    Dias Liquidados: 15
Periodo: 04/16/2026 A 04/30/2026                 Tipo de Nomina: 06 Colegio
Fecha de Impresión: 05/02/2026
CONCEPTO                              DIV.   CC          CANTIDAD        VALOR     FACTOR  APLICA

Codigo Empleado: 1102879310-2   Empleado: PEREZ GOMEZ JUAN CARLOS   Documento N°: 45871
Cargo Empleado : DOCENTE PRIMARIA                Sueldo Base : $ 2,500,000.00
Salario - 001   EDUCACION Centro-01                 15.00      1,250,000.00     1.00   Si
Auxilio Transporte - 010                            15.00        100,000.00     1.00   Si
Descuento Salud - 410                                1.00        (54,000.00)    4.00   No
Descuento Pensión Colpensiones   - 416               1.00        (54,000.00)    4.00   No
NETO A PAGAR -----> 1,242,000.00

Codigo Empleado: 64578123   Empleado: LOPEZ MARTINEZ ANA MARIA   Documento N°: 45872
Cargo Empleado : COORDINADOR ACADEMICO           Sueldo Base : $ 3,000,000.00
Salario - 001   EDUCACION Centro-01                 15.00      1,500,000.00     1.00   Si
                                                                        Pagina 1 de 2
                         CAJA DE COMPENSACION FAMILIAR DE SUCRE
                               LIQUIDACIÓN DE NOMINA
CONCEPTO                              DIV.   CC          CANTIDAD        VALOR     FACTOR  APLICA
Codigo Empleado: 64578123   Empleado: LOPEZ MARTINEZ ANA MARIA   Documento N°: 45872
Bonificación - 020                                   1.00        200,000.00     1.00   Si
Descuento Salud - 410                                1.00        (60,000.00)    4.00   No
Descuento Pensión Porvenir - 417                     1.00        (60,000.00)    4.00   No
Retención Fuente                                     1.00        (10,000.00)    1.00   No
NETO A PAGAR -----> 1,570,000.00

TOTAL LIQUIDADO ------> 2,812,000.00
TOTAL EMPLEADOS LIQUIDADOS : 2
CALLE 25 No 20-15 Sincelejo                                             Pagina 2 de 2
`;

/** Un empleado cuyo neto del PDF no cuadra con sus conceptos. */
export const TEXTO_NOMINA_DESCUADRADA = `
Periodo: 04/01/2026 A 04/15/2026   Tipo de Nomina: 02 CAMPANOS
Codigo Empleado: 123456   Empleado: RUIZ PEDRO   Documento N°: 1
Cargo Empleado : AUXILIAR   Sueldo Base : 1.300.000,00
Salario - 001   ADMINISTRATIVA Centro-02   15.00   650.000,00   1.00   Si
NETO A PAGAR -----> 700.000,00
TOTAL LIQUIDADO ------> 999.999,00
TOTAL EMPLEADOS LIQUIDADOS : 3
`;
