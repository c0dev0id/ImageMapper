import { describe, expect, it } from 'vitest'
import { decodePolyline } from './polyline.ts'

describe('decodePolyline', () => {
  it('decodes the reference example of the encoding (precision 5)', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5)).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ])
  })

  it('decodes an OSRM polyline6 geometry', () => {
    // routing.openstreetmap.de, bike, Marienplatz in Munich; the same request with
    // geometries=geojson returns 55 points from [11.575513, 48.137427] to [11.580011, 48.139027].
    const points = decodePolyline('elayzAqloaUPqAhEy[vB|@G^]x@_ArGCz@x@ZnAsCxBz@o@rEFe@Hk@}EmBsB|OcA`IoHjDeTgHkScGuCsB_Ba@MjAEf@Ed@Gv@z@Xh@yDz@VhEs[xBmPn@}E|BePCA`AyGLoCc@Ya@GkHw@aFyByNmF{Cy@{NqDnFgk@nCa]ZwAp@}C`HgZl@iC^eB|@_EwSoWy@eAsO_Mn@}F')
    expect(points).toHaveLength(55)
    expect(points[0]).toEqual([11.575513, 48.137427])
    expect(points.at(-1)).toEqual([11.580011, 48.139027])
  })

  it('returns no points for an empty string', () => {
    expect(decodePolyline('')).toEqual([])
  })
})
