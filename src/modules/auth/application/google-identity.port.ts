/** Perfil que Google entrega tras el ingreso. */
export interface GoogleProfile {
  email: string;
  emailVerified: boolean;
  name: string | null;
}

/**
 * Puerto del proveedor de identidad de Google (OAuth 2.0 con código de autorización).
 * El `state` viaja firmado para evitar CSRF y conservar la URL de retorno.
 */
export abstract class GoogleIdentityProvider {
  abstract isEnabled(): boolean;
  /** Dominio de Google Workspace permitido (vacío = cualquiera). */
  abstract workspaceDomain(): string;
  abstract authorizationUrl(returnUrl?: string): Promise<string>;
  /** Verifica el `state` y devuelve la URL de retorno que traía. */
  abstract readState(state: string): Promise<{ returnUrl: string }>;
  abstract profileFromCode(code: string): Promise<GoogleProfile>;
}
