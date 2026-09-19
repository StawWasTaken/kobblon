/**
 * How big an ad is.
 *
 * These were part of the 2D page format, which has gone. Ads outlived it:
 * they sit on real pages of the website now, so the sizes live on their own.
 */
export const AD_SIZES: Record<string, { w: number; h: number; label: string }> = {
  banner: { w: 728, h: 90, label: 'Banner, 728 by 90' },
  tall: { w: 160, h: 600, label: 'Tall, 160 by 600' },
  box: { w: 300, h: 250, label: 'Box, 300 by 250' },
}

/** The shapes a campaign can actually buy. */
export const BUYABLE_AD_SIZES = ['banner', 'tall'] as const
