/** Contrato común de los casos de uso de la capa de aplicación. */
export interface UseCase<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>;
}
