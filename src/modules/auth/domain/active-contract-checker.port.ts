/**
 * Puerto hacia el contexto de Contratos: ¿tiene el usuario un contrato
 * activo vigente hoy? Se define aquí para que Auth no dependa del módulo de
 * contratos; la implementación vive en infraestructura.
 */
export abstract class ActiveContractChecker {
  abstract hasActiveContract(userId: number): Promise<boolean>;
}
