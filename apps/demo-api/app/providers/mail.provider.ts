import { createMailProvider } from '@framework/mail';
import type { AppConfig } from '../../config';

/**
 * Outbound mail (`MAILER` and `MAIL_TRANSPORT`) from the `mail` section:
 * console transport by default, `memory` for test suites.
 */
export const mailProvider = createMailProvider<AppConfig>();
