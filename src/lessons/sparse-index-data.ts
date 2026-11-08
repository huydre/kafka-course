/* Ten messages of different byte sizes in one segment. Varying sizes are the whole reason an index exists. */
export const SIZES = [120, 340, 90, 260, 180, 400, 150, 220, 110, 300]
/** Byte position where each message starts. */
export const POS = SIZES.map((_, i) => SIZES.slice(0, i).reduce((a, b) => a + b, 0))
export const TOTAL = SIZES.reduce((a, b) => a + b, 0)
