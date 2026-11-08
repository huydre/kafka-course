import { loadFont as loadVietnam } from '@remotion/google-fonts/BeVietnamPro'
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono'

/* Loaded through Remotion so rendering waits for the fonts; Vietnamese subset is required for diacritics. */
export const { fontFamily: SANS } = loadVietnam('normal', { weights: ['400', '500', '600', '700', '800'], subsets: ['latin', 'vietnamese'] })
export const { fontFamily: MONO } = loadMono('normal', { weights: ['500', '700'], subsets: ['latin'] })
