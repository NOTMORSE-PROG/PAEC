declare module 'swagger-ui-react' {
  import { ComponentType } from 'react'

  interface SwaggerUIProps {
    url?: string
    spec?: object
    docExpansion?: 'list' | 'full' | 'none'
    defaultModelsExpandDepth?: number
    displayRequestDuration?: boolean
    filter?: boolean | string
    requestInterceptor?: (req: object) => object
    responseInterceptor?: (res: object) => object
    onComplete?: (system: object) => void
    plugins?: object[]
    supportedSubmitMethods?: string[]
    tryItOutEnabled?: boolean
    validatorUrl?: string | null
  }

  const SwaggerUI: ComponentType<SwaggerUIProps>
  export default SwaggerUI
}
