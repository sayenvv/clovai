import { appConfigSchema } from '@/schemas/config.schema'
import type { AppConfig } from '@/types/config'
import navbar from '../../config/navbar.json'
import megaMenu from '../../config/mega-menu.json'
import footer from '../../config/footer.json'
import theme from '../../config/theme.json'
import landingPage from '../../config/landing-page.json'

/**
 * The default configuration is assembled from the JSON modules in the
 * root-level `config/` folder (navbar, mega menu, footer, theme, pages)
 * and validated at startup so a malformed module fails loudly in development.
 */
export const defaultAppConfig: AppConfig = appConfigSchema.parse({
  meta: {
    name: 'Eleven Nodes Default',
    version: '1.0.0',
    configBundleVersion: 7,
    description: 'Default Eleven Nodes platform configuration assembled from JSON modules.',
  },
  theme,
  navbar,
  megaMenu,
  footer,
  pages: [landingPage],
})
